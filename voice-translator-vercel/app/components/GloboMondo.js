'use client';
import { useEffect, useRef, useState } from 'react';
import { postoADestra, MARGINE, COLONNA_DESTRA } from '../lib/righello.js';

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

// b.401 — LE VISTE HANNO UN NOME (collaudo di Luca: «non si puo
// selezionare la vista»). Prima erano tre icone senza etichetta dietro
// un solo comando che le faceva girare in tondo: per tornare a quella di
// prima bisognava premere due volte al buio, e niente diceva quale fosse
// quella accesa. Un ciclo cieco non e una scelta.
// b.403 — P1.11 DEL PIANO: l'iframe e di casa nostra, quindi i messaggi
// si mandano al NOSTRO indirizzo, non a chiunque ('*').
const ORIGINE = typeof window !== 'undefined' ? window.location.origin : '*';

const STATI = [
  { id: 'notte', icona: 'luna', nome: 'Notte' },
  { id: 'giorno', icona: 'sole', nome: 'Giorno' },
  { id: 'ibrido', icona: 'mezzaluna', nome: 'Ibrido' },
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

export default function GloboMondo({ sfondo = false, titolo = 'Il mondo ora', etichettaCielo = 'Cielo del pianeta', paese = null, rotte = null, traffico = null, onPaeseScelto = null, focusEsterno = null }) {
  const ref = useRef(null);
  // b.549 — IL PIANETA PARTIVA DI NOTTE. Collaudo di Luca: «hai rimesso
  // un filtro scuro davanti al mondo». Non era un filtro: era il cielo
  // NOTTURNO, che era il primo dell'elenco e quindi il predefinito. Su
  // uno schermo gia scuro un pianeta al buio e' un disco nero — non si
  // vede niente, e sembra rotto. Si parte dal GIORNO (indice 1), che e'
  // il mondo che si riconosce; la notte resta a un tocco.
  const [stato, setStato] = useState(1);
  const [menuCielo, setMenuCielo] = useState(false); // b.401

  // b.363 — IL PAESE SCELTO DA FUORI ARRIVA AL PIANETA. Finora il globo e
  // l'app non si parlavano: toccando un paese sulla mappa lo sapeva solo
  // il globo, e scegliendolo dall'elenco l'app non aveva modo di dirglielo.
  // Cosi il pianeta restava fermo dove stava, mentre l'utente aveva appena
  // detto dove voleva andare.
  // Qui il paese viaggia dentro il file, che lo seleziona: e con la
  // selezione parte lo ZOOM che il pianeta sa gia fare per conto suo —
  // nessuna animazione nuova, quella che c'e gia (ordine di Luca).
  // b.515 — SECONDO PADRONE, MA IN CODA: il paese scelto A MANO
  // dall'utente comanda sempre; la breaking news punta il pianeta SOLO
  // quando l'utente non ha gia scelto lui un paese (altrimenti gli
  // scipperebbe lo sguardo da sotto il dito). Nessun filtro nuovo sulle
  // liste — questo canale non tocca paeseScelto/onPaeseScelto, serve
  // solo a far volare il pianeta.
  useEffect(() => {
    const finestra = ref.current?.contentWindow;
    if (!finestra) return;
    const manda = () => {
      try { finestra.postMessage({ tipo: 'bartalk:paese', code: paese || focusEsterno || null }, ORIGINE); }
      catch { /* il pianeta non e ancora pronto: si riprova quando lo dice lui */ }
    };
    manda();
    // se il pianeta si e appena acceso, glielo si ridice: al primo giro
    // puo non essere ancora in ascolto.
    const suPronto = (ev) => {
      if (ev.origin !== window.location.origin) return;      // b.403 — P1.11
      if (ev.source !== ref.current?.contentWindow) return;
      if (ev?.data?.tipo === 'bartalk:globo-pronto') manda();
    };
    window.addEventListener('message', suPronto);
    return () => window.removeEventListener('message', suPronto);
  }, [paese, focusEsterno]);

  // b.363 — LE ROTTE VERE. Gli aeroplanini facevano la spola su otto
  // tratte inventate, sempre le stesse. Ora ricevono anche quelle dove ci
  // sono stanze aperte davvero: il pianeta diventa un indicatore di dove
  // si sta parlando. Si AGGIUNGONO a quelle di scena (ordine di Luca):
  // senza stanze aperte il cielo resterebbe vuoto, e un cielo vuoto non
  // dice "non c'e nessuno", dice "e rotto".
  useEffect(() => {
    // b.403 — P1.10: SI MANDANO ANCHE LE ROTTE VUOTE. Con `!rotte?.length`
    // si usciva senza dire niente e il pianeta teneva acceso il volo di
    // prima: chiuse le stanze, la rotta restava a disegnare traffico che
    // non c'era piu.
    const finestra = ref.current?.contentWindow;
    if (!finestra) return;
    const manda = () => {
      try { finestra.postMessage({ tipo: 'bartalk:rotte', coppie: rotte || [] }, ORIGINE); }
      catch { /* il pianeta non e ancora acceso: si riprova quando lo dice lui */ }
    };
    manda();
    const suPronto = (ev) => {
      if (ev.origin !== window.location.origin) return;      // b.403 — P1.11
      if (ev.source !== ref.current?.contentWindow) return;
      if (ev?.data?.tipo === 'bartalk:globo-pronto') manda();
    };
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
      try { finestra.postMessage({ tipo: 'bartalk:traffico', perPaese: traffico }, ORIGINE); }
      catch { /* il pianeta non e ancora acceso: si riprova quando lo dice lui */ }
    };
    manda();
    const suPronto = (ev) => {
      if (ev.origin !== window.location.origin) return;      // b.403 — P1.11
      if (ev.source !== ref.current?.contentWindow) return;
      if (ev?.data?.tipo === 'bartalk:globo-pronto') manda();
    };
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
      // b.403 — P1.11: si ascolta solo il NOSTRO iframe. Prima bastava che
      // un messaggio dicesse di chiamarsi 'bartalk:paese-scelto' — da
      // qualunque finestra — per spostare il Paese di tutta la sezione.
      if (ev.origin !== window.location.origin) return;
      if (ev.source !== ref.current?.contentWindow) return;
      const d = ev?.data;
      if (!d || d.tipo !== 'bartalk:paese-scelto') return;
      onPaeseScelto?.(d.code ? String(d.code).toUpperCase() : null);
    };
    window.addEventListener('message', suMessaggio);
    return () => window.removeEventListener('message', suMessaggio);
  }, [onPaeseScelto]);

  // b.401 — si SCEGLIE la vista, non si cicla: il menu qui sotto chiama
  // questa con l'indice voluto. Il messaggio al pianeta e lo stesso.
  const scegliCielo = (indice) => {
    const finestra = ref.current?.contentWindow;
    if (!finestra) return;
    try { finestra.postMessage({ tipo: 'bartalk:cielo', variante: CIELI[indice] }, ORIGINE); }
    catch { return; }
    // l'icona cambia solo a comando dato davvero (b.363).
    setStato(indice);
    setMenuCielo(false);
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
      <button onClick={() => setMenuCielo((v) => !v)} aria-label={etichettaCielo}
        aria-haspopup="listbox" aria-expanded={menuCielo}
        style={{
          // b.363 — SECONDO posto della colonna di destra, sotto la pila
          // (vedi lib/righello.js). Prima era su un asse tutto suo e si
          // vedeva che non era in riga con lei.
          // b.400 — POSTO 0, NON 1. In Mondo la pila del credito non c'e:
          // il posto 0 restava vuoto e la luna finiva sotto il selettore
          // del Paese, che partiva da destra. Ora e lei la prima della
          // fila, e la testata le tiene libera la colonna (riservaADestra).
          //
          // b.478, collaudo di Luca: «fulmine e luna sono sovrapposti,
          // affiancali in alto a destra». Erano tutti e due al posto 0 —
          // il righello serve proprio a evitarlo, ma due file diverse lo
          // chiedevano senza sapere l'una dell'altra, e uno si e seduto
          // sopra l'altro.
          // La pila resta al posto 0, che e il piu a destra: e la stessa
          // colonna che tiene in ogni schermata dell'applicazione, e
          // spostarla qui la farebbe ballare passando da una pagina
          // all'altra. La luna prende il posto 1, cioe un passo a sinistra
          // — che e anche quello che Luca aveva gia chiesto in b.370: «la
          // luna deve stare di fianco a sinistra della pila, non sotto».
          ...postoADestra(1), zIndex: 80,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}>
        <IconaCielo tipo={STATI[stato].icona} size={26} />
      </button>

      {/* ═══ INIZIO b.401 — LA SCELTA DELLA VISTA ═══
          Tre voci col loro nome e la spunta su quella accesa. Si apre
          sotto l'icona, nella stessa colonna del righello, e si chiude
          toccando fuori. Nessun livello nuovo: sta alla quota della
          luna (80), sopra il velo trasparente che intercetta i tocchi. */}
      {menuCielo && (
        <>
          <div onClick={() => setMenuCielo(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 79, background: 'transparent' }} />
          <div role="listbox" aria-label={etichettaCielo}
            style={{
              position: 'fixed', zIndex: 81,
              // b.478 — la tendina segue la luna, che si e spostata di un passo
              right: MARGINE + COLONNA_DESTRA.passo, top: `calc(${COLONNA_DESTRA.primo} + 40px)`,
              minWidth: 152, padding: 4,
              background: 'rgba(11,15,28,0.96)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12,
              boxShadow: '0 14px 34px rgba(0,0,0,0.55)',
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            }}>
            {STATI.map((v, i) => (
              <button key={v.id} role="option" aria-selected={i === stato}
                onClick={() => scegliCielo(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: i === stato ? 'rgba(255,255,255,0.07)' : 'transparent',
                  color: i === stato ? '#eaf0ff' : 'rgba(214,226,245,0.85)',
                  fontSize: 13, fontWeight: i === stato ? 800 : 600,
                  textAlign: 'left', WebkitTapHighlightColor: 'transparent',
                }}>
                <IconaCielo tipo={v.icona} size={17} color={i === stato ? '#eaf0ff' : 'rgba(214,226,245,0.8)'} />
                <span style={{ flex: 1 }}>{v.nome}</span>
                {i === stato && <span style={{ fontSize: 12 }}>&#10003;</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {/* ═══ FINE b.401 ═══ */}
    </>
  );
}
