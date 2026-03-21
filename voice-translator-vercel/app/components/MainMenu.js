'use client';
import { memo, useState } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════════════════════
// MainMenu — Dark Ambient Glassmorphism Hub
// ═══════════════════════════════════════════════════════════════

const MENU_ITEMS = [
  {
    id: 'speaker', iconName: 'swap', label: 'TaxiTalk',
    descIT: 'Traduci faccia a faccia',
    descEN: 'Face-to-face translation',
    accentFrom: '#26D9B0', accentTo: '#0FA88A',
    size: 'large',
  },
  {
    id: 'create', iconName: 'doorCreate', label: 'Chat',
    descIT: 'Crea una stanza',
    descEN: 'Create a room',
    accentFrom: '#8B6AFF', accentTo: '#6B4ADF',
    size: 'large',
  },
  {
    id: 'quickinvite', iconName: 'share', label: 'Invita',
    descIT: 'QR code istantaneo',
    descEN: 'Instant QR code',
    accentFrom: '#26D9B0', accentTo: '#3B82F6',
    size: 'medium', badge: 'New',
  },
  {
    id: 'call', iconName: 'phone', label: 'Chiama',
    descIT: 'Voice call tradotta',
    descEN: 'Translated voice call',
    accentFrom: '#E8924A', accentTo: '#FF6B6B',
    size: 'medium',
  },
  {
    id: 'video', iconName: 'video', label: 'Video',
    descIT: 'Video call tradotta',
    descEN: 'Translated video call',
    accentFrom: '#8B6AFF', accentTo: '#EC4899',
    size: 'medium',
  },
  {
    id: 'mondo', iconName: 'globe', label: 'Mondo',
    descIT: 'Stanze pubbliche',
    descEN: 'Public rooms',
    accentFrom: '#06B6D4', accentTo: '#26D9B0',
    size: 'medium',
  },
  {
    id: 'voicetest', iconName: 'mic', label: 'Voce',
    descIT: 'Test e impostazioni voce',
    descEN: 'Voice test & settings',
    accentFrom: '#E8924A', accentTo: '#FBBF24',
    size: 'small',
  },
  {
    id: 'history', iconName: 'history', label: 'Cronologia',
    descIT: 'Le tue conversazioni',
    descEN: 'Your conversations',
    accentFrom: '#8B6AFF', accentTo: '#26D9B0',
    size: 'small',
  },
  {
    id: 'contacts', iconName: 'user', label: 'Contatti',
    descIT: 'Gestisci contatti',
    descEN: 'Manage contacts',
    accentFrom: '#A78BFA', accentTo: '#8B6AFF',
    size: 'small',
  },
  {
    id: 'settings', iconName: 'settings', label: 'Impostazioni',
    descIT: 'Lingua, tema, voce',
    descEN: 'Language, theme, voice',
    accentFrom: '#64748B', accentTo: '#475569',
    size: 'small',
  },
];

// Dark glass card style
const glassCard = (accent1, accent2) => ({
  background: `linear-gradient(135deg, rgba(14,18,35,0.75) 0%, rgba(10,14,28,0.85) 100%)`,
  border: `1px solid rgba(255,255,255,0.06)`,
  backdropFilter: 'blur(24px) saturate(1.1)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.1)',
  boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
});

