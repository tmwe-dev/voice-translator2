'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { CONTEXTS, getLang, POLLING_INTERVAL, LIVE_TEXT_THROTTLE, TYPING_TIMEOUT, SPEAKING_TIMEOUT } from '../lib/constants.js';

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
  const pollErrorCountRef = useRef(0);  // FASE 6B: track consecutive errors
  const [pollError, setPollError] = useState(false);
  const roomSessionTokenRef = useRef(null); // Server-verified identity token

  const startPolling = useCallback((rid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    lastMsgRef.current = Date.now();
    pollErrorCountRef.current = 0;
    setPollError(false);
    pollRef.current = setInterval(async () => {
      try {
        const rstParam = roomSessionTokenRef.current ? `&rst=${encodeURIComponent(roomSessionTokenRef.current)}` : '';
        const mRes = await fetch(`/api/messages?room=${rid}&name=${encodeURIComponent(prefsRef.current.name)}&after=${lastMsgRef.current}${rstParam}`);
        if (mRes.ok) {
          const { messages: newMsgs } = await mRes.json();
          if (newMsgs && newMsgs.length > 0) {
            setMessages(prev => {
              const ids = new Set(prev.map(m => m.id));
              const fresh = newMsgs.filter(m => !ids.has(m.id));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
            // FASE 6A: Use timestamp as-is; dedup by ID handles duplicates
            lastMsgRef.current = Math.max(...newMsgs.map(m => m.timestamp));
            for (const msg of newMsgs) {
              if (sentByMeRef.current.has(msg.id)) continue;
              if (msg.sender === prefsRef.current.name) continue;
              // Multi-language: pick translation for MY language
              const myLang = myLangRef.current;
              let textToPlay = '';
              let speechLang = '';
              if (msg.translations && msg.translations[myLang]) {
                // Multi-lang message: use MY language translation
                textToPlay = msg.translations[myLang];
                speechLang = getLang(myLang).speech;
              } else if (msg.translated) {
                // Backward compat: use single translation
                textToPlay = msg.translated;
                speechLang = getLang(msg.targetLang).speech;
              }
              if (textToPlay && prefsRef.current.autoPlay) {
                queueAudio(textToPlay, speechLang, msg.id);
              }
            }
          }
        }
        const rRes = await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'heartbeat', roomId: rid, name: prefsRef.current.name, roomSessionToken: roomSessionTokenRef.current })
        });
        if (rRes.ok) {
          const { room } = await rRes.json();
          setRoomInfo(room);
          setPartnerConnected(room.members.length >= 2);
          // Multi-member: check if ANY partner is speaking/typing
          const others = room.members.filter(m => m.name !== prefsRef.current.name);
          const anyoneSpeaking = others.some(p => p.speaking && Date.now() - p.speakingAt < SPEAKING_TIMEOUT);
          const speakingPartner = others.find(p => p.speaking && Date.now() - p.speakingAt < SPEAKING_TIMEOUT);
          setPartnerSpeaking(anyoneSpeaking);
          setPartnerLiveText(speakingPartner?.liveText || '');
          setPartnerTyping(others.some(p => p.typing && Date.now() - (p.typingAt || 0) < TYPING_TIMEOUT));
        }
        // FASE 6B: Reset error count on success
        if (pollErrorCountRef.current > 0) {
          pollErrorCountRef.current = 0;
          setPollError(false);
        }
      } catch (e) {
        console.error('[Poll] error:', e);
        // FASE 6B: Track consecutive failures
        pollErrorCountRef.current++;
        if (pollErrorCountRef.current >= 3) {
          setPollError(true);
        }
      }
    }, POLLING_INTERVAL);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (liveTextTimerRef.current) {
      clearTimeout(liveTextTimerRef.current);
      liveTextTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  async function setSpeakingState(rid, speaking, liveText = null, typing = false) {
    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'speaking',
          roomId: rid,
          name: prefsRef.current.name,
          roomSessionToken: roomSessionTokenRef.current,
          speaking,
          liveText,
          typing
        })
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

  // Sync language change to room — all participants see the update via polling
  async function syncLangChange(newLang) {
    if (!roomId) return;
    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'changeLang',
          roomId,
          name: prefsRef.current.name,
          roomSessionToken: roomSessionTokenRef.current,
          lang: newLang,
        })
      });
    } catch (e) {
      console.error('[SyncLang] Error:', e);
    }
  }

  function sendTypingState(isTyping) {
    if (!roomId) return;
    fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'speaking',
        roomId,
        name: prefsRef.current.name,
        roomSessionToken: roomSessionTokenRef.current,
        speaking: false,
        typing: isTyping
      })
    }).catch(() => {});
  }

  async function handleCreateRoom(
    name,
    lang,
    mode,
    avatar,
    selectedContext,
    selectedMode,
    roomDescription,
    isTrial,
    isTopPro,
    userAccount
  ) {
    try {
      const ctxObj = CONTEXTS.find(c => c.id === selectedContext) || CONTEXTS[0];
      const currentTier = isTrial ? 'FREE' : isTopPro ? 'TOP PRO' : 'PRO';
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name,
          lang,
          mode,
          avatar,
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
          name,
          lang,
          avatar
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
      return room;
    } catch (e) {
      throw e;
    }
  }

  function leaveRoom() {
    stopPolling();
    roomSessionTokenRef.current = null;
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
    roomSessionTokenRef
  };
}
