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
import { cercaTopics } from '../lib/topics/cliente.js';   // b.409 — il lettore a righe, uno per tutti
import Scelta from './ui/Scelta.js';
import { bandieraPaese, nomePaese, quando, tipoContenuto, fonteDi, viva, stileEtichetta, PUNTO, paeseDaLingua } from '../lib/schedaMondo.js';
import PannelloLaterale from './ui/PannelloLaterale.js';
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
function MondoNews({ C, onJoinRoom, onParlane, apriDiscussioneId = null, suApertaDiscussione, strumenti = false, suChiudiStrumenti, paeseDalGlobo = null, suPaeseScelto, suScorrimento, temaDaFuori = null, suTemaLetto }) {
  const { L, prefs, userToken, savePrefs } = useApp();
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
  useEffect(() => {
    if (typeof window === 'undefined' || window.__VT_FEED_VISTO) return;
    window.__VT_FEED_VISTO = true;
    setFeedAperto(true);
  }, []);
  const feedFiltro = prefs?.mondoFeedFiltro || 'video'; // { tipo: 'articolo'|'video', dati }
  const [video, setVideo] = useState(null);   // null = mai cercati
  const [videoAttivi, setVideoAttivi] = useState(false);
  // b.185 — seconda modalita: Veloce (default) o Approfondita (piu fonti,
  // Wikipedia in testa). `numFonti` = quanto approfondire (3/6/10).
  // b.363 — il modo lo dice la PREFERENZA: si decide una volta e resta.
  const profonda = (prefs?.mondoModo || 'veloce') === 'approfondita';
  const [numFonti, setNumFonti] = useState(6);
  const abortRef = useRef(null);
  const [feedGuasto, setFeedGuasto] = useState(false);
  // b.363 — LA PREFERENZA "QUANDO AGGIORNO", che fa una cosa vera: se e
  // impostata su "all'apertura", le notizie si cercano da sole appena si
  // entra, una volta sola. Altrimenti si aspetta che tu tocchi Aggiorna,
  // che e il modo di non spendere credito senza averlo chiesto.
  const giaCercato = useRef(false);
  useEffect(() => {
    if ((prefs?.mondoAggiorna || 'richiesta') !== 'apertura') return;
    if (giaCercato.current || !userToken) return;
    giaCercato.current = true;
    cercaChip(CATEGORIE[0]);
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
  const [bozzaPaese, setBozzaPaese] = useState(null);
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
  const cercaVideoPer = useCallback(async (q) => {
    setVideo(null);
    try {
      const r = await fetch(`/api/topics/video?q=${encodeURIComponent(q)}&lang=${lingua}`, { signal: AbortSignal.timeout(60000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
      if (!r.ok) return;
      // b.363 — prima la lettura non era protetta e la ricerca video moriva
      // in silenzio, lasciando la griglia vuota senza un motivo.
      const d = await r.json().catch(() => null);
      if (!d) { console.warn('[b.363] topics/video: risposta illeggibile'); return; }
      setVideoAttivi(!!d.disponibile);
      // b.324 — audit Mondo D6: la griglia mostrava lo stesso video due
      // volte (fonti diverse, stesso id). Dedup per id/url prima di mostrare.
      if (d.disponibile) {
        const visti = new Set();
        setVideo((d.video || []).filter((v) => {
          const k = v?.id || v?.url || v?.titolo;
          if (!k || visti.has(k)) return false;
          visti.add(k); return true;
        }));
      }
    } catch { /* i video sono un di piu, mai un errore in faccia */ }
  }, [lingua]);

  const cerca = useCallback(async (q, cat = 'notizie', fresca = false) => {
    const pulita = (q || '').trim();
    if (!pulita || cercando) return;
    cercaVideoPer(pulita);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setCercando(true); setErrore(''); setProcesso([]); setDaCache(false);
    vibrate(10);
    try {
      // b.409 — IL LETTORE A RIGHE NON VIVE PIU QUI DENTRO. Era scritto
      // a mano in questa funzione, e in Life non c'era: la stessa rotta
      // veniva letta bene in Mondo e male in Impara, dove non ha mai
      // prodotto un risultato. Ora e uno solo, in lib/topics/cliente.js.
      // Il comportamento e lo stesso di prima, riga per riga.
      const fine = await cercaTopics(
        { q: pulita, lingua, cat, fresca, profonda, fonti: profonda ? numFonti : 0, segnale: ac.signal },
        (r) => {
          const testo = descriviStadio(r);
          if (testo) setProcesso(p => [...p.slice(-5), { testo, id: p.length }]);
        },
      );
      if (fine) {
        setArgomenti(fine.argomenti || []);
        setStanze(fine.stanze || []);
        setDaCache(!!fine.daCache);
        // b.529 — ULTIME RICERCHE (Luca: «quando faccio una ricerca devi
        // inserire in alto nella sidebar ultime ricerche e devi
        // recuperare il logo e inserirlo a sinistra del nome abbreviato»).
        // L'etichetta sono le prime due parole piene della domanda
        // («milan ac...» -> Milan Ac, «politica estera della corea» ->
        // Politica Corea); l'immagine e la miniatura del primo risultato
        // VERO — un logo garantito per qualunque ricerca non esiste, la
        // faccia della notizia si.
        try {
          const VUOTE = new Set(['di','della','del','dello','delle','dei','degli','la','il','lo','le','gli','un','una','uno','che','per','con','sul','sulla','the','of','a','an','and']);
          const parole = pulita.split(/[\s,]+/).filter(w => w.length > 1 && !VUOTE.has(w.toLowerCase()));
          const etichetta = parole.slice(0, 2).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || pulita.slice(0, 18);
          const img = (fine.argomenti || []).find(t => t.immagine)?.immagine || null;
          const vecchie = Array.isArray(prefs?.ricercheRecenti) ? prefs.ricercheRecenti : [];
          const nuove = [{ q: pulita, etichetta, img }, ...vecchie.filter(r => r.q !== pulita)].slice(0, 6);
          savePrefs?.({ ...prefs, ricercheRecenti: nuove });
        } catch { /* la memoria delle ricerche non deve mai rompere la ricerca */ }
      }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/topics/search:', e?.message || e);
      if (e.name !== 'AbortError') setErrore('guasto');
    } finally {
      setCercando(false);
    }
  }, [lingua, cercando, descriviStadio, cercaVideoPer, profonda, numFonti, prefs, savePrefs]);

  const cercaChip = useCallback((c) => {
    setChipAttiva(c.id);
    const q = (QUERY_RAPIDE[c.id] || {})[lingua] || (QUERY_RAPIDE[c.id] || {}).en || c.id;
    setQuery('');
    cerca(q, c.cat);
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
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
            fontFamily: FONT, opacity: cercando || (!query.trim() && !chipAttiva) ? 0.5 : 1,
            WebkitTapHighlightColor: 'transparent',
          }}>
          {L('newsUpdate')}
        </button>
      </div>



      {/* b.363 — GLI STRUMENTI STANNO DIETRO IL GIORNALE. Sopra il pianeta
          restavano accesi tre blocchi — il campo "cosa vuoi seguire", i due
          modi, la fila delle categorie — che coprivano meta mondo anche
          quando nessuno li stava usando. Ora si aprono toccando l'icona
          del giornale in alto a sinistra, e si richiudono. */}
      <PannelloLaterale aperto={strumenti} onChiudi={suChiudiStrumenti} titolo={L('tabNews')} C={C}>
      {/* b.524 — LO SCHELETRO DEL PANNELLO E UNO SOLO, su tutte e tre le
          schede. Luca: «le side bar delle tre pagine stanze, notizie e
          mondo hanno la stessa selezione campi?????» — no, non
          l'avevano: Preferiti e Paese esistevano solo nel pannello di
          Stanze/Mondo, e le Notizie ne avevano uno tutto diverso.
          Ordine comune, da qui in avanti:
            1. PREFERITI (i temi, badge di vetro)
            2. PAESE (da dove guardo il mondo)
            3. i filtri PROPRI della scheda
            4. PREFERENZE (le quattro, identiche ovunque)
          Qui i preferiti sono i temi VERI del giornale in mano
          (argomentiVeri, gia contati per il filtro qui sotto): toccarne
          uno filtra, la x lo toglie con la stessa memoria persistente
          di Stanze/Mondo (prefs.temiTolti). */}
      {/* b.529 — LE ULTIME RICERCHE, in alto: badge di vetro
          rettangolari, miniatura a sinistra e nome abbreviato. Un tocco
          rifa quella ricerca (azione esplicita: parte subito), la x la
          dimentica. */}
      {Array.isArray(prefs?.ricercheRecenti) && prefs.ricercheRecenti.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, color: C.textMuted, margin: '0 0 8px' }}>
            {L('recentSearches')}
          </div>
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
                    color: '#fff', fontSize: 11.5, fontWeight: 600, maxWidth: 180, WebkitTapHighlightColor: 'transparent' }}>
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
        </div>
      )}
      <PreferitiTemi temi={argomentiVeri.map(([arg, n]) => ({ topic: arg, discussioni: n }))}
        prefs={prefs} savePrefs={savePrefs} C={C} L={L}
        onScegli={(topic) => { setArgomentoFiltro(topic); suChiudiStrumenti?.(); }} />

      {/* b.524 — IL PAESE, che qui mancava: filtrava solo dal globo o
          dalla bandierina di una scheda. Stessa tendina di Stanze/Mondo,
          stesso giro (scegliPaese risale a MondoView, che aggiorna anche
          il globo: un filtro solo, non due che litigano). */}
      <Scelta C={C}
        etichetta={L('countryLabel')}
        valore={bozzaPaese || 'tutto'}
        opzioni={[
          { valore: 'tutto', etichetta: L('wholeWorld'), conto: feed?.length || 0 },
          ...PAESI
            .map((pa) => ({
              valore: pa.codice,
              etichetta: `${pa.bandiera} ${nomePaese(pa.codice)}`,
              conto: (feed || []).filter((d) => d.country === pa.codice).length,
            }))
            .sort((a, b) => a.etichetta.localeCompare(b.etichetta)),
        ]}
        onCambia={(v) => setBozzaPaese(v === 'tutto' ? null : v)} />

      {/* b.363 — I DUE MODI SONO DIVENTATI UNA PREFERENZA (qui sopra):
          era una scelta da rifare a ogni apertura, e invece e una cosa
          che si decide una volta. Qui resta solo quante fonti leggere
          quando si va a fondo, che e un dettaglio del momento. */}
      {profonda && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT }}>{L('newsSourcesShort')}</span>
          {/* b.482 — erano tondini da 30x28: un bersaglio piu piccolo del
              polpastrello. Portati alla misura minima del template. */}
          {[3, 6, 10].map(n => (
            <button key={n} onClick={() => { setNumFonti(n); vibrate(8); }}
              style={{
                width: 44, height: 44, borderRadius: 9, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600,
                background: numFonti === n ? `${C.accent}20` : C.card,
                border: numFonti === n ? `1px solid ${C.accent}45` : bordo,
                color: numFonti === n ? C.accent : C.textSecondary,
                WebkitTapHighlightColor: 'transparent',
              }}>{n}</button>
          ))}
        </div>
      )}

      {/* b.363 — DUE TENDINE AL POSTO DI DUE PARETI DI PILLOLE (ordine di
          Luca: «in dropdown se la scelta e singola»). Erano quaranta
          bottoni su otto righe, per due scelte che sono SINGOLE: una fila
          di pillole promette "puoi averne piu di una", una tendina dice
          la verita, e occupa una riga invece di otto.
          Sono due cose diverse e vanno tenute distinte: la prima filtra
          cio che c'e QUI DENTRO, la seconda va a cercare LA FUORI. */}
      {argomentiVeri.length > 0 && (
        <Scelta C={C}
          etichetta={L('topicsWord')}
          valore={argomentoFiltro || ''}
          opzioni={[
            { valore: '', etichetta: L('allTopicsWord'), conto: feed?.length || 0 },
            ...argomentiVeri.map(([arg, n]) => ({ valore: arg, etichetta: arg, conto: n })),
          ]}
          onCambia={(v) => setArgomentoFiltro(v || null)} />
      )}

      <Scelta C={C}
        etichetta={L('searchCategoryWord')}
        valore={bozzaCategoria || ''}
        opzioni={[
          { valore: '', etichetta: L('allTopicsWord') },
          ...CATEGORIE.map((c) => ({ valore: c.id, etichetta: L(c.labelKey) })),
        ]}
        onCambia={(v) => setBozzaCategoria(v)} />


      <div style={{ height: 1, background: C.cardBorder, margin: '6px 0 16px' }} />
      {/* b.529 — UNA conferma sola: si applica cio che e cambiato, e il
          pannello si chiude cosi si VEDE l'effetto. */}
      <button onClick={() => {
          vibrate(10);
          if (bozzaPaese !== paeseFiltro) scegliPaese(bozzaPaese);
          if ((bozzaCategoria || '') !== (chipAttiva || '')) {
            if (!bozzaCategoria) setChipAttiva(null);
            else { const c = CATEGORIE.find((x) => x.id === bozzaCategoria); if (c) cercaChip(c); }
          }
          suChiudiStrumenti?.();
        }}
        style={{
          width: '100%', minHeight: 46, borderRadius: 12, cursor: 'pointer', margin: '2px 0 14px',
          background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: 'none',
          color: '#fff', fontSize: 13.5, fontWeight: 600, fontFamily: FONT,
          WebkitTapHighlightColor: 'transparent',
        }}>
        {L('applyWord')}
      </button>

      <PreferenzeMondo C={C} />
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
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: C.accent }}>
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
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>
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
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            color: C.textMuted, fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
          }}>
          {L('newsError')} · {L('retryWord')}
        </button>
      )}

      {/* ─── b.187 · Feed delle discussioni pubbliche persistenti ─── */}
      {feedMostrato.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8, padding: '0 16px' }}>
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
                        fontSize: 34, fontWeight: 600, color: `${C.accent}55`, letterSpacing: 1,
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
                              fontSize: 14, lineHeight: 1, cursor: 'pointer', borderRadius: 5,
                              padding: '2px 4px', background: 'rgba(6,9,18,0.6)',
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
                        overflow: 'hidden', fontSize: 15, fontWeight: 600, lineHeight: 1.35,
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
                        fontWeight: 600, WebkitTapHighlightColor: 'transparent',
                      }}>
                      <Icon name="chat" size={13} color={vita.accesa ? C.accent : C.textMuted} />
                      {vita.n > 0 ? `${vita.n} ${L('commentsWord')}` : L('commentsWord')}
                    </button>

                    <span style={{ flex: 1 }} />

                    {leggibile && (
                      <button onClick={() => { vibrate(6); setLettura(perLettore); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', minHeight: 44,
                          borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600,
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
            <div onClick={() => { vibrate(8); setLettura({ url: t.url, titolo: t.titolo, fonte: t.fonti?.[0]?.fonte, dati: t, faccia: 'articolo' }); }} style={{
              position: 'relative', aspectRatio: '16/9', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${C.accent}14, ${C.purple}18)`,
              overflow: 'hidden',
            }}>
              <span style={{ fontSize: 26, fontWeight: 600, color: `${C.accent}55`, letterSpacing: 1 }}>
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{viva.persone}</span>
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
            <h3 onClick={() => { vibrate(8); setLettura({ url: t.url, titolo: t.titolo, fonte: t.fonti?.[0]?.fonte, dati: t, faccia: 'articolo' }); }} style={{
              margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.35,
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
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>
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
                    fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, color: C.textPrimary,
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
                      fontSize: 11, fontWeight: 600 }}>
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
      {(argomenti?.length > 0 || video?.length > 0) && (
        <button onClick={() => { vibrate(10); setFeedAperto(true); }}
          aria-label={L('feedApri')}
          style={{
            position: 'fixed', right: 20, bottom: 'calc(96px + env(safe-area-inset-bottom))',
            zIndex: 40, minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FONT,
            boxShadow: '0 10px 26px rgba(0,0,0,0.4)', WebkitTapHighlightColor: 'transparent',
          }}>
          <Icon name="play" size={14} color="#fff" />
          {L('feedApri')}
        </button>
      )}

      <FeedNotizieMondo aperto={feedAperto} onChiudi={() => setFeedAperto(false)} C={C} L={L}
        argomenti={argomenti || []} video={video || []} filtro={feedFiltro}
        onFiltro={(id) => savePrefs({ ...prefs, mondoFeedFiltro: id })}
        onParlane={(d) => onParlane?.(d)}
        onApriArticolo={(d) => { setLettura({ url: d.url, titolo: d.titolo, fonte: d.fonti?.[0]?.fonte, dati: d }); }} />

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
            C={C} L={L} onIndietro={() => setLettura(null)} />
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
              <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, flex: 1 }}>
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
            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.accent, marginBottom: 12 }}>{temaMondo}</div>

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
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3, color: C.textMuted, whiteSpace: 'nowrap' }}>
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
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nomePaese(p.paese)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, whiteSpace: 'nowrap' }}>
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
