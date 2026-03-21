'use client';
import { memo, useState } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import getStyles from '../lib/styles.js';

// ═══════════════════════════════════════════════════════════════
// MainMenu — Hub centrale con icone grandi
//
// Miglioramenti:
// - Tap animation (scale feedback)
// - Badge "Nuovo" su features recenti
// - Descrizioni localizzate
// - Active press state con haptic
// - Icone più grandi nel tier large
// ═══════════════════════════════════════════════════════════════

const MENU_ITEMS = [
  {
    id: 'speaker', icon: '🚕', label: 'TaxiTalk',
    descIT: 'Traduci faccia a faccia',
    descEN: 'Face-to-face translation',
    gradient: 'linear-gradient(135deg, #26D9B0 0%, #FF6584 100%)',
    size: 'large',
  },
  {
    id: 'create', icon: '💬', label: 'Chat',
    descIT: 'Crea una stanza',
    descEN: 'Create a room',
    gradient: 'linear-gradient(135deg, #26D9B0 0%, #8B6AFF 100%)',
    size: 'large',
  },
  {
    id: 'quickinvite', icon: '📱', label: 'Invita',
    descIT: 'QR code istantaneo',
    descEN: 'Instant QR code',
    gradient: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
    size: 'medium', badge: 'New',
  },
  {
    id: 'call', icon: '📞', label: 'Chiama',
    descIT: 'Voice call tradotta',
    descEN: 'Translated voice call',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    size: 'medium',
  },
  {
    id: 'video', icon: '📹', label: 'Video',
    descIT: 'Video call tradotta',
    descEN: 'Translated video call',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
    size: 'medium',
  },
  {
    id: 'mondo', icon: '🌍', label: 'Mondo',
    descIT: 'Stanze pubbliche',
    descEN: 'Public rooms',
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #10B981 100%)',
    size: 'medium',
  },
  {
    id: 'voicetest', icon: '🎙️', label: 'Voce',
    descIT: 'Test e impostazioni voce',
    descEN: 'Voice test & settings',
    gradient: 'linear-gradient(135deg, #F97316 0%, #FBBF24 100%)',
    size: 'small',
  },
  {
    id: 'history', icon: '📋', label: 'Cronologia',
    descIT: 'Le tue conversazioni',
    descEN: 'Your conversations',
    gradient: 'linear-gradient(135deg, #64748B 0%, #94A3B8 100%)',
    size: 'small',
  },
  {
    id: 'contacts', icon: '👥', label: 'Contatti',
    descIT: 'Gestisci contatti',
    descEN: 'Manage contacts',
    gradient: 'linear-gradient(135deg, #A78BFA 0%, #C084FC 100%)',
    size: 'small',
  },
  {
    id: 'settings', icon: '⚙️', label: 'Impostazioni',
    descIT: 'Lingua, tema, voce',
    descEN: 'Language, theme, voice',
    gradient: 'linear-gradient(135deg, #475569 0%, #64748B 100%)',
    size: 'small',
  },
];

function MainMenu({ L, S, prefs, theme, setView, handleCreateRoom, setShowCreatePopup }) {
  const C = getStyles(theme);
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
              flex: 1, padding: '24px 14px', borderRadius: 22, cursor: 'pointer',
              background: item.gradient, border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 6, fontFamily: FONT,
              boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: pressedId === item.id ? 'scale(0.95)' : 'scale(1)',
            }}>
            <span style={{ fontSize: 40 }}>{item.icon}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{item.label}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
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
              background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: FONT, position: 'relative',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: pressedId === item.id ? 'scale(0.96)' : 'scale(1)',
            }}>
            {/* Badge */}
            {item.badge && (
              <div style={{
                position: 'absolute', top: 6, right: 8,
                padding: '2px 6px', borderRadius: 6,
                background: 'linear-gradient(135deg, #FF6B6B, #FF9A53)',
                color: '#fff', fontSize: 8, fontWeight: 800, letterSpacing: 0.5,
              }}>
                {item.badge}
              </div>
            )}
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: item.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {item.icon}
            </div>
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{item.label}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{getDesc(item)}</div>
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
              background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.12s',
              transform: pressedId === item.id ? 'scale(0.96)' : 'scale(1)',
            }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: item.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>
              {item.icon}
            </div>
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary }}>{item.label}</div>
              <div style={{ fontSize: 9, color: C.textMuted }}>{getDesc(item)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(MainMenu);
