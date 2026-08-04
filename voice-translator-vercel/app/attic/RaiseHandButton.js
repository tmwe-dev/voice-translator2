'use client';
import { memo, useState, useCallback } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';

// ═══════════════════════════════════════
// RaiseHandButton — "Alza la mano" for community voice rooms
//
// States: idle → raised → granted → speaking
// Integrates with room's raiseHand/grantSpeak actions.
// ═══════════════════════════════════════

const STATES = {
  idle: { icon: '✋', label: 'Alza la mano', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' },
  raised: { icon: '✋', label: 'Mano alzata', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', color: '#F59E0B' },
  granted: { icon: '🎤', label: 'Puoi parlare!', bg: 'rgba(38,217,176,0.12)', border: 'rgba(38,217,176,0.25)', color: '#26D9B0' },
  speaking: { icon: '🎤', label: 'Stai parlando', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', color: '#EF4444' },
};

function RaiseHandButton({ state = 'idle', onRaiseHand, onLowerHand, size = 'md' }) {
  const s = STATES[state] || STATES.idle;
  const isRaised = state === 'raised';
  const padding = size === 'sm' ? '8px 14px' : '10px 20px';
  const fontSize = size === 'sm' ? 11 : 13;

  const handleClick = useCallback(() => {
    vibrate(15);
    if (state === 'idle') onRaiseHand?.();
    else if (state === 'raised') onLowerHand?.();
  }, [state, onRaiseHand, onLowerHand]);

  return (
    <button onClick={handleClick} style={{
      padding, borderRadius: 14, cursor: state === 'speaking' || state === 'granted' ? 'default' : 'pointer',
      background: s.bg, border: `1px solid ${s.border}`,
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: FONT, transition: 'all 0.2s',
      animation: isRaised ? 'rhWave 1.5s ease-in-out infinite' : state === 'granted' ? 'rhPulse 1s ease-in-out infinite' : 'none',
    }}>
      <span style={{ fontSize: size === 'sm' ? 14 : 18, lineHeight: 1 }}>{s.icon}</span>
      <span style={{ fontSize, fontWeight: 600, color: s.color }}>{s.label}</span>
      <style>{`
        @keyframes rhWave { 0%,100% { transform: translateY(0); } 25% { transform: translateY(-3px) rotate(10deg); } 75% { transform: translateY(-3px) rotate(-10deg); } }
        @keyframes rhPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
      `}</style>
    </button>
  );
}

export default memo(RaiseHandButton);
