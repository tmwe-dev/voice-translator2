'use client';
import { memo, useState, useEffect } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════════════════════
// MainMenu — Premium Dark Ambient Glassmorphism
// Floating orbs, layered glass, accent glow, hover zoom
// ═══════════════════════════════════════════════════════════════

const MENU_ITEMS = [
  {
    id: 'speaker', iconName: 'swap', label: 'TaxiTalk',
    descIT: 'Traduci faccia a faccia',
    descEN: 'Face-to-face translation',
    accentFrom: '#26D9B0', accentTo: '#0FA88A', accentGlow: 'rgba(38,217,176,0.35)',
    size: 'hero',
  },
  {
    id: 'create', iconName: 'doorCreate', label: 'Chat',
    descIT: 'Crea una stanza',
    descEN: 'Create a room',
    accentFrom: '#8B6AFF', accentTo: '#6B4ADF', accentGlow: 'rgba(139,106,255,0.35)',
    size: 'hero',
  },
  {
    id: 'quickinvite', iconName: 'share', label: 'Invita',
    descIT: 'QR code istantaneo',
    descEN: 'Instant QR code',
    accentFrom: '#26D9B0', accentTo: '#3B82F6', accentGlow: 'rgba(38,217,176,0.25)',
    size: 'feature', badge: 'New',
  },
  {
    id: 'mondo', iconName: 'globe', label: 'Mondo',
    descIT: 'Stanze pubbliche',
    descEN: 'Public rooms',
    accentFrom: '#06B6D4', accentTo: '#26D9B0', accentGlow: 'rgba(6,182,212,0.25)',
    size: 'feature',
  },
  {
    id: 'history', iconName: 'history', label: 'Cronologia',
    descIT: 'Le tue conversazioni',
    descEN: 'Your conversations',
    accentFrom: '#8B6AFF', accentTo: '#26D9B0', accentGlow: 'rgba(139,106,255,0.2)',
    size: 'util',
  },
  {
    id: 'contacts', iconName: 'user', label: 'Contatti',
    descIT: 'Gestisci contatti',
    descEN: 'Manage contacts',
    accentFrom: '#A78BFA', accentTo: '#8B6AFF', accentGlow: 'rgba(167,139,250,0.2)',
    size: 'util',
  },
  {
    id: 'settings', iconName: 'settings', label: 'Impostazioni',
    descIT: 'Lingua, tema, voce',
    descEN: 'Language, theme, voice',
    accentFrom: '#94A3B8', accentTo: '#64748B', accentGlow: 'rgba(148,163,184,0.15)',
    size: 'util',
  },
];

// ── CSS keyframes (injected once) ──
const KEYFRAMES = `
@keyframes mmOrbFloat { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6px,-8px) scale(1.15); } }
@keyframes mmShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes mmPulseGlow { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
`;

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = KEYFRAMES;
  document.head.appendChild(s);
}

