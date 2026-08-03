'use client';

import { memo } from 'react';
import { vibrate } from '../lib/constants.js';
import { PALETTE } from '../lib/palette.js';

// ═══════════════════════════════════════════════════════════════
// SVG Nav Icons — clean, modern, 2px stroke
// ═══════════════════════════════════════════════════════════════
const NavIcon = ({ id, color, size = 22 }) => {
  const s = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  switch (id) {
    case 'home': return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z"/>
        <path d="M9 21V14h6v7"/>
      </svg>
    );
    case 'conversations': return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        <path d="M8 9h8M8 13h5" opacity="0.6"/>
      </svg>
    );
    case 'community': return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <circle cx="12" cy="12" r="9"/>
        <path d="M3.5 9h17M3.5 15h17" opacity="0.6"/>
        <ellipse cx="12" cy="12" rx="4.5" ry="9"/>
      </svg>
    );
    case 'profile': return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 21v-1a8 8 0 0116 0v1"/>
      </svg>
    );
    default: return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// BottomNav — 5 tabs + central FAB
// ═══════════════════════════════════════════════════════════════

const BottomNav = ({ currentView, setView, S, L, theme, onNewConversation }) => {
  const C = S.colors || {};

  const navItems = [
    { id: 'home', label: 'Home', views: ['home', 'quickinvite'] },
    { id: 'conversations', label: 'Chat', views: ['history', 'archive', 'summary', 'detail'] },
    { id: 'community', label: 'Community', views: ['mondo', 'speaker'] },
    { id: 'profile', label: 'Profilo', views: ['settings', 'account', 'credits', 'apikeys', 'voicetest', 'voice-clone', 'help', 'ai', 'contacts'] },
  ];

  const hiddenViews = new Set(['room', 'lobby', 'join', 'welcome', 'loading']);
  if (hiddenViews.has(currentView)) return null;

  const handleTabClick = (viewId) => { vibrate(15); setView(viewId); };
  const handleFabClick = () => { vibrate(20); onNewConversation ? onNewConversation() : setView('home'); };

  const accentColor = C.accent1 || PALETTE.purple;
  const hexToRgb = (hex) => {
    if (!hex || hex[0] !== '#') return '139,92,246';
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `${r},${g},${b}`;
  };

  const renderTab = (item) => {
    const isActive = item.views.includes(currentView);
    const color = isActive ? accentColor : (C.textMuted || 'rgba(250,250,250,0.40)');
    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.views[0])}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '4px', padding: '6px 14px',
          backgroundColor: isActive ? `rgba(${hexToRgb(accentColor)}, 0.10)` : 'transparent',
          border: 'none', borderRadius: '12px', cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)', minWidth: '56px',
        }}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
      >
        <NavIcon id={item.id} color={color} size={22} />
        <span style={{ fontSize: '10px', fontWeight: '600', color, letterSpacing: '0.2px' }}>{item.label}</span>
      </button>
    );
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: '76px',
      backgroundColor: 'rgba(9, 9, 11, 0.95)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderTop: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.06)'}`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
      zIndex: 50, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {navItems.slice(0, 2).map(renderTab)}

      {/* ── Central FAB ── */}
      <div style={{ position: 'relative', width: '56px', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={handleFabClick}
          style={{
            position: 'absolute', top: '-28px', width: '52px', height: '52px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${accentColor}, ${C.accent2 || PALETTE.cyan})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', border: '3px solid rgba(9,9,11,0.95)',
            boxShadow: `0 4px 20px rgba(${hexToRgb(accentColor)}, 0.40)`,
            cursor: 'pointer', transition: 'transform 0.15s', zIndex: 51,
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          aria-label="Nuova conversazione"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {navItems.slice(2).map(renderTab)}
    </div>
  );
};

export default memo(BottomNav);
