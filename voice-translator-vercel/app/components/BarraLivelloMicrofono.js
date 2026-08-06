'use client';
import { useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// BARRA DEL LIVELLO — si disegna da sola, fuori da React.
//
// Il livello del microfono cambia sessanta volte al secondo. Farlo
// passare da uno stato React significava ridisegnare tutta la stanza —
// intestazione, comandi, e ogni nuvoletta con il suo avatar e le sue
// reazioni — sessanta volte al secondo, per una barretta alta quaranta
// pixel.
//
// Qui il valore arriva in un RIFERIMENTO. Il componente si monta una
// volta e poi scrive direttamente l'altezza e il colore sul nodo, con il
// proprio ciclo a fotogrammi. React non viene disturbato mai piu.
//
// Due accortezze:
//  · si aggiorna solo quando il valore e cambiato abbastanza da vedersi
//    (mezzo punto percentuale): sotto quella soglia e lavoro sprecato
//  · il ciclo si ferma appena si smette di ascoltare, e quando la scheda
//    passa in secondo piano
// ═══════════════════════════════════════════════════════════════

const SOGLIA_VISIBILE = 0.005; // sotto mezzo punto percentuale non si vede

export default function BarraLivelloMicrofono({ livelloRef, attiva, C }) {
  const riempimentoRef = useRef(null);
  const ultimoRef = useRef(-1);

  useEffect(() => {
    if (!attiva) return undefined;
    let vivo = true;
    let richiesta = null;

    const disegna = () => {
      if (!vivo) return;
      if (document.hidden) { richiesta = requestAnimationFrame(disegna); return; }

      const nodo = riempimentoRef.current;
      const livello = Math.max(0, Math.min(1, livelloRef?.current ?? 0));

      if (nodo && Math.abs(livello - ultimoRef.current) > SOGLIA_VISIBILE) {
        ultimoRef.current = livello;
        nodo.style.height = `${Math.round(livello * 100)}%`;
        nodo.style.background = livello > 0.5 ? '#4ade80'
          : livello > 0.15 ? '#667eea'
          : 'rgba(255,255,255,0.2)';
      }
      richiesta = requestAnimationFrame(disegna);
    };
    richiesta = requestAnimationFrame(disegna);

    return () => {
      vivo = false;
      if (richiesta) cancelAnimationFrame(richiesta);
      ultimoRef.current = -1;
    };
  }, [attiva, livelloRef]);

  if (!attiva) return null;

  return (
    <div
      // Nessun ruolo ARIA: un valore che cambia sessanta volte al secondo
      // non si puo annunciare a voce, e un `meter` senza aria-valuenow e
      // solo una promessa non mantenuta. Che si stia ascoltando lo dice
      // gia il pulsante accanto, che ha il suo stato leggibile.
      aria-hidden="true"
      style={{
        width: 6, height: 40, borderRadius: 3,
        background: C?.overlayBg || 'rgba(255,255,255,0.1)',
        overflow: 'hidden', position: 'relative',
      }}>
      <div ref={riempimentoRef} style={{
        position: 'absolute', bottom: 0, width: '100%', borderRadius: 3,
        height: '0%', background: 'rgba(255,255,255,0.2)',
        transition: 'height 0.08s linear',
      }} />
    </div>
  );
}
