'use client';
import { useState, useEffect, memo } from 'react';
import { FONT } from '../lib/constants.js';

// ═══════════════════════════════════════════════
// NetworkStatus — Offline banner + sync indicator
//
// Shows a dismissable banner when offline,
// a brief "back online" toast when reconnected,
// and a sync indicator when background sync is running.
// ═══════════════════════════════════════════════

function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const [showReconnect, setShowReconnect] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Init
    setOnline(navigator.onLine);

    const goOffline = () => setOnline(false);
    const goOnline = () => {
      setOnline(true);
      setShowReconnect(true);
      setSyncing(true);
      // Auto-hide reconnect toast after 3s
      setTimeout(() => setShowReconnect(false), 3000);
      // Sync indicator for 5s
      setTimeout(() => setSyncing(false), 5000);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Listen for SW sync messages
    let swMessageHandler = null;
    if ('serviceWorker' in navigator) {
      swMessageHandler = (e) => {
        if (e.data?.type === 'SYNC_COMPLETE') setSyncing(false);
        if (e.data?.type === 'SYNC_START') setSyncing(true);
      };
      navigator.serviceWorker.addEventListener('message', swMessageHandler);
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (swMessageHandler && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', swMessageHandler);
      }
    };
  }, []);

  // Nothing to show
  if (online && !showReconnect && !syncing) return null;

  return (
    <>
      {/* Offline banner */}
      {!online && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
          padding: '10px 16px',
          background: 'linear-gradient(135deg, #FF3B30, #FF6584)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#fff',
          animation: 'vtSlideDown 0.3s ease-out',
          boxShadow: '0 4px 20px rgba(255,59,48,0.3)',
        }}>
          <span>{'📡'}</span>
          <span>Sei offline — i messaggi verranno inviati quando torni online</span>
        </div>
      )}

      {/* Reconnected toast */}
      {showReconnect && online && (
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000, padding: '8px 20px', borderRadius: 20,
          background: 'linear-gradient(135deg, #10B981, #34D399)',
          fontFamily: FONT, fontSize: 12, fontWeight: 700, color: '#fff',
          animation: 'vtSlideDown 0.3s ease-out',
          boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
        }}>
          {'✓ Connessione ripristinata'}
        </div>
      )}

      {/* Sync indicator */}
      {syncing && online && (
        <div style={{
          position: 'fixed', top: showReconnect ? 48 : 12, right: 12,
          zIndex: 10000, padding: '6px 12px', borderRadius: 12,
          background: 'rgba(108,99,255,0.9)',
          fontFamily: FONT, fontSize: 10, fontWeight: 700, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 6,
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            border: '2px solid transparent', borderTopColor: '#fff',
            animation: 'vtSpin 0.6s linear infinite',
          }} />
          Sincronizzando...
        </div>
      )}

      <style>{`
        @keyframes vtSlideDown {
          from { transform: translateY(-100%) translateX(-50%); opacity: 0; }
          to { transform: translateY(0) translateX(-50%); opacity: 1; }
        }
        @keyframes vtSpin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

export default memo(NetworkStatus);
