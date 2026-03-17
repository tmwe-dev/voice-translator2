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
  getEffectiveToken,
  onMessageReceived, // Callback when a new unique incoming message arrives (for conversation context)
}) {
  const [roomId, setRoomId] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);
  const [partnerLiveText, setPartnerLiveText] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);

  const pollRef = useRef(null);
  const pollFnRef = useRef(null);  // store pollFn so interval changes can reuse it
  const lastMsgRef = useRef(0);
  const liveTextTimerRef = useRef(null);
  const lastLiveTextRef = useRef('');
  const sentByMeRef = useRef(new Set());
  const pollErrorCountRef = useRef(0);
  const [pollError, setPollError] = useState(false);
  const roomSessionTokenRef = useRef(null);
  const verifiedNameRef = useRef(null);
  const isHostRef = useRef(false);

  // ── Callback ref for conversation context ──
  const onMessageReceivedRef = useRef(onMessageReceived);
  onMessageReceivedRef.current = onMessageReceived;

  // ── Unified dedup: track ALL message IDs that have been processed for TTS ──
  // This prevents TTS replay when polling replaces a temp message with a server version
  const processedForTTSRef = useRef(new Set());

  // ── Guard: track message IDs that have already been through processIncomingMessage ──
  // This prevents calling processIncomingMessage twice for the same message when both
  // P2P and Realtime deliver it. Without this, handleRealtimeMessage calls it unconditionally.
  const processedMsgIdsRef = useRef(new Set());

  // ── Helper: process incoming message (shared by realtime + polling + P2P) ──
  // ALWAYS checks content fingerprint to prevent TTS replay.
  // This handles: P2P + Realtime arriving ~50ms apart, and polling replacing temp with server ID.
  const processIncomingMessage = useCallback((msg) => {
    if (!msg || !msg.id) return;
    // Skip messages sent by me
    if (sentByMeRef.current.has(msg.id)) return;
    const myVerifiedName = verifiedNameRef.current || prefsRef.current.name;
    if (msg.sender === myVerifiedName) return;

    // ── Unified TTS dedup: check fingerprint BEFORE playing ──
    // Purpose: prevent TTS replay when the SAME message is delivered via multiple channels
    // (P2P ~50ms, Realtime ~100ms, Polling ~2-10s) — all with different IDs but same content.
    //
    // Uses sender + original text + coarse timestamp (30s window):
    // - Different channels for the SAME message arrive within seconds → same window → deduped
    // - Same person sending the SAME text again (e.g. "ok" twice) → different window → TTS plays
    // - Without the time window, "ok" sent twice would be blocked by the first fingerprint
    const timeWindow = Math.floor((msg.timestamp || Date.now()) / 30000); // 30-second buckets
    const contentFingerprint = `${msg.sender}|${msg.original}|${timeWindow}`;
    if (processedForTTSRef.current.has(contentFingerprint)) {
      return; // Already played TTS for this exact content in this time window
    }

    // Queue audio for the translation in MY language
    const myLang = myLangRef.current;
    let textToPlay = '';
    let speechLang = '';
    if (msg.translations && msg.translations[myLang]) {
      textToPlay = msg.translations[myLang];
      speechLang = getLang(myLang).speech;
    } else if (msg.sourceLang === myLang && msg.original) {
      textToPlay = msg.original;
      speechLang = getLang(myLang).speech;
    } else if (msg.targetLang === myLang && msg.translated) {
      textToPlay = msg.translated;
      speechLang = getLang(myLang).speech;
    }

    // IMPORTANT: Only add fingerprint when we actually play TTS.
    // Phase 1 messages arrive with NO translation → no TTS → don't add fingerprint.
    // Phase 2 update arrives WITH translation → TTS plays → add fingerprint.
    // This ensures Phase 2 isn't blocked by Phase 1's empty arrival.
    if (textToPlay && prefsRef.current.autoPlay) {
      processedForTTSRef.current.add(contentFingerprint);
      // LRU cap: prevent unbounded growth
      if (processedForTTSRef.current.size > 500) {
        const first = processedForTTSRef.current.values().next().value;
        processedForTTSRef.current.delete(first);
      }
      queueAudio(textToPlay, speechLang, msg.id);
    }

    // ── Feed incoming message to conversation context (knowledge base) ──
    if (onMessageReceivedRef.current && msg.original) {
      try {
        onMessageReceivedRef.current({
          sender: msg.sender,
          original: msg.original,
          translated: msg.translated || (msg.translations ? Object.values(msg.translations)[0] : null),
          sourceLang: msg.sourceLang,
          targetLang: msg.targetLang,
          timestamp: msg.timestamp || Date.now(),
        });
      } catch {}
    }
  }, [prefsRef, myLangRef, queueAudio]);

  // ── Supabase Realtime handlers ──

  const handleRealtimeMessage = useCallback((message) => {
    // ── ID-based guard: skip if already processed by another delivery channel ──
    // P2P and Realtime both call this function for the same message.
    // Without this guard, processIncomingMessage would be called twice.
    const alreadyProcessed = processedMsgIdsRef.current.has(message.id);
    if (!alreadyProcessed) {
      processedMsgIdsRef.current.add(message.id);
      // LRU cap
      if (processedMsgIdsRef.current.size > 500) {
        const first = processedMsgIdsRef.current.values().next().value;
        processedMsgIdsRef.current.delete(first);
      }
    }

    setMessages(prev => {
      // Dedup by ID
      const ids = new Set(prev.map(m => m.id));
      if (ids.has(message.id)) return prev;
      // Dedup: if a temp message (tmp_xxx) exists with same sender+original, replace it with server version
      const tempIdx = prev.findIndex(m =>
        m.id?.startsWith('tmp_') && m.sender === message.sender && m.original === message.original
      );
      if (tempIdx >= 0) {
        // Replace temp with server version, but MERGE translations to avoid
        // losing Phase 2 data that arrived before this poll.
        const tempMsg = prev[tempIdx];
        const updated = [...prev];
        if (sentByMeRef.current.has(tempMsg.id)) {
          sentByMeRef.current.add(message.id);
        }
        updated[tempIdx] = {
          ...message,
          translated: message.translated || tempMsg.translated,
          translations: message.translations || tempMsg.translations,
          targetLang: message.targetLang || tempMsg.targetLang,
          _replaced: true,
          _stableKey: tempMsg._stableKey || tempMsg.id,
        };
        return updated;
      }
      return [...prev, message];
    });
    if (message.timestamp) {
      lastMsgRef.current = Math.max(lastMsgRef.current, message.timestamp);
    }
    // Only call processIncomingMessage if this is the FIRST time we see this message ID
    if (!alreadyProcessed) {
      processIncomingMessage(message);
    }
  }, [processIncomingMessage]);

  // ── Handle translation update for an existing message (Phase 2) ──
  // When sender translates text after sending the original, this updates the message
  // and triggers TTS for the receiver.
  const handleMessageUpdate = useCallback((data) => {
    if (!data || !data.original) return;
    // ── Deterministic update ID: same content = same ID across P2P + Realtime ──
    // Previously used `update_${Date.now()}` which generated different IDs for each
    // delivery channel, defeating the message-ID dedup guard.
    const updateId = data.tempId || `update_${data.sender}|${data.original}`;

    // ── ID-based guard: skip if already processed by another delivery channel ──
    const alreadyProcessed = processedMsgIdsRef.current.has(updateId);
    if (!alreadyProcessed) {
      processedMsgIdsRef.current.add(updateId);
      if (processedMsgIdsRef.current.size > 500) {
        const first = processedMsgIdsRef.current.values().next().value;
        processedMsgIdsRef.current.delete(first);
      }
    }

    // Find the message by sender + original text (works for both temp and server IDs)
    setMessages(prev => {
      const idx = prev.findIndex(m => m.sender === data.sender && m.original === data.original);
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        translated: data.translated || updated[idx].translated,
        targetLang: data.targetLang || updated[idx].targetLang,
        translations: data.translations || updated[idx].translations,
      };
      return updated;
    });
    // Trigger TTS for the receiver ONLY on the first delivery channel
    if (!alreadyProcessed && (data.translated || data.translations)) {
      processIncomingMessage({
        id: updateId,
        sender: data.sender,
        original: data.original,
        translated: data.translated,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        translations: data.translations,
      });
    }
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
    broadcastMessageUpdate,
    broadcastSpeaking,
    broadcastMemberUpdate,
    broadcastHeartbeat,
  } = useRealtimeRoom({
    roomId,
    myName: verifiedNameRef.current || prefsRef.current?.name,
    onNewMessage: handleRealtimeMessage,
    onMessageUpdate: handleMessageUpdate,
    onSpeakingChange: handleRealtimeSpeaking,
    onMemberUpdate: handleRealtimeMemberUpdate,
    onPresenceChange: handleRealtimePresence,
  });

  // ── Polling: safety-net when Realtime is active, primary when not ──

  // Use a ref to read realtimeConnected inside pollFn without causing re-creation
  const realtimeConnectedRef = useRef(false);
  useEffect(() => { realtimeConnectedRef.current = realtimeConnected; }, [realtimeConnected]);

  const startPolling = useCallback((rid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    lastMsgRef.current = Date.now();
    pollErrorCountRef.current = 0;
    setPollError(false);

    // Subscribe to Supabase Realtime channel (only once on room join)
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
              let updated = [...prev];
              let changed = false;
              for (const m of newMsgs) {
                if (ids.has(m.id)) continue;
                // Replace temp message with server version (dedup broadcast vs poll)
                const tempIdx = updated.findIndex(t =>
                  t.id?.startsWith('tmp_') && t.sender === m.sender && t.original === m.original
                );
                if (tempIdx >= 0) {
                  // Mark server ID as "sent by me" if the temp was ours
                  const tempMsg = updated[tempIdx];
                  if (sentByMeRef.current.has(tempMsg.id)) {
                    sentByMeRef.current.add(m.id);
                  }
                  // MERGE: keep local translations if server doesn't have them yet
                  // (Phase 2 updateLocalMessage may have added them before this poll)
                  updated[tempIdx] = {
                    ...m,
                    translated: m.translated || tempMsg.translated,
                    translations: m.translations || tempMsg.translations,
                    targetLang: m.targetLang || tempMsg.targetLang,
                    _stableKey: tempMsg._stableKey || tempMsg.id,
                  };
                  changed = true;
                } else {
                  updated.push(m);
                  changed = true;
                }
              }
              return changed ? updated : prev;
            });
            lastMsgRef.current = Math.max(...newMsgs.map(m => m.timestamp));
            for (const msg of newMsgs) {
              // Guard: skip if this message ID was already processed via Realtime/P2P
              if (processedMsgIdsRef.current.has(msg.id)) continue;
              processedMsgIdsRef.current.add(msg.id);
              if (processedMsgIdsRef.current.size > 500) {
                const first = processedMsgIdsRef.current.values().next().value;
                processedMsgIdsRef.current.delete(first);
              }
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
          if (!realtimeConnectedRef.current) {
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

    // Save pollFn so the interval-adjustment effect can reuse it
    pollFnRef.current = pollFn;

    // Immediate first poll (don't wait for interval)
    pollFn();

    // Start with legacy interval; the effect below will adjust when Realtime connects
    pollRef.current = setInterval(pollFn, LEGACY_POLL_INTERVAL);
  }, [realtimeSubscribe, broadcastHeartbeat, processIncomingMessage]);

  // ── Adjust poll interval when realtime connects/disconnects ──
  // IMPORTANT: This does NOT re-subscribe — only changes the timer interval
  useEffect(() => {
    if (!roomId || !pollFnRef.current) return;
    if (pollRef.current) clearInterval(pollRef.current);
    const interval = realtimeConnected ? REALTIME_FALLBACK_POLL : LEGACY_POLL_INTERVAL;
    pollRef.current = setInterval(pollFnRef.current, interval);
    console.log(`[Poll] Interval adjusted to ${interval}ms (Realtime: ${realtimeConnected ? 'ON' : 'OFF'})`);
  }, [realtimeConnected, roomId]);

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
    const myName = verifiedNameRef.current || prefsRef.current.name;

    // ── Immediately update local roomInfoRef so translation targets are correct ──
    // Don't wait for Realtime broadcast round-trip or next poll
    if (roomInfoRef.current?.members) {
      const updatedMembers = roomInfoRef.current.members.map(m =>
        m.name === myName ? { ...m, lang: newLang } : m
      );
      roomInfoRef.current = { ...roomInfoRef.current, members: updatedMembers };
      // Also update React state so UI re-renders
      setRoomInfo(prev => {
        if (!prev?.members) return prev;
        return { ...prev, members: prev.members.map(m =>
          m.name === myName ? { ...m, lang: newLang } : m
        )};
      });
    }

    // Broadcast lang change via Realtime (so partner updates too)
    broadcastMemberUpdate({
      action: 'langChange',
      name: myName,
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

  // ── Stable callbacks for two-phase send (avoid cascading re-creations) ──
  const updateLocalMessage = useCallback((original, sender, updates) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.sender === sender && m.original === original);
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...updates };
      return updated;
    });
  }, []); // setMessages is stable — no deps needed

  const addLocalMessage = useCallback((msg) => {
    setMessages(prev => {
      const ids = new Set(prev.map(m => m.id));
      if (ids.has(msg.id)) return prev;
      return [...prev, msg];
    });
  }, []); // setMessages is stable — no deps needed

  function leaveRoom() {
    stopPolling();
    roomSessionTokenRef.current = null;
    verifiedNameRef.current = null;
    isHostRef.current = false;
    processedForTTSRef.current.clear();
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
    broadcastMessageUpdate,
    broadcastMemberUpdate,
    // P2P message-update handler (reused by handleDirectMessage in page.js)
    handleMessageUpdate,
    updateLocalMessage,
    addLocalMessage,
    // P2P DataChannel: add incoming message (same logic as Realtime)
    addIncomingMessage: handleRealtimeMessage,
  };
}
