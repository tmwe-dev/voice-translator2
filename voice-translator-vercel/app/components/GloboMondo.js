'use client';
import { useEffect, useRef, useState } from 'react';
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

export default function GloboMondo({ sfondo = false, titolo = 'Il mondo ora', etichettaCielo = 'Cielo del pianeta', paese = null, rotte = null, traffico = null, onPaeseScelto = null }) {
  const ref = useRef(null);
  const [stato, setStato] = useState(0);

  // b.363 — IL PAESE SCELTO DA FUORI ARRIVA AL PIANETA. Finora il globo e
  // l'app non si parlavano: toccando un paese sulla mappa lo sapeva solo
  // il globo, e scegliendolo dall'elenco l'app non aveva modo di dirglielo.
  // Cosi il pianeta restava fermo dove stava, mentre l'utente aveva appena
  // detto dove voleva andare.
  // Qui il paese viaggia dentro il file, che lo seleziona: e con la
  // selezione parte lo ZOOM che il pianeta sa gia fare per conto suo —
  // nessuna animazione nuova, quella che c'e gia (ordine di Luca).
  useEffect(() => {
    const finestra = ref.current?.contentWindow;
    if (!finestra) return;
    const manda = () => {
      try { finestra.postMessage({ tipo: 'bartalk:paese', code: paese || null }, '*'); }
      catch { /* il pianeta non e ancora pronto: si riprova quando lo dice lui */ }
    };
    manda();
    // se il pianeta si e appena acceso, glielo si ridice: al primo giro
    // puo non essere ancora in ascolto.
    const suPronto = (ev) => { if (ev?.data?.tipo === 'bartalk:globo-pronto') manda(); };
    window.addEventListener('message', suPronto);
    return () => window.removeEventListener('message', suPronto);
  }, [paese]);

  // b.363 — LE ROTTE VERE. Gli aeroplanini facevano la spola su otto
  // tratte inventate, sempre le stesse. Ora ricevono anche quelle dove ci
  // sono stanze aperte davvero: il pianeta diventa un indicatore di dove
  // si sta parlando. Si AGGIUNGONO a quelle di scena (ordine di Luca):
  // senza stanze aperte il cielo resterebbe vuoto, e un cielo vuoto non
  // dice "non c'e nessuno", dice "e rotto".
  useEffect(() => {
    const finestra = ref.current?.contentWindow;
    if (!finestra || !rotte?.length) return;
    const manda = () => {
      try { finestra.postMessage({ tipo: 'bartalk:rotte', coppie: rotte }, '*'); }
      catch { /* il pianeta non e ancora acceso: si riprova quando lo dice lui */ }
    };
    manda();
    const suPronto = (ev) => { if (ev?.data?.tipo === 'bartalk:globo-pronto') manda(); };
    window.addEventListener('message', suPronto);
    return () => window.removeEventListener('message', suPronto);
  }, [rotte]);

  // b.363 — I PUNTINI SI ACCENDONO DOVE C'E PIU GENTE (ordine di Luca).
  // Prima ogni paese aveva uno di tre stati soli — scelto, attivo,
  // spento — quindi un paese con una stanza e uno con venti si vedevano
  // identici. Ora il colore si scalda in proporzione, e la mappa dice a
  // colpo d'occhio DOVE si sta parlando, non solo dove si potrebbe.
  useEffect(() => {
    const finestra = ref.current?.contentWindow;
    if (!finestra || !traffico) return;
    const manda = () => {
      try { finestra.postMessage({ tipo: 'bartalk:traffico', perPaese: traffico }, '*'); }
      catch { /* il pianeta non e ancora acceso: si riprova quando lo dice lui */ }
    };
    manda();
    const suPronto = (ev) => { if (ev?.data?.tipo === 'bartalk:globo-pronto') manda(); };
    window.addEventListener('message', suPronto);
    return () => window.removeEventListener('message', suPronto);
  }, [traffico]);

  // b.370 — IL CIELO SI CAMBIA CON UN MESSAGGIO, non entrando in casa
  // d'altri. Prima questo comando apriva il documento dentro l'iframe e
  // PREMEVA i bottoni nascosti del file (.terra-sw). Ha funzionato
  // finche quei bottoni esistevano: appena il globo ha smesso di
  // disegnare la sua interfaccia (b.369) il comando e morto in silenzio,
  // ed e cosi che Luca l'ha trovato.
  //
  // Non era solo fragile: era la regola rotta. Gli altri tre comandi
  // (paese, rotte, traffico) parlano al globo con un messaggio, e il
  // globo li ascolta perche dentro il file c'e scritto che li ascolta.
  // Questo faceva di testa sua. Ora fa come gli altri.
  const CIELI = ['navigator', 'wueform', 'ibrido'];
  // b.383 — IL PIANETA ADESSO PARLA. Finora la conversazione era a senso
  // unico: noi gli dicevamo dove guardare, e il paese toccato sul globo
  // restava chiuso li dentro. Quindi si poteva zoomare sull'Italia e le
  // liste sotto continuavano a mostrare il mondo intero.
  useEffect(() => {
    const suMessaggio = (ev) => {
      const d = ev?.data;
      if (!d || d.tipo !== 'bartalk:paese-scelto') return;
      onPaeseScelto?.(d.code ? String(d.code).toUpperCase() : null);
    };
    window.addEventListener('message', suMessaggio);
    return () => window.removeEventListener('message', suMessaggio);
  }, [onPaeseScelto]);

  const cambiaCielo = () => {
    const finestra = ref.current?.contentWindow;
    if (!finestra) return;
    const prossimo = (stato + 1) % STATI.length;
    try { finestra.postMessage({ tipo: 'bartalk:cielo', variante: CIELI[prossimo] }, '*'); }
    catch { return; }
    // l'icona avanza solo a comando dato davvero (b.363).
    setStato(prossimo);
  };

  const contenitore = sfondo
    ? { position: 'absolute', inset: 0, zIndex: 0, background: '#05070f', overflow: 'hidden' }
    : { width: '100%', height: '58vh', borderRadius: 18, overflow: 'hidden', position: 'relative', flexShrink: 0, background: '#05070f' };

  return (
    <>
      <div style={contenitore}>
        <iframe
          ref={ref}
          // b.369 — "solo" = solo il pianeta. Dentro quel file c'e
          // un'applicazione INTERA (testata Community, schede
          // Stanze/News, ricerca, menu in basso, e un foglio dei paesi
          // con stanze FINTE scritte a mano dentro il file). Come
          // sfondo la disegnavamo sotto la nostra: due interfacce una
          // sull'altra, ed e per quello che niente sembrava allineato.
          src={sfondo ? "/mondo-globo.html?solo=1" : "/mondo-globo.html"}
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
