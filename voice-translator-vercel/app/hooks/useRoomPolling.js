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

  const startPolling = useCallback((rid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    lastMsgRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const mRes = await fetch(`/api/messages?room=${rid}&after=${lastMsgRef.current}`);
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
              if (sentByMeRef.current.has(msg.id)) continue;
              if (msg.sender === prefsRef.current.name) continue;
              if (msg.translated && prefsRef.current.autoPlay) {
                queueAudio(msg.translated, getLang(msg.targetLang).speech, msg.id);
              }
            }
          }
        }
        const rRes = await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'heartbeat', roomId: rid, name: prefsRef.current.name })
        });
        if (rRes.ok) {
          const { room } = await rRes.json();
          setRoomInfo(room);
          setPartnerConnected(room.members.length >= 2);
          const partner = room.members.find(m => m.name !== prefsRef.current.name);
          setPartnerSpeaking(!!(partner && partner.speaking && Date.now() - partner.speakingAt < SPEAKING_TIMEOUT));
          setPartnerLiveText(partner && partner.speaking && partner.liveText ? partner.liveText : '');
          setPartnerTyping(!!(partner && partner.typing && Date.now() - (partner.typingAt || 0) < TYPING_TIMEOUT));
        }
      } catch (e) {
        console.error('[Poll] error:', e);
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

  function sendTypingState(isTyping) {
    if (!roomId) return;
    fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'speaking',
        roomId,
        name: prefsRef.current.name,
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
      const { room } = await res.json();
      setRoomId(room.id);
      setRoomInfo(room);
      setMessages([]);
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
      const { room } = await res.json();
      setRoomId(room.id);
      setRoomInfo(room);
      setMessages([]);
      startPolling(room.id);
      return room;
    } catch (e) {
      throw e;
    }
  }

  function leaveRoom() {
    stopPolling();
    setRoomId(null);
    setRoomInfo(null);
    setMessages([]);
    setPartnerSpeaking(false);
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
    startPolling,
    stopPolling,
    setSpeakingState,
    broadcastLiveText,
    sendTypingState,
    handleCreateRoom,
    handleJoinRoom,
    leaveRoom,
    sentByMeRef
  };
}
