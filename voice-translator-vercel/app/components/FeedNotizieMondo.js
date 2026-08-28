'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { chiaveContenuto, hoMessoCuore, giraCuore, quantiCuori } from '../lib/gradimento.js'; // b.544 — il mi piace
import VentaglioReazioni from './ui/VentaglioReazioni.js';   // b.550 — le sei facce
import InterpreteVideo from './ui/InterpreteVideo.js';       // b.551 — il video nella tua lingua
import { miaReazione, giraReazione, contaReazioni, emojiDi } from '../lib/reazioni.js';
import { bandieraPaese, nomePaese } from '../lib/schedaMondo.js'; // b.546 — la bandiera e il nome del paese
import { paeseDellaNotizia } from '../lib/paeseDaFonte.js';       // b.546 — da dove arriva davvero la notizia
import AnteprimaCoperta from './ui/AnteprimaCoperta.js';
import Sovrapposizione from './ui/Sovrapposizione.js';
import { VETRO, VETRO_ACCESO, VETRO_CUORE, VETRO_FASCIA } from '../lib/vetro.js'; // b.552 — la ricetta del vetro, una per tutti
import { inBacheca } from '../lib/bacheca.js';                                    // b.552 — la stella: messo da parte

// ═══════════════════════════════════════════════════════════════
// FeedNotizieMondo — IL FEED A TUTTA PAGINA (b.515)
//
// Ordine di Luca: «nella stanza news social attiva una visualizzazione
// continua a tutta pagina che mostri le notizie a tutta pagina e se uno
// entra e scorre attiva l'autoplay per ogni video in sequenza».
//
// Una notizia (o un video) per schermata, scroll-snap verticale: chi e
// in vista prende l'autoplay, chi esce lo perde — mai piu di un video
// che suona alla volta. Il filtro (solo articoli / solo video /
// entrambi, DEFAULT SOLO VIDEO — ordine di Luca) sta in un comando
// fisso in alto, sempre visibile mentre si scorre.
//
// Riusa i dati gia in mano a MondoNews (argomenti/video dell'ultima
// ricerca): nessuna chiamata di rete propria, nessun costo aggiuntivo.
// ═══════════════════════════════════════════════════════════════

const FILTRI = [
  { id: 'video', labelKey: 'feedSoloVideo' },
  { id: 'articoli', labelKey: 'feedSoloArticoli' },
  { id: 'entrambi', labelKey: 'feedEntrambi' },
];

// b.538 — L'ALTEZZA DELLA BARRA DEI COMANDI DI YOUTUBE. Il player
// disegna i suoi comandi (play, tempo, cc, ingranaggio, schermo intero)
// in una fascia in fondo all'inquadratura: circa 48 punti sul telefono,
// una sessantina sullo schermo grande. Si tiene la misura piu generosa:
// meglio due dita d'aria in piu che un tasto coperto.
const BARRA_YT = 60;
// b.552 — quanto e' alto il piede del video: due righe di titolo (15 x
// 1.3 x 2 = 39) piu i suoi bordi (26), arrotondato in su. E' un patto
// fra il piede e l'interprete: i sottotitoli si fermano sopra questa
// quota e non toccano mai il titolo. Se un giorno il piede cresce,
// questo numero cresce con lui — non si aggiusta a occhio.
const PIEDE_VIDEO = 76;

// b.546 — QUANTO BASTA VEDERSI PER ESSERE «LA SLIDE CHE SI STA
// GUARDANDO». Fino a ieri la soglia era una sola, 0.6, e li stava meta
// del difetto raccontato da Luca («hai rotto il passaggio, passando al
// prossimo video non lo riproduce»): una slide alta 100dvh dentro una
// finestra piu bassa — sul telefono la barra del browser si mangia
// qualche decina di punti — non arriva MAI a mostrare il 60% della
// propria area, quindi nessuna slide superava la soglia, l'osservatore
// non avvisava di niente e l'indice restava fermo dov'era. Il player,
// che vive solo sulla slide attiva, non si spostava mai.
// Adesso la soglia e bassa e non decide da sola: dice solo «di questa
// vale la pena parlare», e poi fra tutte quelle viste si prende
// comunque la PIU visibile (vedi l'osservatore).
const SOGLIA_VISTA = 0.25;

