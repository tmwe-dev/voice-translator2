'use client';

import { memo, useState, useEffect} from 'react';
import { vibrate } from '../lib/constants.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import { ascoltaPannelloPieno } from '../lib/pannelloPieno.js';

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

// b.443 — le immagini in acciaio del menu, quelle del template.
const IMG_MENU = {
  home: '/sezioni/menu-home.webp',
  conversations: '/sezioni/menu-chat.webp',
  community: '/sezioni/menu-cuore.webp',
  profile: '/sezioni/menu-profilo.webp',
};

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
  // b.448 — si ascolta il registro dei pannelli che coprono lo schermo.
  const [pannelloPieno, setPannelloPieno] = useState(false);
  useEffect(() => ascoltaPannelloPieno(setPannelloPieno), []);

  const navItems = [
    // b.139 — 'Profilo' era italiano fisso in una barra sempre a schermo:
    // la parola piu vista dell'applicazione, e l'unica mai tradotta.
    // 'Community' resta com'e: e il nome della sezione, non una parola comune.
    // b.394 — DENTRO TAXITALK SI ACCENDEVA «COMMUNITY». La schermata
    // vive sotto il vecchio nome di vista 'speaker', rimasto da b.205, ed
    // era rimasto anche nell'elenco di Community. Ma a TaxiTalk ci si
    // arriva dalla Home, non da Community. E 'taxi-chat' non era in
    // nessun elenco: li non si accendeva niente.
    { id: 'home', label: L('navHome'), views: ['home', 'quickinvite', 'speaker', 'taxi-chat'] },
    // b.537 — «Chat» PORTAVA ALL'ARCHIVIO. Il tasto che ogni persona
    // tocca per andare alle conversazioni portava a 'history', cioe alle
    // conversazioni FINITE; quelle VIVE stavano al secondo tocco dentro
    // «Il mondo ora». Dal ragionamento con Luca: adesso porta alle
    // stanze vive, e l'archivio e' una porta dentro quella schermata.
    { id: 'conversations', label: L('navChat'), views: ['stanze', 'history', 'summary', 'detail'] },
    // b.425 — ERA SCRITTA A MANO, e restava in inglese in tutte e
    // trentotto le lingue: nel collaudo, con l'interfaccia in turco,
    // le altre tre voci dicevano «Ana sayfa», «Sohbetler», «Profil» e
    // questa «Community». E' la stessa malattia che b.370 aveva chiuso
    // altrove — e la guardia sulle stringhe cablate non guardava qui.
    { id: 'community', label: L('navCommunity'), views: ['mondo'] },
    { id: 'profile', label: L('navProfile'), views: ['settings', 'account', 'credits', 'apikeys', 'voicetest', 'voice-clone', 'help', 'ai', 'contacts'] },
  ];

  const hiddenViews = new Set(['room', 'lobby', 'join', 'welcome', 'loading']);
  if (hiddenViews.has(currentView)) return null;
  // b.448 — e la barra si toglie anche quando qualcosa COPRE lo schermo
  // (collaudo di Luca sulla mappa a schermo intero: «mi presenta solo una
  // barra sopra il menu a pie di pagina»). La mappa piena vive dentro il
  // ribaltamento della Home, che ha una transform: un antenato trasformato
  // INTRAPPOLA position:fixed, quindi la mappa non puo coprire questa barra
  // per quanto alto sia il suo z-index. Se non puo coprirla, si toglie lei.
  if (pannelloPieno) return null;

  const handleTabClick = (viewId) => { vibrate(15); setView(viewId); };
  const handleFabClick = () => { vibrate(20); onNewConversation ? onNewConversation() : setView('home'); };

  // b.443 — l'accesa e gialla (goldAccent), come nel template: il blu e
  // l'applicazione, il giallo dice dove sei adesso.
  const accentColor = C.goldAccent || '#ffc44d';

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
          justifyContent: 'center', gap: '3px', padding: '2px 10px',
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
        {/* b.443 — TORNA L'ACCIAIO NEL MENU, come nel template (ordine di
            Luca: «non stai usando il menu pie di pagina del template»).
            A b.363 le avevo tolte perche a 48 si leggevano come macchie:
            il template le usa a 26, ed e questa la misura che le fa
            funzionare — piccole e nitide, non grandi e impastate. */}
        {IMG_MENU[item.id]
          // eslint-disable-next-line @next/next/no-img-element -- immagine locale
          ? <img src={IMG_MENU[item.id]} alt="" aria-hidden width={52} height={52}
              style={{ width: 26, height: 26, objectFit: 'contain', display: 'block',
                opacity: isActive ? 1 : 0.55 }} />
          : <NavIcon id={item.id} color={coloreIcona} size={26} />}
        <span style={{ fontSize: '9.5px', fontWeight: '500', color, letterSpacing: '0.2px' }}>{item.label}</span>
      </button>
    );
  };

  return (
    <div style={{
      // b.443 — altezza 62 come nel template (era 94 per reggere l'acciaio
      // a 48; ora l'acciaio e 26 e quell'altezza non serve piu).
      position: 'fixed', bottom: 0, left: 0, right: 0, height: '62px',
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
      <div style={{ width: '56px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button
          onClick={handleFabClick}
          style={{
            // b.443 — il piu sta DENTRO la barra, tondo da 40, come nel
            // template: non piu appeso sopra il bordo.
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(238,242,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.textPrimary || '#fff', border: 'none', padding: 0,
            cursor: 'pointer', transition: 'transform 0.15s', zIndex: 51,
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          aria-label={L('newConversation')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
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
