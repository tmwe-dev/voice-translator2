'use client';
import { useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// IL GLOBO DEL MONDO — il file di Luca, adattato per l'innesto.
//
// Il pianeta e l'app che Luca ha approvato (bartalk-completo_2.html),
// copiata in public/mondo-globo.html e ADATTATA li dentro quel tanto che
// serve per stare nella pagina Mondo: parte gia sulla pagina del pianeta e
// nasconde la propria chrome (testata, schede, ricerca, dock, i tre pulsanti
// Notte/Giorno). Qui si innesta l'iframe, punto — niente hack dall'esterno.
//
// L'unico comando che resta qui e l'icona del cielo (luna/sole/mezzaluna),
// che clicca i pulsanti del file (esistono ancora nel DOM, solo nascosti).
// ═══════════════════════════════════════════════════════════════

const STATI = [
  { id: 'notte', icona: 'luna' },
  { id: 'giorno', icona: 'sole' },
  { id: 'ibrido', icona: 'mezzaluna' },
];

function IconaCielo({ tipo, size = 26, color = '#dfe6f2' }) {
  if (tipo === 'sole') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.2" fill={color} stroke="none" />
        {[0,45,90,135,180,225,270,315].map((a) => {
          const r = a * Math.PI / 180;
          return <line key={a} x1={12 + Math.cos(r) * 7} y1={12 + Math.sin(r) * 7} x2={12 + Math.cos(r) * 9.5} y2={12 + Math.sin(r) * 9.5} />;
        })}
      </svg>
    );
  }
  if (tipo === 'mezzaluna') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke={color} strokeWidth="2" />
        <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill={color} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </svg>
  );
}

export default function GloboMondo({ sfondo = false }) {
  const ref = useRef(null);
  const [stato, setStato] = useState(0);

  const cambiaCielo = () => {
    const prossimo = (stato + 1) % STATI.length;
    setStato(prossimo);
    try {
      const doc = ref.current?.contentWindow?.document;
      const bottoni = doc?.querySelectorAll('.terra-sw button, .terra-sw [role="button"]');
      if (bottoni && bottoni[prossimo]) bottoni[prossimo].click();
    } catch { /* il file non e ancora pronto */ }
  };

  const contenitore = sfondo
    ? { position: 'absolute', inset: 0, zIndex: 0, background: '#05070f', overflow: 'hidden' }
    : { width: '100%', height: '58vh', borderRadius: 18, overflow: 'hidden', position: 'relative', flexShrink: 0, background: '#05070f' };

  return (
    <>
      <div style={contenitore}>
        <iframe
          ref={ref}
          src="/mondo-globo.html"
          title="Il mondo ora"
          allow="accelerometer; gyroscope"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>

      {/* icona del cielo (Luca: una sola icona luna/sole/mezzaluna, nuda,
          sotto la linguetta a sinistra). FUORI dal contenitore del globo,
          altrimenti resta intrappolata nel suo livello e non e cliccabile
          (collaudo di Luca). Qui e un fratello, sopra tutto. */}
      <button onClick={cambiaCielo} aria-label="Cielo del pianeta"
        style={{
          position: 'fixed', left: 22,
          top: 'max(238px, calc(env(safe-area-inset-top) + 214px))', zIndex: 70,
          background: 'none', border: 'none', padding: 6, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>
        <IconaCielo tipo={STATI[stato].icona} size={26} />
      </button>
    </>
  );
}
