'use client';
import { memo } from 'react';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════
// SpatialBackdrop — ambiente spaziale globale (Spatial Design)
//
// Mesh gradient che deriva lentamente + campo stelle che scintilla.
// Sta dietro TUTTE le view (position fixed, zIndex 0, pointerEvents none).
// Nel tema Dawn le stelle sono quasi invisibili e il mesh è pastello.
// ═══════════════════════════════════════════════

const MESH = {
  deep: [
    'radial-gradient(42% 38% at 18% 22%, rgba(91,140,255,0.30), transparent 70%)',
    'radial-gradient(36% 42% at 82% 16%, rgba(120,80,255,0.18), transparent 70%)',
    'radial-gradient(50% 44% at 60% 88%, rgba(56,225,255,0.14), transparent 70%)',
  ].join(','),
  ember: [
    'radial-gradient(42% 38% at 18% 22%, rgba(255,120,40,0.24), transparent 70%)',
    'radial-gradient(36% 42% at 82% 16%, rgba(200,80,30,0.18), transparent 70%)',
    'radial-gradient(50% 44% at 60% 88%, rgba(255,180,60,0.12), transparent 70%)',
  ].join(','),
  dawn: [
    'radial-gradient(42% 38% at 18% 22%, rgba(61,99,232,0.14), transparent 70%)',
    'radial-gradient(36% 42% at 82% 16%, rgba(150,110,255,0.10), transparent 70%)',
    'radial-gradient(50% 44% at 60% 88%, rgba(0,168,204,0.10), transparent 70%)',
  ].join(','),
};

const STARS = [
  'radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.7), transparent)',
  'radial-gradient(1px 1px at 90px 120px, rgba(255,255,255,0.5), transparent)',
  'radial-gradient(1.5px 1.5px at 160px 60px, rgba(255,255,255,0.8), transparent)',
  'radial-gradient(1px 1px at 230px 160px, rgba(255,255,255,0.4), transparent)',
].join(',');

const SpatialBackdrop = memo(function SpatialBackdrop() {
  const { theme } = useApp();
  const mesh = MESH[theme] || MESH.deep;
  const isDawn = theme === 'dawn';

  return (
    <div aria-hidden="true" style={{
      position: 'fixed', inset: '-10%', zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes sbDrift { to { transform: translate(-3%, 2.5%) scale(1.06) rotate(2deg); } }
        @keyframes sbTwinkle { to { opacity: 0.4; } }
      `}</style>
      <div style={{
        position: 'absolute', inset: 0, filter: 'blur(60px)', opacity: 0.9,
        background: mesh,
        animation: 'sbDrift 26s ease-in-out infinite alternate',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: STARS, backgroundRepeat: 'repeat', backgroundSize: '260px 200px',
        opacity: isDawn ? 0.08 : 0.85,
        filter: isDawn ? 'invert(1)' : 'none',
        animation: 'sbTwinkle 5s ease-in-out infinite alternate',
      }} />
    </div>
  );
});

export default SpatialBackdrop;
