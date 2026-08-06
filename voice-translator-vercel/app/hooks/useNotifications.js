'use client';
import { useRef, useEffect } from 'react';

/**
 * useNotifications — Handles in-app notifications, badge updates, and visibility.
 */
export default function useNotifications({ messages, roomId, myName, notifPermission }) {
  const prevMsgCountRef = useRef(0);

  // Send notification when new message arrives in background
  useEffect(() => {
    const msgs = messages || [];
    if (msgs.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
      const lastMsg = msgs[msgs.length - 1];
      // b.110 — leggeva `lastMsg.speaker`, ma chi produce il messaggio
      // scrive `sender` (useTranslationAPI:86, store:67). Il campo era
      // sempre undefined, quindi il confronto era SEMPRE vero: arrivava
      // una notifica anche per i propri messaggi, e il titolo era sempre
      // "Partner".
      if (lastMsg && lastMsg.sender !== myName && document.hidden) {
        // Update app badge
        if (navigator.setAppBadge) {
          const unread = msgs.length - prevMsgCountRef.current;
          navigator.setAppBadge(unread).catch(() => {});
        }
        // Local notification via SW
        if (notifPermission === 'granted' && navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_LOCAL_NOTIFICATION',
            title: `${lastMsg.sender || 'Partner'}`,
            body: lastMsg.translated || lastMsg.original || 'Nuovo messaggio',
            tag: `vt-msg-${roomId}`,
            roomId,
            url: '/'
          });
        }
      }
    }
    prevMsgCountRef.current = msgs.length;
  }, [messages]);

  // Clear badge when page becomes visible
  useEffect(() => {
    function handleVisibility() {
      if (!document.hidden && navigator.clearAppBadge) {
        navigator.clearAppBadge().catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
}
