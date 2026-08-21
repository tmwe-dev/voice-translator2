'use client';
import { useRef, useState } from 'react';
import { postoADestra } from '../lib/righello.js';

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

export default function GloboMondo({ sfondo = false, titolo = 'Il mondo ora', etichettaCielo = 'Cielo del pianeta' }) {
  const ref = useRef(null);
  const [stato, setStato] = useState(0);

  const cambiaCielo = () => {
    // b.363 — l'icona avanzava PRIMA di sapere se il comando era arrivato: se
    // il pianeta non era ancora pronto, mostrava il sole mentre il cielo
    // restava notte. Ora avanza solo a comando dato davvero.
    try {
      const doc = ref.current?.contentWindow?.document;
      const bottoni = doc?.querySelectorAll('.terra-sw button, .terra-sw [role="button"]');
      if (!bottoni || !bottoni.length) return;
      // b.363 (secondo giro) — non si conta piu per conto proprio: il file
      // dichiara da se quale cielo e acceso (il tasto porta la classe 'on').
      // Cosi l'icona resta fedele anche se il cielo cambia dentro il file,
      // o se un giorno i tasti saranno tre in un altro ordine.
      let acceso = -1;
      for (let i = 0; i < bottoni.length; i++) if (bottoni[i].classList?.contains('on')) { acceso = i; break; }
      const partenza = acceso >= 0 ? acceso : stato;
      const prossimo = (partenza + 1) % bottoni.length;
      bottoni[prossimo].click();
      setStato(prossimo % STATI.length);
    } catch { /* il file non e ancora pronto: l'icona non mente, resta com'e */ }
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
          title={titolo}
          allow="accelerometer; gyroscope"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>

      {/* icona del cielo (Luca: una sola icona luna/sole/mezzaluna, nuda,
          sotto la linguetta a sinistra). FUORI dal contenitore del globo,
          altrimenti resta intrappolata nel suo livello e non e cliccabile
          (collaudo di Luca). Qui e un fratello, sopra tutto. */}
      {/* b.363 — l'etichetta era in italiano fisso: chi usa un lettore di
          schermo in un'altra lingua sentiva una parola italiana in mezzo a
          un'interfaccia tradotta. */}
      <button onClick={cambiaCielo} aria-label={etichettaCielo}
        style={{
          // b.363 — SECONDO posto della colonna di destra, sotto la pila
          // (vedi lib/righello.js). Prima era su un asse tutto suo e si
          // vedeva che non era in riga con lei.
          ...postoADestra(1), zIndex: 70,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}>
        <IconaCielo tipo={STATI[stato].icona} size={26} />
      </button>
    </>
  );
}