function MainMenu({ L, S, prefs, theme, setView, handleCreateRoom, setShowCreatePopup }) {
  const [hoverId, setHoverId] = useState(null);
  const [pressedId, setPressedId] = useState(null);
  const isIT = L('createRoom') === 'Crea Stanza';
  const getDesc = (item) => isIT ? item.descIT : item.descEN;

  // Inject CSS animations once on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  const handleTap = (id) => {
    vibrate();
    setPressedId(id);
    setTimeout(() => setPressedId(null), 200);
    if (id === 'create') {
      if (setShowCreatePopup) setShowCreatePopup(true);
      else setView('home');
      return;
    }
    setView(id);
  };

  const heroItems = MENU_ITEMS.filter(i => i.size === 'hero');
  const featureItems = MENU_ITEMS.filter(i => i.size === 'feature');
  const utilItems = MENU_ITEMS.filter(i => i.size === 'util');

  // ── Shared pointer handlers ──
  const ptrHandlers = (id) => ({
    onPointerDown: () => setPressedId(id),
    onPointerUp: () => setPressedId(null),
    onPointerLeave: () => { setPressedId(null); setHoverId(null); },
    onPointerEnter: () => setHoverId(id),
    onClick: () => handleTap(id),
  });

  return (
    <div style={{ padding: '0 12px', width: '100%', maxWidth: 420 }}>

      {/* ═══════ HERO CARDS — TaxiTalk + Chat ═══════ */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        {heroItems.map(item => {
          const isHover = hoverId === item.id;
          const isPressed = pressedId === item.id;
          return (
            <button key={item.id} {...ptrHandlers(item.id)}
              style={{
                flex: 1, padding: '32px 16px 26px', borderRadius: 28, cursor: 'pointer',
                position: 'relative', overflow: 'hidden',
                background: `linear-gradient(165deg, ${item.accentFrom}14 0%, rgba(8,10,22,0.92) 50%, ${item.accentTo}0A 100%)`,
                border: `1px solid ${isHover ? item.accentFrom + '40' : item.accentFrom + '18'}`,
                backdropFilter: 'blur(48px) saturate(1.2)',
                WebkitBackdropFilter: 'blur(48px) saturate(1.2)',
                boxShadow: isHover
                  ? `0 20px 60px ${item.accentGlow}, 0 0 80px ${item.accentFrom}15, inset 0 1px 0 rgba(255,255,255,0.08)`
                  : `0 12px 40px rgba(0,0,0,0.5), 0 0 60px ${item.accentFrom}06, inset 0 1px 0 rgba(255,255,255,0.05)`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isPressed ? 'scale(0.93)' : isHover ? 'scale(1.04) translateY(-3px)' : 'scale(1)',
              }}>
              {/* Floating orb glow */}
              <div style={{
                position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%',
                background: `radial-gradient(circle, ${item.accentFrom}30 0%, transparent 70%)`,
                animation: 'mmOrbFloat 4s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', bottom: -15, left: -15, width: 70, height: 70, borderRadius: '50%',
                background: `radial-gradient(circle, ${item.accentTo}20 0%, transparent 70%)`,
                animation: 'mmOrbFloat 5s ease-in-out infinite reverse',
                pointerEvents: 'none',
              }} />
              {/* Icon container with glow ring */}
              <div style={{
                position: 'relative', width: 64, height: 64, borderRadius: 20,
                background: `linear-gradient(145deg, ${item.accentFrom}20, ${item.accentTo}10)`,
                border: `1px solid ${item.accentFrom}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isHover ? `0 0 30px ${item.accentGlow}` : `0 0 15px ${item.accentFrom}10`,
                transition: 'box-shadow 0.3s ease',
              }}>
                <Icon name={item.iconName} size={32} color={item.accentFrom} />
              </div>
              {/* Label with gradient */}
              <span style={{
                fontSize: 18, fontWeight: 800, letterSpacing: -0.5, position: 'relative',
                background: `linear-gradient(135deg, ${item.accentFrom} 0%, #fff 60%, ${item.accentTo} 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>{item.label}</span>
              <span style={{
                fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'center',
                letterSpacing: 0.3, position: 'relative',
              }}>{getDesc(item)}</span>
              {/* Bottom shine line */}
              <div style={{
                position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 1,
                background: `linear-gradient(90deg, transparent, ${item.accentFrom}40, transparent)`,
                opacity: isHover ? 1 : 0.4, transition: 'opacity 0.3s',
              }} />
            </button>
          );
        })}
      </div>

      {/* ═══════ FEATURE CARDS — Invita + Mondo ═══════ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {featureItems.map(item => {
          const isHover = hoverId === item.id;
          const isPressed = pressedId === item.id;
          return (
            <button key={item.id} {...ptrHandlers(item.id)}
              style={{
                flex: 1, padding: '20px 14px', borderRadius: 22, cursor: 'pointer',
                position: 'relative', overflow: 'hidden',
                background: `linear-gradient(155deg, ${item.accentFrom}0C 0%, rgba(10,13,26,0.88) 60%, ${item.accentTo}06 100%)`,
                border: `1px solid ${isHover ? item.accentFrom + '35' : 'rgba(255,255,255,0.06)'}`,
                backdropFilter: 'blur(32px) saturate(1.1)',
                WebkitBackdropFilter: 'blur(32px) saturate(1.1)',
                boxShadow: isHover
                  ? `0 14px 44px ${item.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.07)`
                  : `0 8px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
                display: 'flex', alignItems: 'center', gap: 14,
                fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isPressed ? 'scale(0.94)' : isHover ? 'scale(1.03) translateY(-2px)' : 'scale(1)',
              }}>
              {/* Badge */}
              {item.badge && (
                <div style={{
                  position: 'absolute', top: 8, right: 10, padding: '2px 8px', borderRadius: 8,
                  background: `linear-gradient(135deg, ${item.accentFrom}, ${item.accentTo})`,
                  color: '#fff', fontSize: 8, fontWeight: 800, letterSpacing: 0.8,
                  boxShadow: `0 2px 10px ${item.accentGlow}`,
                  animation: 'mmPulseGlow 2.5s ease-in-out infinite',
                }}>{item.badge}</div>
              )}
              {/* Ambient orb */}
              <div style={{
                position: 'absolute', top: -10, right: -10, width: 50, height: 50, borderRadius: '50%',
                background: `radial-gradient(circle, ${item.accentFrom}18 0%, transparent 70%)`,
                animation: 'mmOrbFloat 6s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
              {/* Icon orb */}
              <div style={{
                width: 50, height: 50, borderRadius: 16, flexShrink: 0,
                background: `linear-gradient(145deg, ${item.accentFrom}22, ${item.accentTo}12)`,
                border: `1px solid ${item.accentFrom}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isHover ? `0 0 24px ${item.accentGlow}` : 'none',
                transition: 'box-shadow 0.3s',
              }}>
                <Icon name={item.iconName} size={24} color={item.accentFrom} />
              </div>
              <div style={{ textAlign: 'left', minWidth: 0, position: 'relative' }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, letterSpacing: -0.2,
                  color: isHover ? item.accentFrom : 'rgba(255,255,255,0.92)',
                  transition: 'color 0.3s',
                }}>{item.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', marginTop: 2, letterSpacing: 0.2 }}>
                  {getDesc(item)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ═══════ UTILITY ROW — Cronologia, Contatti, Impostazioni ═══════ */}
      <div style={{ display: 'flex', gap: 8 }}>
        {utilItems.map(item => {
          const isHover = hoverId === item.id;
          const isPressed = pressedId === item.id;
          return (
            <button key={item.id} {...ptrHandlers(item.id)}
              style={{
                flex: 1, padding: '14px 8px', borderRadius: 18, cursor: 'pointer',
                position: 'relative', overflow: 'hidden',
                background: isHover
                  ? `linear-gradient(160deg, ${item.accentFrom}12, rgba(10,13,26,0.90))`
                  : 'linear-gradient(160deg, rgba(12,15,30,0.70), rgba(8,10,24,0.85))',
                border: `1px solid ${isHover ? item.accentFrom + '30' : 'rgba(255,255,255,0.05)'}`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: isHover
                  ? `0 8px 30px ${item.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.06)`
                  : '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isPressed ? 'scale(0.92)' : isHover ? 'scale(1.06) translateY(-3px)' : 'scale(1)',
              }}>
              {/* Icon with subtle glow */}
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(145deg, ${item.accentFrom}18, transparent)`,
                border: `1px solid ${item.accentFrom}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isHover ? `0 0 20px ${item.accentGlow}` : 'none',
                transition: 'box-shadow 0.3s, transform 0.3s',
                transform: isHover ? 'scale(1.1)' : 'scale(1)',
              }}>
                <Icon name={item.iconName} size={18} color={isHover ? item.accentFrom : 'rgba(255,255,255,0.65)'} />
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: 0.2,
                color: isHover ? item.accentFrom : 'rgba(255,255,255,0.55)',
                transition: 'color 0.3s',
              }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(MainMenu);
