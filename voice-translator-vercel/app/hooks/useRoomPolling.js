'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { CONTEXTS, getLang, LIVE_TEXT_THROTTLE, TYPING_TIMEOUT, SPEAKING_TIMEOUT } from '../lib/constants.js';
import useRealtimeRoom from './useRealtimeRoom.js';

// ═══════════════════════════════════════════════════════════════
// POLLING_INTERVAL: With Supabase Realtime active, polling is just
// a safety net. We poll every 10s to catch anything missed.
// Without Realtime, we fall back to 2s polling (still better than 1s).
// ═══════════════════════════════════════════════════════════════
const REALTIME_FALLBACK_POLL = 10000;  // 10s when WebSocket is active
const LEGACY_POLL_INTERVAL = 2000;     // 2s fallback when no WebSocket

export default function useRoomPolling({
  prefsRef,
  myLangRef,
  roomInfoRef,
  queueAudio,
  getEffectiveToken
}) {
  const [roomId, setRoomId] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);
  const [partnerLiveText, setPartnerLiveText] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);

  const pollRef = useRef(null);
  const lastMsgRef = useRef(0);
  const liveTextTimerRef = useRef(null);
  const lastLiveTextRef = useRef('');
  const sentByMeRef = useRef(new Set());
  const pollErrorCountRef = useRef(0);
  const [pollError, setPollError] = useState(false);
  const roomSessionTokenRef = useRef(null);
  const verifiedNameRef = useRef(null);
  const isHostRef = useRef(false);

  // ── Helper: process incoming message (shared by realtime + polling) ──
  const processIncomingMessage = useCallback((msg) => {
    if (!msg || !msg.id) return;
    // Skip messages sent by me
    if (sentByMeRef.current.has(msg.id)) return;
    const myVerifiedName = verifiedNameRef.current || prefsRef.current.name;
    if (msg.sender === myVerifiedName) return;

    // Queue audio for the translation in MY language
    const myLang = myLangRef.current;
    let textToPlay = '';
    let speechLang = '';
    if (msg.translations && msg.translations[myLang]) {
      textToPlay = msg.translations[myLang];
      speechLang = getLang(myLang).speech;
    } else if (msg.translated) {
      textToPlay = msg.translated;
      speechLang = getLang(msg.targetLang).speech;
    }
    if (textToPlay && prefsRef.current.autoPlay) {
      queueAudio(textToPlay, speechLang, msg.id);
    }
  }, [prefsRef, myLangRef, queueAudio]);

  // ── Supabase Realtime handlers ──

  const handleRealtimeMessage = useCallback((message) => {
    setMessages(prev => {
      const ids = new Set(prev.map(m => m.id));
      if (ids.has(message.id)) return prev;
      return [...prev, message];
    });
    if (message.timestamp) {
      lastMsgRef.current = Math.max(lastMsgRef.current, message.timestamp);
    }
    processIncomingMessage(message);
  }, [processIncomingMessage]);

  const handleRealtimeSpeaking = useCallback((data) => {
    const myName = verifiedNameRef.current || prefsRef.current.name;
    if (data.name === myName) return;
    if (data.speaking !== undefined) {
      setPartnerSpeaking(data.speaking);
      if (data.liveText !== undefined) setPartnerLiveText(data.liveText);
      if (!data.speaking) setPartnerLiveText('');
    }
    if (data.typing !== undefined) {
      setPartnerTyping(data.typing);
    }
  }, [prefsRef]);

  const handleRealtimeMemberUpdate = useCallback((data) => {
    if (data.room) {
      setRoomInfo(data.room);
      setPartnerConnected(data.room.members.length >= 2);
      return;
    }

    if (data.members) {
      setRoomInfo(prev => prev ? { ...prev, members: data.members } : prev);
      setPartnerConnected(data.members.length >= 2);
      return;
    }

    // Handle langChange broadcast (payload: { action, name, lang })
    if (data.action === 'langChange' && data.name && data.lang) {
      setRoomInfo(prev => {
        if (!prev?.members) return prev;
        const members = prev.members.map((m) =>
          m.name === data.name ? { ...m, lang: data.lang } : m
        );
        setPartnerConnected(members.length >= 2);
        return { ...prev, members };
      });
    }
  }, []);

  const handleRealtimePresence = useCallback(() => {
    // Heartbeats confirm partner is still connected
    // The polling fallback handles full room state refresh
  }, []);

  // ── Supabase Realtime hook ──
  const {
    connected: realtimeConnected,
    subscribe: realtimeSubscribe,
    unsubscribe: realtimeUnsubscribe,
    broadcastMessage,
    broadcastSpeaking,
    broadcastMemberUpdate,
    broadcastHeartbeat,
  } = useRealtimeRoom({
    roomId,
    myName: verifiedNameRef.current || prefsRef.current?.name,
    onNewMessage: handleRealtimeMessage,
    onSpeakingChange: handleRealtimeSpeaking,
    onMemberUpdate: handleRealtimeMemberUpdate,
    onPresenceChange: handleRealtimePresence,
  });

  // ── Polling: safety-net when Realtime is active, primary when not ──

  const startPolling = useCallback((rid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    lastMsgRef.current = Date.now();
    pollErrorCountRef.current = 0;
    setPollError(false);

    // Subscribe to Supabase Realtime channel
    realtimeSubscribe(rid);

    const pollFn = async () => {
      try {
        const rstParam = roomSessionTokenRef.current ? `&rst=${encodeURIComponent(roomSessionTokenRef.current)}` : '';
        const nameParam = !roomSessionTokenRef.current ? `&name=${encodeURIComponent(prefsRef.current.name)}` : '';
        const mRes = await fetch(`/api/messages?room=${rid}${nameParam}&after=${lastMsgRef.current}${rstParam}`);
        if (mRes.ok) {
          const { messages: newMsgs } = await mRes.json();
          if (newMsgs && newMsgs.length > 0) {
            setMessages(prev => {
              const ids = new Set(prev.map(m => m.id));
              const fresh = newMsgs.filter(m => !ids.has(m.id));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
            lastMsgRef.current = Math.max(...newMsgs.map(m => m.timestamp));
            for (const msg of newMsgs) {
              processIncomingMessage(msg);
            }
          }
        }

        // Heartbeat (always needed to keep room alive and detect members)
        const heartbeatBody = { action: 'heartbeat', roomId: rid, roomSessionToken: roomSessionTokenRef.current };
        if (!roomSessionTokenRef.current) heartbeatBody.name = prefsRef.current.name;
        const rRes = await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(heartbeatBody)
        });
        if (rRes.ok) {
          const { room, verifiedName, isHost: hostFlag } = await rRes.json();
          if (verifiedName) verifiedNameRef.current = verifiedName;
          if (hostFlag !== undefined) isHostRef.current = hostFlag;
          setRoomInfo(room);
          setPartnerConnected(room.members.length >= 2);
          const myName = verifiedNameRef.current || prefsRef.current.name;
          const others = room.members.filter(m => m.name !== myName);
          // Only update speaking/typing from polling if Realtime is NOT connected
          // (Realtime delivers these in real-time, polling is just backup)
          if (!realtimeConnected) {
            const anyoneSpeaking = others.some(p => p.speaking && Date.now() - p.speakingAt < SPEAKING_TIMEOUT);
            const speakingPartner = others.find(p => p.speaking && Date.now() - p.speakingAt < SPEAKING_TIMEOUT);
            setPartnerSpeaking(anyoneSpeaking);
            setPartnerLiveText(speakingPartner?.liveText || '');
            setPartnerTyping(others.some(p => p.typing && Date.now() - (p.typingAt || 0) < TYPING_TIMEOUT));
          }
        }

        // Also broadcast heartbeat via Realtime
        broadcastHeartbeat(verifiedNameRef.current || prefsRef.current.name).catch(() => {});

        if (pollErrorCountRef.current > 0) {
          pollErrorCountRef.current = 0;
          setPollError(false);
        }
      } catch (e) {
        console.error('[Poll] error:', e);
        pollErrorCountRef.current++;
        if (pollErrorCountRef.current >= 3) {
          setPollError(true);
        }
      }
    };

    // Immediate first poll (don't wait for interval)
    pollFn();

    // Choose poll interval based on Realtime connection
    const interval = realtimeConnected ? REALTIME_FALLBACK_POLL : LEGACY_POLL_INTERVAL;
    pollRef.current = setInterval(pollFn, interval);
  }, [realtimeSubscribe, realtimeConnected, broadcastHeartbeat, processIncomingMessage]);

  // ── Adjust poll interval when realtime connects/disconnects ──
  const prevRealtimeRef = useRef(false);
  useEffect(() => {
    if (prevRealtimeRef.current !== realtimeConnected && roomId && pollRef.current) {
      // Re-start polling with new interval
      clearInterval(pollRef.current);
      const interval = realtimeConnected ? REALTIME_FALLBACK_POLL : LEGACY_POLL_INTERVAL;
      const pollFn = pollRef.current?.__fn;
      // Simple approach: restart polling
      startPolling(roomId);
      console.log(`[Poll] Interval adjusted to ${interval}ms (Realtime: ${realtimeConnected ? 'ON' : 'OFF'})`);
    }
    prevRealtimeRef.current = realtimeConnected;
  }, [realtimeConnected, roomId, startPolling]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (liveTextTimerRef.current) {
      clearTimeout(liveTextTimerRef.current);
      liveTextTimerRef.current = null;
    }
    realtimeUnsubscribe();
  }, [realtimeUnsubscribe]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // ── Speaking state: now also broadcasts via Realtime ──

  async function setSpeakingState(rid, speaking, liveText = null, typing = false) {
    // Broadcast instantly via Realtime (other clients see it immediately)
    broadcastSpeaking({
      name: verifiedNameRef.current || prefsRef.current.name,
      speaking,
      liveText,
      typing,
    });

    // Also persist to Redis (for polling fallback / new joiners)
    try {
      const body = {
        action: 'speaking',
        roomId: rid,
        roomSessionToken: roomSessionTokenRef.current,
        speaking, liveText, typing
      };
      if (!roomSessionTokenRef.current) body.name = prefsRef.current.name;
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch {}
  }

  function broadcastLiveText(text) {
    if (!roomId || text === lastLiveTextRef.current) return;
    lastLiveTextRef.current = text;
    if (liveTextTimerRef.current) return;
    liveTextTimerRef.current = setTimeout(() => {
      liveTextTimerRef.current = null;
      setSpeakingState(roomId, true, lastLiveTextRef.current);
    }, LIVE_TEXT_THROTTLE);
  }

  async function syncLangChange(newLang) {
    if (!roomId) return;
    // Broadcast lang change via Realtime
    broadcastMemberUpdate({
      action: 'langChange',
      name: verifiedNameRef.current || prefsRef.current.name,
      lang: newLang,
    }).catch(() => {});
    try {
      const body = {
        action: 'changeLang',
        roomId,
        roomSessionToken: roomSessionTokenRef.current,
        lang: newLang,
      };
      if (!roomSessionTokenRef.current) body.name = prefsRef.current.name;
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      console.error('[SyncLang] Error:', e);
    }
  }

  function sendTypingState(isTyping) {
    if (!roomId) return;
    // Broadcast instantly via Realtime
    broadcastSpeaking({
      name: verifiedNameRef.current || prefsRef.current.name,
      speaking: false,
      typing: isTyping,
    });
    // Also persist to Redis
    const body = {
      action: 'speaking',
      roomId,
      roomSessionToken: roomSessionTokenRef.current,
      speaking: false,
      typing: isTyping
    };
    if (!roomSessionTokenRef.current) body.name = prefsRef.current.name;
    fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => {});
  }

  async function handleCreateRoom(
    name, lang, mode, avatar, selectedContext, selectedMode,
    roomDescription, isTrial, isTopPro, userAccount
  ) {
    try {
      const ctxObj = CONTEXTS.find(c => c.id === selectedContext) || CONTEXTS[0];
      const currentTier = isTrial ? 'FREE' : isTopPro ? 'TOP PRO' : 'PRO';
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name, lang, mode, avatar,
          context: selectedContext,
          contextPrompt: ctxObj.prompt,
          description: roomDescription,
          hostTier: currentTier,
          hostEmail: userAccount?.email || null
        })
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      const { room, roomSessionToken: token } = data;
      if (token) roomSessionTokenRef.current = token;
      setRoomId(room.id);
      setRoomInfo(room);
      setMessages([]);
      setPartnerConnected(room.members.length >= 2);
      startPolling(room.id);
      return room;
    } catch (e) {
      throw e;
    }
  }

  async function handleJoinRoom(joinCode, name, lang, avatar) {
    if (!joinCode.trim()) return;
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          roomId: joinCode.trim().toUpperCase(),
          name, lang, avatar
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Room not found');
      }
      const data = await res.json();
      const { room, roomSessionToken: token } = data;
      if (token) roomSessionTokenRef.current = token;
      setRoomId(room.id);
      setRoomInfo(room);
      setMessages([]);
      setPartnerConnected(room.members.length >= 2);
      startPolling(room.id);

      // Broadcast member join via Realtime
      broadcastMemberUpdate({ room, action: 'join', name });

      return room;
    } catch (e) {
      throw e;
    }
  }

  function leaveRoom() {
    stopPolling();
    roomSessionTokenRef.current = null;
    verifiedNameRef.current = null;
    isHostRef.current = false;
    setRoomId(null);
    setRoomInfo(null);
    setMessages([]);
    setPartnerConnected(false);
    setPartnerSpeaking(false);
    setPartnerLiveText('');
    setPartnerTyping(false);
  }

  return {
    roomId,
    setRoomId,
    roomInfo,
    setRoomInfo,
    messages,
    setMessages,
    partnerConnected,
    partnerSpeaking,
    partnerLiveText,
    partnerTyping,
    pollError,
    realtimeConnected,
    startPolling,
    stopPolling,
    setSpeakingState,
    broadcastLiveText,
    sendTypingState,
    syncLangChange,
    handleCreateRoom,
    handleJoinRoom,
    leaveRoom,
    sentByMeRef,
    roomSessionTokenRef,
    verifiedNameRef,
    isHostRef,
    // Realtime broadcast functions (for use in useTranslationAPI)
    broadcastMessage,
    broadcastMemberUpdate,
    // P2P DataChannel: add incoming message (same logic as Realtime)
    addIncomingMessage: handleRealtimeMessage,
  };
}
