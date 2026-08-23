'use client';
import { useEffect } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import { formaLinguetta, LINGUETTA, postoASinistra } from '../../lib/righello.js';

// ═══════════════════════════════════════════════════════════════
// IL PANNELLO LATERALE — dove vivono filtri e impostazioni di una
// sezione, quando non le si sta usando.
//
// b.363, ordine di Luca. Sopra il pianeta galleggiava una vetrina di
// attrezzi sempre accesi: campo di ricerca, fila delle lingue, fila dei
// modi, e in News anche i due modi e le categorie. Coprivano meta mondo
// anche quando nessuno li stava usando, e i CONTENUTI — le stanze, gli
// articoli — finivano sotto, fuori dalla vista.
//
// Al primo tentativo li avevo solo nascosti dietro l'icona di sezione:
// toccandola ricomparivano dov'erano, cioe di nuovo sopra il mondo. Non
// era quello che serviva. Serve un posto DIVERSO dove metterli: un
// pannello che entra da sinistra, con dentro tutto, e che si chiude.
//
// La maniglia e una linguetta sul bordo, come quella della lingua in
// fondo: si vede sempre, dice da che parte si apre, e non copre niente.
// ═══════════════════════════════════════════════════════════════

export default function PannelloLaterale({ aperto, onChiudi, titolo, C, children }) {
  // b.363 — col pannello aperto la pagina dietro non scorre: altrimenti
  // si trascina il mondo credendo di scorrere l'elenco dei filtri.
  useEffect(() => {
    if (!aperto) return;
    const prima = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prima; };
  }, [aperto]);

  // b.363 — il tasto Esc chiude, come ogni pannello che si rispetti.
  useEffect(() => {
    if (!aperto) return;
    const suTasto = (e) => { if (e.key === 'Escape') onChiudi?.(); };
    window.addEventListener('keydown', suTasto);
    return () => window.removeEventListener('keydown', suTasto);
  }, [aperto, onChiudi]);

  if (!aperto) return null;

  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.08)'}`;

  return (
    <>
      {/* il velo: si tocca fuori e si chiude */}
      <div onClick={() => { vibrate(6); onChiudi?.(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 88, background: 'rgba(0,0,0,0.5)' }} />

      <aside role="dialog" aria-modal="true" aria-label={titolo}
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 89,
          width: 'min(330px, 86vw)', display: 'flex', flexDirection: 'column',
          // coprente: dietro c'e il pianeta, e attraverso un pannello
          // translucido si leggeva tutto (la lezione della tendina paese).
          background: C.bg || '#080b16',
          borderRight: bordo,
          boxShadow: '10px 0 40px rgba(0,0,0,0.55)',
          fontFamily: FONT,
          animation: 'vtPannelloEntra .22s cubic-bezier(0.4,0,0.2,1)',
        }}>
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          padding: 'max(16px, calc(env(safe-area-inset-top) + 12px)) 14px 12px',
          borderBottom: bordo,
        }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: C.textPrimary }}>{titolo}</span>
          <button onClick={() => { vibrate(6); onChiudi?.(); }} aria-label="✕"
            style={{
              width: 34, height: 34, borderRadius: 12, cursor: 'pointer',
              background: C.card, border: bordo, color: C.textMuted, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>✕</button>
        </header>

        <div style={{
          flex: 1, overflowY: 'auto', scrollbarWidth: 'none',
          padding: '14px 14px calc(20px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {children}
        </div>

        <style>{`
          @keyframes vtPannelloEntra { from { transform: translateX(-102%); } to { transform: translateX(0); } }
        `}</style>
      </aside>
    </>
  );
}

/**
 * La linguetta sul bordo sinistro che apre il pannello. Sta sotto la
 * testata, sporge appena, e non copre il mondo.
 */
export function LinguettaPannello({ onApri, C, etichetta }) {
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.10)'}`;
  return (
    // b.363 — misure dal righello comune: questa linguetta e quella della
    // lingua erano larghe una trenta e l'altra cinquanta, una attaccata al
    // bordo e una staccata di dieci, con due forme diverse. Ora sono
    // gemelle: stessa larghezza, stessa forma, stesso bordo.
    <button onClick={() => { vibrate(8); onApri?.(); }} aria-label={etichetta} title={etichetta}
      style={{
        // b.400 — la quota viene dal righello: posto 0 della fila a sinistra.
        ...formaLinguetta(C, postoASinistra(0)),
        zIndex: 62,
      }}>
      {/* tre righine: il segno universale di "qui ci sono i comandi" */}
      <svg width={LINGUETTA.icona} height={LINGUETTA.icona} viewBox="0 0 24 24" fill="none"
        stroke={C.textSecondary || 'rgba(240,244,255,0.75)'} strokeWidth={1.4} strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="14" y2="17" />
      </svg>
    </button>
  );
}
