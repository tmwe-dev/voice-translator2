'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

export default function PannelloLaterale({ aperto, onChiudi, titolo, C, children , sopra = false }) {
  // b.514 — CONFERMATO (Luca: «il velo non chiude piu, ho dovuto rompere
  // tutto per fartelo vedere»): il velo (position:fixed, inset:0) viveva
  // dentro il flusso normale della colonna della sezione. Un antenato con
  // position:absolute + transform (il layout a due colonne, su schermi
  // abbastanza larghi) diventa il containing block di QUALSIASI fixed al
  // suo interno — CSS lo prevede cosi apposta. Il velo restava quindi
  // grande quanto la colonna (rilevato: 440x635 su una finestra 1064x1122),
  // non quanto lo schermo: fuori da li il click non lo toccava mai, il
  // pannello restava aperto per sempre. Un portal in document.body monta
  // il pannello fuori da QUALSIASI antenato: fixed torna a essere relativo
  // alla finestra, sempre, indipendentemente da chi lo ospita.
  const [montato, setMontato] = useState(false);
  useEffect(() => { setMontato(true); }, []);

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

  if (!aperto || !montato) return null;

  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.08)'}`;

  return createPortal(
    <>
      {/* il velo: si tocca fuori e si chiude */}
      <div onClick={() => { vibrate(6); onChiudi?.(); }}
        style={{ position: 'fixed', inset: 0, zIndex: sopra ? 120 : 88, background: 'rgba(0,0,0,0.5)' }} />

      <aside role="dialog" aria-modal="true" aria-label={titolo}
        style={{
          // b.516 — Luca dal vivo: «lo scroll non va e parte del container
          // finisce sotto il menu in alto, abbassa e dimensiona perche
          // resti dentro lo schermo; allarga, hai lasciato troppo margine
          // laterale». Due bug distinti nella stessa riga:
          // - `100dvh` invece di `top:0,bottom:0`: col solo top/bottom un
          //   fixed prende il viewport GRANDE (quello che ignora le barre
          //   del browser che vanno e vengono su mobile) — la parte alta
          //   del pannello finiva sotto quelle barre quando erano aperte.
          //   La "dynamic viewport height" si aggiusta da sola.
          // - largo il doppio (era fisso a 330px, che su schermi ampi
          //   lasciava piu della meta della finestra come solo velo).
          // b.535 — `sopra`: aperto dalla linguetta DENTRO il feed (z 97)
          // il pannello deve salirci sopra, se no e' un'altra porta che si
          // apre dietro un velo (la stessa malattia di «apri e traduci»).
          position: 'fixed', left: 0, top: 0, zIndex: sopra ? 121 : 89,
          height: '100dvh', maxHeight: '100dvh',
          width: 'min(460px, 92vw)', display: 'flex', flexDirection: 'column',
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
          padding: 'max(16px, calc(env(safe-area-inset-top) + 12px)) 20px 12px',
          borderBottom: bordo,
        }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{titolo}</span>
          <button onClick={() => { vibrate(6); onChiudi?.(); }} aria-label="✕"
            style={{
              width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
              background: C.card, border: bordo, color: C.textMuted, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>✕</button>
        </header>

        <div style={{
          // b.516 — IL BUG VERO DELLO SCROLL: un figlio flex con
          // `flex:1` ha di default `min-height:auto`, che in un
          // contenitore a colonna lo forza a restare alto quanto TUTTO
          // il suo contenuto invece di fermarsi all'altezza del
          // genitore — `overflow:auto` non scatta mai perche il figlio
          // non trabocca mai (si allarga lui). `minHeight:0` gli
          // permette di restringersi davvero: solo cosi l'overflow ha
          // senso di esistere.
          flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none',
          padding: '14px 20px calc(20px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {children}
        </div>

        <style>{`
          @keyframes vtPannelloEntra { from { transform: translateX(-102%); } to { transform: translateX(0); } }
        `}</style>
      </aside>
    </>,
    document.body
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
