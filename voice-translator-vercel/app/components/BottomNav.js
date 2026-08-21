'use client';

import { memo } from 'react';
import { vibrate } from '../lib/constants.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// SVG Nav Icons — clean, modern, 2px stroke
// ═══════════════════════════════════════════════════════════════
// b.363 — VIA L'ACCIAIO DAL MENU IN BASSO. Le immagini d'acciaio erano
// disegni ricchi, con riflessi e profondita: alla misura di un menu si
// leggevano come macchie grigie, e l'ombra che avrebbe dovuto staccarle
// non si vedeva perche il fondo e quasi nero. Luca: «sostituisci le
// icone del menu in basso con icone semplicissime bianche, stessa
// dimensione». Sono tornate quelle al tratto, bianche, alla misura che
// avevano prese le altre: 48.
const MISURA_MENU = 48;

const NavIcon = ({ id, color, size = MISURA_MENU }) => {
  // b.363 — ICONE SOTTILI E MODERNE (ordine di Luca: «mettine di belle e
  // moderne con linee sottili, NO BOLD»). Quelle di prima erano disegni
  // pesanti, con tratti spessi e dettagli che a questa misura diventavano
  // macchie: il tetto della casa a spiovente ripido, il fumetto squadrato
  // con dentro due righe di finto testo, il mappamondo con meridiani e
  // paralleli che si impastavano. Ora sono quattro segni essenziali,
  // tratto sottile e uniforme, angoli arrotondati, niente riempimenti.
  const s = {
    stroke: color, strokeWidth: 1.25,
    strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none',
    vectorEffect: 'non-scaling-stroke',
  };
  switch (id) {
    // la casa: un tetto appena accennato e un corpo semplice, senza porta
    case 'home': return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <path d="M4 10.2 12 4l8 6.2V19a1.2 1.2 0 0 1-1.2 1.2H5.2A1.2 1.2 0 0 1 4 19z" />
      </svg>
    );
    // la chat: un fumetto tondo, con la codina. Niente righe finte dentro
    case 'conversations': return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2a9.8 9.8 0 0 1-2.7-.37L4.5 20.5l1.2-3.5A6.9 6.9 0 0 1 3.5 12.2C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2z" />
      </svg>
    );
    // il mondo: un cerchio, l'equatore, e un solo meridiano che lo curva
    case 'community': return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <circle cx="12" cy="12" r="8.2" />
        <path d="M3.8 12h16.4" />
        <path d="M12 3.8c2.1 2.3 3.2 5.1 3.2 8.2s-1.1 5.9-3.2 8.2c-2.1-2.3-3.2-5.1-3.2-8.2s1.1-5.9 3.2-8.2z" />
      </svg>
    );
    // la persona: una testa e le spalle, nient'altro
    case 'profile': return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <circle cx="12" cy="8.4" r="3.6" />
        <path d="M5.2 20a6.8 6.8 0 0 1 13.6 0" />
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
    // b.363 — l'ICONA e bianca e basta (ordine di Luca): piena sulla voce
    // attiva, smorzata sulle altre. L'etichetta sotto tiene il colore di
    // prima, cosi si continua a vedere a colpo d'occhio dove si e.
    const coloreIcona = isActive ? '#ffffff' : 'rgba(255,255,255,0.45)';
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
        <NavIcon id={item.id} color={coloreIcona} size={MISURA_MENU} />
        <span style={{ fontSize: '10px', fontWeight: '600', color, letterSpacing: '0.2px' }}>{item.label}</span>
      </button>
    );
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: '94px',
      // b.363 — la barra segue la misura dell'acciaio: con l'icona a 48
      // (raddoppiata e poi ridotta del 20%) l'altezza sta a 94. Con i 76
      // di prima l'icona usciva dalla barra e si mangiava l'etichetta.
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