// ═══════════════════════════════════════════════════════════════
// b.539 — LA COLONNINA DELLE AZIONI. Luca, guardando un video nel feed:
// «perche questo contenuto non ha tasti?».
// Perche' quando il feed e' nato (b.515) i tasti erano stati dati solo
// agli articoli: per i video l'unica azione prevista era guardare. Ma un
// video che ti colpisce e' esattamente il momento in cui vuoi parlarne —
// e li non c'era niente da toccare.
// Sta sul BORDO DESTRO, a mezza altezza: e' il posto che usano tutti
// (e chi guarda lo cerca li), e soprattutto e' lontano dalla barra dei
// comandi del player, che in fondo allo schermo deve restare libera —
// la lezione di b.538, pagata due volte.
//
// b.546 — ED E' L'UNICO POSTO DOVE STANNO LE PORTE. Collaudo di Luca:
// «parlane non deve occupare tutto quello spazio». Ricontrollate tutte
// le slide: nessun bottone a piena larghezza, da nessuna parte. Una
// porta e un cerchio da 46 punti in questa colonnina, mai una fascia
// che si mangia mezzo schermo.
// ═══════════════════════════════════════════════════════════════
function Azioni({ voci }) {
  return (
    <div style={{
      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
      zIndex: 3, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {voci.filter(Boolean).map((v) => (
        <div key={v.chiave} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          {/* b.550 — una voce puo essere un pezzo intero (il ventaglio
              delle reazioni) invece di un tasto: la colonnina lo ospita
              senza sapere cosa sia. */}
          {v.nodo ? v.nodo : null}
          {!v.nodo && (
          <button
            onClick={(e) => { e.stopPropagation(); v.onTocca(); }}
            aria-label={v.parola} title={v.parola} aria-pressed={v.acceso || undefined}
            style={{
              width: 46, height: 46, borderRadius: 999, cursor: 'pointer', padding: 0,
              // b.544 — acceso quando l'hai messo tu: si vede a colpo d'occhio
              // che il tocco e' arrivato, senza aspettare la rete.
              // b.552 — vetro, per ordine di Luca (vedi lib/vetro.js).
              // In b.551 qui c'era un fondo pieno per risparmiare la
              // sfocatura: la ricetta condivisa la tiene leggera.
              ...(v.acceso ? VETRO_CUORE : VETRO),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>
            {/* b.552 — acceso non vuol dire sempre rosso: il cuore e' caldo,
                la stella della bacheca e' d'oro. */}
            <Icon name={v.icona} size={19} color={v.acceso ? (v.caldo ? '#ff5470' : '#ffd479') : '#fff'} />
          </button>
          )}
          {v.conto ? (
            <span style={{
              fontSize: 11, fontWeight: 500, fontFamily: FONT,
              color: v.acceso ? '#ff5470' : 'rgba(255,255,255,0.82)',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}>{v.conto}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// b.546 — DA DOVE ARRIVA QUESTA COSA, SCRITTO SOPRA LA FOTO
//
// Collaudo di Luca: «non vedo bandiere negli articoli ne le fonti,
// mostra la bandiera e l'origine e che si veda bene».
// Aveva ragione, e non era un dettaglio: nel feed a tutta pagina la
// provenienza non c'era proprio. Nella lista delle notizie la bandiera
// c'e da b.363 — e il «DA DOVE» del metodo delle schede
// (schedaMondo.js) — e passando al feed si perdeva per strada. Una
// notizia senza origine e una voce di corridoio: chi guarda deve
// sapere in mezzo secondo CHI la racconta e DA DOVE, senza toccare
// niente.
//
// Vetro scuro sfocato in alto a sinistra, sopra la fotografia: e il
// primo posto dove cade l'occhio e non litiga con nessuno — l'header
// sta piu su, la colonnina delle porte sta a destra, i comandi di
// YouTube stanno in fondo (la lezione di b.538).
//
// LA BANDIERA SOLO SE E' VERA: `paeseDellaNotizia` torna `null` quando
// il dominio non dice il paese, e allora resta la sola fonte. Meglio
// nessuna bandiera che una bandiera sbagliata — la stessa regola del
// globo che non vola in Groenlandia per una notizia di Napoli.
//
// E' pittura, non un tasto (`pointerEvents: 'none'`): non deve rubare
// il tocco ne al player ne all'anteprima ancora da scoprire.
// ═══════════════════════════════════════════════════════════════
// ═══ b.552 — UNA RIGA SUA, IN ALTO, E NIENTE PIU SOVRAPPOSIZIONI ═══
// Collaudo di Luca, con la fotografia: «titoli e sottotitoli in basso a
// volte si sovrappongono. Se devi mettere una nota mettila in alto in
// una riga dedicata con bandiera e origine e data pubblicazione bene
// evidente con la ora a destra in alto».
//
// Aveva ragione due volte. In basso si accatastavano titolo, nome del
// canale e sottotitoli dell'interprete: tre cose che crescono ognuna per
// conto suo, e prima o poi si toccano. E l'origine, che e' la prima cosa
// da sapere, stava schiacciata li in mezzo.
//
// Ora la nota ha la SUA riga in cima, larga quanto lo schermo: a
// sinistra bandiera, chi lo racconta e quando; a destra l'ora. In basso
// resta il titolo e basta — a due righe al massimo, cosi il piede ha
// un'altezza certa e i sottotitoli sanno dove fermarsi.
//
// LA BANDIERA SOLO SE E' VERA: `paeseDellaNotizia` torna `null` quando
// il dominio non dice il paese, e allora resta la sola fonte. Meglio
// nessuna bandiera che una bandiera sbagliata.
// E' pittura, non un tasto (`pointerEvents: 'none'`).
function RigaOrigine({ bandiera, luogo, origine, quandoMs, quandoTesto, lingua = 'it' }) {
  if (!bandiera && !origine && !quandoTesto && !quandoMs) return null;
  // La data si scrive per esteso e corta insieme: «28 ago» si legge in un
  // colpo d'occhio, «28/08/2026» va decifrato.
  let data = '';
  let ora = '';
  if (quandoMs) {
    try {
      const d = new Date(quandoMs);
      data = d.toLocaleDateString(lingua, { day: 'numeric', month: 'short' });
      ora = d.toLocaleTimeString(lingua, { hour: '2-digit', minute: '2-digit' });
    } catch { /* lingua strana: si resta senza data, non si sbaglia data */ }
  }
  // I video non hanno una data vera (YouTube da l'eta a parole): quella
  // va a destra, dove Luca vuole il tempo.
  const aDestra = ora || quandoTesto || '';
  return (
    <div style={{
      // sotto l'header (44 di barra + respiro), larga tutta: e' una riga,
      // non una targhetta appiccicata in un angolo.
      position: 'absolute', top: 70, left: 0, right: 0, zIndex: 2,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px',
      ...VETRO_FASCIA,   // vetro anche qui, ma senza spigoli: e' una fascia, non una targa
      pointerEvents: 'none',
    }}>
      {bandiera ? (
        // grande davvero: sotto i 20 punti una bandiera diventa un
        // francobollo colorato e non si riconosce piu. Era il punto di
        // Luca, «che si veda bene».
        <span role="img" aria-label={luogo || undefined}
          style={{ fontSize: 21, lineHeight: 1, flexShrink: 0 }}>{bandiera}</span>
      ) : null}
      {origine ? (
        <span style={{
          // niente grassetto: ordine permanente di Luca, «non voglio
          // grassetto da nessuna parte e neanche dentro i pulsanti».
          fontSize: 13.5, fontWeight: 500, fontFamily: FONT, color: '#fff',
          letterSpacing: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: '0 1px 4px rgba(0,0,0,0.8)', minWidth: 0,
        }}>{origine}</span>
      ) : null}
      {data ? (
        <span style={{
          fontSize: 12.5, fontFamily: FONT, color: 'rgba(255,255,255,0.86)',
          whiteSpace: 'nowrap', flexShrink: 0, textShadow: '0 1px 4px rgba(0,0,0,0.8)',
        }}>{data}</span>
      ) : null}
      {aDestra ? (
        <span style={{
          marginLeft: 'auto', flexShrink: 0,
          fontSize: 12.5, fontFamily: FONT, color: 'rgba(255,255,255,0.86)',
          whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,0.8)',
        }}>{aDestra}</span>
      ) : null}
    </div>
  );
}

export default function FeedNotizieMondo({ aperto, onChiudi, C, L, argomenti = [], video = [], filtro, onFiltro, onParlane, onApriArticolo, onStrumenti, onCresci, crescendo = false, onCerca, onCommenta, miaLingua = 'it', caricando = false, prefs = null, onBacheca, onNascondi }) {
  const contenitoreRef = useRef(null);
  // ═══════════════════════════════════════════════════════════════
  // b.546 — L'OSSERVATORE CHE NON NASCEVA MAI. Quinta causa del
  // «passaggio rotto», e la piu silenziosa di tutte.
  // Da b.516 questa schermata vive dentro Sovrapposizione, che al primo
  // giro restituisce `null` (in SSR `document` non esiste: si monta al
  // secondo). Quindi al primo giro il riquadro che scorre NON esiste
  // ancora e `contenitoreRef.current` e vuoto — e l'effetto che accende
  // l'IntersectionObserver, trovandolo vuoto, se ne andava senza fare
  // niente. Al secondo giro il riquadro c'era, ma l'effetto non veniva
  // richiamato perche' nessuna delle sue dipendenze era cambiata:
  // l'osservatore non nasceva PIU, e senza osservatore nessuno diceva
  // mai «adesso stai guardando la slide dopo». Il feed aperto con i
  // contenuti gia in mano — cioe il caso normale — non cambiava mai
  // slide attiva: il player restava sul primo video per sempre.
  // Rimedio: il riquadro non e piu solo un riferimento, e anche uno
  // STATO. Quando compare, chi lo aspetta si sveglia.
  // ═══════════════════════════════════════════════════════════════
  const [contenitore, setContenitore] = useState(null);
  const prendiContenitore = useCallback((nodo) => { contenitoreRef.current = nodo; setContenitore(nodo); }, []);
  const sentinelleRef = useRef(new Map());
  const [indiceAttivo, setIndiceAttivo] = useState(0);
  const [seme, setSeme] = useState('');   // b.541 — il campo dell'ultima slide
  // ═══ b.544 — I CUORI ═══
  // «Non si puo dare un mi piace a nessuno» (Luca). `miei` e cio che ho
  // messo io (dal telefono, immediato), `conteggi` e quello di tutti
  // (dal server, quando arriva).
  const [miei, setMiei] = useState(() => new Set());
  const [conteggi, setConteggi] = useState({});
  // ═══ b.550 — LE REAZIONI ═══
  // Costruite in b.545 e rimaste ferme in un cassetto: «i tasti non
  // funzionano bene» (Luca). Adesso il ventaglio sta nella colonnina,
  // sotto il cuore: il cuore e' il gesto veloce, le sei facce dicono
  // COME ti ha colpito. Le mie stanno nel telefono (immediate), i
  // conteggi di tutti arrivano dal server.
  const [mieFacce, setMieFacce] = useState({});      // chiave -> id faccia
  const [conteggiFacce, setConteggiFacce] = useState({});

  const reagisci = useCallback((url, idFaccia) => {
    const esito = giraReazione(url, idFaccia);
    if (!esito.chiave) return;
    vibrate(10);
    setMieFacce((prima) => ({ ...prima, [esito.chiave]: esito.dopo }));
    // si aggiusta subito il conto sotto gli occhi, poi lo si dice al server
    setConteggiFacce((prima) => {
      const perChiave = { ...(prima[esito.chiave] || {}) };
      if (esito.prima) perChiave[esito.prima] = Math.max(0, (perChiave[esito.prima] || 0) - 1);
      if (esito.dopo) perChiave[esito.dopo] = (perChiave[esito.dopo] || 0) + 1;
      return { ...prima, [esito.chiave]: perChiave };
    });
    fetch('/api/mondo/reazioni', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiave: esito.chiave, prima: esito.prima, dopo: esito.dopo }),
    }).catch(() => { /* la faccia resta mia anche senza rete */ });
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // b.546 — LA CAUSA VERA DEL «PASSAGGIO ROTTO», e viene prima di
  // tutte le altre: L'ELENCO SI COSTRUIVA TROPPO TARDI.
  //
  // Collaudo di Luca: «hai rotto il passaggio, passando al prossimo
  // video non lo riproduce». Il video dopo non partiva perche' il feed
  // NON ARRIVAVA PIU A DISEGNARSI, per niente: in b.544, aggiungendo
  // il giro che chiede i conteggi dei cuori, quell'effetto e' stato
  // scritto SOPRA la riga `const elementi = useMemo(...)` tenendosi
  // pero `elementi` nel proprio elenco di dipendenze.
  // L'elenco delle dipendenze si costruisce DURANTE il disegno — e un
  // argomento passato a useEffect, non qualcosa che accade dopo —
  // quindi leggeva `elementi` prima che `elementi` esistesse. Su una
  // `const` non ancora inizializzata JavaScript non risponde
  // `undefined`: si ferma («Cannot access 'elementi' before
  // initialization»). Il componente moriva ad ogni disegno, e nessuna
  // delle prove se n'era accorta perche leggono il sorgente con
  // un'espressione regolare invece di montarlo davvero.
  //
  // Rimedio, che e una regola e non una toppa: le cose si dichiarano
  // SOPRA a chiunque le guardi, sempre. Qui l'elenco viene per primo.
  // ═══════════════════════════════════════════════════════════════
  // ═══ b.552 — SI MOSTRA QUANDO E' CERTO, NON PRIMA ═══
  // Collaudo di Luca: «quando apro Mondo mostra la pagina cerca, poi un
  // video, e a volte salta subito ad altri e si ferma. Deve presentare
  // il primo contenuto solo quando e' certo e mettere una icona mentre
  // carica se non e' pronto».
  // Lo STATO sta qui, sopra: il calcolo dell'elenco lo legge mentre
  // disegna (`prontoRef`). L'effetto che lo accende sta piu sotto,
  // perche' quello guarda `elementi` — e le cose si dichiarano sopra a
  // chi le guarda, sempre (lezione b.546, ripresa oggi da questa prova).
  const [visto, setVisto] = useState(false);   // una volta mostrato, resta mostrato
  const prontoRef = useRef(false);

  // b.552 — la memoria dell'ordine gia mostrato. Dichiarata QUI, sopra a
  // chi la guarda: e' la regola imparata in b.546, e vale sempre.
  const ordineRef = useRef([]);
  const elementi = useMemo(() => {
    const art = (argomenti || []).map((t) => ({ tipo: 'articolo', dati: t, chiave: `a-${t.id || t.url || t.titolo}` }));
    const vid = (video || []).filter((v) => v?.id).map((v) => ({ tipo: 'video', dati: v, chiave: `v-${v.id}` }));
    if (filtro === 'video') return vid;
    if (filtro === 'articoli') return art;
    // «entrambi»: intercalati, cosi non si scorrono prima tutti gli
    // articoli in blocco e poi tutti i video in blocco.
    const intreccia = (a, v) => {
      const fuori = [];
      const n = Math.max(a.length, v.length);
      for (let i = 0; i < n; i++) { if (a[i]) fuori.push(a[i]); if (v[i]) fuori.push(v[i]); }
      return fuori;
    };
    // ═══ b.552 — L'ORDINE GIA VISTO NON SI RIFA' ═══
    // Ordine di Luca: «quando sto guardando un video non devi
    // interrompermi per attivare la nuova ricerca». Anche senza una
    // scritta a schermo, l'intreccio rifatto da capo E' un'interruzione:
    // con dieci articoli e tre video la sequenza era a1 v1 a2 v2 a3 v3
    // a4 a5..., e appena arrivavano tre video nuovi diventava
    // a1 v1 a2 v2 a3 v3 a4 v4 a5 v5... — cioe' tutto quello DOPO la
    // settima diapositiva si spostava di posto, e il video sotto il dito
    // diventava un altro.
    // Adesso la parte gia composta resta identica e si intreccia solo
    // cio che e' appena arrivato, che finisce in fondo: dove lo trovi
    // scorrendo, quando vuoi tu.
    const vive = new Set([...art, ...vid].map((e) => e.chiave));
    // b.552 — prima di essere «pronti» l'elenco si puo ancora ricomporre
    // per intero: nessuno lo sta guardando, e cosi i video del primo
    // giro restano intrecciati agli articoli come devono. Dal momento in
    // cui si mostra, invece, cio che c'e' non si muove piu.
    const testa = prontoRef.current ? ordineRef.current.filter((e) => vive.has(e.chiave)) : [];
    const gia = new Set(testa.map((e) => e.chiave));
    const out = [
      ...testa,
      ...intreccia(art.filter((e) => !gia.has(e.chiave)), vid.filter((e) => !gia.has(e.chiave))),
    ];
    ordineRef.current = out;
    return out;
  }, [argomenti, video, filtro]);


  // b.552 — e qui si decide quando e' «certo»: il primo giro ha finito
  // (`caricando` falso) e qualcosa in mano c'e'. Si calcola mentre si
  // disegna, non con un'attesa a orologio: un ritardo finto sarebbe solo
  // un altro modo di far aspettare senza motivo.
  // Una volta mostrato resta mostrato (`visto`): la crescita in
  // sottofondo non deve MAI rimettere il feed in attesa — sarebbe di
  // nuovo l'interruzione che Luca non vuole.
  const pronto = visto || (aperto && !caricando && elementi.length > 0);
  useEffect(() => { prontoRef.current = pronto; if (pronto && !visto) setVisto(true); }, [pronto, visto]);
  useEffect(() => { if (!aperto) { setVisto(false); ordineRef.current = []; prontoRef.current = false; } }, [aperto]);

  // b.546 — l'indice e l'elenco tenuti anche «a mano». Servono a chi
  // ascolta gli eventi della finestra: un ascoltatore registrato una
  // volta sola si porterebbe dietro per sempre i valori del giorno in
  // cui e nato, e prenderebbe decisioni sul passato.
  const indiceRef = useRef(0);
  const elementiRef = useRef(elementi);
  useEffect(() => { indiceRef.current = indiceAttivo; elementiRef.current = elementi; });

  // si chiedono i conteggi delle slide che si stanno guardando, non di
  // tutte: una manciata di indirizzi per volta.
  useEffect(() => {
    if (!aperto || !elementi.length) return undefined;
    const chiavi = elementi.slice(Math.max(0, indiceAttivo - 2), indiceAttivo + 6)
      .map((el) => chiaveContenuto(el?.dati?.url || (el?.dati?.id ? `youtube.com/watch?v=${el.dati.id}` : '')))
      .filter(Boolean);
    if (!chiavi.length) return undefined;
    let vivo = true;
    (async () => {
      try {
        const [rCuori, rFacce] = await Promise.all([
          fetch(`/api/mondo/gradimento?chiavi=${encodeURIComponent(chiavi.join(','))}`, { signal: AbortSignal.timeout(8000) }),
          // b.550 — le facce si chiedono insieme ai cuori: una tornata
          // sola per le slide che si stanno guardando.
          fetch(`/api/mondo/reazioni?chiavi=${encodeURIComponent(chiavi.join(','))}`, { signal: AbortSignal.timeout(8000) }).catch(() => null),
        ]);
        if (rCuori?.ok) {
          const d = await rCuori.json().catch(() => null);
          if (vivo && d?.conteggi) setConteggi((prima) => ({ ...prima, ...d.conteggi }));
        }
        if (rFacce?.ok) {
          const d2 = await rFacce.json().catch(() => null);
          if (vivo && d2?.conteggi) setConteggiFacce((prima) => ({ ...prima, ...d2.conteggi }));
        }
        return;
      } catch { /* senza conteggi il cuore si mette lo stesso */ }
    })();
    return () => { vivo = false; };
  }, [aperto, elementi, indiceAttivo]);

  // b.544 — il tocco: prima si accende (chi tocca deve vedere subito),
  // poi si dice al server. Se il server non risponde, il cuore resta
  // acceso qui: e comunque vero che a me e piaciuto.
  const cuore = useCallback((url) => {
    const esito = giraCuore(url);
    if (!esito.chiave) return;
    vibrate(12);
    setMiei((prima) => {
      const dopo = new Set(prima);
      if (esito.acceso) dopo.add(esito.chiave); else dopo.delete(esito.chiave);
      return dopo;
    });
    setConteggi((prima) => ({ ...prima, [esito.chiave]: Math.max(0, (Number(prima[esito.chiave]) || 0) + esito.passo) }));
    fetch('/api/mondo/gradimento', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiave: esito.chiave, passo: esito.passo }),
    }).catch(() => { /* il cuore resta mio anche se la rete non c'e */ });
  }, []);

  // all'apertura si ricorda cosa avevo gia amato
  useEffect(() => { if (aperto) setMiei(new Set()); }, [aperto]);

  // b.544 — «immediatamente fai andare in alto il campo e presenti il
  // nuovo contenuto»: si semina e si torna SUBITO in cima, dove il
  // contenuto nuovo sta arrivando. Chi ha appena chiesto una cosa non
  // deve risalire a mano venti schermate.
  const semina = useCallback(() => {
    const q = seme.trim();
    if (!q) return;
    vibrate(10);
    onCerca?.(q);
    setSeme('');
    setIndiceAttivo(0);
    try { contenitoreRef.current?.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* niente da riportare in cima */ }
  }, [seme, onCerca]);

  // b.546 — QUANTO SI VEDE OGNI SLIDE, l'ultima volta che se n'e saputo
  // qualcosa. Serve perche l'osservatore avvisa SOLO delle slide che
  // hanno appena attraversato una soglia: nel giro in cui la slide
  // vecchia scende sotto, quella nuova puo non essere ancora
  // nell'elenco delle voci. Decidere sul solo lotto di quel millesimo
  // voleva dire, a volte, non decidere affatto — ed e l'altra meta del
  // passaggio che non passava. Con la memoria si sceglie sempre
  // guardando TUTTE le slide, non solo quelle che si sono appena mosse.
  const visibiliRef = useRef(new Map());

  // b.515 — CHI E' IN VISTA PRENDE L'AUTOPLAY. Un solo IntersectionObserver
  // su tutte le slide: quella con piu area visibile diventa
  // l'attiva. Le altre spengono il loro player da sole, perche il loro
  // iframe smette di esistere quando non sono piu l'attiva (vedi sotto,
  // i !== indiceAttivo mostra solo la miniatura) — «autoplay in
  // sequenza», mai due video che suonano insieme.
  useEffect(() => {
    if (!aperto || !contenitore) return undefined;
    visibiliRef.current = new Map();   // elenco nuovo, memoria nuova
    const oss = new IntersectionObserver((entries) => {
      // ═══ b.538 — IL RIBALTAMENTO DELLO SCHERMO ═══
      // Collaudo di Luca: «quando ho ribaltato lo schermo, va in errore e
      // si chiude l'applicazione».
      // La causa e' qui, ed e' una di quelle che si vedono solo quando
      // l'altezza cambia sotto i piedi. Ruotando il telefono, le slide —
      // alte 100dvh l'una — vengono rimisurate tutte insieme: per un
      // istante PIU DI UNA supera la soglia, e questo giro
      // chiamava setIndiceAttivo per OGNI voce dell'elenco, in fila.
      // Ogni chiamata ridisegna, il ridisegno rimisura, la rimisura
      // richiama: React conta gli aggiornamenti a catena e oltre un
      // certo numero si arrende («Maximum update depth exceeded»), che
      // e' proprio l'errore che fa comparire la schermata rossa.
      // Due chiusure, tutte e due necessarie:
      //   1. si sceglie UNA sola slide per giro — quella che si vede di
      //      piu — invece di obbedire a tutte;
      //   2. se e' gia lei l'attiva non si tocca niente: nessun
      //      ridisegno, nessuna catena.
      //
      // ═══ b.546 — LA STESSA REGOLA, MA GUARDANDO TUTTE LE SLIDE ═══
      // Prima si SEGNA quello che si e appena saputo, poi si SCEGLIE
      // sull'elenco intero. La scelta resta UNA per giro (b.538 e
      // salva, e la catena di ridisegni non torna) ma non dipende piu
      // dal caso di quali slide hanno attraversato una soglia proprio
      // in quel millesimo di secondo.
      entries.forEach((e) => {
        const idx = Number(e.target.dataset.indice);
        if (!Number.isFinite(idx)) return;
        visibiliRef.current.set(idx, e.isIntersecting ? e.intersectionRatio : 0);
      });
      let miglioreIdx = -1;
      let miglioreArea = SOGLIA_VISTA;
      visibiliRef.current.forEach((area, idx) => {
        if (area <= miglioreArea) return;
        miglioreArea = area;
        miglioreIdx = idx;
      });
      if (miglioreIdx >= 0) setIndiceAttivo((prima) => (prima === miglioreIdx ? prima : miglioreIdx));
      // b.546 — DUE soglie, non una: quella bassa perche una slide piu
      // alta della finestra non arriva mai al 60% e senza di lei non
      // scatterebbe MAI nessun avviso; quella alta perche appena una
      // slide si prende quasi tutto lo schermo lo si sappia subito,
      // senza aspettare il fermo del dito.
    }, { root: contenitore, threshold: [SOGLIA_VISTA, 0.6] });
    sentinelleRef.current.forEach((el) => oss.observe(el));
    return () => oss.disconnect();
    // b.546 — si guarda l'ELENCO, non la sua lunghezza. Una ricerca
    // nuova che riporta lo stesso numero di risultati cambia tutte le
    // slide ma non la misura: con la lunghezza sola l'osservatore
    // restava attaccato ai riquadri di prima, che nel frattempo non
    // esistono piu, e non avvisava mai piu di niente.
  }, [aperto, contenitore, elementi]);

  // b.538 — E DOPO IL RIBALTAMENTO SI RESTA DOVE SI ERA. Cambiando
  // orientamento tutte le slide cambiano altezza e lo scorrimento
  // finisce a meta strada fra due: si rimette la slide attiva al suo
  // posto, senza animazione (un'animazione mentre lo schermo gira si
  // vede come uno strappo). Luca: «con il telefono devo poter ribaltare
  // tranquillamente l'immagine e vederla tutto schermo».
  //
  // ═══ b.546 — MA SOLO SE LO SCHERMO E' GIRATO DAVVERO ═══
  // Terza meta del «passaggio rotto», e la piu insidiosa perche sul
  // computo fisso non si vede mai. Sul telefono la barra del browser si
  // ritira e ricompare MENTRE si scorre: ogni volta la finestra cambia
  // altezza e parte un `resize`. Questo rimedio, nato per la rotazione,
  // scattava li: 260 millesimi dopo l'inizio dello scorrimento
  // riportava di forza la vista sulla slide ancora segnata come attiva
  // — cioe quella da cui si stava scappando. Il dito spingeva avanti,
  // il codice tirava indietro, e il video successivo non partiva mai.
  // Come si distinguono i due casi: la rotazione cambia la LARGHEZZA
  // della finestra, la barra del browser cambia solo l'altezza. Si
  // guarda la larghezza, e in tutti gli altri casi si sta fermi.
  useEffect(() => {
    if (!aperto) return undefined;
    let larghezzaPrima = window.innerWidth;
    const rimetti = () => {
      const larghezzaOra = window.innerWidth;
      if (larghezzaOra === larghezzaPrima) return;   // e solo la barra del browser: non si tocca niente
      larghezzaPrima = larghezzaOra;
      // si aspetta che il browser abbia finito di rimisurare: farlo
      // subito rimetterebbe a posto con le misure vecchie.
      setTimeout(() => {
        const el = sentinelleRef.current.get(elementiRef.current[indiceRef.current]?.chiave);
        try { el?.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch { /* niente da rimettere */ }
      }, 260);
    };
    window.addEventListener('orientationchange', rimetti);
    window.addEventListener('resize', rimetti);
    return () => {
      window.removeEventListener('orientationchange', rimetti);
      window.removeEventListener('resize', rimetti);
    };
    // b.546 — l'ascolto si registra UNA volta per apertura: indice ed
    // elenco li legge dai riferimenti, cosi non serve piu smontare e
    // rimontare l'ascoltatore ad ogni slide.
  }, [aperto]);

  // ═══ b.541 — IL FEED NON FINISCE ═══
  // Luca: «perche in fondo alla lista non metti un tasto continua cerca
  // ancora con un campo di ricerca?». Due risposte, tutte e due qui: il
  // giardino cresce DA SOLO quando mancano tre slide alla fine (chi
  // scorre non deve accorgersi di niente), e in fondo resta comunque la
  // riga per seminare a mano.
  useEffect(() => {
    if (!aperto || !onCresci || crescendo) return;
    // b.544 — si cresce anche quando il feed e CORTO o VUOTO, non solo
    // quando ci si avvicina scorrendo: «le persone sono pigre e devi
    // mettergli in bocca i contenuti». Chi apre e trova poco non deve
    // chiedere niente — la roba arriva.
    if (elementi.length < 4 || indiceAttivo >= elementi.length - 3) onCresci();
  }, [aperto, indiceAttivo, elementi.length, onCresci, crescendo]);

  // ═══ b.545 — SI PARTE DALLA PRIMA, SEMPRE ═══
  // Collaudo di Luca: «quando parte la visualizzazione mostra la pagina
  // in fondo e attiva il video della prima in alto — hai rotto tutto».
  // Causa, ed e' mia di b.544: il feed si apre PRIMA che i contenuti
  // arrivino (schermata vuota, un'altezza sola), e quando poi le slide
  // compaiono tutte insieme il browser tiene la posizione che aveva —
  // che a quel punto e' il fondo. L'indice restava 0, quindi il player
  // partiva sulla prima mentre gli occhi erano sull'ultima: video che
  // canta fuori dal riquadro.
  // Rimedio: quando l'elenco passa da vuoto a pieno si riporta lo
  // scorrimento sulla prima slide, senza animazione.
  //
  // ═══ b.546 — E CHI STA GIA GUARDANDO NON SI TOCCA ═══
  // Quarta meta del «passaggio rotto». Se i contenuti vengono
  // RIMPIAZZATI — un giro nuovo che prima svuota e poi riempie — mentre
  // l'utente e dieci schermate piu in basso, questo stesso rimedio lo
  // strappava in cima e gli rimetteva in canna il primo video: dal suo
  // lato sembrava esattamente «il passaggio non funziona».
  // Come si riconosce il caso vero di b.545 dal falso: in b.545 le due
  // cose NON tornavano — la vista era in fondo ma l'indice diceva zero,
  // ed e proprio quella incoerenza che va raddrizzata. Se invece indice
  // e scorrimento dicono tutti e due «sono piu in basso», allora chi
  // guarda ci e arrivato con il dito, e ha ragione lui.
  const quantiPrima = useRef(0);
  useEffect(() => {
    if (!aperto) { quantiPrima.current = 0; return; }
    const prima = quantiPrima.current;
    quantiPrima.current = elementi.length;
    // da vuoto a pieno: e' l'apertura vera, si parte dalla prima
    if (prima !== 0 || elementi.length === 0) return;
    const scorso = contenitoreRef.current?.scrollTop || 0;
    if (indiceRef.current > 0 && scorso > 8) return;   // c'e gia qualcuno che guarda piu in basso: si lascia stare
    setIndiceAttivo(0);
    try { contenitoreRef.current?.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* niente da riportare */ }
  }, [aperto, elementi.length]);

  // riparte dall'inizio ogni volta che si apre o si cambia filtro: una
  // lista diversa merita di ripartire dalla prima, non da un indice che
  // ora punta a un elemento diverso.
  useEffect(() => {
    if (!aperto) return;
    setIndiceAttivo(0);
    // b.545 — l'indice da solo non basta: senza riportare anche lo
    // SCORRIMENTO, si guarda una slide e ne suona un'altra.
    try { contenitoreRef.current?.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* niente da riportare */ }
    // b.546 — anche qui si aspetta che il riquadro esista: al primo
    // giro Sovrapposizione non l'ha ancora messo al mondo, e uno
    // scrollTo su niente e uno scrollTo perso.
  }, [aperto, filtro, contenitore]);

  if (!aperto) return null;

  // b.516 — «a tutta pagina» non lo era: misurato in produzione 440x691
  // dentro una finestra 657x749, perche' il `fixed` era prigioniero
  // della colonna della sezione. Vedi Sovrapposizione.js.
  return (
    <Sovrapposizione>
    <div style={{ position: 'fixed', inset: 0, zIndex: 97, background: C.bg || '#05070f', fontFamily: FONT }}>
      {/* ═══ header fisso: chiudi + il filtro a tre stati ═══ */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px',
        background: 'linear-gradient(180deg, rgba(5,7,15,0.85), transparent)',
      }}>
        {/* b.535 — Luca: «la x in alto deve essere una freccia back». */}
        <button onClick={() => { vibrate(6); onChiudi?.(); }} aria-label={L('backWord')}
          style={{
            width: 44, height: 44, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
            ...VETRO,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Icon name="back" size={16} color="#fff" />
        </button>
        <div role="tablist" aria-label={L('feedFiltroLabel')} style={{
          display: 'flex', gap: 4, flex: 1, overflow: 'hidden', padding: 3,
          ...VETRO, borderRadius: 12,
        }}>
          {FILTRI.map((f) => {
            const acceso = filtro === f.id;
            return (
              <button key={f.id} role="tab" aria-selected={acceso}
                onClick={() => { vibrate(6); onFiltro?.(f.id); }}
                style={{
                  flex: 1, minHeight: 38, padding: '0 8px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  ...(acceso ? VETRO_ACCESO : { background: 'transparent', border: '1px solid transparent' }),
                  color: acceso ? '#fff' : 'rgba(255,255,255,0.72)',
                  fontSize: 12, fontWeight: 500, fontFamily: FONT, whiteSpace: 'nowrap',
                }}>
                {L(f.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* b.535 — Luca: «non c'e la linguetta in primo piano per
          modificare le ricerche o farne in tempo reale di nuove.
          inseriscila a sinistra». Bordo sinistro, meta' altezza: apre
          gli strumenti SOPRA il feed (PannelloLaterale con `sopra`). */}
      {onStrumenti && (
        <button onClick={() => { vibrate(8); onStrumenti(); }}
          aria-label={L('tabNews')} title={L('tabNews')}
          style={{
            position: 'absolute', left: 0, top: '44%', zIndex: 3,
            width: 34, height: 64, borderRadius: '0 14px 14px 0', cursor: 'pointer',
            ...VETRO, borderLeft: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}>
          <Icon name="search" size={15} color="#fff" />
        </button>
      )}

      {/* ═══ il feed: una slide per schermata, scroll-snap verticale ═══ */}
      <div ref={prendiContenitore} style={{
        position: 'absolute', inset: 0, overflowY: 'auto', scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', scrollbarWidth: 'none',
      }}>
        {/* b.544 — IL FEED VUOTO NON CHIEDE NIENTE A NESSUNO: prepara.
            «devi produrre i contenuti» (Luca). Prima qui c'era un invito
            a cercare — cioe un compito. Adesso, se non c'e ancora niente,
            il giardino sta gia lavorando e lo si dice; il campo per
            seminare a mano resta in fondo, per chi lo vuole. */}
        {/* ═══ b.552 — L'ATTESA HA UNA FACCIA, E IL PRIMO CONTENUTO ARRIVA
            QUANDO E' CERTO ═══
            Collaudo di Luca: «quando apro Mondo mostra la pagina cerca,
            poi un video, e a volte salta subito ad altri e si ferma.
            Deve presentare il primo contenuto solo quando e' certo e
            mettere una icona mentre carica se non e' pronto».
            Prima si montava la prima diapositiva arrivata e poi
            l'elenco continuava a ricomporsi sotto: partiva un video,
            arrivavano gli altri, la diapositiva in mezzo allo schermo
            diventava un'altra e il player restava a meta. Adesso finche'
            non e' pronto non c'e' NIENTE da saltare: solo l'anello. */}
        {!pronto && (
          <div style={{
            height: '100dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 24, textAlign: 'center', gap: 14,
          }}>
            <span aria-hidden="true" style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '2.5px solid rgba(150,178,255,0.28)',
              borderTopColor: 'rgba(170,196,255,0.95)',
              animation: 'vtGira 0.9s linear infinite',
            }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: '#fff', fontFamily: FONT }}>
              {L('growingWord')}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', fontFamily: FONT }}>
              {L('feedVuoto')}
            </div>
            <style>{'@keyframes vtGira { to { transform: rotate(360deg); } }'}</style>
          </div>
        )}
        {pronto && elementi.map((el, i) => {
          // b.546 — l'origine si calcola QUI, una volta sola per slide,
          // e non in mezzo al disegno: cosi si legge, e chi arriva
          // domani vede subito da dove esce la bandiera.
          const fonteArticolo = el.dati.fonti?.[0]?.fonte || el.dati.fonti?.[0]?.dominio || '';
          // se il dominio non dice il paese, `paeseDellaNotizia` torna
          // null e sopra la foto resta la sola fonte: mai una bandiera
          // indovinata.
          const paese = el.tipo === 'articolo' ? paeseDellaNotizia(el.dati) : null;
          return (
          <div key={el.chiave}
            ref={(node) => { if (node) sentinelleRef.current.set(el.chiave, node); else sentinelleRef.current.delete(el.chiave); }}
            data-indice={i}
            style={{
              height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always',
              position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}>
            {el.tipo === 'video' ? (
              <>
                <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
                  {i === indiceAttivo ? (
                    // b.515 — il player ufficiale YouTube (nocookie), come
                    // in SchedaArgomento.js: la sua monetizzazione resta
                    // sua. Esiste SOLO mentre e la slide attiva: uscendo
                    // dalla vista lo smontaggio del componente ferma
                    // l'audio da solo, senza un comando esplicito.
                    <iframe key={`on-${el.dati.id}`}
                      // b.551 — enablejsapi: senza, il player non si lascia ne silenziare
                      // ne interrogare sul tempo, e l'Interprete resta cieco e muto.
                      src={`https://www.youtube-nocookie.com/embed/${el.dati.id}?autoplay=1&playsinline=1&enablejsapi=1`}
                      title={el.dati.titolo}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura YouTube, dominio esterno
                    <img src={el.dati.miniatura} alt="" loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                  )}
                </div>
                {/* b.546 — anche il video dice di chi e': il nome del
                    canale, sopra l'inquadratura. Nessuna bandiera: un
                    canale YouTube non ha un paese che si possa leggere
                    dal suo indirizzo, e una bandiera indovinata sarebbe
                    peggio di nessuna bandiera. */}
                {/* b.553-bis — dalla porta ufficiale arriva l'istante
                    vero (`pubblicato`), non piu l'eta a parole: la riga
                    in alto puo scrivere data E ora, come chiesto. */}
                <RigaOrigine origine={el.dati.canale}
                  quandoMs={el.dati.pubblicato || 0}
                  quandoTesto={el.dati.quandoTesto || ''}
                  lingua={miaLingua} />
                {/* ═══ b.551 — L'INTERPRETE DEL VIDEO ═══
                    Ordini di Luca: «possiamo trovare il modo di silenziare
                    l'audio e tradurre direttamente con elevenlabs?»,
                    «rallentiamo la partenza del video di 5 secondi e diamo
                    modo al sistema di elaborare frasi compiute», «potremmo
                    darla dove disponibile no??», «le scelte possibili
                    devono essere chiare senza confondere l'utente».
                    Il tasto NON esiste se il video non ha sottotitoli: una
                    porta che non si apre non si mostra (la regola delle
                    testate chiuse, b.535). Tre scelte dette in chiaro:
                    spento, sottotitoli tradotti, voce. */}
                <InterpreteVideo videoId={el.dati.id} lingua={miaLingua}
                  attivo={i === indiceAttivo} C={C} L={L}
                  daFondo={BARRA_YT + PIEDE_VIDEO} />

                {/* b.539 — i tasti che mancavano ai video. */}
                <Azioni voci={[
                  /* b.544 — IL CUORE, in cima: e la cosa piu facile da fare
                     e quella che alimenta il resto (i contenuti amati
                     salgono nel feed di tutti). */
                  (() => {
                    const u = `youtube.com/watch?v=${el.dati.id}`;
                    const k = chiaveContenuto(u);
                    const acceso = miei.has(k) || (hoMessoCuore(u) && !miei.size);
                    return { chiave: 'cuore', icona: 'heart', parola: L('likeWord'), acceso, caldo: true,
                      conto: quantiCuori(conteggi, u, null) || null, onTocca: () => cuore(u) };
                  })(),
                  (() => {
                    const u = `youtube.com/watch?v=${el.dati.id}`;
                    const k = chiaveContenuto(u);
                    const mia = mieFacce[k] !== undefined ? mieFacce[k] : miaReazione(u);
                    const { totale } = contaReazioni(conteggiFacce, u);
                    return { chiave: 'facce', conto: totale || null, nodo: (
                      <VentaglioReazioni valore={mia} onScegli={(id) => reagisci(u, id)}
                        C={C} targa={L('reactWord')} />
                    ) };
                  })(),
                  { chiave: 'parlane', icona: 'chat', parola: L('newsTalkAbout'), onTocca: () => { vibrate(10); onParlane?.({ titolo: el.dati.titolo, sintesi: el.dati.canale ? `YouTube \u00b7 ${el.dati.canale}` : '' }); } },
                  /* ═══ b.552 — I DUE POLLICI, per ordine di Luca ═══
                     «un tasto preferito, da tenere in una bacheca che devi
                     mettere nella sidebar» e «un tasto non mostrare piu
                     contenuto all'utente, perche gia visto e non si
                     desidera rivederlo». Uno mette da parte, l'altro
                     butta via: sono le due sole cose che si possono dire
                     a un feed senza scrivere niente. */
                  { chiave: 'bacheca', icona: 'star', parola: L('boardSave'),
                    acceso: inBacheca(prefs, `youtube.com/watch?v=${el.dati.id}`),
                    onTocca: () => { vibrate(8); onBacheca?.(el.dati); } },
                  { chiave: 'basta', icona: 'eye', parola: L('hideForever'),
                    onTocca: () => { vibrate(12); onNascondi?.(el.dati); } },
                  { chiave: 'fuori', icona: 'link', parola: L('newsOpenSite'), onTocca: () => { vibrate(6); try { window.open(`https://www.youtube.com/watch?v=${el.dati.id}`, '_blank', 'noopener,noreferrer'); } catch { /* il browser ha rifiutato la finestra */ } } },
                ]} />

                {/* b.535 — Luca: «il menu di youtube rimane nascosto».
                    Questo velo col titolo copriva la barra dei comandi del
                    player e si mangiava i tocchi: ora e' solo pittura
                    (pointerEvents none) — il titolo si vede, il menu di
                    YouTube si tocca. */}
                <div style={{
                  // b.538, Luca per la seconda volta: «i comandi di YouTube
                  // rimangono nascosti dall'ombreggiatura in basso. Devi
                  // fare in modo di alzarla». In b.535 il velo aveva smesso
                  // di RUBARE i tocchi (pointerEvents none), ma continuava a
                  // COPRIRLI con la pittura: la barra del player sta negli
                  // ultimi ~56 punti dell'inquadratura, e li c'era il fondo
                  // scuro pieno. Ora il blocco si alza di tutta l'altezza
                  // della barra (BARRA_YT) e il gradiente si spegne prima:
                  // il titolo si legge, i comandi restano in chiaro.
                  position: 'relative', zIndex: 1,
                  padding: '16px 20px 10px',
                  marginBottom: `calc(${BARRA_YT}px + env(safe-area-inset-bottom))`,
                  background: 'linear-gradient(180deg, transparent, rgba(5,7,15,0.92) 55%)',
                  pointerEvents: 'none',
                }}>
                  {/* b.552 — QUI RESTA SOLO IL TITOLO, e al massimo due
                      righe. Il nome del canale e' salito nella riga in
                      alto (RigaOrigine): tenerlo anche qui era un
                      doppione, e ogni riga in piu qui sotto e' una riga
                      che finisce addosso ai sottotitoli. Con il taglio a
                      due righe il piede ha un'altezza CERTA — PIEDE_VIDEO
                      — e l'interprete sa esattamente dove fermarsi. */}
                  <div style={{
                    fontSize: 15, fontWeight: 500, color: '#fff', lineHeight: 1.3,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{el.dati.titolo}</div>
                </div>
              </>
            ) : (
              <>
                {/* ═══ b.542 — LA PAGINA NERA ═══
                    Collaudo di Luca: «controlla perche hai fatto una
                    pagina nera». Non era una pagina rotta: era una slide
                    SENZA IMMAGINE. Le card dell'enciclopedia (e diverse
                    notizie) non ne hanno una, e qui lo sfondo si
                    disegnava solo `se` l'immagine c'era — altrimenti
                    restava il vuoto, con due righe di testo in fondo e
                    mezzo schermo di nero.
                    Ora il fondo c'e SEMPRE: quando manca la fotografia
                    si mette una copertina fatta in casa — il colore del
                    tema in sfumatura e l'iniziale della fonte in
                    filigrana, come gia fanno le card della lista. Una
                    slide senza foto puo essere spoglia; non puo essere
                    vuota.

                    ═══ b.546 — UNA MINIATURA SOLA, MAI DUE ═══
                    Collaudo di Luca: «mostra sempre una sola miniatura
                    e mai due affiancate». Controllato AnteprimaCoperta
                    riga per riga: disegna UN elemento solo — la
                    fotografia, oppure (se il contenuto e da coprire) il
                    velo sfocato al suo posto — mai i due insieme e mai
                    affiancati; da li la seconda miniatura non arrivava.
                    Perche' non possa arrivarci nemmeno domani, lo
                    sfondo ha adesso UN posto solo: questo strato, che
                    ritaglia cio che esce (`overflow: hidden`) e tiene
                    dentro una cosa sola — la fotografia se c'e,
                    l'iniziale in filigrana se non c'e. Un `se/altrimenti`,
                    non due rami che possono accendersi insieme. */}
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${C.accent}22, ${C.purple || C.accent}18 45%, rgba(5,7,15,0.96))`, overflow: 'hidden' }}>
                  {el.dati.immagine ? (
                    <>
                      <AnteprimaCoperta src={el.dati.immagine} L={L}
                        contenuto={{ url: el.dati.url, source: el.dati.fonti?.[0]?.fonte || el.dati.fonti?.[0]?.dominio }}
                        stile={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,7,15,0.15), rgba(5,7,15,0.92) 65%)' }} />
                    </>
                  ) : (
                    <div aria-hidden="true" style={{
                      position: 'absolute', inset: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      // b.546 — 500 anche qui: Luca non vuole grassetto
                      // da nessuna parte, nemmeno in una filigrana.
                      fontSize: 132, fontWeight: 500, fontFamily: FONT,
                      color: 'rgba(255,255,255,0.07)', letterSpacing: 2, userSelect: 'none',
                    }}>
                      {String(el.dati.fonti?.[0]?.fonte || el.dati.titolo || '·').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                {/* b.546 — la bandiera e la fonte, sopra la foto:
                    «non vedo bandiere negli articoli ne le fonti,
                    mostra la bandiera e l'origine e che si veda
                    bene» (Luca). */}
                <RigaOrigine
                  bandiera={paese ? bandieraPaese(paese) : ''}
                  luogo={paese ? nomePaese(paese) : ''}
                  origine={fonteArticolo}
                  quandoMs={el.dati.pubblicato || el.dati.fonti?.[0]?.pubblicato || 0}
                  lingua={miaLingua} />
                {/* b.539 — le stesse porte dei video, nello stesso posto:
                    il feed non cambia grammatica a meta scorrimento. */}
                <Azioni voci={[
                  (() => {
                    const u = el.dati.url || '';
                    const k = chiaveContenuto(u);
                    const acceso = miei.has(k) || (hoMessoCuore(u) && !miei.size);
                    return { chiave: 'cuore', icona: 'heart', parola: L('likeWord'), acceso, caldo: true,
                      conto: quantiCuori(conteggi, u, null) || null, onTocca: () => cuore(u) };
                  })(),
                  (() => {
                    const u = el.dati.url || '';
                    const k = chiaveContenuto(u);
                    const mia = mieFacce[k] !== undefined ? mieFacce[k] : miaReazione(u);
                    const { totale } = contaReazioni(conteggiFacce, u);
                    return { chiave: 'facce', conto: totale || null, nodo: (
                      <VentaglioReazioni valore={mia} onScegli={(id) => reagisci(u, id)}
                        C={C} targa={L('reactWord')} />
                    ) };
                  })(),
                  { chiave: 'commenta', icona: 'chat', parola: L('commentsWord'), onTocca: () => { vibrate(8); onCommenta?.(el.dati); } },
                  { chiave: 'leggi', icona: 'doc', parola: L('newsOpenTranslate'), onTocca: () => { vibrate(8); onApriArticolo?.(el.dati); } },
                  /* ═══ b.552 — I DUE POLLICI, per ordine di Luca ═══
                     «un tasto preferito, da tenere in una bacheca che devi
                     mettere nella sidebar» e «un tasto non mostrare piu
                     contenuto all'utente, perche gia visto e non si
                     desidera rivederlo». Uno mette da parte, l'altro
                     butta via: sono le due sole cose che si possono dire
                     a un feed senza scrivere niente. */
                  { chiave: 'bacheca', icona: 'star', parola: L('boardSave'),
                    acceso: inBacheca(prefs, el.dati.url),
                    onTocca: () => { vibrate(8); onBacheca?.(el.dati); } },
                  { chiave: 'basta', icona: 'eye', parola: L('hideForever'),
                    onTocca: () => { vibrate(12); onNascondi?.(el.dati); } },
                  { chiave: 'parlane', icona: 'chat', parola: L('newsTalkAbout'), onTocca: () => { vibrate(10); onParlane?.(el.dati); } },
                  el.dati.url ? { chiave: 'fuori', icona: 'link', parola: L('newsOpenSite'), onTocca: () => { vibrate(6); try { window.open(el.dati.url, '_blank', 'noopener,noreferrer'); } catch { /* il telefono ha bloccato la finestra nuova: non e' un guasto nostro e non merita un allarme a schermo, chi vuole il sito ha ancora il tasto */ } } } : null,
                ]} />

                <div style={{ position: 'relative', zIndex: 1, padding: '16px 20px calc(28px + env(safe-area-inset-bottom))' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: '#fff', lineHeight: 1.3 }}>{el.dati.titolo}</h3>
                  {el.dati.sintesi && (
                    <p style={{
                      margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {el.dati.sintesi}
                    </p>
                  )}
                  {/* b.542 — I DUE BOTTONI IN BASSO SONO USCITI. Luca:
                      «devi toglierlo da sotto se lasci un duplicato a
                      destra, e anche apri e traduci giusto?». Giusto: in
                      b.539 ho aggiunto la colonnina a destra e ho
                      lasciato in piedi anche questi, cosi ogni articolo
                      aveva DUE «Apri e traduci» e DUE «Parlane» che
                      facevano la stessa identica cosa. Le porte stanno
                      nella colonnina, dove stanno anche per i video: una
                      grammatica sola.
                      b.546 — ricontrollato su richiesta di Luca
                      («parlane non deve occupare tutto quello
                      spazio»): qui sotto NON c'e nessun bottone a piena
                      larghezza, e non deve tornarcene mai uno. */}
                </div>
              </>
            )}
          </div>
          );
        })}

        {/* ═══ b.544 — L'ULTIMA RATIO, e si vede solo se serve ═══
            Ordine di Luca, con lo schermo davanti: «questo deve essere la
            ultima razio, nel senso che tu devi produrre i contenuti e se
            proprio non ne hai mostri sotto l'ultimo contenuto un campo
            semplice senza descrizione, e un tasto per avviare una
            ricerca, e immediatamente fai andare in alto il campo e
            presenti il nuovo contenuto» — piu la regola che vale per
            tutto: «considera che le persone sono pigre e devi mettergli
            in bocca i contenuti».
            In b.541 avevo fatto l'errore opposto: con il feed vuoto
            questa slide diventava la PRIMA cosa che si vedeva, con
            titolo e spiegazione, cioe un compito da svolgere al posto
            del giornale. Adesso: compare SOLO in coda a contenuti che
            gia ci sono (`elementi.length > 0`), e' nuda — campo e tasto,
            nessuna descrizione — e appena si semina si torna in cima,
            dove il contenuto nuovo sta gia arrivando. */}
        {elementi.length > 0 && onCerca && (
          <div style={{
            height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '24px 24px calc(40px + env(safe-area-inset-bottom))',
          }}>
            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 420 }}>
              <input value={seme} onChange={(e) => setSeme(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && seme.trim()) semina(); }}
                placeholder={L('newsWhatFollow')} aria-label={L('newsWhatFollow')}
                style={{
                  flex: 1, minHeight: 48, padding: '0 14px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)',
                  outline: 'none', color: '#fff', fontSize: 15, fontFamily: FONT,
                }} />
              <button onClick={semina} disabled={!seme.trim()}
                aria-label={L('newsUpdate')}
                style={{
                  minWidth: 54, minHeight: 48, borderRadius: 14, border: 'none',
                  cursor: seme.trim() ? 'pointer' : 'default', opacity: seme.trim() ? 1 : 0.5,
                  background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Icon name="search" size={18} color="#fff" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </Sovrapposizione>
  );
}
