'use client';
import { useEffect, useRef, useState } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';

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

export default function Scelta({ etichetta, valore, opzioni, onCambia, C }) {
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
    <div ref={mio} style={{ position: 'relative', marginBottom: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: C.textMuted, fontFamily: FONT,
        marginBottom: 5, letterSpacing: 0.2,
      }}>
        {etichetta}
      </div>

      <button onClick={() => { vibrate(6); setAperta((v) => !v); }}
        aria-haspopup="listbox" aria-expanded={aperta}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
          background: C.card, border: bordo, fontFamily: FONT,
          textAlign: 'left', WebkitTapHighlightColor: 'transparent',
        }}>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: C.textPrimary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {scelta?.etichetta}
          {scelta?.conto != null && (
            <span style={{ color: C.textMuted, fontWeight: 600 }}> {scelta.conto}</span>
          )}
        </span>
        <span style={{
          color: C.textMuted, fontSize: 11, flexShrink: 0,
          transform: aperta ? 'rotate(180deg)' : 'none', transition: 'transform .18s',
        }}>▾</span>
      </button>

      {aperta && (
        <div role="listbox" style={{
          position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, zIndex: 5,
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
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 13, fontWeight: scelto ? 800 : 600,
                  color: scelto ? C.accent : C.textSecondary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {o.etichetta}
                  {o.conto != null && <span style={{ opacity: 0.6, fontWeight: 600 }}> {o.conto}</span>}
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
