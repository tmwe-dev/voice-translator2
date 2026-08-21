'use client';
import { FONT, vibrate } from '../../lib/constants.js';

// ═══════════════════════════════════════════════════════════════
// L'INTERRUTTORE — due stati, uno solo acceso, e si vede da lontano.
//
// b.363, ordine di Luca: «veloce o approfondita switch».
//
// Ha ragione, e la differenza con due tasti affiancati e piu di
// grafica: due tasti dicono "scegli fra queste due cose", un
// interruttore dice "questa cosa e accesa oppure spenta". Veloce e
// approfondita non sono due opzioni alla pari — sono un solo comando che
// si sposta da una parte o dall'altra, e il pallino che scorre lo fa
// vedere anche senza leggere.
//
// Le due parole restano scritte tutte e due, ai lati: chi guarda deve
// sapere cosa succede se lo sposta, non scoprirlo spostandolo.
// ═══════════════════════════════════════════════════════════════

export default function Interruttore({ sinistra, destra, valore, onCambia, C, coloreTitolo }) {
  const aDestra = valore === destra.valore;
  const accento = C.accent || '#26D9B0';
  const spento = coloreTitolo || 'rgba(186,203,230,0.92)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        fontSize: 12.5, fontFamily: FONT,
        fontWeight: aDestra ? 600 : 800,
        color: aDestra ? spento : accento,
      }}>
        {sinistra.etichetta}
      </span>

      <button
        onClick={() => { vibrate(6); onCambia(aDestra ? sinistra.valore : destra.valore); }}
        role="switch" aria-checked={aDestra}
        aria-label={`${sinistra.etichetta} / ${destra.etichetta}`}
        style={{
          position: 'relative', width: 48, height: 27, flexShrink: 0,
          borderRadius: 999, cursor: 'pointer', padding: 0,
          background: aDestra ? `${accento}2E` : 'rgba(255,255,255,0.07)',
          border: `1px solid ${aDestra ? `${accento}66` : 'rgba(255,255,255,0.13)'}`,
          transition: 'background .2s, border-color .2s',
          WebkitTapHighlightColor: 'transparent',
        }}>
        <span style={{
          position: 'absolute', top: 2.5, left: aDestra ? 23 : 2.5,
          width: 20, height: 20, borderRadius: '50%',
          background: aDestra ? accento : 'rgba(226,236,252,0.9)',
          transition: 'left .2s cubic-bezier(0.4,0,0.2,1), background .2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.45)',
        }} />
      </button>

      <span style={{
        fontSize: 12.5, fontFamily: FONT,
        fontWeight: aDestra ? 800 : 600,
        color: aDestra ? accento : spento,
      }}>
        {destra.etichetta}
      </span>
    </div>
  );
}
