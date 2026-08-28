'use client';
// ═══════════════════════════════════════════════════════════════
// MondoNews — il tab NEWS dentro Mondo (b.147)
//
// La regola di prodotto, concordata: la notizia e il pretesto, la
// conversazione e il prodotto. Quindi in cima ai risultati stanno le
// STANZE che gia parlano dell'argomento (livello 0, gratis), poi le
// Topic Card raggruppate per evento. Ogni card ha [Apri] e [Parlane]:
// Parlane apre il foglio di creazione stanza gia compilato.
//
// IL PROCESSO SI VEDE. La rotta /api/topics/search risponde una riga
// NDJSON per stadio: qui ogni riga diventa una voce nel pannello
// "COBRA", cosi l'attesa racconta il lavoro invece di nasconderlo.
//
// Niente aggiornamento automatico: ogni ricerca nasce da un gesto.
// ═══════════════════════════════════════════════════════════════

import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { segnaApertura } from '../lib/interessi.js';
import { COLONNA } from '../lib/righello.js';
import { ordinaFeed } from '../lib/ordineFeed.js';
// b.545 — il motore costruito e provato ieri, finalmente attaccato al
// giornale: il punteggio condiviso (chi apre, commenta, guarda), la
// campanella degli avvisi e il filo dei commenti sotto ogni articolo.
import { ordinaPerPunteggio, mescolaConInteresse } from '../lib/punteggioFeed.js';
import { chiaveContenuto, mieiCuori } from '../lib/gradimento.js';
import { giraBacheca, nascondi, senzaNascosti, bachecaDi, spostaInBacheca, togliDaBacheca } from '../lib/bacheca.js';
import { soloRecenti, quantiFreschi } from '../lib/topics/registro.js'; // b.557 — le notizie sono di oggi
import { eDiCronaca } from '../lib/topics/enciclopediaUtile.js';        // b.557 — e questa domanda ha una scadenza? // b.552 — la bacheca e il «non mostrarmelo piu»
import { cercaTopics, chiediRami, chiediFonti } from '../lib/topics/cliente.js';   // b.409 — il lettore a righe, uno per tutti; b.541 — i rami del giardino
import { semiDi, prossimaQuery, esaurito, sanaRami } from '../lib/giardino.js'; // b.541 — le ricerche sono semi
import { listaVecchia, giorniDiVita } from '../lib/topics/fonti.js'; // b.543 — il Fontiere
import { vociDaTradurre, applicaTraduzioni, traduzioneAccesa } from '../lib/topics/titoliTradotti.js'; // b.548 — i titoli nella tua lingua
import Scelta from './ui/Scelta.js';
import { ricerchePredefinite } from '../lib/casaEViaggio.js';
import { preferitiAggiunti, ePreferita, aggiungiPreferita, togliPreferita } from '../lib/preferitiRicerche.js'; // b.535
import { testataChiusa } from '../lib/testateChiuse.js'; // b.535 — la porta chiusa non si offre
import { bandieraPaese, nomePaese, quando, tipoContenuto, fonteDi, viva, stileEtichetta, PUNTO, paeseDaLingua } from '../lib/schedaMondo.js';
import PannelloLaterale from './ui/PannelloLaterale.js';
import CardSezione from './ui/CardSezione.js';   // b.550 — la card di vetro, una per tutte e tre le sidebar
import ParlaneCon from './ui/ParlaneCon.js';     // b.551 — il ponte fra una notizia e Vita
import { sesSet } from '../lib/memoria.js';
import PreferenzeMondo from './ui/PreferenzeMondo.js';
import PreferitiTemi from './ui/PreferitiTemi.js';
import { PAESI } from '../lib/paesi.js';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import AnteprimaCoperta from './ui/AnteprimaCoperta.js';
import SchedaArgomento from './SchedaArgomento.js';
import FeedNotizieMondo from './FeedNotizieMondo.js'; // b.515 — il feed a tutta pagina
import MondoDiscussioni from './MondoDiscussioni.js';
import Ribalta from './ui/Ribalta.js';
import LettoreArticolo from './ui/LettoreArticolo.js';
import Campanella from './ui/Campanella.js';        // b.545 — gli avvisi, in alto
import FiloCommenti from './ui/FiloCommenti.js';    // b.545 — il filo sotto il contenuto
import MondoPersona from './MondoPersona.js';
import { useApp } from '../contexts/AppContext.js';
// b.255 — vedi lib/pannelloPieno.js: un pannello che copre lo schermo lo
// dichiara, cosi il banner d'installazione non gli finisce sopra.
import { apriPannelloPieno, chiudiPannelloPieno } from '../lib/pannelloPieno.js';

const CATEGORIE = [
  { id: 'top',        cat: 'notizie',    labelKey: 'newsTopHeadlines' },
  { id: 'mondo',      cat: 'notizie',    labelKey: 'catWorld' },
  { id: 'sport',      cat: 'sport',      labelKey: 'catSport' },
  { id: 'tecnologia', cat: 'tecnologia', labelKey: 'catTech' },
  { id: 'economia',   cat: 'economia',   labelKey: 'catEconomy' },
  { id: 'scienza',    cat: 'scienza',    labelKey: 'catScience' },
  { id: 'arte',       cat: 'arte',       labelKey: 'catArt' },
];

// La query da mandare al motore per ogni scorciatoia, per lingua UI.
// "top" usa il nome del giornale radio: i titoli del giorno.
const QUERY_RAPIDE = {
  top:        { it: 'ultime notizie', en: 'top news today', es: 'últimas noticias', fr: 'dernières nouvelles', de: 'nachrichten heute' },
  mondo:      { it: 'notizie dal mondo', en: 'world news', es: 'noticias del mundo', fr: 'actualités monde', de: 'weltnachrichten' },
  sport:      { it: 'sport', en: 'sports', es: 'deportes', fr: 'sport', de: 'sport' },
  tecnologia: { it: 'tecnologia', en: 'technology', es: 'tecnología', fr: 'technologie', de: 'technologie' },
  economia:   { it: 'economia', en: 'economy business', es: 'economía', fr: 'économie', de: 'wirtschaft' },
  scienza:    { it: 'scienza', en: 'science', es: 'ciencia', fr: 'science', de: 'wissenschaft' },
  arte:       { it: 'arte cultura', en: 'art culture', es: 'arte cultura', fr: 'art culture', de: 'kunst kultur' },
};

