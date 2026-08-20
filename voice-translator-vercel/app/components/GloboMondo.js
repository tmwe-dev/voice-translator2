'use client';
import { useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// b.359 — IL GLOBO DEL MONDO (Luca: «hai il file html usa quello»,
// «devi usare la copia esatta del file»).
//
// Il pianeta 3D e il file che Luca ha approvato (bartalk-completo_2.html),
// copiato VERBATIM in public/mondo-globo.html: three.js e il globo stanno
// dentro il file, intatti. Qui NON si riscrive niente del globo — si mostra
// il file in una cornice e lo si apre direttamente sulla pagina del
// pianeta, pilotandolo dall'esterno (stessa origine) con la funzione che il
// file stesso espone, `window.__vai`. Zero modifiche al file.
//
// Stesso schema dello Scanner BizCard: copia esatta in public/, iframe,
// aggancio via funzione globale gia esposta dal file.
// ═══════════════════════════════════════════════════════════════

export default function GloboMondo({ altezza = '58vh' }) {
  const ref = useRef(null);

  return (
    <div style={{
      width: '100%', height: altezza, borderRadius: 18, overflow: 'hidden',
      position: 'relative', flexShrink: 0, background: '#05070f',
    }}>
      <iframe
        ref={ref}
        src="/mondo-globo.html"
        title="Il mondo ora"
        onLoad={() => {
          // il file naviga con __vai(): lo apriamo sul globo (community).
          // Il globo e React e si monta DOPO il load dell'iframe, quindi la
          // schermata puo ancora tornare alla home: si insiste per qualche
          // istante finche la pagina community non e davvero quella accesa.
          // Il bundle (three + React) e pesante e `__vai` compare solo
          // quando lo script grande ha finito di girare: si aspetta che la
          // funzione esista, poi la si chiama, e si insiste finche la
          // pagina community non e davvero accesa. Fino a 10 secondi.
          let tentativi = 0;
          const timer = setInterval(() => {
            tentativi++;
            const w = ref.current?.contentWindow;
            const community = w?.document?.getElementById('s-community');
            if (typeof w?.__vai === 'function') {
              try { w.__vai('community'); } catch { /* la chiamata puo fallire durante il montaggio */ }
            }
            if ((community && community.classList.contains('on')) || tentativi > 50) {
              clearInterval(timer);
            }
          }, 200);
        }}
        allow="accelerometer; gyroscope"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </div>
  );
}
