'use client';
import { memo } from 'react';

/**
 * ConnectionQuality — Glassmorphism signal bars indicator
 * Shows connection status with gradient bars and glow effects.
 *
 * @param {string} webrtcState - 'idle' | 'connecting' | 'connected' | 'failed'
 * @param {boolean} partnerConnected - whether partner is in the room
 * @param {boolean} realtimeConnected - whether Supabase Realtime WebSocket is active
 * @param {object} [style] - optional style overrides
 */
const ConnectionQuality = memo(function ConnectionQuality({ webrtcState, partnerConnected, realtimeConnected, style }) {
  // Determine quality level (0-4)
  let level = 0;
  let label = 'Offline';
  let color = '#FF6B6B';

  if (!partnerConnected) {
    level = 0;
    label = 'In attesa';
    color = '#888';
  } else if (webrtcState === 'connected') {
    level = 4;
    label = 'P2P';
    color = '#4ADE80';
  } else if (webrtcState === 'connecting') {
    level = 1;
    label = 'Connessione...';
    color = '#FBBF24';
  } else if (realtimeConnected) {
    level = 3;
    label = 'Realtime';
    color = '#38BDF8';
  } else if (partnerConnected) {
    level = 2;
    label = 'Polling';
    color = '#FB923C';
  }

  const barHeights = [5, 9, 13, 17];
  const barWidth = 3.5;
  const gap = 2.5;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'flex-end', gap,
      padding: '3px 8px', borderRadius: 8,
      background: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.08)',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      ...style,
    }}
      title={`Connessione: ${label}`}
      aria-label={`Connection quality: ${label}`}
    >
      {barHeights.map((h, i) => {
        const isActive = i < level;
        return (
          <div key={i} style={{
            width: barWidth,
            height: h,
            borderRadius: 2,
            background: isActive
              ? `linear-gradient(to top, ${color}CC, ${color})`
              : 'rgba(255,255,255,0.1)',
            boxShadow: isActive ? `0 0 6px ${color}40` : 'none',
            transform: isActive ? 'scaleY(1)' : 'scaleY(0.85)',
            transformOrigin: 'bottom',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          }} />
        );
      })}
      <span style={{
        fontSize: 8, fontWeight: 600, color,
        marginLeft: 4, letterSpacing: 0.3,
        transition: 'color 0.3s ease',
        textShadow: level > 0 ? `0 0 8px ${color}40` : 'none',
      }}>
        {label}
      </span>
    </div>
  );
});

export default ConnectionQuality;
