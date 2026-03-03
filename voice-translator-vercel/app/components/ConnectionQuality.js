'use client';
import { memo } from 'react';

/**
 * ConnectionQuality — compact signal bars indicator
 * Shows connection status: offline, polling, webrtc states
 *
 * @param {string} webrtcState - 'idle' | 'connecting' | 'connected' | 'failed'
 * @param {boolean} partnerConnected - whether partner is in the room
 * @param {object} [style] - optional style overrides
 */
const ConnectionQuality = memo(function ConnectionQuality({ webrtcState, partnerConnected, style }) {
  // Determine quality level (0-3)
  let level = 0; // offline
  let label = 'Offline';
  let color = '#FF6B6B';

  if (!partnerConnected) {
    level = 0;
    label = 'In attesa';
    color = '#888';
  } else if (webrtcState === 'connected') {
    level = 3;
    label = 'P2P';
    color = '#4ADE80';
  } else if (webrtcState === 'connecting') {
    level = 1;
    label = 'Connessione...';
    color = '#FBBF24';
  } else if (webrtcState === 'failed') {
    level = 2;
    label = 'Polling';
    color = '#FB923C';
  } else if (partnerConnected) {
    // Connected via polling (no WebRTC attempted or idle)
    level = 2;
    label = 'Server';
    color = '#38BDF8';
  }

  const barHeight = [6, 10, 14, 18];
  const barWidth = 3;
  const gap = 2;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'flex-end', gap: gap,
      padding: '2px 6px', borderRadius: 6,
      background: 'rgba(255,255,255,0.06)',
      ...style,
    }}
      title={`Connessione: ${label}`}
    >
      {barHeight.map((h, i) => (
        <div key={i} style={{
          width: barWidth,
          height: h,
          borderRadius: 1,
          background: i < level ? color : 'rgba(255,255,255,0.15)',
          transition: 'background 0.3s ease',
        }} />
      ))}
      <span style={{
        fontSize: 8, fontWeight: 600, color,
        marginLeft: 3, letterSpacing: 0.3,
        transition: 'color 0.3s ease',
      }}>
        {label}
      </span>
    </div>
  );
});

export default ConnectionQuality;
