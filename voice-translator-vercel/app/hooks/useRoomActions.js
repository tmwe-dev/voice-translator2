'use client';
import { useCallback } from 'react';
import { t } from '../lib/i18n.js';

/**
 * useRoomActions — Room management and chat actions extracted from page.js
 *
 * Handles: share, export, endChat, leaveTemporary, rejoin, viewConversation
 * These are pure action functions that operate on room state passed as deps.
 */
export default function useRoomActions({
  roomPolling,
  auth,
  prefs,
  myLang,
  audio,
  convContext,
  roomInfoRef,
  roomContextRef,
  setView,
  setStatus,
  setConvHistory,
  setViewingConv,
  L,
}) {
  const APP_URL = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://voice-translator2.vercel.app';

  const shareApp = useCallback((lang, inviteLang) => {
    const url = `${APP_URL}?lang=${lang || inviteLang}`;
    const text = t(lang || inviteLang, 'shareAppText');
    if (navigator.share) navigator.share({ title: 'VoiceTranslate', text, url });
    else { navigator.clipboard.writeText(url); setStatus('Link copied!'); setTimeout(() => setStatus(''), 2000); }
  }, [setStatus]);

  const shareRoom = useCallback((inviteLang) => {
    const url = `${APP_URL}?room=${roomPolling.roomId}&lang=${inviteLang}`;
    if (navigator.share) navigator.share({ title: 'VoiceTranslate', text: t(inviteLang, 'inviteText'), url });
    else { navigator.clipboard.writeText(url); setStatus('Link copied!'); setTimeout(() => setStatus(''), 2000); }
  }, [roomPolling.roomId, setStatus]);

  const exportConversation = useCallback(() => {
    if (!roomPolling.messages.length) return;
    const roomName = roomPolling.roomInfo?.host ? `${roomPolling.roomInfo.host}'s Room` : roomPolling.roomId;
    const date = new Date().toLocaleString();
    let text = `VoiceTranslate - ${roomName}\n${date}\n${'='.repeat(40)}\n\n`;
    for (const msg of roomPolling.messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      text += `[${time}] ${msg.sender}:\n  ${msg.original}\n  \u2192 ${msg.translated}\n\n`;
    }
    text += `${'='.repeat(40)}\n${roomPolling.messages.length} ${L('messages')} | VoiceTranslate`;
    if (navigator.share) navigator.share({ title: `VoiceTranslate - ${roomName}`, text });
    else { navigator.clipboard.writeText(text); setStatus(L('exportCopied')); setTimeout(() => setStatus(''), 2000); }
  }, [roomPolling.messages, roomPolling.roomInfo, roomPolling.roomId, L, setStatus]);

  const loadHistory = useCallback(async () => {
    if (!prefs.name) return;
    try {
      const listBody = { action: 'list', userToken: auth.userTokenRef?.current || null };
      if (!auth.userTokenRef?.current) listBody.userName = prefs.name;
      const res = await fetch('/api/conversation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listBody)
      });
      if (res.ok) { const { conversations } = await res.json(); setConvHistory(conversations || []); }
    } catch (e) { console.error('History error:', e); }
  }, [prefs.name, setConvHistory]);

  const endChatAndSave = useCallback(async () => {
    if (!roomPolling.roomId) return;
    roomPolling.stopPolling();
    setStatus('...');
    try {
      const endBody = {
        action: 'end', roomId: roomPolling.roomId,
        roomSessionToken: roomPolling.roomSessionTokenRef?.current || null
      };
      if (!roomPolling.roomSessionTokenRef?.current) endBody.userName = prefs.name;
      await fetch('/api/conversation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(endBody)
      });
    } catch (e) { console.error('End chat error:', e); }
    roomPolling.leaveRoom();
    convContext.resetContext();
    setStatus('');
    setView('home');
  }, [roomPolling.roomId, prefs.name, setStatus, setView]);

  const leaveRoomTemporary = useCallback(() => {
    if (!roomPolling.roomId) return;
    try {
      let activeRooms = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]');
      const roomData = {
        roomId: roomPolling.roomId,
        host: roomPolling.roomInfo?.host,
        members: roomPolling.roomInfo?.members?.map(m => ({ name: m.name, lang: m.lang, avatar: m.avatar })) || [],
        mode: roomPolling.roomInfo?.mode || 'conversation',
        leftAt: Date.now()
      };
      activeRooms = activeRooms.filter(r => r.roomId !== roomData.roomId);
      activeRooms.unshift(roomData);
      localStorage.setItem('vt-active-rooms', JSON.stringify(activeRooms.slice(0, 10)));
    } catch {}
    roomPolling.stopPolling();
    roomPolling.leaveRoom();
    setView('home');
  }, [roomPolling.roomId, roomPolling.roomInfo, setView]);

  const rejoinRoom = useCallback(async (rid) => {
    audio.unlockAudio();
    try {
      setStatus('...');
      const room = await roomPolling.handleJoinRoom(rid, prefs.name, myLang, prefs.avatar);
      roomInfoRef.current = room;
      roomContextRef.current = {
        contextId: room.context || 'general',
        contextPrompt: room.contextPrompt || '',
        description: room.description || ''
      };
      const hostTier = room.hostTier || 'FREE';
      auth.roomTierOverrideRef.current = hostTier;
      if (hostTier === 'FREE') { auth.setIsTrial(true); auth.setIsTopPro(false); }
      else if (hostTier === 'TOP PRO') { auth.setIsTrial(false); auth.setIsTopPro(true); }
      else { auth.setIsTrial(false); auth.setIsTopPro(false); }
      try {
        let activeRooms = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]');
        activeRooms = activeRooms.filter(r => r.roomId !== rid);
        localStorage.setItem('vt-active-rooms', JSON.stringify(activeRooms));
      } catch {}
      setView('room');
      setStatus('');
    } catch (e) {
      try {
        let activeRooms = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]');
        activeRooms = activeRooms.filter(r => r.roomId !== rid);
        localStorage.setItem('vt-active-rooms', JSON.stringify(activeRooms));
      } catch {}
      setStatus('Chat terminata');
      setTimeout(() => setStatus(''), 2000);
    }
  }, [prefs.name, prefs.avatar, myLang, setStatus, setView]);

  return {
    shareApp,
    shareRoom,
    exportConversation,
    loadHistory,
    endChatAndSave,
    leaveRoomTemporary,
    rejoinRoom,
  };
}
