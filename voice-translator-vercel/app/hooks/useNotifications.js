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
      if (lastMsg && lastMsg.speaker !== myName && document.hidden) {
        // Update app badge
        if (navigator.setAppBadge) {
          const unread = msgs.length - prevMsgCountRef.current;
          navigator.setAppBadge(unread).catch(() => {});
        }
        // Local notification via SW
        if (notifPermission === 'granted' && navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_LOCAL_NOTIFICATION',
            title: `${lastMsg.speaker || 'Partner'}`,
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