// Large card - glassmorphism with subtle accent glow
const largeGlass = (accent1, accent2) => ({
  background: `linear-gradient(160deg, ${accent1}12 0%, rgba(14,18,35,0.80) 40%, ${accent2}08 100%)`,
  border: `1px solid ${accent1}20`,
  backdropFilter: 'blur(40px) saturate(1.1)',
  WebkitBackdropFilter: 'blur(40px) saturate(1.1)',
  boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 60px ${accent1}08, inset 0 1px 0 rgba(255,255,255,0.06)`,
});

function MainMenu({ L, S, prefs, theme, setView, handleCreateRoom, setShowCreatePopup }) {
  const [pressedId, setPressedId] = useState(null);
  const isIT = L('createRoom') === 'Crea Stanza';

  const handleTap = (id) => {
    vibrate();
    setPressedId(id);
    setTimeout(() => setPressedId(null), 150);
    if (id === 'create' || id === 'call' || id === 'video') {
      if (setShowCreatePopup) setShowCreatePopup(true);
      else setView('home');
      return;
    }
    setView(id);
  };

  const largeItems = MENU_ITEMS.filter(i => i.size === 'large');
  const mediumItems = MENU_ITEMS.filter(i => i.size === 'medium');
  const smallItems = MENU_ITEMS.filter(i => i.size === 'small');
  const getDesc = (item) => isIT ? item.descIT : item.descEN;

  return (
    <div style={{ padding: '0 16px', width: '100%', maxWidth: 420 }}>

      {/* ═══ LARGE CARDS — TaxiTalk + Chat ═══ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        {largeItems.map(item => (
          <button key={item.id}
            onClick={() => handleTap(item.id)}
            onPointerDown={() => setPressedId(item.id)}
            onPointerUp={() => setPressedId(null)}
            onPointerLeave={() => setPressedId(null)}
            style={{
              flex: 1, padding: '28px 14px', borderRadius: 22, cursor: 'pointer',
              ...largeGlass(item.accentFrom, item.accentTo),
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 8, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: pressedId === item.id ? 'scale(0.95)' : 'scale(1)',
            }}>
            <Icon name={item.iconName} size={40} color={item.accentFrom} />
            <span style={{
              fontSize: 16, fontWeight: 700, letterSpacing: -0.3,
              background: `linear-gradient(135deg, ${item.accentFrom}, #fff)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>{item.label}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>
              {getDesc(item)}
            </span>
          </button>
        ))}
      </div>

      {/* ═══ MEDIUM GRID — 2x2 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {mediumItems.map(item => (
          <button key={item.id}
            onClick={() => handleTap(item.id)}
            onPointerDown={() => setPressedId(item.id)}
            onPointerUp={() => setPressedId(null)}
            onPointerLeave={() => setPressedId(null)}
            style={{
              padding: '18px 12px', borderRadius: 18, cursor: 'pointer',
              ...glassCard(item.accentFrom, item.accentTo),
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: FONT, position: 'relative',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: pressedId === item.id ? 'scale(0.96)' : 'scale(1)',
            }}>
            {item.badge && (
              <div style={{
                position: 'absolute', top: 6, right: 8,
                padding: '2px 6px', borderRadius: 6,
                background: 'linear-gradient(135deg, #26D9B0, #8B6AFF)',
                color: '#fff', fontSize: 8, fontWeight: 800, letterSpacing: 0.5,
              }}>
                {item.badge}
              </div>
            )}
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: `linear-gradient(135deg, ${item.accentFrom}25, ${item.accentTo}15)`,
              border: `1px solid ${item.accentFrom}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={item.iconName} size={22} color={item.accentFrom} />
            </div>
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{item.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{getDesc(item)}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ═══ SMALL ROW — utilities ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {smallItems.map(item => (
          <button key={item.id}
            onClick={() => handleTap(item.id)}
            onPointerDown={() => setPressedId(item.id)}
            onPointerUp={() => setPressedId(null)}
            onPointerLeave={() => setPressedId(null)}
            style={{
              padding: '12px 10px', borderRadius: 14, cursor: 'pointer',
              ...glassCard(item.accentFrom, item.accentTo),
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.12s',
              transform: pressedId === item.id ? 'scale(0.96)' : 'scale(1)',
            }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${item.accentFrom}25, ${item.accentTo}15)`,
              border: `1px solid ${item.accentFrom}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={item.iconName} size={16} color={item.accentFrom} />
            </div>
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>{item.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.50)' }}>{getDesc(item)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(MainMenu);
