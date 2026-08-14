'use client';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { PALETTE } from '../lib/palette.js';
import { ascoltaAvvisi, dismissToast } from '../lib/avvisi.js';
import { t, preloadLang, linguaInterfacciaFuoriContesto } from '../lib/i18n.js';

// ═══════════════════════════════════════════════
// Toast Notification System
// Non-blocking error/info/success messages
// Auto-dismiss, stackable, with retry action
// ═══════════════════════════════════════════════

// b.111 — la coda degli avvisi e uscita da questo file (lib/avvisi.js).
// Qui c'e solo il disegno. Il motivo e concreto: questo file contiene
// JSX, e chi voleva avvisare l'utente da un hook doveva importarlo. Il
// primo che ci ha provato ha fatto smettere di caricare un intero file
// di test, perche il nostro esecutore non legge JSX dentro un .js.
// Ma il difetto vero era la dipendenza al contrario: un hook non deve
// dipendere da come le cose sono disegnate.
export { addToast, dismissToast, toast } from '../lib/avvisi.js';

// Colori dalla tavolozza centrale, non inventati qui. Segni tipografici
// al posto delle emoji: nell'app non entrano emoji, in nessun punto.
const COLORS = {
  info: { tinta: PALETTE.blue, icon: 'i' },
  error: { tinta: PALETTE.red, icon: '!' },
  success: { tinta: PALETTE.green, icon: '✓' },
  warning: { tinta: PALETTE.amber, icon: '!' },
};
// Da un colore pieno ricavo fondo e bordo trasparenti, senza riscrivere rgba a mano.
const velo = (tinta, opacita) => `${tinta}${Math.round(opacita * 255).toString(16).padStart(2, '0')}`;

// b.138 — l'etichetta del pulsante di chiusura era in italiano fisso e
// finiva nei lettori di schermo. Anche questo contenitore vive fuori da
// AppProvider (page.js, sopra <HomeInner/>), quindi legge la lingua da se.
const ToastContainer = memo(function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const [lingua, setLingua] = useState('en');

  useEffect(() => ascoltaAvvisi(setToasts), []);
  useEffect(() => { const l = linguaInterfacciaFuoriContesto(); setLingua(l); preloadLang(l); }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8,
      maxWidth: 'calc(100vw - 32px)', width: 360,
      pointerEvents: 'none',
    }} role="alert" aria-live="assertive">
      {toasts.map(t => {
        const base = COLORS[t.type] || COLORS.info;
        const c = { ...base, bg: velo(base.tinta, 0.15), border: velo(base.tinta, 0.35), text: base.tinta };
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 12,
            background: c.bg, border: `1px solid ${c.border}`,
            backdropFilter: 'blur(16px)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'vtSlideIn 0.2s ease-out',
            pointerEvents: 'auto',
          }}>
            <span style={{
              flexShrink: 0, width: 20, height: 20, borderRadius: 999,
              display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800,
              color: c.text, border: `1px solid ${c.border}`,
            }}>{c.icon}</span>
            <span style={{ flex: 1, fontSize: 13, color: c.text, lineHeight: 1.4 }}>
              {t.message}
            </span>
            {t.action && (
              <button
                onClick={() => { t.action.onClick(); dismissToast(t.id); }}
                style={{
                  padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'rgba(255,255,255,0.1)', border: `1px solid ${c.border}`,
                  color: c.text, cursor: 'pointer', flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismissToast(t.id)}
              aria-label={t(lingua, 'closeNotification')}
              style={{
                background: 'none', border: 'none', color: c.text, cursor: 'pointer',
                fontSize: 14, padding: '2px 4px', opacity: 0.6, flexShrink: 0,
              }}
            >✕</button>
          </div>
        );
      })}
    </div>
  );
});

export default ToastContainer;
