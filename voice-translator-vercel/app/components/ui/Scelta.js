'use client';
import { useEffect, useRef, useState } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';

// b.363 — I DUE COLORI, gli stessi delle preferenze: il titolo dice DI
// COSA si tratta, il valore dice COM'E' adesso. E niente grigi cupi: sul
// fondo di quest'app (quasi nero) sparirebbero.
const COLORE_TITOLO = 'rgba(186,203,230,0.92)';
const COLORE_VALORE = 'rgba(236,243,255,0.96)';

// ═══════════════════════════════════════════════════════════════
// LA SCELTA SINGOLA — un menu a tendina, non una fila di pillole.
//
// b.363, ordine di Luca: «metti in ordine gli elementi allineati a
// sinistra e in dropdown se la scelta e singola, usa bene gli spazi».
//
// Aveva ragione, e il motivo e di sostanza, non di gusto. Una fila di
// pillole dice "puoi averne piu di una"; una tendina dice "una sola".
// Nel pannello c'erano quattro file di pillole una sotto l'altra —
// argomenti, modi, categorie, lingue — tutte per scelte SINGOLE: una
// parete di bottoni che occupava tutta la colonna, andava a capo dove
// capitava, e non lasciava capire cosa fosse in relazione a cosa.
//
// Una tendina occupa una riga sola, dice a sinistra COSA si sta
// scegliendo e a destra COS'E' SCELTO ADESSO. Quattro tendine in
// colonna si leggono a colpo d'occhio; quaranta pillole no.
// ═══════════════════════════════════════════════════════════════

export default function Scelta({ etichetta, valore, opzioni, onCambia, C, icona = null, versoAlto = false }) {
  const [aperta, setAperta] = useState(false);
  const mio = useRef(null);
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.10)'}`;

  // si chiude toccando fuori: una tendina aperta che resta aperta e una
  // trappola, soprattutto se sotto ce ne sono altre.
  useEffect(() => {
    if (!aperta) return;
    const fuori = (e) => { if (mio.current && !mio.current.contains(e.target)) setAperta(false); };
    document.addEventListener('pointerdown', fuori);
    return () => document.removeEventListener('pointerdown', fuori);
  }, [aperta]);

  const scelta = opzioni.find((o) => o.valore === valore) || opzioni[0];

  return (
    <div ref={mio} style={{ position: 'relative', marginBottom: (etichetta || icona) ? 12 : 0 }}>
      {/* b.367 — senza titolo non si lascia una riga vuota: la tendina in
          fondo alla pagina non ne ha, e quello spazio era un buco. */}
      {(etichetta || icona) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          fontSize: 12, fontWeight: 700, color: COLORE_TITOLO, fontFamily: FONT,
          marginBottom: 6, letterSpacing: 0.2,
        }}>
          {icona && <Icon name={icona} size={13} color={COLORE_TITOLO} />}
          {etichetta}
        </div>
      )}

      <button onClick={() => { vibrate(6); setAperta((v) => !v); }}
        aria-haspopup="listbox" aria-expanded={aperta}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
          background: 'rgba(255,255,255,0.045)',
          border: `1px solid ${aperta ? `${C.accent}55` : 'rgba(255,255,255,0.09)'}`,
          fontFamily: FONT, textAlign: 'left', WebkitTapHighlightColor: 'transparent',
        }}>
        {scelta?.bandiera && <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{scelta.bandiera}</span>}
        <span style={{
          flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: COLORE_VALORE,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {scelta?.etichetta}
          {scelta?.conto != null && (
            <span style={{ color: C.accent, fontWeight: 800 }}> {scelta.conto}</span>
          )}
        </span>
        <span style={{
          color: COLORE_TITOLO, fontSize: 11, flexShrink: 0,
          transform: aperta !== versoAlto ? 'rotate(180deg)' : 'none', transition: 'transform .18s',
        }}>▾</span>
      </button>

      {aperta && (
        <div role="listbox" style={{
          // b.367 — in fondo alla pagina una tendina che si apre verso il
          // basso finisce fuori dallo schermo: li si apre all'insu.
          position: 'absolute', left: 0, right: 0, zIndex: 5,
          ...(versoAlto
            ? { bottom: '100%', marginBottom: 4 }
            : { top: '100%', marginTop: 4 }),
          background: C.bg || '#0b0f1c', border: bordo, borderRadius: 12,
          boxShadow: '0 14px 34px rgba(0,0,0,0.55)', overflow: 'hidden',
          maxHeight: 260, overflowY: 'auto',
        }}>
          {opzioni.map((o) => {
            const scelto = o.valore === scelta?.valore;
            return (
              <button key={String(o.valore)} role="option" aria-selected={scelto}
                onClick={() => { vibrate(6); setAperta(false); onCambia(o.valore); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                  background: scelto ? `${C.accent}14` : 'transparent',
                  border: 'none', borderBottom: bordo, fontFamily: FONT,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {o.bandiera && <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{o.bandiera}</span>}
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 13, fontWeight: scelto ? 800 : 600,
                  color: scelto ? C.accent : 'rgba(214,226,245,0.88)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {o.etichetta}
                  {o.conto != null && <span style={{ color: scelto ? C.accent : 'rgba(150,168,196,0.85)', fontWeight: 700 }}> {o.conto}</span>}
                </span>
                {scelto && <span style={{ color: C.accent, fontSize: 12, flexShrink: 0 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
