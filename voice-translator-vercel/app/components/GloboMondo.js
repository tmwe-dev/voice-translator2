'use client';
import { useRef, useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// b.359 — IL GLOBO DEL MONDO (Luca: «hai il file html usa quello»,
// «devi usare la copia esatta del file»).
//
// Il pianeta 3D e il file che Luca ha approvato (bartalk-completo_2.html),
// copiato VERBATIM in public/mondo-globo.html: three.js e il globo stanno
// dentro il file, intatti. Qui NON si riscrive niente del globo — si mostra
// il file in una cornice, lo si tiene sulla pagina del pianeta e se ne
// nasconde la chrome (che faceva il "doppio menu"), pilotando tutto da
// fuori (stessa origine) con la funzione che il file gia espone (__vai) e
// cliccando i suoi comandi. Zero modifiche al file.
// ═══════════════════════════════════════════════════════════════

// b.361 — i tre stati del pianeta, che nel file sono tre pulsanti
// (Notte/Giorno/Ibrido): qui diventano UNA sola icona che cicla.
const STATI = [
  { id: 'notte', icona: 'luna' },
  { id: 'giorno', icona: 'sole' },
  { id: 'ibrido', icona: 'mezzaluna' },
];

function IconaCielo({ tipo, size = 22, color = '#dfe6f2' }) {
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
  // luna
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </svg>
  );
}

export default function GloboMondo({ altezza = '58vh', sfondo = false }) {
  const ref = useRef(null);
  const timerRef = useRef(null);
  const [stato, setStato] = useState(0); // indice in STATI
  const [pronto, setPronto] = useState(false);

  // tiene il file sulla pagina del pianeta e ne nasconde la chrome
  const tieniIlGlobo = useCallback(() => {
    const w = ref.current?.contentWindow;
    const doc = w?.document;
    if (!doc) return;
    if (!doc.getElementById('bartalk-solo-globo')) {
      const st = doc.createElement('style');
      st.id = 'bartalk-solo-globo';
      // via la chrome del file: testata, schede, ricerca, dock, e i tre
      // pulsanti Notte/Giorno/Ibrido (sostituiti dalla nostra icona unica).
      st.textContent = 'header.testa,.pagina .tabs,.cerca-fluttua,.dock,#dockapp,.terra-sw{display:none!important}';
      (doc.head || doc.documentElement).appendChild(st);
    }
    const community = doc.getElementById('s-community');
    const suGlobo = community && community.classList.contains('on');
    if (!suGlobo && typeof w.__vai === 'function') {
      try { w.__vai('community'); } catch { /* montaggio in corso */ }
    } else if (suGlobo && !pronto) {
      setPronto(true);
    }
  }, [pronto]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // clicca il pulsante del file che imposta lo stato scelto (il file resta
  // intatto: lo comandiamo da fuori come farebbe un dito sul suo bottone).
  const cambiaCielo = () => {
    const prossimo = (stato + 1) % STATI.length;
    setStato(prossimo);
    try {
      const doc = ref.current?.contentWindow?.document;
      const bottoni = doc?.querySelectorAll('.terra-sw button, .terra-sw [role="button"]');
      if (bottoni && bottoni[prossimo]) bottoni[prossimo].click();
    } catch { /* il file non e ancora pronto: al prossimo giro */ }
  };

  // b.361 — INTEGRATO, non incastrato (collaudo di Luca: «hai inserito un
  // oggetto dentro un'altra pagina invece di integrarlo»). In modalita
  // `sfondo` il pianeta riempie TUTTA la pagina Mondo dietro i comandi: non
  // e piu un riquadro-nel-riquadro, e la sola testata che si vede e quella
  // di BarTalk che gli fluttua sopra.
  const contenitore = sfondo
    ? { position: 'absolute', inset: 0, zIndex: 0, background: '#05070f', overflow: 'hidden' }
    : { width: '100%', height: altezza, borderRadius: 18, overflow: 'hidden', position: 'relative', flexShrink: 0, background: '#05070f' };

  return (
    <div style={contenitore}>
      <iframe
        ref={ref}
        src="/mondo-globo.html"
        title="Il mondo ora"
        onLoad={() => {
          clearInterval(timerRef.current);
          timerRef.current = setInterval(tieniIlGlobo, 400);
          tieniIlGlobo();
        }}
        allow="accelerometer; gyroscope"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />

      {/* b.361 — UNA SOLA ICONA per il cielo del pianeta (Luca: «trasforma i
          tre pulsanti Notte/Giorno in una sola icona che cambia stato — sole,
          luna, mezza luna — senza bordi o sfondi»). Nuda, SOTTO la linguetta
          della lingua, a sinistra (Luca: «sposta sotto la linguetta»). */}
      {pronto && (
        <button onClick={cambiaCielo} aria-label="Cielo del pianeta"
          style={{
            position: 'fixed', left: 22,
            top: 'max(238px, calc(env(safe-area-inset-top) + 214px))', zIndex: 61,
            background: 'none', border: 'none', padding: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}>
          <IconaCielo tipo={STATI[stato].icona} size={26} />
        </button>
      )}
    </div>
  );
}
