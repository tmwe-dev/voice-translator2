'use client';

import { memo } from 'react';
import { ombraAcciaio, faroAcciaio } from '../lib/acciaio.js';
import { vibrate } from '../lib/constants.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// SVG Nav Icons — clean, modern, 2px stroke
// ═══════════════════════════════════════════════════════════════
// b.361 — le immagini in acciaio di Luca al posto delle icone del menu, dove
// le ho: la casa per Home, il globo per Community.
const IMG_MENU = {
  home: '/sezioni/menu-home.webp',
  conversations: '/sezioni/menu-chat.webp',   // il fumetto in acciaio per Chat
  community: '/sezioni/sez-mondo.webp',        // il globo in acciaio
  profile: '/sezioni/menu-profilo.webp',       // la porta in acciaio per Profilo
};

const NavIcon = ({ id, color, size = 22 }) => {
  if (IMG_MENU[id]) {
    // b.363 — le icone in acciaio del menu in basso vanno al DOPPIO
    // (ordine di Luca). Le altre voci, che sono disegni al tratto,
    // restano come sono: qui raddoppia solo l'acciaio.
    const acciaio = (size + 8) * 2;
    // b.363 — il faro e l'ombra dell'acciaio (vedi lib/acciaio.js): l'alone
    // caldo sta dietro, appoggiato in basso a sinistra; l'ombra segue la
    // sagoma dell'icona e cade dalla stessa parte, sfumando.
    return (
      <span style={{
        width: acciaio, height: acciaio, display: 'block',
        background: faroAcciaio(1), borderRadius: '50%',
      }}>
        <img src={IMG_MENU[id]} alt="" aria-hidden width={acciaio} height={acciaio}
          style={{ width: acciaio, height: acciaio, objectFit: 'contain', display: 'block',
            filter: ombraAcciaio(1.4) }} />
      </span>
    );
  }
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

const BottomNav = ({ currentView, onNewConversation }) => {
  const { setView, S, L, theme } = useApp();
  const C = S.colors || {};

  const navItems = [
    // b.139 — 'Profilo' era italiano fisso in una barra sempre a schermo:
    // la parola piu vista dell'applicazione, e l'unica mai tradotta.
    // 'Community' resta com'e: e il nome della sezione, non una parola comune.
    { id: 'home', label: L('navHome'), views: ['home', 'quickinvite'] },
    { id: 'conversations', label: L('navChat'), views: ['history', 'summary', 'detail'] },
    { id: 'community', label: 'Community', views: ['mondo', 'speaker'] },
    { id: 'profile', label: L('navProfile'), views: ['settings', 'account', 'credits', 'apikeys', 'voicetest', 'voice-clone', 'help', 'ai', 'contacts'] },
  ];

  const hiddenViews = new Set(['room', 'lobby', 'join', 'welcome', 'loading']);
  if (hiddenViews.has(currentView)) return null;

  const handleTabClick = (viewId) => { vibrate(15); setView(viewId); };
  const handleFabClick = () => { vibrate(20); onNewConversation ? onNewConversation() : setView('home'); };

  const accentColor = C.accent1 || PALETTE.purple;

  const renderTab = (item) => {
    const isActive = item.views.includes(currentView);
    const color = isActive ? accentColor : (C.textMuted || 'rgba(250,250,250,0.40)');
    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.views[0])}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '2px', padding: '4px 10px',
          // b.361 — VIA la sfumatura azzurra dietro la voce attiva (collaudo
          // di Luca: «sembra rimasta appesa la sfumatura e basta»): niente
          // sfondo, l'attiva si distingue solo dal colore del testo.
          backgroundColor: 'transparent',
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
      position: 'fixed', bottom: 0, left: 0, right: 0, height: '104px',
      // b.363 — la barra si alza da 76 a 104: con l'acciaio raddoppiato
      // (60 invece di 30) l'icona sarebbe uscita dalla barra e avrebbe
      // mangiato l'etichetta sotto.
      // ── INIZIO b.90 — la barra segue il TEMA ──
      // Prima era nera fissa: nel tema chiaro restava scura e le voci
      // Home, Chat e Community sparivano, nero su nero. Tre pulsanti su
      // quattro invisibili per chi sceglie Dawn.
      backgroundColor: C.headerBg || 'rgba(9, 9, 11, 0.95)',
      // ── FINE b.90 ──
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
            // b.361 — GLASS semitrasparente, zero sfumature, segno nero
            // (collaudo di Luca: «il tasto grigio sfumato fa cagare, voglio
            // zero sfumature e sfondo glass semitrasparente, carattere nero»).
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', border: `1px solid rgba(255,255,255,0.5)`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            cursor: 'pointer', transition: 'transform 0.15s', zIndex: 51,
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          aria-label={L('newConversation')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
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
