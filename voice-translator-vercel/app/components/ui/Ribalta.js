'use client';
import { useEffect, useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// IL RIBALTAMENTO — l'elenco gira su se stesso e dietro c'e l'articolo.
//
// b.365, ordine di Luca: «quando voglio leggere l'articolo ribalta il
// container elenco di 180 gradi e permetti di leggere l'articolo; fai
// la stessa cosa per visualizzare i commenti o entrare nella chat».
//
// PERCHE' E' MEGLIO DI UNA PAGINA NUOVA. Una schermata che si apre
// sopra dice "sei andato via, poi tornerai". Un foglio che si gira dice
// "e sempre la stessa cosa, vista dall'altra parte" — e non si perde il
// posto: quando torna, l'elenco e esattamente dov'era, alla riga dov'era.
// Non e un effetto: e la promessa che non stai lasciando niente.
//
// LO SPAZIO NON CAMBIA MAI. Le due facce stanno nello stesso riquadro,
// sovrapposte, della stessa altezza. Girare non spinge in basso niente e
// non fa saltare la pagina: e la regola di sempre — cio che appare
// SOSTITUISCE nello stesso posto.
//
// E CHI NON VUOLE L'ANIMAZIONE non la subisce: se il telefono dice di
// ridurre il movimento, le facce si scambiano e basta. Una rotazione di
// mezzo giro, per certe persone, e nausea vera.
// ═══════════════════════════════════════════════════════════════

export default function Ribalta({ girato, fronte, retro, durata = 520 }) {
  // il retro si costruisce solo quando serve la prima volta, ma da li in
  // poi resta: se lo si smontasse a ogni ritorno, riaprire lo stesso
  // articolo lo farebbe ricaricare da capo.
  const [retroNato, setRetroNato] = useState(!!girato);
  const [animato, setAnimato] = useState(true);
  const mio = useRef(null);

  useEffect(() => { if (girato) setRetroNato(true); }, [girato]);

  useEffect(() => {
    const q = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!q) return;
    const leggi = () => setAnimato(!q.matches);
    leggi();
    q.addEventListener?.('change', leggi);
    return () => q.removeEventListener?.('change', leggi);
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // b.450 — LA HOME SPECCHIATA SU TELEFONO. Collaudo di Luca: «su mobile
  // appare una immagine inversa della home».
  //
  // Era il RETRO della faccia davanti. `backface-visibility: hidden` c'era
  // gia — ed e la difesa giusta — ma su Safari di iPhone non regge: basta
  // che dentro una faccia ci sia qualcosa che rompe il contesto 3D (una
  // zona che scorre, una sfocatura, un elemento fisso) e il browser
  // APPIATTISCE il 3D. Appiattito, «nascondi il retro» non significa piu
  // niente, e cosi la Home ricompariva rovesciata.
  //
  // Percio non ci si appoggia piu. La faccia che non si deve vedere si
  // spegne con `visibility`, che nessun browser interpreta a modo suo. Lo
  // scambio avviene a META giro, quando il foglio e di taglio: e il solo
  // istante in cui non si vede ne l'una ne l'altra, quindi non si nota.
  // ═══════════════════════════════════════════════════════════════
  const [mostrato, setMostrato] = useState(girato ? 'retro' : 'fronte');
  useEffect(() => {
    const meta = animato ? Math.max(0, Math.round(durata / 2)) : 0;
    const id = setTimeout(() => setMostrato(girato ? 'retro' : 'fronte'), meta);
    return () => clearTimeout(id);
  }, [girato, animato, durata]);

  const faccia = {
    position: 'absolute', inset: 0,
    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    display: 'flex', flexDirection: 'column', minHeight: 0,
  };

  return (
    <div style={{ flex: 1, minHeight: 0, perspective: 2000, position: 'relative' }}>
      <div ref={mio} style={{
        position: 'absolute', inset: 0,
        transformStyle: 'preserve-3d',
        transform: girato ? 'rotateY(180deg)' : 'rotateY(0deg)',
        transition: animato ? `transform ${durata}ms cubic-bezier(0.4, 0.0, 0.2, 1)` : 'none',
      }}>
        {/* la faccia davanti: l'elenco. Quando e girata non deve
            prendere tocchi, se no si tocca l'elenco attraverso
            l'articolo. */}
        <div style={{ ...faccia,
          pointerEvents: girato ? 'none' : 'auto',
          visibility: mostrato === 'fronte' ? 'visible' : 'hidden',
        }} aria-hidden={girato}>
          {fronte}
        </div>

        {/* la faccia dietro: gia ruotata, cosi quando il foglio gira si
            presenta dritta. */}
        <div style={{
          ...faccia,
          transform: 'rotateY(180deg)',
          pointerEvents: girato ? 'auto' : 'none',
          visibility: mostrato === 'retro' ? 'visible' : 'hidden',
        }} aria-hidden={!girato}>
          {retroNato ? retro : null}
        </div>
      </div>
    </div>
  );
}