// b.398 — `suPaeseScelto` chiude il giro. Il Paese scendeva dal globo
// fino a qui, ma da qui non risaliva: toccando la bandiera su una scheda
// cambiava solo la copia locale, e il pianeta e le Stanze non ne sapevano
// niente. Nel documento di Luca il Paese e «stato globale della sezione
// Mondo, non un filtro locale di una singola pagina»: se lo cambi da una
// parte deve cambiare dappertutto, altrimenti passando da News a Stanze
// ti ritrovi in un altro posto senza averlo chiesto.
// b.535 — LA CARD DI VETRO DELLA SIDEBAR (scelta di Luca dal ventaglio:
// «Card di vetro con icona»). Chip con icona blu, titolo bianco,
// didascalia LEGGIBILE (mai piu grigio smorto su fondo scuro), contenuto
// dentro. Una sola forma per tutte le sezioni del pannello.
function MondoNews({ C, onJoinRoom, onParlane, apriDiscussioneId = null, suApertaDiscussione, strumenti = false, suChiudiStrumenti, suApriStrumenti, paeseDalGlobo = null, suPaeseScelto, suScorrimento, temaDaFuori = null, suTemaLetto }) {
  const { L, prefs, userToken, savePrefs, setView } = useApp();
  const lingua = prefs.uiLang || 'en';
  // b.186 — "cerca -> apri discussione col link": la discussione pubblica
  // persistente aperta da una card (id) e il flag di creazione in corso.
  const [discAperta, setDiscAperta] = useState(null);
  // b.365 — cosa c'e sull'altra faccia del foglio: un articolo da
  // leggere, oppure niente (allora dietro ci va la discussione).
  const [lettura, setLettura] = useState(null);
  // b.363 — la discussione scelta nei risultati di ricerca si apre davvero
  useEffect(() => {
    if (!apriDiscussioneId) return;
    setDiscAperta(apriDiscussioneId);
    suApertaDiscussione?.();
  }, [apriDiscussioneId, suApertaDiscussione]);
  const [creando, setCreando] = useState(false);
  // b.187 — il FEED sfogliabile delle discussioni pubbliche persistenti.
  const [feed, setFeed] = useState(null);
  // b.188 — il profilo di una persona aperto dal thread (id pubblico).
  const [personaAperta, setPersonaAperta] = useState(null);

  const [query, setQuery] = useState('');
  const [cercando, setCercando] = useState(false);
  const [processo, setProcesso] = useState([]);   // le righe del pannello COBRA
  const [argomenti, setArgomenti] = useState(null); // null = mai cercato
  const [stanze, setStanze] = useState([]);
  const [daCache, setDaCache] = useState(false);
  // b.255 — non piu un booleano: '' = nessun errore, 'account' = serve un
  // conto, 'guasto' = la ricerca non e riuscita. Due cause diverse non
  // possono avere lo stesso messaggio.
  const [errore, setErrore] = useState('');
  const [chipAttiva, setChipAttiva] = useState(null);
  // b.153 — la scheda di lettura/visione e i video di YouTube.
  const [scheda, setScheda] = useState(null); // b.516 — resta in uso SOLO per i video
  // b.515 — il feed a tutta pagina (stile reel): aperto/chiuso qui,
  // il filtro (solo video di default — ordine di Luca) e una preferenza
  // persistita, cosi resta com'era l'ultima volta che l'ha scelto.
  const [feedAperto, setFeedAperto] = useState(false);
  // b.529 — Luca: «non vedo la visualizzazione default video di cui
  // abbiamo parlato». L'ordine originale (b.515) diceva «se uno ENTRA e
  // scorre attiva l'autoplay»: la vista continua a tutta pagina si apre
  // DA SOLA la prima volta che si entra in Notizie (una volta per
  // sessione, filtro gia SOLO VIDEO di default). La X riporta al
  // giornale e non ricompare piu fino alla prossima apertura dell'app.
  // b.540 — SI PARTE DAL FEED, SEMPRE. Ordine di Luca: «parti
  // all'apertura con i feed direttamente». Prima si apriva una volta per
  // sessione (bandierina __VT_FEED_VISTO): chi tornava in Notizie una
  // seconda volta trovava l'elenco, cioe una porta diversa dalla prima.
  // Ora la presentazione e' la porta, ogni volta; la freccia indietro
  // lascia il giornale a chi lo vuole.
  useEffect(() => { setFeedAperto(true); }, []);
  // b.533 — IL GIORNALE DEL VIAGGIATORE: entrando in Notizie senza aver
  // mai cercato, la prima ricerca parte DA SOLA col default di
  // casaEViaggio (prima casa: la Gazzetta del mattino; il polo «dove
  // sono» lo copre gia il giro delle breaking). Cosi il feed che si
  // apre da solo (b.529) non e mai vuoto. Silenziosa: non finisce
  // nelle «ultime ricerche», che sono le TUE.
  useEffect(() => {
    // b.535 — BUG (collaudo di Luca: «quando apro notizie non mi fai
    // vedere le notizie»): la bandierina window.__VT_GAZZETTA valeva per
    // TUTTA la sessione, ma i risultati vivono nello stato del
    // componente, che muore uscendo dalla scheda. Secondo ingresso:
    // bandierina alzata, stato vuoto -> giornale bianco per sempre.
    // La guardia giusta e' lo stato stesso: se il giornale e' vuoto e
    // nessuna ricerca corre, la Gazzetta parte. Resta silenziosa e la
    // cache del server evita di ripagare le ricerche gia' fatte.
    if (typeof window === 'undefined') return;
    if (argomenti !== null || cercando) return;
    try {
      // b.541 — SI PARTE DAI TUOI SEMI. Luca: «se le mie ricerche ultime
      // sono dentro perche nei reel non vedo piu questi contenuti?».
      // Perche' all'apertura si piantava sempre e solo il giro
      // predefinito. Ora il primo a entrare e' il seme piu importante
      // che hai (una ricerca salvata con la stella, poi le recenti), e
      // il giro predefinito resta come ultima riserva.
      const semiUtente = semiDi(prefs, ricerchePredefinite(prefs, nomePaese));
      const giri = semiUtente.length ? semiUtente : ricerchePredefinite(prefs, nomePaese);
      // b.535 — «perche mi presenta sempre le stesse notizie quando
      // entro????» (Luca): la prima ricerca era SEMPRE giri[0], quindi
      // stesso mazzo a ogni ingresso (e articoli anche vecchi di
      // giorni: VERI, non finti — ma sempre quelli). Ora i giri
      // RUOTANO a ogni ingresso (la Gazzetta di casa, il paese dove
      // sei, i temi): il giornale cambia faccia da solo, senza
      // spendere ricerche in piu.
      let n = 0;
      try {
        n = parseInt(localStorage.getItem('vt-gazzetta-giro') || '0', 10) || 0;
        localStorage.setItem('vt-gazzetta-giro', String(n + 1));
      } catch { /* senza memoria si parte dal primo giro */ }
      // ═══ b.549 — SI PIANTANO TUTTI I SEMI, NON UNO ═══
      // Collaudo di Luca: «mostra solo i preferiti, e limita le pagine da
      // vedere, non fa l'autoricerca». Vero: qui si piantava UN giro solo
      // — con tre preferiti se ne vedeva uno, e il giornale restava corto
      // come una pagina. Adesso il primo seme apre il giornale e gli
      // altri due si ACCODANO subito dopo, uno alla volta per non fare a
      // pugni sulla stessa chiamata: tre semi, tre mazzi di contenuti.
      // La rotazione di b.535 decide da quale si comincia, cosi il
      // giornale cambia faccia a ogni ingresso.
      const quanti = Math.min(giri.length, 3);
      const scelti = Array.from({ length: quanti }, (_, i) => giri[(n + i) % giri.length]).filter((g) => g?.query);
      if (!scelti.length) return;
      (async () => {
        await cerca(scelti[0].query, 'notizie', false, true);
        for (const altro of scelti.slice(1)) {
          await cerca(altro.query, 'notizie', false, true, true);   // accodato
        }
      })();
    } catch { /* senza default si resta sull'invito a cercare */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parte una volta, all'ingresso
  }, []);
  const feedFiltro = prefs?.mondoFeedFiltro || 'video'; // { tipo: 'articolo'|'video', dati }
  const [video, setVideo] = useState(null);   // null = mai cercati
  const [videoAttivi, setVideoAttivi] = useState(false);
  // b.185 — seconda modalita: Veloce (default) o Approfondita (piu fonti,
  // Wikipedia in testa). `numFonti` = quanto approfondire (3/6/10).
  // b.363 — il modo lo dice la PREFERENZA: si decide una volta e resta.
  // b.541 — il predefinito e' APPROFONDITA (ordine di Luca: «questo deve
  // essere il default»). Il valore scritto qui deve dire lo stesso del
  // pannello: se i due si scostano, il pannello mente — gia successo col
  // ritmo del globo in b.535.
  const profonda = (prefs?.mondoModo || 'approfondita') === 'approfondita';
  const [numFonti, setNumFonti] = useState(10); // b.541 — dieci, come nello schermo che Luca ha eletto a predefinito
  const abortRef = useRef(null);
  const cercandoRef = useRef(false);   // b.549 — la guardia vera, senza attese di ridisegno
  const abortDietroRef = useRef(null); // b.552 — il giro che cresce da solo: si annulla da se, mai quello davanti
  const [feedGuasto, setFeedGuasto] = useState(false);
  // b.363 — LA PREFERENZA "QUANDO AGGIORNO", che fa una cosa vera: se e
  // impostata su "all'apertura", le notizie si cercano da sole appena si
  // entra, una volta sola. Altrimenti si aspetta che tu tocchi Aggiorna,
  // che e il modo di non spendere credito senza averlo chiesto.
  const giaCercato = useRef(false);
  const tornaAlFeedRef = useRef(false); // b.535 — chi apre un articolo DAL FEED, chiudendolo torna al feed
  useEffect(() => {
    if ((prefs?.mondoAggiorna || 'apertura') !== 'apertura') return;
    if (giaCercato.current || !userToken) return;
    giaCercato.current = true;
    cercaChip(CATEGORIE[0], true); // b.535 — apertura automatica: silenziosa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs?.mondoAggiorna, userToken]);

  // b.363 — l'argomento scelto fra quelli VERI delle discussioni aperte
  const [argomentoFiltro, setArgomentoFiltro] = useState(null);
  // b.363 — il paese scelto con un tocco sulla bandiera di una scheda
  const [paeseFiltro, setPaeseFiltro] = useState(null);
  // b.529 — LA BOZZA DEL PANNELLO (Luca: «devi mettere un tasto di
  // conferma dentro le side bar perche non dobbiamo ripetere query per
  // ogni operazione»). Paese e «Cerca la fuori» non scattano piu al
  // tocco: si sceglie con calma e si APPLICA una volta sola.
  const [ultimaRicerca, setUltimaRicerca] = useState(null); // b.535 — per la stella «salva nei preferiti»
  // ═══ b.541 — IL GIARDINO ═══
  // Luca: «le ricerche sono un seme che fa crescere una pianta... ogni
  // ramo ne crea altri quando ha esaurito le informazioni». Qui vive lo
  // stato della pianta: cosa e' gia stato cercato, quali rami sono noti,
  // e cosa e' gia finito sotto gli occhi (per non ripetere le stesse
  // schede quando si accoda un giro nuovo).
  const [ramiNoti, setRamiNoti] = useState([]);
  const usateRef = useRef([]);
  const vistiRef = useRef(new Set());   // url gia mostrati: il feed non ripete
  const [crescendo, setCrescendo] = useState(false);
  // ═══ b.543 — IL FONTIERE ═══
  // Luca: «vicino al selettore paese o lingua della sidebar aggiungi un
  // tasto... anche i settori devono riaccendere la icona (spenta dopo il
  // primo aggiornamento)». `listaFonti` e cio che sappiamo adesso;
  // l'icona e ACCESA quando la lista manca o ha passato i trenta giorni.
  const [listaFonti, setListaFonti] = useState(null);
  const [fontiInCorso, setFontiInCorso] = useState(false);
  const [bozzaPaese, setBozzaPaese] = useState(null);
  // b.552 — resta come MEMORIA della categoria attiva (serve al
  // Fontiere, che con un settore in mano sa dove pescare), non piu come
  // tendina da compilare: quella l'ha tolta Luca.
  const [bozzaCategoria, setBozzaCategoria] = useState('');
  // b.386 — il paese toccato sul pianeta filtra anche le notizie. Prima
  // arrivava solo alle stanze: si zoomava sull'Italia e le news restavano
  // del mondo intero, il che faceva sembrare che il gesto non funzionasse
  // a meta.
  useEffect(() => { if (paeseDalGlobo !== undefined) setPaeseFiltro(paeseDalGlobo); }, [paeseDalGlobo]);
  useEffect(() => { if (strumenti) { setBozzaPaese(paeseFiltro); setBozzaCategoria(chipAttiva || ''); } }, [strumenti]); // eslint-disable-line react-hooks/exhaustive-deps -- la bozza si fotografa all'apertura
  // b.398 — si sceglie in un posto solo, e lo sanno tutti: la copia qui
  // dentro serve a disegnare subito, e la stessa scelta risale a Mondo,
  // che la manda al pianeta e alle Stanze.
  // b.400 — COSA NE PENSA IL MONDO. Il documento di Luca la chiama la
  // funzione distintiva: preso un tema, si confrontano le conversazioni fra
  // Paesi. Qui NON si riassume cosa pensa un Paese e non si calcola nessuna
  // percentuale — il documento lo vieta nella stessa riga in cui chiede la
  // funzione. Si CONTA dove se ne parla e quanto, e si entra a leggere.
  // b.401 — il tema scelto nella Home del Paese arriva qui e diventa il
  // filtro. Si consuma una volta sola: dopo comanda chi guarda, e non gli
  // si rimette il filtro sotto le dita ogni volta che la schermata si
  // ridisegna.
  useEffect(() => {
    if (!temaDaFuori) return;
    setArgomentoFiltro(temaDaFuori);
    suTemaLetto?.();
  }, [temaDaFuori, suTemaLetto]);

  const [temaMondo, setTemaMondo] = useState(null);      // il tema aperto
  const [confronto, setConfronto] = useState(null);      // i conti, o null
  const [confrontoGuasto, setConfrontoGuasto] = useState(false);
  useEffect(() => {
    if (!temaMondo) { setConfronto(null); setConfrontoGuasto(false); return; }
    let vivo = true;
    const taglio = new AbortController();
    setConfronto(null); setConfrontoGuasto(false);
    (async () => {
      try {
        const r = await fetch(`/api/mondo/tema?topic=${encodeURIComponent(temaMondo)}`, { signal: taglio.signal });
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (vivo) setConfronto(d);
      } catch (e) {
        // Un guasto non si traveste da «nessuno ne parla»: sono due cose
        // diverse, e chi guarda deve poterle distinguere.
        if (e?.name !== 'AbortError') { console.warn('[b.400] confronto non arrivato:', e?.message); if (vivo) setConfrontoGuasto(true); }
      }
    })();
    return () => { vivo = false; taglio.abort(); };
  }, [temaMondo]);

  const scegliPaese = useCallback((codice) => {
    setPaeseFiltro(codice);
    suPaeseScelto?.(codice);
  }, [suPaeseScelto]);
  const [riprova, setRiprova] = useState(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  // b.187 — carica il feed delle discussioni: all'avvio, quando cambi
  // argomento, e quando chiudi un thread (per vedere quello appena aperto).
  useEffect(() => {
    let vivo = true;
    (async () => {
      // b.363 — un feed CADUTO non e un feed VUOTO: prima entrambi
      // mostravano la stessa pagina bianca e sembrava che nel mondo non
      // parlasse nessuno. Ora il guasto si dichiara e si puo riprovare.
      try {
        const r = await fetch(`/api/mondo/discussioni${chipAttiva ? `?topic=${encodeURIComponent(chipAttiva)}` : ''}`, { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
        if (!vivo) return;
        // b.363 — prima la lettura non era protetta: una risposta rotta
        // lasciava il feed vuoto SENZA dichiarare il guasto, e tornava a
        // sembrare che nel mondo non parlasse nessuno.
        if (r.ok) { const d = await r.json().catch(() => null); if (d) { setFeed(d.discussioni || []); setFeedGuasto(false); } else setFeedGuasto(true); }
        else setFeedGuasto(true);
      } catch (e) {
        // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
        // registro non compariva nulla, e il motivo vero (rete caduta, attesa
        // scaduta, credito finito, server rotto) restava irrecuperabile.
        if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
        if (vivo) setFeedGuasto(true); }
    })();
    return () => { vivo = false; };
  }, [chipAttiva, discAperta, riprova]);

  // b.255 — finche uno di questi pannelli e aperto, niente si mette
  // davanti: erano proprio loro (composer di una discussione, scheda di
  // lettura) a farsi coprire dal banner d'installazione.
  useEffect(() => {
    if (!discAperta && !personaAperta && !scheda) return;
    apriPannelloPieno();
    return () => chiudiPannelloPieno();
  }, [discAperta, personaAperta, scheda]);

  const descriviStadio = useCallback((r) => {
    switch (r.stadio) {
      case 'stanze':    return L('newsCobraRooms');
      case 'cache':     return L('newsCobraCache');
      case 'cerca':     return L('newsCobraSearching');
      case 'fonti':     return L('newsCobraFound').replace('{x}', r.quante);
      case 'leggo':     return L('newsCobraReading').replace('{x}', r.dominio);
      case 'raggruppo': return L('newsCobraCluster');
      case 'riordino':  return L('newsCobraRerank');
      default: return null;
    }
  }, [L]);

  // b.153 — i video viaggiano in parallelo agli articoli: la stessa
  // query interroga anche YouTube (se la chiave c'e) e i risultati
  // compaiono sotto le card. Il fallimento e silenzioso: senza chiave
  // o senza quota, semplicemente niente sezione video.
  // b.552 — ORDINE DI LUCA: «quando sto guardando un video non devi
  // interrompermi per attivare la nuova ricerca, la devi fare in
  // background. Mai rovinare l'esperienza dell'utente».
  // Qui c'era il colpo peggiore: `setVideo(null)` in cima. Mentre stavi
  // guardando, la crescita del giardino svuotava la lista dei video —
  // e la diapositiva sotto i tuoi occhi spariva a meta. In sottofondo
  // adesso non si svuota niente: i video nuovi si ACCODANO in fondo,
  // dove li troverai scorrendo, senza toccare quello che stai vedendo.
  // b.552 — le preferenze «di adesso» viste da dentro una richiesta che
  // e' partita un minuto fa: senza questo, il filtro dei nascosti
  // userebbe l'elenco che c'era quando la chiamata e' partita.
  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  const cercaVideoPer = useCallback(async (q, dietro = false) => {
    if (!dietro) setVideo(null);
    try {
      const r = await fetch(`/api/topics/video?q=${encodeURIComponent(q)}&lang=${lingua}&ore=${Number(prefsRef.current?.finestraOre ?? 48)}`, { signal: AbortSignal.timeout(60000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
      if (!r.ok) return;
      // b.363 — prima la lettura non era protetta e la ricerca video moriva
      // in silenzio, lasciando la griglia vuota senza un motivo.
      const d = await r.json().catch(() => null);
      if (!d) { console.warn('[b.363] topics/video: risposta illeggibile'); return; }
      setVideoAttivi(!!d.disponibile);
      // b.324 — audit Mondo D6: la griglia mostrava lo stesso video due
      // volte (fonti diverse, stesso id). Dedup per id/url prima di mostrare.
      if (d.disponibile) {
        setVideo((prima) => {
          const base = dietro && Array.isArray(prima) ? prima : [];
          // b.552 — e neanche i video nascosti tornano indietro
          const visti = new Set(base.map((v) => v?.id || v?.url || v?.titolo).filter(Boolean));
          const nuovi = (d.video || []).filter((v) => {
            const k = v?.id || v?.url || v?.titolo;
            if (!k || visti.has(k)) return false;
            visti.add(k); return true;
          });
          return senzaNascosti([...base, ...nuovi], prefsRef.current);
        });
      }
    } catch { /* i video sono un di piu, mai un errore in faccia */ }
  }, [lingua]);

  // b.541 — `accoda`: il giro nuovo si AGGIUNGE a quello che gia si sta
  // guardando, invece di sostituirlo. E' cio che permette al feed di non
  // finire mai — e cio che mancava perche' i semi di Luca (Tom Cruise,
  // Chelsea) non si vedevano: il giornale teneva UNA ricerca alla volta,
  // l'ultima, e le altre sparivano.
  // ═══ b.548 — I TITOLI SI TRADUCONO DAVVERO ═══
  // Collaudo di Luca: «i testi non vengono tradotti anche se il setting
  // dice di farlo». La preferenza esisteva, si accendeva, si salvava — e
  // nel giornale non la leggeva nessuno: una feature orfana in piena
  // regola. Adesso, quando le schede arrivano, cio che non e gia nella
  // lingua di chi guarda viene tradotto e sostituito (l'originale resta
  // dentro la scheda: non si perde niente).
  // Si traduce SOLO cio che si sta guardando (tetto in vociDaTradurre) e
  // mai due volte la stessa frase.
  const tradottiRef = useRef(new Map());   // impronta -> resa, per non ripagare
  const [inTraduzione, setInTraduzione] = useState(false);
  const traduciSchede = useCallback(async (schede) => {
    if (!traduzioneAccesa(prefs)) return;
    const mia = prefs?.uiLang || prefs?.lang || 'it';
    const voci = vociDaTradurre(schede, mia);
    if (!voci.length) return;
    setInTraduzione(true);
    try {
      const rese = {};
      // le frasi gia tradotte prima non si ripagano
      const daChiedere = voci.filter((v) => {
        const gia = tradottiRef.current.get(`${mia}|${v.testo}`);
        if (gia) { rese[`${v.id}|${v.campo}`] = gia; return false; }
        return true;
      });
      await Promise.all(daChiedere.map(async (v) => {
        try {
          const r = await fetch('/api/translate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: v.testo, sourceLang: 'auto', targetLang: mia, userToken }),
            signal: AbortSignal.timeout(20000),
          });
          if (!r.ok) return;
          const d = await r.json().catch(() => null);
          const resa = d?.translated || d?.testo || '';
          if (!resa) return;
          tradottiRef.current.set(`${mia}|${v.testo}`, resa);
          rese[`${v.id}|${v.campo}`] = resa;
        } catch { /* una frase che non si traduce resta nella sua lingua */ }
      }));
      if (Object.keys(rese).length) setArgomenti((prima) => applicaTraduzioni(prima || [], rese));
    } finally { setInTraduzione(false); }
  }, [prefs, userToken]);

  // b.543 — si guarda (gratis) che lista c'e per questo Paese: serve a
  // sapere se l'icona va accesa, e da quanto tempo.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const d = await chiediFonti({ paese: paeseFiltro || '', leggi: true });
      if (vivo) setListaFonti(d);
    })();
    return () => { vivo = false; };
  }, [paeseFiltro]);

  const migliora = useCallback(async ({ settore = '' } = {}) => {
    if (fontiInCorso) return;
    setFontiInCorso(true);
    try {
      const d = await chiediFonti({
        paese: settore ? '' : (paeseFiltro || ''),
        settore,
        nomePaese: paeseFiltro ? nomePaese(paeseFiltro) : '',
        lingua, userToken, rifai: true,
      });
      if (!settore) setListaFonti(d);
      return d;
    } finally { setFontiInCorso(false); }
  }, [fontiInCorso, paeseFiltro, lingua, userToken]);

  // ═══ b.545 — IL PUNTEGGIO CONDIVISO, ATTACCATO AL GIORNALE ═══
  // Ordine di Luca: «possiamo misurare il tempo che passano gli utenti a
  // vedere un video di un argomento, se commentano, oppure cliccano mi
  // piace per determinare piu velocemente cosa proporre nelle sezioni
  // mondo quando i materiali selezionati terminano».
  //
  // Il conto vive tutto in lib/punteggioFeed.js e la memoria in
  // /api/mondo/segnali: qui c'e' soltanto il filo che li lega alle
  // Notizie. Erano stati costruiti e provati, ma non li chiamava nessuno.

  // I MIEI SEMI nella forma che `mescolaConInteresse` sa leggere: le
  // ricerche salvate con la stella, le ultime che ho fatto, e gli
  // argomenti che apro di piu. Tutte cose che ho fatto IO — mai dedotte
  // da eta, sesso o paese (la regola di lib/interessi.js).
  const interessiMiei = useMemo(() => ({
    interessi: semiDi(prefs, []).map((x) => x.query),
    argomentiVisti: prefs?.argomentiVisti || {},
  }), [prefs]);

  // La copia dell'elenco che si sta guardando. Serve a riordinare DOPO
  // che i conteggi sono tornati dalla rete, sapendo da quale lista si
  // era partiti: dentro `cerca` questo ref vale ancora `prima`, cioe il
  // giornale com'era un attimo prima di accodare il giro nuovo.
  const argomentiRef = useRef(null);
  useEffect(() => { argomentiRef.current = argomenti; }, [argomenti]);

  // UN SEGNALE, E VIA. Non si aspetta la risposta e non si mostra niente:
  // un segnale perduto rende il feed un po meno informato, e basta — non
  // e un guasto da mettere in faccia a chi sta leggendo (e' la stessa
  // scelta gia scritta dentro la rotta, che risponde `salvato: false`).
  const mandaSegnale = useCallback((chiave, tipo, valore = 1) => {
    const k = String(chiave || '').trim();
    if (!k) return;
    fetch('/api/mondo/segnali', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // stesso tetto d'attesa del resto del Mondo (b.363): senza, con la
      // rete muta la chiamata resta appesa per sempre.
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ chiave: k, tipo, valore }),
    }).catch((e) => {
      if (e?.name !== 'AbortError') console.warn('[b.545] POST /api/mondo/segnali:', e?.message || e);
    });
  }, []);

  // RIORDINA COL PUNTEGGIO DI TUTTI, poi mescola col mio interesse.
  //
  // I risultati si mostrano SUBITO e si riordinano quando i conteggi
  // arrivano: far aspettare il giornale per una chiamata in piu sarebbe
  // pagare il motore con l'attesa di chi legge. Se i conteggi non
  // arrivano non succede niente — resta l'ordine di prima.
  //
  // La rotta ne serve trenta per volta (MAX_CHIAVI): oltre, le schede
  // senza conteggio prendono il punteggio del contenuto nuovo, cioe un
  // valore neutro. Scendono in mezzo, non spariscono — qui vale la
  // regola di sempre: SI ORDINA, NON SI FILTRA.
  //
  // b.552 — E CON `fermi` NON SI TOCCA QUELLO CHE STAI GIA GUARDANDO.
  // Ordine di Luca: la crescita in sottofondo non deve interrompere il
  // video. Riordinare TUTTO l'elenco mentre guardi e' un'interruzione
  // anche se nessuna scritta compare: la diapositiva sotto il dito
  // diventa un'altra. Quando il giro e' in sottofondo, le prime `fermi`
  // schede restano dove sono e si ordina solo la coda appena arrivata.
  const riordinaConSegnali = useCallback(async (lista, fermi = 0) => {
    const contenuti = Array.isArray(lista) ? lista : [];
    if (contenuti.length < 2) return;
    const chiavi = [...new Set(contenuti.map((t) => chiaveContenuto(t?.url)).filter(Boolean))].slice(0, 30);
    if (!chiavi.length) return;
    let conteggi = null;
    try {
      const r = await fetch(`/api/mondo/segnali?chiavi=${encodeURIComponent(chiavi.join(','))}`, {
        signal: AbortSignal.timeout(10000),
      });
      const d = r.ok ? await r.json().catch(() => null) : null;
      conteggi = d?.conteggi || null;
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.545] GET /api/mondo/segnali:', e?.message || e);
    }
    if (!conteggi) return;
    // `mescolaConInteresse` garantisce che il migliore di ogni mio seme
    // resti nella prima meta: il punteggio di tutti non puo far sparire
    // le cose che ho chiesto io.
    const testa = fermi > 0 ? contenuti.slice(0, fermi) : [];
    const daOrdinare = fermi > 0 ? contenuti.slice(fermi) : contenuti;
    const ordinati = [
      ...testa,
      ...mescolaConInteresse(ordinaPerPunteggio(daOrdinare, conteggi, Date.now()), interessiMiei),
    ];
    // e si riordina SOLO se nel frattempo il giornale non e cambiato: una
    // ricerca nuova partita mentre i conteggi viaggiavano non deve
    // ritrovarsi in pagina l'elenco di quella vecchia.
    setArgomenti((prima) => (
      Array.isArray(prima) && prima.length === contenuti.length && prima.every((x, i) => x === contenuti[i])
        ? ordinati
        : prima
    ));
  }, [interessiMiei]);

  const cerca = useCallback(async (q, cat = 'notizie', fresca = false, silenziosa = false, accoda = false) => {
    const pulita = (q || '').trim();
    // b.549 — la guardia guarda un RIFERIMENTO, non lo stato. `cercando`
    // e uno stato di React: quando si incatenano due ricerche con await,
    // la seconda parte prima che il ridisegno lo abbia rimesso a falso, e
    // veniva scartata. Cosi i semi accodati non arrivavano mai.
    if (!pulita) return;
    // b.552 — DIETRO = il giro che cresce da solo mentre guardi. Non
    // vibra, non accende il pannello COBRA, non svuota i video, non
    // spegne i tasti: si vede solo perche' in fondo compare altra roba.
    // Ordine di Luca: «mai rovinare l'esperienza dell'utente».
    const dietro = !!accoda;
    if (cercandoRef.current) {
      // due giri insieme si pestano i piedi: chi sta guardando comanda.
      if (dietro) return;
      abortDietroRef.current?.abort();
    }
    cercandoRef.current = true;
    cercaVideoPer(pulita, dietro);
    const ac = new AbortController();
    if (dietro) {
      abortDietroRef.current = ac;
    } else {
      abortRef.current?.abort();
      abortRef.current = ac;
      setCercando(true); setErrore(''); setProcesso([]); setDaCache(false);
      vibrate(10);
    }
    try {
      // b.409 — IL LETTORE A RIGHE NON VIVE PIU QUI DENTRO. Era scritto
      // a mano in questa funzione, e in Life non c'era: la stessa rotta
      // veniva letta bene in Mondo e male in Impara, dove non ha mai
      // prodotto un risultato. Ora e uno solo, in lib/topics/cliente.js.
      // Il comportamento e lo stesso di prima, riga per riga.
      const fine = await cercaTopics(
        // b.543 — se per questo Paese esiste una lista di testate, la
        // ricerca si sdoppia in voci mirate (vedi topics/servizio.js).
        { q: pulita, lingua, cat, fresca, profonda, fonti: profonda ? numFonti : 0, segnale: ac.signal,
          paeseFonti: paeseFiltro || '', settoreFonti: bozzaCategoria || '' },
        (r) => {
          if (dietro) return;   // b.552 — in sottofondo non si racconta niente a schermo
          const testo = descriviStadio(r);
          if (testo) setProcesso(p => [...p.slice(-5), { testo, id: p.length }]);
        },
      );
      if (fine) {
        const arrivati = fine.argomenti || [];
        // b.541 — niente doppioni fra un giro e l'altro: due rami vicini
        // pescano spesso la stessa notizia, e vederla due volte nel feed
        // e' il modo piu rapido per far sembrare finito il giornale.
        // b.552 — cio che hai detto di non volere piu non rientra dalla
        // finestra al giro dopo: si filtra qui, dove il mazzo arriva, e
        // non in venti posti diversi.
        let puliti = senzaNascosti(arrivati, prefs);
        // ═══ b.557 — LE NOTIZIE SONO DI OGGI ═══
        // Collaudo di Luca, con due fotografie in mano: video del 2 e
        // del 24 maggio presentati come attualita. «Quando si parla di
        // news devi lavorare sulle 48 ore».
        // La finestra si applica SOLO alle domande di cronaca: per «tom
        // cruise» o «come si fa il pane» il pezzo di tre anni fa puo
        // essere il migliore che esiste. E se dentro la finestra non
        // resta abbastanza da fare un giornale (meno di quattro pezzi
        // con una data vera) si tiene tutto: meglio una notizia di tre
        // giorni fa che una pagina vuota.
        // Quanto indietro andare lo decide chi guarda, dalla barra
        // (`finestraOre`, ordine di Luca): 0 = nessun limite.
        const oreIndietro = Number(prefs?.finestraOre ?? 48);
        if (oreIndietro > 0 && eDiCronaca(pulita)) {
          const finestra = oreIndietro * 3600 * 1000;
          if (quantiFreschi(puliti, { finestra }) >= 4) puliti = soloRecenti(puliti, { finestra });
        }
        const nuovi = puliti.filter((a) => {
          const chiave = a?.url || a?.id || a?.titolo;
          if (!chiave || vistiRef.current.has(chiave)) return false;
          vistiRef.current.add(chiave);
          return true;
        });
        usateRef.current = [...usateRef.current, pulita];
        // b.548 — appena le schede sono in pagina, si traducono i titoli
        // che non sono gia nella lingua di chi guarda.
        if (nuovi.length) traduciSchede(nuovi);
        setArgomenti((prima) => (accoda ? [...(prima || []), ...nuovi] : puliti));
        // b.545 — appena l'elenco e in pagina si chiedono i segnali di
        // tutti e si riordina. `argomentiRef` qui vale ancora quello di
        // un attimo fa, cioe esattamente il `prima` della riga sopra.
        // b.552 — in sottofondo si ordina SOLO la coda nuova: quello che
        // hai gia' sotto gli occhi non si sposta di un posto.
        riordinaConSegnali(
          accoda ? [...(argomentiRef.current || []), ...nuovi] : puliti,
          dietro ? (argomentiRef.current || []).length : 0,
        );
        if (!accoda) setStanze(fine.stanze || []);
        setDaCache(!!fine.daCache);
        // b.541 — il ramo che non porta niente di nuovo e' esaurito: si
        // annota, cosi il giardino sa che deve ramificare piu in la.
        if (accoda && esaurito({ trovati: puliti.length, nuovi: nuovi.length })) {
          setRamiNoti((r) => r.map((x) => (x.query === pulita ? { ...x, secco: true } : x)));
        }
        // b.529 — ULTIME RICERCHE (Luca: «quando faccio una ricerca devi
        // inserire in alto nella sidebar ultime ricerche e devi
        // recuperare il logo e inserirlo a sinistra del nome abbreviato»).
        // L'etichetta sono le prime due parole piene della domanda
        // («milan ac...» -> Milan Ac, «politica estera della corea» ->
        // Politica Corea); l'immagine e la miniatura del primo risultato
        // VERO — un logo garantito per qualunque ricerca non esiste, la
        // faccia della notizia si.
        try {
          if (silenziosa) throw new Error('auto');
          const VUOTE = new Set(['di','della','del','dello','delle','dei','degli','la','il','lo','le','gli','un','una','uno','che','per','con','sul','sulla','the','of','a','an','and']);
          const parole = pulita.split(/[\s,]+/).filter(w => w.length > 1 && !VUOTE.has(w.toLowerCase()));
          const etichetta = parole.slice(0, 2).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || pulita.slice(0, 18);
          const img = (fine.argomenti || []).find(t => t.immagine)?.immagine || null;
          const vecchie = Array.isArray(prefs?.ricercheRecenti) ? prefs.ricercheRecenti : [];
          const nuove = [{ q: pulita, etichetta, img }, ...vecchie.filter(r => r.q !== pulita)].slice(0, 6);
          savePrefs?.({ ...prefs, ricercheRecenti: nuove });
          setUltimaRicerca({ q: pulita, etichetta, img }); // b.535 — offre la stella qui sotto
        } catch { /* la memoria delle ricerche non deve mai rompere la ricerca */ }
      }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/topics/search:', e?.message || e);
      // b.552 — un giro in sottofondo che non riesce resta in sottofondo:
      // non si mette un cartello di guasto davanti a chi sta guardando.
      if (e.name !== 'AbortError' && !dietro) setErrore('guasto');
    } finally {
      cercandoRef.current = false;
      if (!dietro) setCercando(false);
    }
  }, [lingua, cercando, descriviStadio, cercaVideoPer, profonda, numFonti, prefs, savePrefs, riordinaConSegnali]);

  // ═══ b.541 — FAI CRESCERE IL GIARDINO ═══
  // Il gesto che tiene vivo il feed. Ordine di Luca: «la pianta nasce da
  // un seme che sviluppa rami in tutte le direzioni e ogni ramo ne crea
  // altri quando ha esaurito le informazioni e i contenuti».
  // Tre passi, sempre gli stessi:
  //   1. c'e' un seme dell'utente non ancora piantato? si pianta quello
  //      — le SUE ricerche vengono prima di qualunque cosa inventiamo noi;
  //   2. se no, si prende il ramo che tocca (giardino.js sceglie
  //      alternando famiglia e seme di provenienza: mai sei ricerche di
  //      fila sullo stesso attore);
  //   3. se non ci sono piu rami, se ne chiedono di nuovi al giardiniere,
  //      partendo dal seme piu importante che non ha ancora figli.
  const cresci = useCallback(async () => {
    if (crescendo || cercando) return;
    setCrescendo(true);
    try {
      const semi = semiDi(prefs, ricerchePredefinite(prefs, nomePaese));
      let rami = ramiNoti.filter((r) => !r.secco);
      let scelta = prossimaQuery({ semi, rami, usate: usateRef.current });

      if (!scelta) {
        // il giardino ha bisogno di rami nuovi: si parte dal seme piu
        // importante che non ne ha ancora, e si scende di un livello.
        const senzaFigli = semi.find((x) => !ramiNoti.some((r) => r.seme === x.query))
          || semi[0]
          || { query: usateRef.current[usateRef.current.length - 1] || '' };
        if (!senzaFigli.query) return;
        const nuovi = sanaRami(
          await chiediRami({ seme: senzaFigli.query, lingua, paese: paeseFiltro || '', livello: 1, userToken }),
          senzaFigli.query,
          1,
        );
        if (!nuovi.length) return;
        rami = [...rami, ...nuovi];
        setRamiNoti((r) => [...r, ...nuovi]);
        scelta = prossimaQuery({ semi, rami, usate: usateRef.current });
      }
      if (scelta?.query) await cerca(scelta.query, 'notizie', false, true, true);
    } finally {
      setCrescendo(false);
    }
  }, [crescendo, cercando, prefs, nomePaese, ramiNoti, lingua, paeseFiltro, userToken, cerca]);

  // ═══ b.552 — METTI DA PARTE / NON MOSTRARMELO PIU ═══
  // Ordine di Luca. Due gesti che cambiano il giornale della persona e
  // non quello di tutti: vivono nelle sue preferenze, non nei conteggi
  // condivisi. Il contenuto nascosto sparisce SUBITO dall'elenco — se
  // restasse fino al prossimo giro, il tasto sembrerebbe rotto.
  const suBacheca = useCallback((d) => {
    const url = d?.url || (d?.id ? `youtube.com/watch?v=${d.id}` : '');
    savePrefs?.(giraBacheca(prefs, { ...d, url }));
  }, [prefs, savePrefs]);

  const suNascondi = useCallback((d) => {
    const url = d?.url || (d?.id ? `youtube.com/watch?v=${d.id}` : '');
    if (!url) return;
    const dopo = nascondi(prefs, url);
    savePrefs?.(dopo);
    setArgomenti((prima) => senzaNascosti(prima, dopo));
    setVideo((prima) => senzaNascosti(prima, dopo));
  }, [prefs, savePrefs]);

  const cercaChip = useCallback((c, silenziosa = false) => {
    setChipAttiva(c.id);
    const q = (QUERY_RAPIDE[c.id] || {})[lingua] || (QUERY_RAPIDE[c.id] || {}).en || c.id;
    setQuery('');
    cerca(q, c.cat, false, silenziosa); // b.535 — le partenze automatiche non firmano le «ultime ricerche»
  }, [lingua, cerca]);

  // b.186 — crea una discussione pubblica PERSISTENTE da una card di
  // ricerca (con dentro il link/foto) e apre subito il thread. Serve un
  // account: chi non ce l'ha riceve l'avviso.
  const apriDiscussione = useCallback(async (t) => {
    if (creando) return;
    // b.255 — qui si diceva "La ricerca non e riuscita" (newsError) a chi
    // semplicemente non aveva un account: un messaggio che manda a cercare
    // un guasto inesistente. Il motivo vero e un altro, e la frase giusta
    // esiste gia ed e usata negli stessi casi altrove (accessToCreate).
    if (!userToken) { setErrore('account'); return; }
    setCreando(true); vibrate(12);
    try {
      const media = t.url ? { url: t.url, thumb: t.immagine || '', source: (t.fonti?.[0]?.dominio) || '' } : {};
      const r = await fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azione: 'crea', userToken, nick: prefs?.mondoNick || '',
          title: t.titolo || '', titleLang: lingua, lang: lingua,
          topic: chipAttiva || null, media,
        }),
      });
      // b.363 — prima la lettura non era protetta: con una risposta rotta il
      // tasto "crea" restava senza esito e la discussione non si apriva.
      const d = await r.json().catch(() => null);
      if (r.ok && d?.id) setDiscAperta(d.id);
      else setErrore('guasto');
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
      setErrore('guasto'); }
    setCreando(false);
    // b.232 — `prefs` nelle deps: il body usa prefs.mondoNick, che prima
    // poteva essere quello vecchio (stale closure).
  }, [creando, userToken, lingua, chipAttiva, prefs]);

  // b.390 — QUI C'ERA UN SECONDO `quando`, e faceva ombra a quello buono
  // importato in cima. Aspettava un NUMERO, ma il feed manda le date
  // SCRITTE ("2026-08-22T…"): la sottrazione dava NaN e sotto ogni
  // notizia compariva «El Pais · NaNg».
  //
  // Non e stato riscritto: e stato TOLTO. Quello importato le date scritte
  // le sa leggere gia, e due funzioni con lo stesso nome nello stesso file
  // sono la trappola perfetta — chi legge crede di usare quella giusta.

  // b.363 — GLI ARGOMENTI VERI, CONTATI. Nella sidebar c'erano solo le
  // categorie della ricerca esterna (Top headlines, World, Sports…), che
  // sono i reparti di un motore di ricerca, non le cose di cui si parla
  // QUI DENTRO. Questo elenco nasce dalle discussioni aperte: compaiono
  // solo gli argomenti che esistono davvero, col loro numero. Niente
  // reparti vuoti da toccare per scoprire che dentro non c'e niente.
  const argomentiVeri = useMemo(() => {
    const conto = new Map();
    for (const d of feed || []) {
      if (!d.topic) continue;
      conto.set(d.topic, (conto.get(d.topic) || 0) + 1);
    }
    return [...conto.entries()].sort((a, b) => b[1] - a[1]);
  }, [feed]);

  // b.363 — prima si toglie cio che non e stato chiesto (argomento,
  // paese), poi si ORDINA per interesse: cio che non interessa scende,
  // non sparisce. Vedi lib/interessi.js per il perche.
  const feedMostrato = useMemo(() => {
    let v = feed || [];
    if (argomentoFiltro) v = v.filter((d) => d.topic === argomentoFiltro);
    if (paeseFiltro) v = v.filter((d) => d.country === paeseFiltro);
    return ordinaFeed(v, prefs);
  }, [feed, argomentoFiltro, paeseFiltro, prefs]);

  // b.517 — CHI STA GIA PARLANDO DI QUESTO ARTICOLO. Luca: «parlane va
  // bene sia che ci siano persone o che apra la discussione (aggiungi un
  // numero dei partecipanti)». Le discussioni aperte sono gia scaricate
  // per il feed qui sotto: si indicizzano per link, cosi la card di
  // ricerca sa DA SOLA se dietro c'e gia una stanza viva — senza una
  // sola chiamata di rete in piu.
  const discussionePerLink = useMemo(() => {
    const m = new Map();
    for (const d of feed || []) {
      const u = d?.media?.url;
      if (u && !m.has(u)) m.set(u, { id: d.id, persone: d.comment_count || 0 });
    }
    return m;
  }, [feed]);

  // ═══ b.545 — LA CAMPANELLA E IL FILO DEI COMMENTI ═══
  // Ordine di Luca: «dobbiamo avvisare l'utente in alto nelle pagine di
  // commenti come instagram o facebook, nella sua stanza potra quindi
  // aprire il commento/lista direttamente dal pulsante» e «anche il
  // commento apre una "stanza" di commenti che possono susseguirsi».

  // I CONTENUTI CHE SEGUO. Si segue cio su cui si e lasciato un segno: il
  // cuore (lib/gradimento.js lo ricorda nel telefono, non sul server) e
  // le schede nate dalle MIE ricerche — quelle con la stella e le
  // recenti. Una campanella che avvisa di tutto non avvisa di niente:
  // chi non ha mai toccato un articolo non vuole sapere chi lo commenta.
  const chiaviSeguite = useMemo(() => {
    const cuori = mieiCuori();
    const miei = semiDi(prefs, []).map((x) => String(x.query || '').trim().toLowerCase()).filter(Boolean);
    // i cuori per primi: la campanella ne tiene sessanta, e un contenuto
    // che ho scelto a mano vale piu di uno che passava di li per argomento.
    const fuori = [...cuori];
    const gia = new Set(fuori);
    for (const t of argomenti || []) {
      const k = chiaveContenuto(t?.url);
      if (!k || gia.has(k)) continue;
      const testo = `${t?.titolo || ''} ${t?.sintesi || ''}`.toLowerCase();
      if (!miei.some((seme) => testo.includes(seme))) continue;
      gia.add(k); fuori.push(k);
    }
    return fuori;
  }, [argomenti, prefs]);

  // b.482 — I COLORI VENGONO DAL TEMA. La campanella e il filo parlano la
  // lingua di lib/styles.js (accent1/accent3/glassCard); il Mondo chiama
  // gli stessi colori con altri nomi (accent/red/card, vedi MondoView).
  // Senza questo ponte i due pannelli ripiegherebbero sulle tinte
  // scritte a mano dentro di loro, sorde al tema scelto.
  const temaMondoUi = useMemo(() => ({
    ...C,
    accent1: C.accent, accent2: C.purple, accent3: C.red,
    glassCard: C.card, inputBg: C.input,
  }), [C]);

  // LA RIGA DELLA CAMPANELLA PORTA AL CONTENUTO, non a una pagina di
  // avvisi da cui ricominciare a cercare: e la mezza frase di Luca
  // «aprire il commento/lista direttamente dal pulsante». Si cerca prima
  // fra le schede del giornale, poi fra le discussioni gia scaricate.
  const apriDaChiave = useCallback((chiave) => {
    const k = String(chiave || '').trim();
    if (!k) return;
    const t = (argomenti || []).find((x) => chiaveContenuto(x?.url) === k);
    if (t) {
      // b.542 — il feed e un velo fisso: quello che si apre sotto resta
      // invisibile. Chi arriva dalla campanella deve vedere l'articolo.
      setFeedAperto(false);
      setLettura({ url: t.url, titolo: t.titolo, fonte: t.fonti?.[0]?.fonte, dati: t, faccia: testataChiusa(t.url) ? 'sintesi' : 'articolo' });
      return;
    }
    const d = (feed || []).find((x) => chiaveContenuto(x?.media?.url) === k);
    if (!d) return;
    setFeedAperto(false);
    const suaFonte = fonteDi(d.media);
    // b.383 — un video non si LEGGE: se dietro non c'e un articolo si
    // apre la discussione, che e comunque il posto dove se ne parla.
    // b.519 — `dati.titolo` deve esserci, se no la faccia della sintesi
    // non si disegna e chi arriva qui trova un vicolo cieco.
    if (d.media?.url && tipoContenuto(d.media) !== 'video') {
      setLettura({
        url: d.media.url, titolo: d.title, fonte: suaFonte,
        dati: { titolo: d.title, fonti: suaFonte ? [{ fonte: suaFonte, titolo: d.title }] : [] },
      });
    } else setDiscAperta(d.id);
  }, [argomenti, feed]);

  // IL FILO APERTO ADESSO: su quale contenuto, con che titolo, e con i
  // dati che servono a «Parlane» se dal filo si passa alla stanza.
  // ═══ b.551 — «PARLANE CON CHI?» ═══
  // Idea di Luca: da una notizia si deve poter aprire una stanza fra
  // persone, chiamare un Compagno, aprire un Tavolo che discute per
  // arrivare a una conclusione, o farsi un Podcast da ascoltare. Prima
  // «Parlane» faceva una cosa sola — la stanza — e la stanza appena
  // aperta e' vuota.
  const [parlaneCon, setParlaneCon] = useState(null);
  const smistaParlane = useCallback((modo, contenuto) => {
    setParlaneCon(null);
    // b.551 — il velo si chiude SU TUTTE le strade, non solo su quelle
    // verso Vita: la stanza fra persone e' proprio quella che in b.542 si
    // apriva dietro. La lezione era «dove ALTRO vive la stessa cosa?».
    setFeedAperto(false);
    if (modo === 'persone') { onParlane?.(contenuto); return; }
    // le altre tre strade portano in Vita, con l'argomento gia in mano
    const argomento = [contenuto?.titolo, contenuto?.sintesi].filter(Boolean).join(' — ').slice(0, 300);
    const scheda = modo === 'compagno' ? 'amico' : modo;
    try { sesSet('vt-vita-da-mondo', JSON.stringify({ argomento, scheda })); }
    catch { /* senza memoria di sessione Vita si apre vuota: meglio che non aprirsi */ }
    setView('life');
  }, [onParlane]);

  const [filo, setFilo] = useState(null);   // { url, titolo, dati }

  const apriCommenti = useCallback((c) => {
    // il feed manda le schede degli articoli e quelle dei video: gli uni
    // hanno l'indirizzo, gli altri il solo id di YouTube. La chiave dei
    // commenti e la stessa dei cuori (chiaveContenuto), quindi l'indirizzo
    // va ricostruito allo stesso modo di lib/punteggioFeed.js.
    const url = c?.url || c?.media?.url
      || (c?.id && c?.canale ? `https://www.youtube.com/watch?v=${c.id}` : '');
    if (!url) return;
    vibrate(8);
    setFilo({ url, titolo: c?.titolo || c?.title || '', dati: c?.dati || c });
  }, []);

  // APRIRE E UN SEGNALE. Sta qui e non sui singoli tasti apposta: le
  // porte che portano al lettore sono sei (titolo, foto, icona leggi,
  // bacchetta, feed, campanella) e una sola di loro dimenticata
  // basterebbe a falsare il conto. Il lettore invece e uno.
  useEffect(() => {
    if (!lettura?.url) return;
    mandaSegnale(chiaveContenuto(lettura.url), 'apertura', 1);
  }, [lettura, mandaSegnale]);

  const bordo = `1px solid ${C.cardBorder}`;

  // b.149 — su un monitor largo le card diventavano lenzuola con
  // riquadri-immagine giganteschi (schermate di Luca). Le news hanno
  // il passo di un telefono: colonna centrata, mai piu larga di 680px,
  // come la Home.
  return (
    <>
    <Ribalta girato={!!(lettura || discAperta)}
      fronte={
      // b.398 — anche qui il pianeta deve sapere quanto sei sceso: il
      // documento dice che il globo perde importanza scorrendo, e le News
      // sono meta della sezione Mondo. Prima l'ascolto c'era solo sulle
      // Stanze, quindi scorrendo le notizie il globo restava identico.
      <div onScroll={suScorrimento} style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none' }}>
      {/* b.482 — IL RIENTRO LATERALE SALE DA 16 A 20, la misura del
          template. Era l'ultimo posto di Mondo dove le vecchie misure
          resistevano: passando da una schermata all'altra il contenuto
          saltava di quattro punti. */}
      {/* b.529 — Luca: «non hai eliminato i margini o bordi laterali
          cosi non si vede per intero e la colonna balla dentro lo
          schermo». Il giornale va da bordo a bordo (le foto respirano
          per intero); il testo dentro le card tiene il suo rientro.
          overflowX chiuso: niente piu colonna che dondola. */}
      <div style={{ padding: '0 0 106px', overflowX: 'hidden', fontFamily: FONT, ...COLONNA }}>

      {/* b.523 — LA RICERCA STA NELLA PAGINA, NON DIETRO UNA PORTA.
          Luca, per la seconda volta: «il campo cerca va in alto e fuori
          dalla sidebar te l'ho gia detto che la ricerca principale va
          messa fuori». In b.504 era gia stato fatto per Stanze e per il
          Mondo («si cerca dove si guarda, non dietro una porta che
          nessuno apre per cercare»); la scheda Notizie era rimasta
          indietro, con il campo chiuso nel pannello. Ora sta in cima al
          giornale, sempre visibile. Nel pannello restano le
          preferenze, che sono un'altra cosa: si sistemano una volta e
          non si toccano piu. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, padding: '0 16px' }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setChipAttiva(null); }}
          onKeyDown={e => { if (e.key === 'Enter') { cerca(query); } }}
          placeholder={L('newsWhatFollow')}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 14,
            background: C.input, border: bordo, outline: 'none',
            color: C.textPrimary, fontSize: 14, fontFamily: FONT,
          }} />
        {/* b.482 — il tasto aveva solo il rientro: su un telefono restava
            sotto i 44 punti, cioe sotto la misura in cui un dito comincia
            a sbagliare bersaglio. */}
        <button
          onClick={() => {
            if (chipAttiva) cercaChip(CATEGORIE.find(c => c.id === chipAttiva));
            else cerca(query, 'notizie', true);
            // b.523 — non si chiude piu niente: il campo e uscito dal
            // pannello e sta nella pagina, quindi non c'e nessuna
            // sidebar sopra il giornale da togliere di mezzo. (La
            // regola di b.513 — «quando clicco aggiorna chiudi la side
            // bar» — nasceva proprio dal fatto che il campo stava
            // dentro il pannello: tolto il campo, e decaduta da sola.)
          }}
          disabled={cercando || (!query.trim() && !chipAttiva)}
          aria-label={L('newsUpdate')}
          style={{
            padding: '0 18px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 500,
            fontFamily: FONT, opacity: cercando || (!query.trim() && !chipAttiva) ? 0.5 : 1,
            WebkitTapHighlightColor: 'transparent',
          }}>
          {L('newsUpdate')}
        </button>
        {/* ═══ b.545 — LA CAMPANELLA STA QUI, IN ALTO ═══
            Ordine di Luca: «dobbiamo avvisare l'utente in alto nelle
            pagine di commenti come instagram o facebook». In alto vuol
            dire nella testata, accanto al campo che sta gia nella pagina
            da b.523 — non un affare che galleggia sopra il giornale
            (b.363 la vetrina di attrezzi l'aveva tolta, e non torna).
            Il conto e il raggruppamento stanno in lib/campanella.js. */}
        <Campanella C={temaMondoUi} L={L}
          chiaviSeguite={chiaviSeguite}
          onApriContenuto={apriDaChiave} />
      </div>

      {/* INIZIO b.535 — «quando scelgo il milan ac aggiungi un selettore
          aggiungi alle notizie preferite e aggiungi il badge» (Luca).
          Dopo una ricerca TUA compare la stella: un tocco la salva tra i
          Preferiti della sidebar (badge col logo), un altro la toglie. */}
      {ultimaRicerca && (
        <div style={{ padding: '0 16px', marginBottom: 8 }}>
          <button
            onClick={() => {
              vibrate(8);
              savePrefs?.(ePreferita(prefs, ultimaRicerca.q)
                ? togliPreferita(prefs, ultimaRicerca.q)
                : aggiungiPreferita(prefs, ultimaRicerca));
            }}
            aria-pressed={ePreferita(prefs, ultimaRicerca.q)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 34,
              padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
              background: ePreferita(prefs, ultimaRicerca.q) ? `${C.accent}22` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${ePreferita(prefs, ultimaRicerca.q) ? `${C.accent}66` : C.cardBorder}`,
              color: ePreferita(prefs, ultimaRicerca.q) ? C.accent : 'rgba(255,255,255,0.78)',
              fontSize: 12, fontWeight: 500, WebkitTapHighlightColor: 'transparent',
            }}>
            <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{ePreferita(prefs, ultimaRicerca.q) ? '\u2605' : '\u2606'}</span>
            {(ePreferita(prefs, ultimaRicerca.q) ? L('inFavWord') : L('addFavWord')) + ' \u00b7 ' + ultimaRicerca.etichetta}
          </button>
        </div>
      )}
      {/* FINE b.535 */}



      {/* b.363 — GLI STRUMENTI STANNO DIETRO IL GIORNALE. Sopra il pianeta
          restavano accesi tre blocchi — il campo "cosa vuoi seguire", i due
          modi, la fila delle categorie — che coprivano meta mondo anche
          quando nessuno li stava usando. Ora si aprono toccando l'icona
          del giornale in alto a sinistra, e si richiudono. */}
      <PannelloLaterale aperto={strumenti} onChiudi={suChiudiStrumenti} titolo={L('tabNews')} C={C} sopra={feedAperto}>
      {/* b.524 — LO SCHELETRO DEL PANNELLO E UNO SOLO su tutte e tre le
          schede: 1 Preferiti, 2 Paese, 3 filtri propri, 4 Preferenze.
          INIZIO b.535 — L'ALBERO A CARD DI VETRO. Ordine di Luca:
          «questa sezione non rispecchia la grafica, e' brutto, smorto...
          non ci sono le icone magari blu, e non e' chiaro cosa puoi
          fare» + la sua scelta dal ventaglio: «Card di vetro con icona»
          + «un albero di selezioni e filtri facile da usare anche da un
          bambino». L'albero: ① Preferiti (le cose TUE) ② Ultime
          ricerche ③ Da dove guardo ④ Cosa cerco ⑤ Preferenze; Applica
          sfumato sotto i filtri che applica, acceso solo se c'e'
          qualcosa da applicare. Ogni card: chip icona blu + titolo
          bianco + didascalia leggibile (mai piu grigio smorto). */}
      {/* b.535 — la ricerca RAPIDA in testa al pannello, solo quando lo
          si apre dalla linguetta del feed: li sotto il campo della pagina
          non si vede, e l'ordine e' «fare ricerche nuove in tempo reale»
          senza uscire dalla presentazione. */}
      {feedAperto && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setChipAttiva(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) { cerca(query); suChiudiStrumenti?.(); } }}
            placeholder={L('newsWhatFollow')}
            style={{
              flex: 1, padding: '11px 13px', borderRadius: 12,
              background: C.input, border: `1px solid ${C.cardBorder}`, outline: 'none',
              color: C.textPrimary, fontSize: 14, fontFamily: FONT,
            }} />
          <button onClick={() => { if (query.trim()) { vibrate(8); cerca(query); suChiudiStrumenti?.(); } }}
            disabled={cercando || !query.trim()}
            aria-label={L('newsUpdate')}
            style={{
              padding: '0 16px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 500, fontFamily: FONT,
              opacity: cercando || !query.trim() ? 0.5 : 1, WebkitTapHighlightColor: 'transparent',
            }}>
            <Icon name="search" size={15} color="#fff" />
          </button>
        </div>
      )}
      <CardSezione icona="star" titolo={L('favouritesWord')} sotto={L('sbFavCaption')} C={C}>
        <PreferitiTemi nudo temi={argomentiVeri.map(([arg, n]) => ({ topic: arg, discussioni: n }))}
          prefs={prefs} savePrefs={savePrefs} C={C} L={L}
          aggiunte={preferitiAggiunti(prefs)}
          onScegliAggiunta={(q) => { setQuery(q); setChipAttiva(null); cerca(q); suChiudiStrumenti?.(); }}
          onTogliAggiunta={(q) => savePrefs?.(togliPreferita(prefs, q))}
          onScegli={(topic) => { setArgomentoFiltro(topic); suChiudiStrumenti?.(); }} />
      </CardSezione>

      {/* ═══ b.557 — QUANTO INDIETRO ═══
          Ordine di Luca: «magari serve aggiungere un setting nel sidebar
          per determinare quanto indietro deve caricare contenuti».
          Vale SOLO per le notizie: su «tom cruise» o «come si fa il
          pane» un pezzo di tre anni fa puo essere il migliore che
          esiste, e tagliarlo sarebbe stupido. Il valore comanda sia gli
          articoli sia i video (la stessa finestra, cosi il giornale non
          si contraddice fra le due meta). */}
      <CardSezione icona="history" titolo={L('windowTitle')} sotto={L('windowCaption')} C={C}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[[24, 'window24'], [48, 'window48'], [168, 'window7d'], [0, 'windowAll']].map(([ore, chiave]) => {
            const scelto = Number(prefs?.finestraOre ?? 48) === ore;
            return (
              <button key={ore} onClick={() => { vibrate(8); savePrefs?.({ ...prefs, finestraOre: ore }); }}
                style={{
                  minHeight: 40, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: FONT, fontSize: 12.5, fontWeight: 500,
                  background: scelto ? `${C.accent}20` : C.card,
                  border: scelto ? `1px solid ${C.accent}45` : bordo,
                  color: scelto ? C.accent : C.textSecondary,
                  WebkitTapHighlightColor: 'transparent',
                }}>{L(chiave)}</button>
            );
          })}
        </div>
      </CardSezione>

      {/* ═══ b.552 — LA BACHECA ═══
          Ordine di Luca: «un tasto preferito, da tenere in una bacheca
          che devi mettere nella sidebar. Ordinabile e con miniatura».
          Tutte e tre le cose: la miniatura c'e' (ed e' quella vera del
          contenuto, non un'icona), l'ordine lo decidi tu con le due
          frecce, e la x toglie. Si apre come si apre tutto il resto del
          Mondo — un tocco sulla scheda, non un menu. */}
      {bachecaDi(prefs).length > 0 && (
        <CardSezione icona="star" titolo={L('boardTitle')} sotto={L('boardCaption')} C={C}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bachecaDi(prefs).map((v, i, tutte) => (
              <div key={v.chiave} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: 6, borderRadius: 10,
                background: 'rgba(26,40,74,0.42)', border: '1px solid rgba(150,178,255,0.26)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              }}>
                <button onClick={() => {
                  vibrate(8);
                  // il video si apre nella scheda di visione, come da
                  // qualunque altra parte del Mondo: non si inventa una
                  // seconda strada per la stessa cosa.
                  if (v.tipo === 'video') { setScheda({ tipo: 'video', dati: { id: (v.url.split('v=')[1] || ''), titolo: v.titolo, canale: v.fonte, miniatura: v.img } }); }
                  else { setLettura({ url: v.url, titolo: v.titolo, fonte: v.fonte, dati: v, faccia: testataChiusa(v.url) ? 'sintesi' : 'articolo' }); }
                  suChiudiStrumenti?.();
                }}
                  title={v.titolo}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
                  {v.img
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura esterna del contenuto
                    ? <img src={v.img} alt="" width={40} height={30} style={{ borderRadius: 6, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
                    : <span style={{ width: 40, height: 30, borderRadius: 6, flexShrink: 0, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={v.tipo === 'video' ? 'play' : 'doc'} size={13} color="#fff" />
                      </span>}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#fff', fontFamily: FONT,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.titolo}</span>
                    {v.fonte ? (
                      <span style={{ display: 'block', fontSize: 10.5, color: 'rgba(255,255,255,0.62)', fontFamily: FONT,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.fonte}</span>
                    ) : null}
                  </span>
                </button>
                {/* ordinabile: due frecce, e quella che non serve non c'e' */}
                <button onClick={() => { vibrate(6); savePrefs?.(spostaInBacheca(prefs, v.chiave, 'su')); }}
                  disabled={i === 0} aria-label={L('moveUp')} title={L('moveUp')}
                  style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: i === 0 ? 'default' : 'pointer',
                    opacity: i === 0 ? 0.25 : 1, background: 'rgba(0,0,0,0.22)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
                  <Icon name="chevUp" size={11} color="#fff" />
                </button>
                <button onClick={() => { vibrate(6); savePrefs?.(spostaInBacheca(prefs, v.chiave, 'giu')); }}
                  disabled={i === tutte.length - 1} aria-label={L('moveDown')} title={L('moveDown')}
                  style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: i === tutte.length - 1 ? 'default' : 'pointer',
                    opacity: i === tutte.length - 1 ? 0.25 : 1, background: 'rgba(0,0,0,0.22)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
                  <Icon name="chevDown" size={11} color="#fff" />
                </button>
                <button onClick={() => { vibrate(6); savePrefs?.(togliDaBacheca(prefs, v.chiave)); }}
                  aria-label={L('removeWord')} title={L('removeWord')}
                  style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                    background: 'rgba(0,0,0,0.22)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
                  <Icon name="x" size={10} color="#fff" />
                </button>
              </div>
            ))}
          </div>
        </CardSezione>
      )}

      {/* b.529 — le ultime ricerche: un tocco la rifa, la x la dimentica. */}
      {Array.isArray(prefs?.ricercheRecenti) && prefs.ricercheRecenti.length > 0 && (
        <CardSezione icona="history" titolo={L('recentSearches')} sotto={L('sbRecentCaption')} C={C}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {prefs.ricercheRecenti.map((r, i) => (
              <span key={r.q} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '2px 2px 2px 4px', borderRadius: 7,
                background: i % 2 ? 'rgba(44,94,170,0.34)' : 'rgba(140,88,48,0.34)',
                border: `1px solid ${i % 2 ? 'rgba(112,162,236,0.5)' : 'rgba(206,146,92,0.5)'}`,
                backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)', fontFamily: FONT,
              }}>
                <button onClick={() => { vibrate(8); setQuery(r.q); setChipAttiva(null); cerca(r.q); suChiudiStrumenti?.(); }}
                  title={r.q}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 26, padding: 0,
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT,
                    color: '#fff', fontSize: 11.5, fontWeight: 500, maxWidth: 180, WebkitTapHighlightColor: 'transparent' }}>
                  {r.img
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura esterna della ricerca
                    ? <img src={r.img} alt="" width={20} height={20} style={{ borderRadius: 5, objectFit: 'cover', display: 'block' }} />
                    : <Icon name="search" size={12} color="#fff" />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.etichetta}</span>
                </button>
                <button onClick={() => { vibrate(6); savePrefs?.({ ...prefs, ricercheRecenti: prefs.ricercheRecenti.filter(x => x.q !== r.q) }); }}
                  aria-label={L('removeWord')} title={L('removeWord')}
                  style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                    background: 'rgba(0,0,0,0.22)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
                  <Icon name="x" size={10} color="#fff" />
                </button>
              </span>
            ))}
          </div>
        </CardSezione>
      )}

      {/* b.524 — il Paese: stesso giro di Stanze/Mondo (scegliPaese
          risale a MondoView, che aggiorna anche il globo). */}
      <CardSezione icona="globe" titolo={L('sbWhereTitle')} sotto={L('sbWhereCaption')} C={C}>
        <Scelta C={C}
          valore={bozzaPaese || 'tutto'}
          opzioni={[
            { valore: 'tutto', etichetta: L('wholeWorld'), conto: feed?.length || 0 },
            /* b.535 — paese fuori elenco (dal globo): mostrato onesto,
               non ripiegato zitto su «Mondo intero». */
            ...(bozzaPaese && !PAESI.some((pa) => pa.codice === bozzaPaese)
              ? [{ valore: bozzaPaese, etichetta: `${bandieraPaese(bozzaPaese)} ${nomePaese(bozzaPaese)}` }]
              : []),
            ...PAESI
              .map((pa) => ({
                valore: pa.codice,
                etichetta: `${pa.bandiera} ${nomePaese(pa.codice)}`,
                conto: (feed || []).filter((d) => d.country === pa.codice).length,
              }))
              .sort((a, b) => a.etichetta.localeCompare(b.etichetta)),
          ]}
          onCambia={(v) => setBozzaPaese(v === 'tutto' ? null : v)} />

        {/* ═══ b.543 — IL FONTIERE: «MIGLIORA LE FONTI» ═══
            Ordine di Luca: «vicino al selettore paese o lingua della
            sidebar aggiungi un tasto, con questo attiveremo una
            procedura di miglioramento delle fonti con un deep search per
            creare liste sempre aggiornate... anche i settori devono
            riaccendere la icona (spenta dopo il primo aggiornamento)».
            L'icona e ACCESA quando la lista manca o ha passato i trenta
            giorni, SPENTA quando e fresca: cosi dice da sola quando c'e
            lavoro da fare, senza che nessuno se lo debba ricordare. */}
        {(() => {
          const vecchia = listaVecchia(listaFonti, Date.now());
          const giorni = giorniDiVita(listaFonti, Date.now());
          const quante = listaFonti?.fonti?.length || 0;
          return (
            <button onClick={() => { vibrate(10); migliora(); }} disabled={fontiInCorso}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                marginTop: 10, minHeight: 46, padding: '0 12px', borderRadius: 12,
                cursor: fontiInCorso ? 'default' : 'pointer', fontFamily: FONT, textAlign: 'left',
                background: vecchia ? `${C.accent}16` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${vecchia ? `${C.accent}55` : C.cardBorder}`,
                opacity: fontiInCorso ? 0.7 : 1, WebkitTapHighlightColor: 'transparent',
              }}>
              <Icon name="zap" size={16} color={vecchia ? C.accent : 'rgba(255,255,255,0.5)'} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: vecchia ? C.accent : 'rgba(255,255,255,0.78)' }}>
                  {fontiInCorso ? L('sourcesWorking') : L('sourcesImprove')}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.62)', marginTop: 1 }}>
                  {fontiInCorso ? L('sourcesWorkingDesc')
                    : quante ? `${quante} ${L('sourcesCount')}${giorni != null ? ` \u00b7 ${giorni}${L('daysShort')}` : ''}`
                      : L('sourcesNone')}
                </span>
              </span>
            </button>
          );
        })()}
      </CardSezione>

      {/* ═══ b.552 — LE DUE TENDINE «COSA CERCO» NON CI SONO PIU ═══
          Collaudo di Luca, con la fotografia: «non mi e' chiara la
          utilita di questi filtri, confondono. Se non sono necessari
          accontentiamoci dei preferiti, del random, delle ultime
          ricerche e dell'albero che cresce allargando agli argomenti
          simili adiacenti».
          Ha ragione, e non e' solo questione di gusto: chiedere «in che
          categoria vuoi cercare?» e' chiedere alla persona di fare il
          lavoro che il giardino (b.541) fa gia da solo, meglio e senza
          domande — parte dai tuoi semi, allarga ai rami vicini, e quando
          un ramo si secca ne apre un altro. Due tendine che promettono
          un controllo che non serve valgono meno di zero: confondono.
          Cosa resta, ed e' tutto quello che serve: i PREFERITI (la
          stella), la BACHECA, le ULTIME RICERCHE, il campo per seminare
          a mano, e l'albero che cresce da solo.
          Il numero di fonti in modalita approfondita resta: quella non
          e' una domanda sul cosa, e' una manopola sul quanto. */}
      {profonda && (
        <CardSezione icona="target" titolo={L('newsSourcesShort')} sotto={L('sbWhatCaption')} C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[3, 6, 10].map(n => (
              <button key={n} onClick={() => { setNumFonti(n); vibrate(8); }}
                style={{
                  width: 44, height: 44, borderRadius: 9, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 500,
                  background: numFonti === n ? `${C.accent}20` : C.card,
                  border: numFonti === n ? `1px solid ${C.accent}45` : bordo,
                  color: numFonti === n ? C.accent : C.textSecondary,
                  WebkitTapHighlightColor: 'transparent',
                }}>{n}</button>
            ))}
          </div>
        </CardSezione>
      )}

      {/* b.529 — UNA conferma sola. b.535 — si accende solo se c'e'
          qualcosa da applicare: un tasto sempre acceso promette effetti
          che spesso non ha. */}
      {(() => {
        // b.552 — resta UNA cosa sola da applicare: il Paese. La
        // categoria era l'altra meta della tendina che Luca ha tolto
        // («non mi e' chiara la utilita di questi filtri, confondono»):
        // senza tendina non c'e' piu niente da confermare, e un tasto
        // che conferma qualcosa che nessuno ha scelto e' peggio del
        // filtro che l'aveva generato.
        const cambiato = bozzaPaese !== paeseFiltro;
        return (
          <button onClick={() => {
              vibrate(10);
              if (bozzaPaese !== paeseFiltro) scegliPaese(bozzaPaese);
              suChiudiStrumenti?.();
            }}
            disabled={!cambiato}
            style={{
              width: '100%', minHeight: 46, borderRadius: 12, cursor: cambiato ? 'pointer' : 'default', margin: '2px 0 14px',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: 'none',
              color: '#fff', fontSize: 13.5, fontWeight: 500, fontFamily: FONT,
              opacity: cambiato ? 1 : 0.45,
              WebkitTapHighlightColor: 'transparent',
            }}>
            {L('applyWord')}
          </button>
        );
      })()}

      <CardSezione icona="settings" titolo={L('sbPrefsTitle')} sotto={L('sbPrefsCaption')} C={C}>
        <PreferenzeMondo C={C} />
      </CardSezione>
      {/* FINE b.535 */}
      </PannelloLaterale>

      {/* ─── Il pannello COBRA: il lavoro si vede ─── */}
      {(cercando || (processo.length > 0 && argomenti === null)) && (
        <div style={{
          margin: '6px 0 12px', padding: '12px 20px', borderRadius: 14,
          background: C.card, border: bordo,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 4, background: C.accent,
              animation: 'vtPulse 1.2s infinite ease-in-out',
            }} />
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, color: C.accent }}>
              COBRA
            </span>
          </div>
          {processo.map((p, i) => (
            <div key={p.id} style={{
              fontSize: 12, lineHeight: 1.9, fontFamily: 'ui-monospace, monospace',
              color: i === processo.length - 1 ? C.textPrimary : C.textMuted,
            }}>
              {i === processo.length - 1 && cercando ? '▸ ' : '· '}{p.testo}
            </div>
          ))}
        </div>
      )}

      {/* ─── Esiti vuoti ─── */}
      {errore && (
        <div role="alert" style={{ padding: '18px 4px', fontSize: 13, color: C.red }}>
          {errore === 'account' ? L('accessToCreate') : L('newsError')}
        </div>
      )}
      {!errore && !cercando && argomenti !== null && argomenti.length === 0 && (
        <div style={{ padding: '18px 4px', fontSize: 13, color: C.textMuted }}>{L('newsNoResults')}</div>
      )}

      {/* ─── LIVELLO 0: ne stanno gia parlando ─── */}
      {stanze.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>
            {L('newsTalkingRooms')}
          </div>
          {stanze.map(s => (
            <button key={s.roomId} onClick={() => { vibrate(10); onJoinRoom?.(s.roomId); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 20px', minHeight: 44, marginBottom: 6, borderRadius: 12, cursor: 'pointer',
                background: `${C.accent}0E`, border: `1px solid ${C.accent}28`,
                color: C.textPrimary, fontFamily: FONT, textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4, background: C.accent, flexShrink: 0,
                animation: 'vtPulse 1.2s infinite ease-in-out',
              }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.nome || s.description}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted, flexShrink: 0 }}>
                {s.memberCount || s.members || 1} · {s.lang?.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ─── Le Topic Card ───
          Niente backdrop-filter sulle card: e la lezione di b.143 — un
          velo per card, ripetuto per tutte, diventa nebbia sull'intera
          pagina. Il fondo translucido basta; il blur vive solo su
          elementi singoli come il pannello COBRA. */}
      {/* b.363 — il feed e caduto: si dice, e si puo riprovare */}
      {/* b.482 — il bordo chiedeva un colore che in Mondo NON ESISTE
          (C.border): vinceva sempre il ripiego scritto a mano, quindi
          questo tasto aveva un bordo suo, diverso da tutti gli altri e
          sordo al tema. Ora usa lo stesso bordo delle schede. */}
      {feedGuasto && (!feed || feed.length === 0) && (
        <button onClick={() => { vibrate(8); setFeedGuasto(false); setRiprova(n => n + 1); }}
          style={{
            width: '100%', marginBottom: 16, padding: '12px 20px', minHeight: 44, borderRadius: 12,
            background: 'none', border: bordo,
            color: C.textMuted, fontSize: 12, fontWeight: 500, fontFamily: FONT, cursor: 'pointer',
          }}>
          {L('newsError')} · {L('retryWord')}
        </button>
      )}

      {/* ─── b.187 · Feed delle discussioni pubbliche persistenti ─── */}
      {feedMostrato.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1.2, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8, padding: '0 16px' }}>
            {L('worldNowTitle')}
          </div>
          {feedMostrato.slice(0, 12).map(d => (
            // b.363 — LA SCHEDA DICE TUTTO PRIMA CHE LA TOCCHI (vedi
            // lib/schedaMondo.js). Prima diceva quattro cose — titolo,
            // nome, un numero nudo, una freccia — e per sapere se valeva
            // la pena aprirla bisognava APRIRLA. Ora si legge in tre
            // secondi: da dove viene, di cosa parla, quanto e fresca,
            // chi l'ha scritta, se e un video o un articolo, e se
            // dentro c'e una conversazione viva o un deserto.
            (() => {
              const tipo = tipoContenuto(d.media);
              const fonte = fonteDi(d.media);
              const bandiera = bandieraPaese(d.country);
              const eta = quando(d.last_activity_at || d.created_at, L);
              const vita = viva(d.comment_count);
              const eti = stileEtichetta(C);
              const foto = d.media?.thumb;
              // b.383 — IL VIDEO NON SI RIBALTA (ordine di Luca). Un video
              // non si LEGGE: si guarda, e lo si guarda dove sta gia,
              // dentro il lettore del suo editore. Il ribaltamento e per
              // gli articoli — la seconda faccia serve a leggere, e un
              // video li dentro sarebbe solo un giro in piu prima di
              // finire comunque fuori.
              const leggibile = !!d.media?.url && tipo !== 'video';
              // ═══ INIZIO b.519 — DALLE NOTIZIE, LA SINTESI NON ESISTEVA ═══
              // TROVATO DAL VIVO su #806, scheda Notizie: si preme «Leggi»
              // su un articolo di nature.com, l'editore rifiuta di farsi
              // incorniciare e il lettore mostra — bene — «Questo sito non
              // si lascia aprire dentro un'altra applicazione». Ma li
              // finisce la strada: nel lettore NON c'e nessun comando
              // «Sintesi», nessun «Genera», niente. Vicolo cieco proprio
              // nel caso in cui la sintesi sarebbe l'unica via d'uscita.
              //
              // Il motivo: le due facce di b.517 si disegnano solo se
              // `dati?.titolo` esiste (LettoreArticolo.js, riga 238), e i
              // due punti che aprono il lettore DALLE NOTIZIE — questo e
              // il tasto «Leggi» piu sotto — passavano solo url/titolo/
              // fonte, senza `dati`. Gli ARGOMENTI lo passavano gia, ed e
              // per questo che li la sintesi si vedeva e qui no: mezza
              // funzione consegnata.
              //
              // `/api/topics/riassunto` chiede obbligatoriamente il solo
              // `titolo` (`sintesi` e `fonti` sono facoltativi), quindi
              // basta questo perche la seconda faccia funzioni davvero.
              const perLettore = leggibile ? {
                url: d.media.url, titolo: d.title, fonte,
                dati: { titolo: d.title, fonti: fonte ? [{ fonte, titolo: d.title }] : [] },
              } : null;
              // ═══ FINE b.519 ═══
              // b.365 — L'IMMAGINE COMANDA (ordine di Luca). Misurate le
              // foto che Cobra porta a casa: 1400x933 e 1218x762. Erano
              // vere fotografie, e le stavamo spegnendo dentro un
              // francobollo da 62 pixel accanto al testo. Ora prendono
              // tutta la larghezza, in 16:9, e sono la prima cosa che
              // l'occhio incontra — come su qualunque giornale.
              return (
                <article key={d.id} style={{
                  marginBottom: 12, borderRadius: 0, overflow: 'hidden',
                  background: 'rgba(11,15,28,0.94)', borderTop: bordo, borderBottom: bordo, fontFamily: FONT,
                }}>
                  <button onClick={() => {
                      vibrate(8);
                      // b.363 — quello che uno APRE vale piu di quello che
                      // dichiara: si tiene il conto, e ordina il prossimo giro.
                      if (d.topic && savePrefs) savePrefs(segnaApertura(prefs, d.topic));
                      // b.365 — leggere l'articolo RIBALTA l'elenco; se non
                      // c'e un articolo da leggere si apre la discussione.
                      if (perLettore) setLettura(perLettore);
                      else setDiscAperta(d.id);
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: 0,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
                    }}>

                    {/* LA FOTO, a tutta larghezza. Se non c'e, non si lascia
                        un buco: resta l'iniziale della fonte su un fondale,
                        della STESSA altezza, cosi le schede restano in riga. */}
                    <span style={{
                      display: 'block', position: 'relative', width: '100%', aspectRatio: '16 / 9',
                      background: `linear-gradient(135deg, ${C.accent}14, ${C.purple}18)`, overflow: 'hidden',
                    }}>
                      {/* b.365 — IL RIPIEGO STA SEMPRE SOTTO, non al posto.
                          Misurato dal vivo: parecchi giornali (Sky fra
                          questi) RIFIUTANO di servire la loro foto a un
                          altro sito. Con la miniatura da 62 pixel era una
                          macchia; con l'immagine a tutta larghezza sarebbe
                          un buco enorme con dentro l'icona di immagine
                          rotta del browser. Quindi l'iniziale della fonte
                          si disegna SEMPRE, e la foto ci sta sopra: se
                          muore in volo, si toglie solo lei e sotto c'e gia
                          qualcosa di decente. */}
                      <span style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 34, fontWeight: 500, color: `${C.accent}55`, letterSpacing: 1,
                      }}>{(fonte || d.title || '\u00b7').slice(0, 1).toUpperCase()}</span>
                      {foto && (
                        <AnteprimaCoperta src={foto} contenuto={d.media} L={L}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          stile={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      {/* il velo in basso: il titolo qui sotto resta leggibile
                          anche sopra una foto chiara */}
                      <span style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'linear-gradient(180deg, transparent 58%, rgba(11,15,28,0.92))',
                      }} />
                      {/* se e un video il triangolo lo dice da lontano */}
                      {tipo === 'video' && (
                        <span style={{
                          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          pointerEvents: 'none',
                        }}>
                          <span style={{
                            width: 46, height: 46, borderRadius: 999, background: 'rgba(6,9,18,0.62)',
                            border: '1px solid rgba(255,255,255,0.25)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 17,
                          }}>
                            {/* b.482 — il triangolo era un carattere
                                disegnato dal telefono: cambiava forma e
                                peso da un apparecchio all'altro. Ora e
                                l'icona di casa, uguale dappertutto. */}
                            <Icon name="play" size={17} color="#fff" />
                          </span>
                        </span>
                      )}
                      {/* DA DOVE, DI COSA, QUANDO — sopra la foto, in alto */}
                      <span style={{
                        position: 'absolute', top: 8, left: 10, right: 10,
                        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                      }}>
                        {bandiera && (
                          <span role="button" tabIndex={0}
                            aria-label={d.country}
                            onClick={(e) => { e.stopPropagation(); vibrate(6); scegliPaese(paeseFiltro === d.country ? null : d.country); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); scegliPaese(paeseFiltro === d.country ? null : d.country); } }}
                            style={{
                              // b.540, ordine di Luca: «evidenzia con una
                              // bandiera piu grande nei contenitori
                              // l'origine delle informazioni. e' importante
                              // che garantiamo sin d'ora pluralita di
                              // informazioni da diverse origini». Da 14 a
                              // 22: da segno quasi invisibile a prima cosa
                              // che si vede sulla foto. Se il giornale
                              // pesca sempre dallo stesso posto, adesso lo
                              // si nota a colpo d'occhio — ed e' meta del
                              // lavoro sulla pluralita.
                              fontSize: 22, lineHeight: 1, cursor: 'pointer', borderRadius: 8,
                              padding: '4px 7px', background: 'rgba(6,9,18,0.72)',
                              border: '1px solid rgba(255,255,255,0.16)',
                              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44,
                              outline: paeseFiltro === d.country ? `1px solid ${C.accent}` : 'none',
                            }}>{bandiera}</span>
                        )}
                        {d.topic && (
                          // b.400 — il tema era una targhetta muta. Adesso e
                          // la porta del confronto fra Paesi: e il posto
                          // giusto, perche il confronto e SUL TEMA e il tema
                          // e gia scritto qui.
                          // b.482 — il mappamondo era un'EMOJI dentro il
                          // testo: cambia forma da telefono a telefono e
                          // qui dentro non ne vogliamo. Adesso e l'icona
                          // di casa, che segue il tratto di tutte le altre.
                          <span role="button" tabIndex={0}
                            aria-label={`${L('whatWorldThinks')} \u2014 ${d.topic}`}
                            onClick={(e) => { e.stopPropagation(); vibrate(6); setTemaMondo(d.topic); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setTemaMondo(d.topic); } }}
                            style={{
                              ...eti, background: 'rgba(6,9,18,0.6)', borderRadius: 5, padding: '2px 6px',
                              color: 'rgba(226,236,252,0.9)', cursor: 'pointer', minHeight: 44,
                            }}>
                            <Icon name="globe" size={12} color="rgba(226,236,252,0.9)" />
                            {d.topic}
                          </span>
                        )}
                        {tipo && tipo !== 'articolo' && (
                          <span style={{
                            ...eti, color: C.accent, background: 'rgba(6,9,18,0.6)',
                            borderRadius: 5, padding: '2px 6px',
                          }}>{L(tipo === 'video' ? 'videoWord' : 'postWord')}</span>
                        )}
                      </span>
                    </span>

                    {/* IL TITOLO: il pezzo piu grosso, sotto la foto */}
                    {/* b.482 — rientro a 20 come la colonna: il testo
                        della scheda si incolonna con tutto il resto. */}
                    <span style={{ display: 'block', padding: '10px 20px 8px' }}>
                      <span style={{
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', fontSize: 15, fontWeight: 500, lineHeight: 1.35,
                        color: C.textPrimary,
                      }}>{d.title || '\u2014'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {fonte && <span style={eti}>{fonte}</span>}
                        {fonte && eta && <span style={{ ...eti, opacity: 0.5 }}>{PUNTO}</span>}
                        {eta && <span style={eti}>{eta}</span>}
                      </span>
                    </span>
                  </button>

                  {/* LA RIGA DEI GESTI: leggere e commentare sono due cose
                      diverse e vanno toccate separatamente. Prima erano lo
                      stesso tocco e non si poteva scegliere. */}
                  {/* b.482 — rientro a 20 come il titolo qui sopra, tasti
                      da 44, e via il grassetto: la differenza fra una
                      conversazione viva e una spenta la fa gia il colore,
                      non serviva anche il nero pesante. */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 20px 10px', borderTop: bordo,
                  }}>
                    <button onClick={() => { vibrate(6); setDiscAperta(d.id); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', minHeight: 44,
                        borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 12,
                        background: 'rgba(255,255,255,0.045)', border: bordo,
                        color: vita.accesa ? C.accent : C.textMuted,
                        fontWeight: 500, WebkitTapHighlightColor: 'transparent',
                      }}>
                      <Icon name="chat" size={13} color={vita.accesa ? C.accent : C.textMuted} />
                      {vita.n > 0 ? `${vita.n} ${L('commentsWord')}` : L('commentsWord')}
                    </button>

                    <span style={{ flex: 1 }} />

                    {leggibile && (
                      <button onClick={() => { vibrate(6); setLettura(perLettore); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', minHeight: 44,
                          borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 500,
                          background: `${C.accent}1A`, border: `1px solid ${C.accent}44`, color: C.accent,
                          WebkitTapHighlightColor: 'transparent',
                        }}>
                        <Icon name="doc" size={13} color={C.accent} />
                        {L('readWord')}
                      </button>
                    )}
                  </div>
                </article>
              );
            })()
          ))}
        </div>
      )}

      {argomenti !== null && argomenti.map(t => (
        <article key={t.id} style={{
          marginBottom: 14, borderRadius: 0, overflow: 'hidden',
          background: C.card, borderTop: bordo, borderBottom: bordo,
        }}>
          {/* La miniatura: 16:9, col fondale pronto SOTTO la foto.
              b.149 — se l'immagine muore in volo, onError toglie solo
              il livello <img> e resta il fondale con l'iniziale.
              b.151 — Luca: "tante pagine vuote". Una card SENZA foto
              non mostra nessun riquadro: solo testo, compatta. Il
              riquadro esiste soltanto quando c'e una foto da farci
              stare dentro. */}
          {t.immagine && (
            <div onClick={() => { vibrate(8); setLettura({ url: t.url, titolo: t.titolo, fonte: t.fonti?.[0]?.fonte, dati: t, faccia: testataChiusa(t.url) ? 'sintesi' : 'articolo' }); }} style={{
              position: 'relative', aspectRatio: '16/9', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${C.accent}14, ${C.purple}18)`,
              overflow: 'hidden',
            }}>
              <span style={{ fontSize: 26, fontWeight: 500, color: `${C.accent}55`, letterSpacing: 1 }}>
                {(t.fonti[0]?.fonte || '·').slice(0, 1).toUpperCase()}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element -- immagine
                  esterna di dominio ignoto: next/image richiederebbe la lista
                  dei domini, che per le news non esiste */}
              <AnteprimaCoperta src={t.immagine} L={L}
                contenuto={{ url: t.url, source: t.fonti?.[0]?.dominio || t.fonti?.[0]?.fonte }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
                stile={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'linear-gradient(180deg, transparent 55%, rgba(5,7,15,0.85))',
              }} />
            </div>
          )}

          {/* b.517 — QUATTRO PORTE, TUTTE ICONE. Luca: «i pulsanti apri e
              traduci, apri, vai al sito devono essere delle icone!!!!!!»
              e «usa icone per leggi e parlane e mettili appena sotto
              immagine o video».
                doc   = leggi l'articolo VERO dentro l'applicazione
                globe = leggilo con la sintesi tradotta gia aperta
                link  = esci sul sito dell'editore
                chat  = parlane (una sola porta, vedi sotto)
              «Apri» e «Apri e traduci» aprono LA STESSA pagina: cambia
              solo su quale delle due facce si atterra. */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 20px 0', alignItems: 'center' }}>
            {/* b.535 — la porta che sappiamo chiusa non si offre: niente
                icona «leggi dentro» per le testate che vietano la
                cornice (testateChiuse). Restano bacchetta e mondo. */}
            {!testataChiusa(t.url) && (
            <button onClick={() => { vibrate(8); setLettura({ url: t.url, titolo: t.titolo, fonte: t.fonti?.[0]?.fonte, dati: t, faccia: 'articolo' }); }}
              aria-label={L('readWord')} title={L('readWord')}
              style={{
                width: 38, height: 38, borderRadius: 11, cursor: 'pointer', flexShrink: 0,
                background: `${C.accent}14`, border: `1px solid ${C.accent}44`, color: C.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <Icon name="doc" size={16} color={C.accent} />
            </button>
            )}
            {/* b.529 — Luca: «cambia l'icona: mondo ti porta sul browser,
                per riassunto o tutto tradotto metti bacchetta magica». */}
            <button onClick={() => { vibrate(8); setLettura({ url: t.url, titolo: t.titolo, fonte: t.fonti?.[0]?.fonte, dati: t, faccia: 'sintesi' }); }}
              aria-label={L('newsOpenTranslate')} title={L('newsOpenTranslate')}
              style={{
                width: 38, height: 38, borderRadius: 11, cursor: 'pointer', flexShrink: 0,
                background: 'transparent', border: bordo, color: C.textSecondary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <Icon name="wand" size={15} color={C.textSecondary} />
            </button>
            <a href={t.url} target="_blank" rel="noopener noreferrer" onClick={() => vibrate(6)}
              aria-label={L('newsOpenSite')} title={L('newsOpenSite')}
              style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0, textDecoration: 'none',
                background: 'transparent', border: bordo,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <Icon name="globe" size={15} color={C.textSecondary} />
            </a>
            {/* b.517 — PARLANE, UNA PORTA SOLA. Luca: «parlane o apri
                discussione non devono essere ambedue presenti». Prima
                erano due tasti a piena larghezza che facevano quasi la
                stessa cosa: uno portava fuori, l'altro apriva la
                discussione. Ora e uno: se qualcuno ne sta gia parlando
                si entra li (e il numero lo dice PRIMA di toccare), se
                non c'e nessuno la discussione la si apre. */}
            {(() => {
              const viva = discussionePerLink.get(t.url);
              return (
                <button onClick={() => { vibrate(10); if (viva) setDiscAperta(viva.id); else apriDiscussione(t); }}
                  disabled={creando}
                  aria-label={L('newsTalkAbout')} title={L('newsTalkAbout')}
                  style={{
                    minWidth: 38, height: 38, padding: viva?.persone ? '0 11px' : 0,
                    borderRadius: 11, cursor: 'pointer', flexShrink: 0,
                    background: viva ? `${C.accent}12` : 'transparent',
                    border: viva ? `1px solid ${C.accent}30` : bordo,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: creando ? 0.6 : 1, fontFamily: FONT,
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  <Icon name="chat" size={15} color={viva ? C.accent : C.textSecondary} />
                  {!!viva?.persone && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.accent }}>{viva.persone}</span>
                  )}
                </button>
              );
            })()}
          </div>

          {/* b.482 — rientro a 20, la misura del template. */}
          <div style={{ padding: '10px 20px 13px' }}>
            {/* b.153 — il titolo apre il lettore vero. */}
            {/* b.482 — il titolo e un tasto e su un titolo di una riga
                sola restava alto una ventina di punti: troppo poco per
                un dito. */}
            <h3 onClick={() => { vibrate(8); setLettura({ url: t.url, titolo: t.titolo, fonte: t.fonti?.[0]?.fonte, dati: t, faccia: testataChiusa(t.url) ? 'sintesi' : 'articolo' }); }} style={{
              margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.35,
              color: C.textPrimary, letterSpacing: -0.2, cursor: 'pointer',
              minHeight: 44, display: 'flex', alignItems: 'center',
            }}>
              {t.titolo}
            </h3>
            {t.sintesi && (
              <p style={{
                margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, color: C.textSecondary,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {t.sintesi}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                {t.fonti.slice(0, 3).map(f => f.fonte || f.dominio).join(' · ')}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                — {t.fonti.length} {t.fonti.length === 1 ? L('newsSourceOne') : L('newsSources')}
                {t.pubblicato ? ` · ${quando(t.pubblicato, L)}` : ''}
              </span>
            </div>
            {/* ═══ b.545 — COMMENTA: LA SECONDA PORTA, NON LA STESSA ═══
                Luca: «parlane e un atto volontario che apre una
                discussione, ma anche il commento apre una "stanza" di
                commenti che possono susseguirsi». Sono due cose diverse e
                per questo sono due tasti: «Parlane» qui sopra fa nascere
                subito una discussione, questo lascia una riga sotto
                l'articolo che puo anche restare sola — diventa stanza da
                se quando qualcuno risponde (lib/commentiContenuto.js,
                soglia due).
                Porta la PAROLA e non la sola icona: nella fila di sopra
                la chiacchiera e gia «Parlane», e due icone uguali una
                accanto all'altra non le distingue nessuno. */}
            <button onClick={() => apriCommenti({ url: t.url, titolo: t.titolo, dati: t })}
              aria-label={L('commentsWord')} title={L('commentsWord')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 9,
                padding: '7px 12px', minHeight: 44, borderRadius: 10, cursor: 'pointer',
                background: 'rgba(255,255,255,0.045)', border: bordo,
                color: C.textSecondary, fontSize: 12, fontWeight: 500, fontFamily: FONT,
                WebkitTapHighlightColor: 'transparent',
              }}>
              <Icon name="chat" size={13} color={C.textSecondary} />
              {L('commentsWord')}
            </button>
            {/* b.517 — «apri discussione» non sta piu qui: e la stessa
                cosa di «parlane», e Luca ha chiesto una porta sola. La
                funzione non si perde — apriDiscussione() e ancora quella,
                la chiama l'icona chat qui sopra quando non c'e ancora
                nessuno che ne parla. */}
          </div>
        </article>
      ))}

      {daCache && argomenti?.length > 0 && (
        <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', padding: '2px 0 10px' }}>
          {L('newsCobraCache')}
        </div>
      )}

      {/* ─── I VIDEO (b.153): YouTube per la via ufficiale ─── */}
      {videoAttivi && video?.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>
            {L('catVideo')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {video.slice(0, 8).map(v => (
              <button key={v.id}
                onClick={() => { vibrate(8); setScheda({ tipo: 'video', dati: v }); }}
                style={{
                  padding: 0, textAlign: 'left', cursor: 'pointer', overflow: 'hidden',
                  borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`,
                  fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
                }}>
                <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura YouTube */}
                  <img src={v.miniatura} alt="" loading="lazy"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{
                      width: 38, height: 38, borderRadius: 19, background: 'rgba(0,0,0,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="play" size={16} color="#fff" />
                    </span>
                  </span>
                </div>
                <div style={{ padding: '8px 20px 10px' }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 500, lineHeight: 1.3, color: C.textPrimary,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {v.titolo}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3 }}>{v.canale}</div>
                  {/* b.326 — audit Mondo D3: il Parlane sulla CARD, come per gli
                      articoli — il percorso buono non passa piu solo dal lettore. */}
                  <span role="button" tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); vibrate(10); onParlane?.({ titolo: v.titolo, sintesi: v.canale ? `YouTube · ${v.canale}` : '' }); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onParlane?.({ titolo: v.titolo, sintesi: v.canale ? `YouTube · ${v.canale}` : '' }); } }}
                    style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44,
                      marginTop: 7, padding: '4px 10px', borderRadius: 8,
                      background: `${C.accent}1f`, border: `1px solid ${C.accent}55`, color: C.accent,
                      fontSize: 11, fontWeight: 500 }}>
                    {L('newsTalkAbout')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* b.515 — IL TASTO DEL FEED. Ordine di Luca: «attiva una
          visualizzazione continua a tutta pagina che mostri le notizie a
          tutta pagina». Fluttua sopra la lista, si vede solo quando c'e
          gia qualcosa da scorrere (articoli o video di questa ricerca). */}
      {/* b.540 — IL PULSANTE «VISTA FEED» E' USCITO. Luca: «perche metti
          il pulsante vista feed?? parti all'apertura con i feed
          direttamente». Un tasto che porta dove si e gia atterrati chiede
          di rifare una cosa fatta: la presentazione si apre da sola
          all'ingresso, e chi la chiude ha scelto il giornale — non gli si
          ripropone la stessa porta galleggiante in mezzo alla pagina. */}

      {/* b.542 — «IL TASTO PARLANE NON VA» (Luca). Non era rotto: si
          apriva DIETRO. Il feed e' un velo fisso a zIndex 97, e il foglio
          «apri una discussione» nasceva sotto di lui — invisibile,
          esattamente come «apri e traduci» in b.535, dove avevo chiuso il
          velo per l'articolo e non per la discussione: mezzo lavoro. Ora
          tutte e due le strade che escono dal feed chiudono il velo. */}
      {/* INIZIO b.535 — «apri e traduci non va» (Luca, dal feed). Il tasto
          LAVORAVA: setLettura girava il foglio sul lettore. Ma il feed e un
          velo fixed a zIndex 97 che restava aperto SOPRA, e l'articolo si
          apriva dietro, invisibile: tocco morto per chi guarda. Ora il velo
          si chiude (onApriArticolo), il lettore appare, e il back del
          lettore riporta al feed da dove si era partiti. FINE b.535 */}
      {/* b.545 — `onCommenta` e la porta dei commenti per il feed, di
          fianco a onParlane/onCresci/onCerca. Non chiude il velo: il filo
          si monta su Sovrapposizione (portale su body, zIndex 131) e sta
          SOPRA il feed, che vive a 97 — chi commenta dentro la
          presentazione non perde il segno dove era arrivato. */}
      <FeedNotizieMondo aperto={feedAperto} onChiudi={() => setFeedAperto(false)} C={C} L={L}
        argomenti={argomenti || []} video={video || []} filtro={feedFiltro}
        // b.552 — «deve presentare il primo contenuto solo quando e'
        // certo» (Luca). `cercando` e' vero solo per il giro in primo
        // piano: la crescita in sottofondo NON rimette il feed in
        // attesa, altrimenti si tornerebbe a interrompere chi guarda.
        caricando={cercando}
        onFiltro={(id) => savePrefs({ ...prefs, mondoFeedFiltro: id })}
        onParlane={(d) => setParlaneCon(d)}
        onStrumenti={suApriStrumenti}
        onCresci={cresci}
        miaLingua={prefs?.lang || prefs?.uiLang || 'it'}
        onCommenta={apriCommenti}
        prefs={prefs} onBacheca={suBacheca} onNascondi={suNascondi}
        crescendo={crescendo}
        onCerca={(q) => { setQuery(q); setChipAttiva(null); cerca(q); }}
        onApriArticolo={(d) => { tornaAlFeedRef.current = true; setFeedAperto(false); setLettura({ url: d.url, titolo: d.titolo, fonte: d.fonti?.[0]?.fonte, dati: d, faccia: testataChiusa(d.url) ? 'sintesi' : 'articolo' }); }} />

      {/* ─── La scheda di visione (solo VIDEO: gli articoli passano da LettoreArticolo) ─── */}
      <SchedaArgomento
        aperta={!!scheda} tipo={scheda?.tipo} dati={scheda?.dati} C={C}
        onClose={() => setScheda(null)}
        onParlane={() => {
          const d = scheda?.dati;
          if (d) onParlane?.(scheda.tipo === 'video'
            ? { titolo: d.titolo, sintesi: d.canale ? `YouTube · ${d.canale}` : '' }
            : d);
          setScheda(null);
        }} />

      </div>
      </div>
      }
      // b.365 — L'ALTRA FACCIA (ordine di Luca: «ribalta il container
      // elenco di 180 gradi e permetti di leggere l'articolo; fai la
      // stessa cosa per i commenti o per entrare nella chat»).
      // L'articolo ha la precedenza: se uno stava leggendo e poi apre i
      // commenti, si torna indietro di un passo alla volta.
      retro={
        lettura ? (
          <LettoreArticolo url={lettura.url} titolo={lettura.titolo} fonte={lettura.fonte}
            dati={lettura.dati} prefs={prefs} userToken={userToken}
            faccia={lettura.faccia || 'articolo'}
            C={C} L={L} onIndietro={() => { setLettura(null); if (tornaAlFeedRef.current) { tornaAlFeedRef.current = false; setFeedAperto(true); } }} />
        ) : discAperta ? (
          <MondoDiscussioni discussionId={discAperta} onClose={() => setDiscAperta(null)}
            onOpenPersona={(id) => setPersonaAperta(id)} />
        ) : null
      } />

      {/* b.188 — il profilo pubblico di una persona: sta SOPRA tutto, non
          su una faccia del foglio, se no girando sparirebbe. */}
      {personaAperta && (
        <MondoPersona publicId={personaAperta} onClose={() => setPersonaAperta(null)}
          onOpenDiscussione={(id) => { setPersonaAperta(null); setDiscAperta(id); }} />
      )}

      {/* ═══ b.545 — IL FILO DEI COMMENTI ═══
          Sta SOPRA tutto e non su una faccia del foglio: si apre da una
          card, dal feed e (domani) da un avviso, e girando il foglio
          sparirebbe. La stessa scelta gia fatta per il profilo qui sopra. */}
      {/* b.551 — «Parlane con chi?»: la domanda giusta al posto di una porta sola */}
      <ParlaneCon aperto={!!parlaneCon} contenuto={parlaneCon}
        onScegli={smistaParlane} onChiudi={() => setParlaneCon(null)} C={C} L={L} />

      <FiloCommenti aperto={!!filo} url={filo?.url} titolo={filo?.titolo}
        C={temaMondoUi} L={L} nome={prefs?.mondoNick || ''}
        onChiudi={() => setFilo(null)}
        onApriStanza={() => {
          // DAL FILO ALLA STANZA SI PASSA DALLA PORTA DI «PARLANE», la
          // stessa che usano le card e il feed. Una strada sola: se il
          // filo ne aprisse una sua, sullo stesso articolo nascerebbero
          // due discussioni diverse e nessuna delle due sarebbe «quella».
          const dati = filo?.dati;
          setFilo(null);
          // b.542 — il velo del feed si chiude, se no il foglio «apri una
          // discussione» nasce dietro di lui e il tocco sembra morto.
          setFeedAperto(false);
          onParlane?.(dati || { titolo: filo?.titolo || '', url: filo?.url || '' });
        }} />

      {/* b.400 — COSA NE PENSA IL MONDO. Sta SOPRA tutto come il profilo
          qui accanto, e per lo stesso motivo: e una cosa che si guarda un
          momento e si chiude, non una pagina in cui si entra. Toccando un
          Paese ci si va davvero — il confronto e una porta, non una
          classifica da guardare. */}
      {temaMondo && (
        <div onClick={() => setTemaMondo(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 120, display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(4,6,12,0.72)', backdropFilter: 'blur(6px)',
          }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, maxHeight: '72dvh', overflowY: 'auto',
              background: C.card, border: `1px solid ${C.cardBorder}`,
              borderRadius: '20px 20px 0 0', fontFamily: FONT,
              padding: `16px 20px calc(24px + env(safe-area-inset-bottom))`,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, flex: 1 }}>
                {L('whatWorldThinks')}
              </span>
              {/* b.482 — la crocetta era un carattere da 32 punti: sotto
                  la misura minima per un dito, e disegnato dal telefono
                  invece che dal nostro tratto. Ora e l'icona di casa, in
                  un bersaglio da 44. */}
              <button onClick={() => setTemaMondo(null)} aria-label={L('closeWord')}
                style={{ width: 44, height: 44, borderRadius: 999, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.textMuted, fontSize: 15 }}>
                <Icon name="x" size={15} color={C.textMuted} />
              </button>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: C.accent, marginBottom: 12 }}>{temaMondo}</div>

            {confrontoGuasto && (
              <div style={{ fontSize: 13, color: C.textMuted, padding: '10px 0' }}>{L('loadError')}</div>
            )}
            {!confrontoGuasto && !confronto && (
              <div style={{ fontSize: 13, color: C.textMuted, padding: '10px 0' }}>{'\u2026'}</div>
            )}
            {confronto && confronto.paesi?.length === 0 && (
              <div style={{ fontSize: 13, color: C.textMuted, padding: '10px 0' }}>{L('quietHereNow')}</div>
            )}
            {/* b.400 — L'ETICHETTA UNA VOLTA SOLA, IN TESTA. Prima ogni riga
                diceva «1 Discussioni», e con trentotto lingue il
                singolare/plurale e una trappola senza fondo: ogni lingua ha
                le sue regole, e alcune ne hanno tre o quattro. Mettendo le
                parole in cima e lasciando alle righe i soli numeri, il
                problema non esiste in nessuna lingua. */}
            {confronto && confronto.paesi?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 6px' }}>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: 0.3, color: C.textMuted, whiteSpace: 'nowrap' }}>
                  {`${L('discussionsLabel')} ${PUNTO} ${L('commentsWord')}`}
                </span>
              </div>
            )}
            {confronto && confronto.paesi?.map((p) => (
              <button key={p.paese}
                onClick={() => { vibrate(8); scegliPaese(p.paese); setTemaMondo(null); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 20px', minHeight: 44, marginBottom: 8, borderRadius: 14, cursor: 'pointer',
                  background: 'rgba(6,9,18,0.45)', border: `1px solid ${C.cardBorder}`,
                  fontFamily: FONT, textAlign: 'left',
                }}>
                <span style={{ fontSize: 19 }}>{bandieraPaese(p.paese)}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: C.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nomePaese(p.paese)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, whiteSpace: 'nowrap' }}>
                  {`${p.discussioni} ${PUNTO} ${p.commenti}`}
                </span>
              </button>
            ))}

            {/* IL CAMPIONE SI DICHIARA. Il documento lo chiede alla lettera
                («campione dichiarato»): chi legge deve sapere su quante
                discussioni sono stati fatti questi conti, invece di
                credere che siano tutto quello che esiste al mondo. */}
            {confronto && confronto.paesi?.length > 0 && (
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, textAlign: 'center' }}>
                {`${L('countedAcross')} ${confronto.discussioniViste}`}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default memo(MondoNews);
