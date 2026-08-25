'use client';
import Icon from './Icon.js';
import { quando, viva, stileEtichetta, PUNTO, paeseDaLingua, linguaDelPaese, bandieraPaese, nomePaese } from '../lib/schedaMondo.js';
import PannelloLaterale, { LinguettaPannello } from './ui/PannelloLaterale.js';
import { COLONNA, riservaADestra } from '../lib/righello.js';
import PreferenzeMondo from './ui/PreferenzeMondo.js';
import Scelta from './ui/Scelta.js';
// ═══════════════════════════════════════════════
// MondoView — Public room discovery
//
// Redesigned: glassmorphism cards, ambient orb,
// horizontal lang/mode pills, skeleton shimmer,
// search bar, room cards with gradient accents.
// ═══════════════════════════════════════════════

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { FONT, LANGS, vibrate } from '../lib/constants.js';
import GloboMondo from './GloboMondo.js'; // b.359 — il pianeta dal file di Luca
import getStyles from '../lib/styles.js';
import { PALETTE } from '../lib/palette.js';
import { subscribeTick } from '../lib/ticker.js';
import { useApp } from '../contexts/AppContext.js';
import MondoNews from './MondoNews.js';

// ═══ INIZIO b.255 — le etichette delle stanze erano in inglese fisso ═══
// Sono il testo piu ripetuto della vetrina (una per ogni scheda e per
// ogni filtro) e restavano "Chat/Classroom/Free Talk/Live" anche con
// l'interfaccia in coreano o in arabo. Le chiavi esistono gia: sono le
// STESSE che usa la barra dentro la stanza (MODES in constants.js), cosi
// la stessa modalita non si chiama in due modi diversi in due schermate.
// 'interview' e 'conference' restano nella mappa per le stanze vecchie
// che potrebbero averle salvate (tolte da b.126), ma senza chiave: per
// quelle si mostra l'identificativo grezzo invece di una bugia tradotta.
const MODE_LABELS = {
  conversation: { labelKey: 'conversation', icon: '', color: PALETTE.teal },
  classroom:    { labelKey: 'classroom', icon: '', color: '#10B981' },
  interview:    { label: 'Interview', icon: '', color: '#F59E0B' },
  conference:   { label: 'Conference', icon: '', color: '#8B5CF6' },
  freetalk:     { labelKey: 'freeTalk', icon: '', color: '#EC4899' },
  simultaneous: { labelKey: 'simultaneous', icon: '', color: '#EF4444' },
};
// Il nome da mostrare: la chiave tradotta se c'e, altrimenti cio che c'e.
const nomeModalita = (info, L) => (info?.labelKey ? L(info.labelKey) : (info?.label || ''));
// ═══ FINE b.255 ═══

// b.98 — questa mappa era rimasta svuotata dalla ripulitura delle emoji di
// b.94: renderizzava uno spazio, e il tipo di stanza non si vedeva piu.
// Ora sono nomi del sistema di icone, non caratteri.
const ROOM_TYPE_ICONS = {
  public: null,        // pubblica: nessun segno, e la normalita
  protected: 'lock',
  private: 'lock',
  temporary: 'history',
};

// b.138 — le etichette del ruolo erano parole italiane fisse: chi
// leggeva l'app in un'altra lingua vedeva "Invitato" su una scheda
// per il resto tradotta. Ora sono chiavi, tranne quelle che restano
// sigle uguali ovunque.
const ROLE_BADGES = {
  owner: { labelKey: 'roleHost', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  moderator: { labelKey: 'roleMod', color: '#8B5CF6', bg: 'rgba(139,106,255,0.12)' },
  participant: null,
  // b.482 — QUI DENTRO NON C'ERA NIENTE. Il distintivo dell'ascoltatore
  // aveva il fondo, il bordo e il rientro, e la parola era la stringa
  // vuota: sulla scheda della stanza compariva una macchia grigia che
  // non diceva niente e non si poteva nemmeno indovinare. La parola non
  // esisteva in nessuno dei trentotto pacchetti: adesso c'e.
  listener: { labelKey: 'roleListener', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  invited: { labelKey: 'roleInvited', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
};

const LANG_FILTERS = [
  { code: 'all', flag: '', nameKey: 'filterAllVoices' },
  { code: 'it', flag: '🇮🇹', name: 'IT' },
  { code: 'en', flag: '🇺🇸', name: 'EN' },
  { code: 'es', flag: '🇪🇸', name: 'ES' },
  { code: 'fr', flag: '🇫🇷', name: 'FR' },
  { code: 'de', flag: '🇩🇪', name: 'DE' },
  { code: 'pt', flag: '🇧🇷', name: 'PT' },
  { code: 'zh', flag: '🇨🇳', name: 'ZH' },
  { code: 'ja', flag: '🇯🇵', name: 'JA' },
  { code: 'ko', flag: '🇰🇷', name: 'KO' },
  { code: 'ar', flag: '🇸🇦', name: 'AR' },
  { code: 'th', flag: '🇹🇭', name: 'TH' },
];

// b.362 — I DATI IN UNA FORMA SOLA. Stanze e discussioni arrivavano in due
// vesti (nome/name, members/partecipanti, title/titolo, commentCount/
// commenti) e ogni punto del file doveva ricordarsi entrambe: una classe
// intera di bug futuri. Qui si normalizza UNA volta, all'ingresso.
function normalizzaStanza(r) {
  if (!r) return r;
  return { ...r,
    roomId: r.roomId || r.id,
    nome: r.nome || r.name || r.roomId || r.id || '',
    membri: (r.memberCount ?? r.members ?? r.partecipanti ?? 0),
  };
}
function normalizzaDiscussione(d) {
  if (!d) return d;
  return { ...d,
    titolo: d.titolo || d.title || '',
    commenti: (d.comment_count ?? d.commentCount ?? d.commenti ?? 0),
  };
}

function MondoView({ onJoinRoom, onCreateRoom, onParlane }) {
  const { L, setView, theme, prefs } = useApp();
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    // Fondo dal TEMA: prima era fisso e il tema chiaro restava nero.
    bg: col.bg || PALETTE.bgDeep,
    textPrimary: col.textPrimary || PALETTE.grayLight,
    textSecondary: col.textSecondary || 'rgba(242,244,247,0.90)',
    textMuted: col.textMuted || 'rgba(242,244,247,0.60)',
    card: col.glassCard || 'rgba(12,16,30,0.65)',
    cardBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    input: col.inputBg || 'rgba(14,18,32,0.6)',
    inputBorder: col.inputBorder || 'rgba(255,255,255,0.07)',
    accent: col.accent1 || PALETTE.teal,
    purple: col.accent2 || PALETTE.violet,
    red: col.accent3 || PALETTE.coral,
    divider: col.dividerColor || 'rgba(255,255,255,0.04)',
  };

  // b.147 — Mondo si divide in due anime: le STANZE (quello che c'era)
  // e le NEWS (il seminatore di conversazioni). Un tab, non due pagine:
  // la gerarchia resta Mondo → argomento → persone → conversazione.
  // b.335 — HOME MONDO NUOVA: si atterra su "Per te" — cosa e caldo ADESSO
  // (discussioni piu vive, stanze piu piene), a colpo d'occhio.
  const [tab, setTab] = useState('stanze');
  const [feedCaldo, setFeedCaldo] = useState(null);
  // b.363 — un elenco CADUTO non e un elenco VUOTO: prima, se la chiamata
  // non riusciva, la corsia "di cosa si parla" restava muta e sembrava che
  // non ci fosse nulla di cui parlare; con una risposta non valida restava
  // in attesa per sempre, senza un secondo tentativo. Ora il guasto si
  // dichiara e si riprova aprendo la ricerca.
  const [feedCaldoGuasto, setFeedCaldoGuasto] = useState(false);
  const [riprovaCaldo, setRiprovaCaldo] = useState(0);
  useEffect(() => {
    let vivo = true;
    fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!vivo) return;
        if (d) { setFeedCaldo((d.discussioni || []).map(normalizzaDiscussione)); setFeedCaldoGuasto(false); }
        else { setFeedCaldo([]); setFeedCaldoGuasto(true); }
      })
      .catch(() => { if (vivo) { setFeedCaldo([]); setFeedCaldoGuasto(true); } });
    return () => { vivo = false; };
  }, [riprovaCaldo]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  // b.363 — dai risultati di ricerca la discussione va APERTA, non solo la
  // scheda News: prima l'id veniva buttato e si atterrava sul generico.
  const [apriDiscussione, setApriDiscussione] = useState(null);
  // b.363 — la maniglia degli strumenti: chiusa il pianeta e libero.
  const [strumenti, setStrumenti] = useState(false);
  // b.363 — IL PAESE SCELTO e uno stato di MONDO, non un filtro di una
  // pagina: scegliendolo in Stanze resta scelto passando a News, come
  // deve essere se il globo e una porta e non un setaccio.
  const [paeseScelto, setPaeseScelto] = useState(null);
  // b.398 — QUANTO SEI SCESO, da 0 a 1. Serve al pianeta: il documento di
  // Luca dice che il globo «con lo scroll perde importanza» e «dopo il
  // primo blocco contenuti puo scomparire». Finora non lo sapeva nessuno:
  // in tutta la schermata non c'era un solo ascoltatore dello scorrimento,
  // e il globo restava identico sotto i contenuti che gli passavano sopra.
  const [discesa, setDiscesa] = useState(0);
  // b.399 — IL RIQUADRO DEL PAESE. Dal documento di Luca: al termine
  // dello zoom compaiono in sovrimpressione le persone attive, le stanze
  // e i temi. Una chiamata sola, perche con due il riquadro comparirebbe
  // a pezzi. E in SOVRIMPOSIZIONE sul pianeta, non in colonna: un
  // elemento che appare non deve spingere giu quello che stai leggendo.
  const [schedaPaese, setSchedaPaese] = useState(null);
  // b.401 — il tema toccato nella Home del Paese: si passa a News, e
  // News apre proprio quel tema. Senza questo il tocco portava alle news
  // del Paese ma non a QUEL tema, cioe faceva meta strada.
  const [temaDaMondo, setTemaDaMondo] = useState(null);
  useEffect(() => {
    if (!paeseScelto) { setSchedaPaese(null); return; }
    let vivo = true;
    const taglio = new AbortController();
    (async () => {
      try {
        const r = await fetch(`/api/mondo/paese?code=${encodeURIComponent(paeseScelto)}`, { signal: taglio.signal });
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (vivo) setSchedaPaese(d);
      } catch (e) {
        // Il riquadro e un di piu: se non arriva, non si mostra. Ma il
        // guasto si registra — un riquadro che non compare mai e
        // indistinguibile da uno che non esiste.
        if (e?.name !== 'AbortError') console.warn('[b.399] scheda paese non arrivata:', e?.message);
        if (vivo) setSchedaPaese(null);
      }
    })();
    return () => { vivo = false; taglio.abort(); };
  }, [paeseScelto]);

  const seguiScorrimento = useCallback((e) => {
    const y = e?.currentTarget?.scrollTop || 0;
    // 240 pixel: un primo blocco di contenuti. Oltre, il pianeta e sparito.
    const q = Math.min(1, y / 240);
    // si riscrive solo a scatti di un centesimo: ridisegnare a ogni pixel
    // non si vede e costa.
    setDiscesa((prima) => (Math.abs(prima - q) > 0.01 ? q : prima));
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/mondo', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
      // b.363 — prima la lettura non era protetta: una risposta rotta faceva
      // sparire l'elenco stanze senza mostrare il messaggio d'errore previsto.
      if (res.ok) { const data = await res.json().catch(() => null); if (data) { setRooms((data.rooms || []).map(normalizzaStanza)); setError(null); } else setError(L('loadRoomsFailed')); }
      else setError(L('loadRoomsFailed')); // b.232 — prima !res.ok (500/429) era silenzioso
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo:', e?.message || e);
      setError(L('loadRoomsFailed')); }
    finally { setLoading(false); }
  }, [L]);

  useEffect(() => {
    return subscribeTick(30000, fetchRooms, { immediate: true });
  }, [fetchRooms]);

  const handleRefresh = useCallback(() => { fetchRooms(); }, [fetchRooms]);

  const getLangFlag = (code) => LANGS.find(l => l.code === code)?.flag || '';
  const getLangName = (code) => LANGS.find(l => l.code === code)?.name || '';

  const timeAgo = (ts) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return L('timeNow');
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  };

  const filteredRooms = useMemo(() => {
    let list = [...rooms];
    // b.397 — IL PAESE COMANDA, LA LINGUA E IL RIPIEGO. Da oggi una stanza
    // puo portare il posto da cui e stata aperta. Quando ce l'ha, e quello
    // che decide se appartiene al Paese scelto sul pianeta: cosi una stanza
    // aperta in Messico resta in Messico e non finisce in Spagna solo
    // perche ci si parla spagnolo.
    // Le stanze nate prima di oggi il posto non ce l'hanno: per loro resta
    // la vecchia regola — la lingua di casa di quel Paese — che e
    // un'approssimazione, e come tale continua a stare scritta qui sopra.
    if (paeseScelto) {
      const linguaDiLa = linguaDelPaese(paeseScelto);
      list = list.filter(r => (r.paese ? r.paese === paeseScelto : (linguaDiLa ? r.lang === linguaDiLa : true)));
    } else if (langFilter !== 'all') list = list.filter(r => r.lang === langFilter);
    if (modeFilter !== 'all') list = list.filter(r => r.mode === modeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.nome?.toLowerCase().includes(q)
        || r.host?.toLowerCase().includes(q)
        || r.description?.toLowerCase().includes(q));
    }
    return list;
  }, [rooms, langFilter, modeFilter, search, paeseScelto]);

  // b.355 — LA RICERCA A TRE CORSIE (il disegno approvato): mentre scrivi,
  // tre gruppi di risposte — PAESI/LINGUE (col conteggio delle stanze vive),
  // STANZE vere, DISCUSSIONI calde. Un campo solo, tutto il Mondo dentro.
  const cercando = search.trim().length > 0;
  const risultati = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const stanzePerLingua = {};
    for (const r of rooms) { if (r.lang) stanzePerLingua[r.lang] = (stanzePerLingua[r.lang] || 0) + 1; }
    const paesi = LANGS
      .filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().startsWith(q))
      .sort((a, b) => (stanzePerLingua[b.code] || 0) - (stanzePerLingua[a.code] || 0))
      .slice(0, 6)
      .map((l) => ({ ...l, vive: stanzePerLingua[l.code] || 0 }));
    const stanze = rooms.filter((r) =>
      r.nome?.toLowerCase().includes(q)
      || r.host?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
    ).slice(0, 6);
    const discussioni = (feedCaldo || []).filter((d) =>
      (d.titolo || '').toLowerCase().includes(q) || (d.topic || '').toLowerCase().includes(q)
    ).slice(0, 6);
    return { paesi, stanze, discussioni };
  }, [search, rooms, feedCaldo]);

  // b.363 — LA PREFERENZA "DA DOVE PARTO", che fa una cosa vera: aprendo
  // Mondo il pianeta puo portarti subito sul tuo paese. Vale una volta
  // sola, all'ingresso: dopo comandi tu, e non ti si sposta il mondo
  // sotto le dita mentre stai guardando.
  useEffect(() => {
    // b.397 — chi non ha mai scelto niente trova il mondo che gira, non
    // il proprio paese gia inquadrato. Il valore di partenza sta scritto
    // in una riga sola dentro le preferenze di Mondo: qui si ripete, e i
    // due devono dire la stessa cosa (una prova lo controlla).
    const scelto = prefs?.mondoPaese || 'nessuno';
    if (scelto === 'nessuno') return;
    const mio = scelto === 'auto' ? paeseDaLingua(prefs?.lang) : scelto;
    if (mio) setPaeseScelto(mio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // b.363 — IL TRAFFICO PER PAESE, da zero a uno. Si conta quante stanze
  // e quante discussioni ci sono per paese e si rapporta al piu vivo di
  // tutti: cosi il paese piu animato e acceso pieno e gli altri in
  // proporzione. Un numero assoluto non servirebbe — tre stanze sono
  // tante se nessun altro ne ha, poche se altrove ce ne sono trenta.
  const trafficoPaesi = useMemo(() => {
    const conto = {};
    for (const r of rooms) {
      const p = r.paese || paeseDaLingua(r.hostLang || r.lang); // b.403 — P1.1: il paese vero batte la lingua
      if (p) conto[p] = (conto[p] || 0) + 1 + (Number(r.membri) || 0) * 0.2;
    }
    for (const d of feedCaldo || []) {
      if (d.country) conto[d.country] = (conto[d.country] || 0) + 0.6;
    }
    const massimo = Math.max(1, ...Object.values(conto));
    const scala = {};
    for (const [p, n] of Object.entries(conto)) scala[p] = Math.min(1, n / massimo);
    return scala;
  }, [rooms, feedCaldo]);

  // b.363 — LE ROTTE VERE PER I VOLI: le coppie di paesi fra cui c'e
  // davvero qualcuno che parla. Si costruiscono dalle stanze aperte, a
  // due a due, e il pianeta le AGGIUNGE a quelle di scena. Il paese lo
  // ricava dalla lingua finche le stanze non porteranno il luogo.
  const rotteVere = useMemo(() => {
    // b.403 — P1.2: stessa regola del traffico. MX in spagnolo e MESSICO, non Spagna.
    const paesi = [...new Set(rooms.map((r) => r.paese || paeseDaLingua(r.hostLang || r.lang)).filter(Boolean))];
    const coppie = [];
    for (let i = 0; i < paesi.length && coppie.length < 10; i++) {
      for (let j = i + 1; j < paesi.length && coppie.length < 10; j++) coppie.push([paesi[i], paesi[j]]);
    }
    return coppie;
  }, [rooms]);

  // b.363 — QUANTE STANZE PER LINGUA, per dirlo sulle pillole del filtro.
  // Una pillola senza numero e una scommessa: si tocca per scoprire se
  // dietro c'e qualcosa. Col numero si sceglie prima di toccare, che e
  // lo stesso metodo delle schede.
  const perLingua = useMemo(() => {
    const c = {};
    for (const r of rooms) { const l = r.lang; if (l) c[l] = (c[l] || 0) + 1; }
    return c;
  }, [rooms]);

  const availableModes = useMemo(() => {
    const modes = new Set(rooms.map(r => r.mode));
    return ['all', ...modes];
  }, [rooms]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'hidden',
    }}>

      {/* b.361 — IL PIANETA INTEGRATO: e lo SFONDO a tutto schermo della
          pagina Mondo (Luca: «invece di integrarlo»). La testata, le schede e
          la ricerca qui sotto gli fluttuano sopra: una sola chrome, quella di
          BarTalk. Sta nella scheda "Per te"; nelle altre le liste lo coprono. */}
      {/* b.363 — IL PIANETA NON SPARISCE PIU. Prima al primo carattere
          digitato veniva smontato (e ricaricato da zero all'uscita); poi
          veniva solo nascosto — ma sparire e sparire. Ora resta acceso
          mentre si cerca: la ricerca gli galleggia sopra.
          E c'e anche in News: era il pianeta di Mondo, non della sola
          scheda Stanze (Luca: «la pagina news dovrebbe avere anche lei il
          mondo e non ce l'ha»). */}
      {/* b.476, ordine di Luca: «mantieni il mondo solo per il tab mondo,
          mentre in stanze e news lasci lo sfondo normale dell'applicazione».
          Il pianeta stava dietro TUTTE E DUE le schede, e sotto di lui gli
          elenchi avevano bisogno di un velo per restare leggibili: si
          pagava un pianeta che nessuno stava guardando con la leggibilita
          di quello che invece si stava leggendo.
          Adesso il pianeta ha una scheda sua — dove e la cosa da guardare —
          e le altre due hanno il fondo dell'applicazione, come ogni altra
          pagina di elenchi. Del pianeta non e stato toccato niente: stessi
          file, stesse animazioni, stesso cielo. E' cambiato solo DOVE
          compare. */}
      {tab === 'mondo' && (
        // b.505, ordine di Luca: «fai in modo che ci sia un layer solo —
        // la luna e il sole non funzionano». Questo wrapper dichiarava
        // la quota zero — position piu z-index creano uno STACKING CONTEXT,
        // una gabbia: la luna e il suo menu (fixed, quota 80/81) per
        // quanto alti restavano composti dentro il contesto a quota
        // zero, sotto la testata (6) e gli elenchi — visibili ma non
        // cliccabili. Un fixed non scappa dalla gabbia del suo avo.
        // Senza z-index il wrapper non fa contesto; il pianeta resta
        // comunque sotto perche il contenitore interno di GloboMondo la
        // quota zero ce l'ha gia.
        <div style={{ position: 'absolute', inset: 0 }}>
          <GloboMondo sfondo paese={paeseScelto} rotte={rotteVere} traffico={trafficoPaesi}
            titolo={L('worldNowTitle')} etichettaCielo={L('skyOfPlanet')}
            // b.383 — toccare un paese sul pianeta adesso FILTRA le liste.
            // Prima lo zoom ci andava sopra e sotto restava il mondo
            // intero: il gesto piu naturale che c'e su un mappamondo non
            // faceva niente.
            // b.386 — ERRORE MIO DI UN'ORA FA: mettevo il filtro lingua a
            // `null`, e il filtro confronta con 'all' per dire "tutte" —
            // quindi toccare il globo SVUOTAVA l'elenco delle stanze
            // invece di filtrarlo.
            //
            // E le stanze portano la LINGUA, non il luogo. L'unico modo
            // onesto di avvicinarsi al "mostrami le stanze di qui" e la
            // lingua che in quel paese si parla; se non la conosciamo si
            // lasciano tutte, che e meglio di nessuna.
            onPaeseScelto={(code) => {
              setPaeseScelto(code);
              setLangFilter(code ? (linguaDelPaese(code) || 'all') : 'all');
            }} />
          {/* b.367 — «IL PROTAGONISTA NON E' IL GLOBO» (Luca). Era vero
              alla lettera: il pianeta prendeva mezza pagina in pieno
              contrasto e gli elenchi restavano schiacciati sotto. Un velo
              lo manda dietro — si vede ancora, gira ancora, ma smette di
              gridare. Non e stato tolto niente: e cambiato chi comanda. */}
          {/* b.398 — IL VELO SI CHIUDE MENTRE SCENDI. Prima era fisso: il
              pianeta restava uguale sotto i contenuti che gli passavano
              sopra. Ora piu si scende piu il velo si fa fitto, finche il
              globo non e piu li — «il globo e la porta; una volta scelto
              il Paese i contenuti lo coprono e lo trasformano in
              contesto». Nessuna animazione nuova sul globo: si muove solo
              il velo che gli sta davanti. */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            // b.400 — IL VELO ERA DIVENTATO UN COPERCHIO (collaudo di Luca:
            // «hai reso tutto piu scuro dell'originale»). A riposo partiva
            // da 0.42 e chiudeva a 0.86: sopra la Terra notturna, che e gia
            // quasi nera, il pianeta spariva. Il velo serve a far comandare
            // gli elenchi, non a spegnere il globo: a riposo ora si vede, e
            // si chiude solo mentre si scende (il comportamento di b.398
            // resta, cambiano i numeri).
            background: `linear-gradient(180deg, rgba(5,7,15,${0.16 + discesa * 0.72}) 0%, rgba(5,7,15,${0.30 + discesa * 0.66}) 42%, rgba(5,7,15,${0.48 + discesa * 0.50}) 100%)`,
            transition: 'background 160ms linear',
          }} />
          {/* b.399 — «136 persone attive · 8 stanze · 12 temi», nelle
              parole del documento. Sta SOPRA il pianeta e non in colonna:
              cosi comparire non sposta di un pixel quello che stai gia
              leggendo. Sparisce da solo mentre scendi, insieme al globo:
              e il cartello del posto in cui sei entrato, non un pezzo
              della pagina.
              Un numero che non sappiamo NON diventa zero: sparisce. Zero
              e un'affermazione — «non c'e nessuno» — e dirla senza
              saperla e proprio quello che il documento vieta. */}
          {paeseScelto && schedaPaese && discesa < 0.6 && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '52%', pointerEvents: 'none',
              display: 'flex', justifyContent: 'center',
              opacity: 1 - (discesa / 0.6), transition: 'opacity 160ms linear',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                borderRadius: 999, background: 'rgba(6,9,18,0.62)',
                border: `1px solid ${C.cardBorder}`, backdropFilter: 'blur(10px)',
                fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: C.textSecondary,
                maxWidth: '92%', flexWrap: 'wrap', justifyContent: 'center',
              }}>
                {/* Il separatore si mette FRA i pezzi che ci sono, non
                    davanti a ognuno: con le persone e le stanze a zero,
                    attaccarlo a ciascuno lasciava un puntino orfano in
                    testa alla riga. Visto dal vivo. */}
                {(() => {
                  const pezzi = [];
                  if (Number.isFinite(schedaPaese.persone) && schedaPaese.persone > 0) pezzi.push(`${schedaPaese.persone} ${L('inRoomWord')}`);
                  if (Number.isFinite(schedaPaese.stanze) && schedaPaese.stanze > 0) pezzi.push(`${schedaPaese.stanze} ${L('tabRooms')}`);
                  if (Number.isFinite(schedaPaese.temi) && schedaPaese.temi > 0) pezzi.push(`${schedaPaese.temi} ${L('topicsWord')}`);
                  // Se qui non c'e niente da dire, si dice quello: un
                  // riquadro vuoto sembra un guasto, non una piazza calma.
                  if (!pezzi.length) return <span style={{ color: C.textMuted }}>{L('quietHereNow')}</span>;
                  return <span>{pezzi.join(` ${PUNTO} `)}</span>;
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* b.363 — LA LINGUETTA DEL PANNELLO, sul bordo sinistro: si vede
          sempre, dice da che parte si apre, e non copre il mondo. Dentro
          ci sono la ricerca e i filtri di questa sezione. */}
      {!cercando && !strumenti && (
        <LinguettaPannello onApri={() => setStrumenti(true)} C={C}
          etichetta={tab === 'news' ? L('tabNews') : tab === 'mondo' ? L('worldNowTitle') : L('searchRooms')} />
      )}

      {/* ═══ TESTATA (Luca): solo il testo e l'icona della scheda al centro,
          con la freccia a sinistra e a destra che scorrono le schede. Sopra
          l'area di ricerca. Le icone sono quelle in acciaio. ═══ */}
      {/* b.367 — LA TESTATA DIMAGRISCE. Qui stavano un'icona da 62 pixel
          e due frecce: quasi novanta pixel di altezza spesi per dire in
          che sezione sei, in cima a una pagina che deve essere fatta di
          elenchi. Ora resta il nome, e la scelta della sezione e scesa
          in fondo, dove arriva il pollice (vedi la tendina sotto). */}
      {/* b.482 — LA TESTATA RIENTRA DI VENTI, come ogni altra schermata.
          Erano sedici: passando da una pagina all'altra il contenuto
          saltava di quattro punti di lato, e quel salto si vede anche da
          chi non saprebbe dire cosa e cambiato. */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px 4px', flexShrink: 0, position: 'relative', zIndex: 6,
      }}>
        {/* b.370 — IL SELETTORE TORNA IN ALTO. L'avevo messo in fondo
            perche Luca aveva chiesto «tendina sotto»: ma li sotto
            finisce contro la barra di sistema e sotto il menu, e una
            tendina che si apre meta coperta non e una tendina. Qui in
            testata occupa la riga che c'era gia — nessuna altezza in
            piu rubata agli elenchi, che era il motivo per cui l'avevo
            spostata. */}
        {/* b.433 — DUE LINGUETTE AL POSTO DELLA TENDINA (layout completo,
            pagina 02). Erano due voci dentro una tendina col triangolino:
            per sapere che esisteva anche l'altra bisognava aprirla, e per
            passarci due tocchi invece di uno. Sono due, si vedono tutte e
            due, si cambia con un tocco. La tendina serve quando le voci
            sono tante; con due e solo un coperchio.
            L'icona resta sull'opzione, dov'era: accanto alla parola. */}
        <div role="tablist" aria-label={L('worldNowTitle')} style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {[
            { id: 'stanze', parola: L('tabRooms'), icona: 'chat', conto: rooms?.length || null },
            { id: 'news', parola: L('tabNews'), icona: 'doc', conto: null },
            // b.476 — la terza scheda: il pianeta. Prima faceva da sfondo a
            // tutte e due le altre senza essere di nessuna; adesso e sua.
            { id: 'mondo', parola: L('worldNowTitle'), icona: 'globe', conto: null },
          ].map((v) => {
            const acceso = tab === v.id;
            return (
              <button key={v.id} role="tab" aria-selected={acceso}
                onClick={() => { vibrate(6); setTab(v.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, height: 44, padding: '0 14px',
                  border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT,
                  fontSize: 14.5, fontWeight: 600, color: acceso ? C.accent : C.textMuted,
                  borderBottom: `2px solid ${acceso ? C.accent : 'transparent'}`,
                }}>
                <Icon name={v.icona} size={16} color={acceso ? C.accent : C.textMuted} />
                {v.parola}
                {v.conto ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{v.conto}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {/* b.398 — DOVE SEI, E COME USCIRNE. Dal documento di Luca: quando
            il globo non si vede piu «rimane un header sticky» col Paese e
            un «Cambia» che riporta al pianeta. Finora, scelto un Paese,
            non c'era piu nessun modo di dire «tutti»: bisognava ritoccare
            lo stesso Paese sul globo, che e un interruttore, oppure
            rimettere «Tutte» in una tendina dentro un pannello laterale.
            Sta nella riga della testata che c'era gia: nessuna altezza in
            piu tolta agli elenchi. E ad altezza fissa — quando il Paese
            non c'e resta il vuoto, non si sposta niente. */}
        {/* b.400 — LA LUNA NON SI POTEVA CLICCARE (collaudo di Luca:
            «a destra in alto si sovrappongono elementi», «la luna e il
            sole non si possono cliccare, sono in un layer diverso»).
            Il comando del cielo sta nella fila fissa in alto a destra;
            questo selettore invece e nel flusso della testata e largo
            fino a 190: gli finiva sopra, coprendo la parola e rubandogli
            il tocco. Ora la testata TIENE LIBERA la colonna dove vive la
            fila fissa — la misura la da il righello, non un numero a mano. */}
        {/* b.478 — la colonna a destra adesso ha DUE inquilini, la pila e la
            luna: se ne riserva uno solo, la testata finisce sotto la
            seconda. Il conto lo fa il righello, non io. */}
        {/* b.482 — DUE COSE IN QUESTO ANGOLO. Il tasto del Paese diventa
            alto quarantaquattro: sotto quella misura un dito comincia a
            sbagliare bersaglio, e questo e il tasto con cui si esce da un
            Paese. La testata non si alza di un pixel — la sua altezza la
            danno le linguette, che sono gia a 44.
            E il mondo intero non si disegna piu con un'emoji: a schermo
            vanno le icone del sistema, che sono uguali su ogni apparecchio,
            non i caratteri illustrati del telefono, che cambiano faccia da
            un telefono all'altro. */}
        <div style={{ marginLeft: 'auto', marginRight: riservaADestra(2), minHeight: 30, display: 'flex', alignItems: 'center' }}>
          {/* b.504 — M1, col Mondo finalmente guardato con Luca: «il
              Paese e una PILLOLA, non una freccia». Via il «Cambia ›»:
              si tocca la pillola e si apre il pannello, dove il posto da
              cui guardare (mondoPaese) c'e gia. E accanto, l'AGGIORNA e
              un'icona in testata: si tocca mentre si guarda l'elenco,
              che e quando viene voglia di aggiornarlo. */}
          <button onClick={() => { vibrate(8); handleRefresh(); }}
            aria-label={L('retryWord')} title={L('retryWord')}
            style={{ width: 44, height: 44, borderRadius: 12, marginRight: 6, flexShrink: 0,
              cursor: 'pointer', background: 'none', border: `1px solid ${C.cardBorder}`,
              color: C.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="refresh" size={16} color={C.textMuted} />
          </button>
          {paeseScelto ? (
            <button onClick={() => { vibrate(8); setStrumenti(true); }}
              aria-label={nomePaese(paeseScelto)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '5px 12px',
                borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                background: C.card, border: `1px solid ${C.cardBorder}`,
                color: C.textPrimary, fontSize: 12.5, fontWeight: 600,
                maxWidth: 190, whiteSpace: 'nowrap', overflow: 'hidden',
              }}>
              <span style={{ fontSize: 15 }}>{bandieraPaese(paeseScelto)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomePaese(paeseScelto)}</span>
            </button>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: C.textMuted, whiteSpace: 'nowrap' }}>
              <Icon name="globe" size={14} color={C.textMuted} />
              {L('wholeWorld')}
            </span>
          )}
        </div>
      </header>

      {/* ═══ b.355 — LA RICERCA, una sola, per tutto il Mondo ═══
          b.361 — CENTRATA e non a tutta larghezza (regola di Luca).
          b.363 — E ORA STA DIETRO L'ICONA IN ALTO A SINISTRA. Sopra il
          pianeta galleggiavano un campo di ricerca, una fila di modi, una
          fila di categorie: strumenti sempre accesi che coprivano meta
          mondo anche quando nessuno li stava usando. Ora si aprono
          toccando la porta (o il giornale, in News) e si richiudono.
          Scende anche di 18 pixel: attaccata al titolo sembrava parte
          della testata, staccata si legge come una cosa appoggiata sopra
          il pianeta. */}
      {/* in News il pannello lo riempie MondoNews coi suoi strumenti */}
      {/* b.476 — il pannello vale per la scheda in cui si sta: Stanze ha i
          suoi filtri, e le altre due il loro. Prima era legato alla sola
          Stanze, quindi da News e da Mondo la linguetta si apriva su niente. */}
      <PannelloLaterale aperto={strumenti && (tab === 'stanze' || tab === 'mondo')} onChiudi={() => setStrumenti(false)}
        titolo={L('tabRooms')} C={C}>
      {/* b.504 — M2, col Mondo guardato con Luca: il pannello e SOLO
          preferenze. La RICERCA e andata NELLA PAGINA (M1: si cerca dove
          si guarda, non dietro una porta che nessuno apre per cercare). */}
      {/* b.397 — DA QUI ARRIVAVA UNA LINGUA TRAVESTITA DA PAESE. Scegliendo
          una lingua dal filtro si mandava in giro il suo codice in maiuscolo
          come se fosse un Paese: «en» diventava «EN», che non e nessun posto
          sulla Terra. Sei lingue su dodici sbagliate — inglese, cinese,
          giapponese, portoghese, arabo, coreano — e le altre sei giuste solo
          per combinazione, perche li il codice della lingua e quello del
          Paese coincidono. Quel finto Paese andava al globo, che non sapeva
          dove avvicinarsi, e alle News, che filtravano su un Paese che non
          esiste e restavano vuote. La conversione vera esisteva gia. */}
      {/* b.363 — DUE TENDINE al posto di due file di pillole: la lingua e
          il tipo di stanza sono scelte SINGOLE, e una fila di bottoni che
          va a capo prometteva il contrario. Ognuna dice quante stanze ci
          sono dietro, cosi si sceglie prima di toccare. */}
      {/* b.504 — M2: VIA il filtro LINGUA. In un'applicazione che traduce
          tutto, filtrare per lingua rimette la barriera che l'applicazione
          toglie; quello che serve e la ZONA — da dove guardo il mondo — e
          sta qui sotto, in mondoPaese (b.363/b.397, che gia raccontava i
          guai della lingua travestita da Paese). */}
      {availableModes.length > 2 && (
        <Scelta C={C}
          etichetta={L('roomTypeWord')}
          valore={modeFilter}
          opzioni={availableModes.map((m) => ({
            valore: m,
            etichetta: m === 'all' ? L('filterAllVoices') : (nomeModalita(MODE_LABELS[m], L) || m),
            conto: m === 'all' ? rooms.length : rooms.filter((r) => r.mode === m).length,
          }))}
          onCambia={setModeFilter} />
      )}

      <div style={{ height: 1, background: C.cardBorder, margin: '6px 0 16px' }} />
      <PreferenzeMondo C={C} bandieraMia={bandieraPaese(paeseDaLingua(prefs?.lang))} />
      </PannelloLaterale>

      {/* ═══ b.361 — I RISULTATI DELLA RICERCA come POPUP centrata sul globo
          (collaudo di Luca: «deve essere una popup in primo piano senza
          eliminare lo sfondo»): un pannello stretto, in mezzo, col pianeta
          che resta dietro. Larghezze rispettate. ═══ */}
      {cercando && risultati && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '4px 20px', pointerEvents: 'none' }}>
          <div style={{ width: '100%', maxWidth: 420, maxHeight: '68vh', overflowY: 'auto', scrollbarWidth: 'none', pointerEvents: 'auto', background: C.card, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: `1px solid ${C.cardBorder}`, borderRadius: 18, padding: '14px 20px', boxShadow: '0 24px 60px -14px rgba(0,0,0,0.65)' }}>

            {risultati.paesi.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>{L('searchCountriesLangs')}</div>
              {/* b.363 — scegliendo di qui, il PIANETA ci va sopra: il codice
                  viaggia al globo e parte lo zoom che sa gia fare da se */}
              {risultati.paesi.map((l) => (
                <button key={l.code} onClick={() => { setLangFilter(l.code); setPaeseScelto(paeseDaLingua(l.code)); setSearch(''); setTab('stanze'); }}
                  style={{ width: '100%', minHeight: 44, textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{l.flag}</span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.textPrimary }}>{l.name}</span>
                  {l.vive > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: C.accent }}>
                      <span style={{ width: 7, height: 7, borderRadius: 4, background: C.accent, boxShadow: `0 0 8px ${C.accent}` }} />
                      {l.vive}
                    </span>
                  )}
                  <span style={{ color: C.textMuted }}>›</span>
                </button>
              ))}
            </>)}

            {risultati.stanze.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.textMuted, margin: '14px 0 8px' }}>{L('liveRoomsNow')}</div>
              {risultati.stanze.map((r) => (
                <button key={r.roomId} onClick={() => onJoinRoom?.(r.roomId)}
                  style={{ width: '100%', minHeight: 44, textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{r.membri} {L('inRoomWord')}{r.lang ? ` · ${getLangFlag(r.lang)} ${getLangName(r.lang)}` : ''}</div>
                </button>
              ))}
            </>)}

            {risultati.discussioni.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.textMuted, margin: '14px 0 8px' }}>{L('trendNow')}</div>
              {risultati.discussioni.map((d, i) => (
                <button key={d.id || i} onClick={() => { setSearch(''); setTab('news'); setApriDiscussione(d.id || null); }}
                  style={{ width: '100%', minHeight: 44, textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titolo}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{d.commenti} {L('commentsWord')}{d.topic ? ` · ${d.topic}` : ''}</div>
                </button>
              ))}
            </>)}

            {/* b.363 — se l'elenco delle discussioni e caduto lo si dice qui,
                invece di far passare il guasto per un mondo silenzioso. */}
            {feedCaldoGuasto && (
              <button onClick={() => { setFeedCaldoGuasto(false); setRiprovaCaldo((n) => n + 1); }}
                style={{ width: '100%', minHeight: 44, margin: '10px 0', padding: '10px 12px', borderRadius: 12, background: 'none',
                  border: `1px solid ${C.cardBorder}`, color: C.textMuted, fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>
                {L('newsError')} · {L('retryWord')}
              </button>
            )}

            {risultati.paesi.length === 0 && risultati.stanze.length === 0 && risultati.discussioni.length === 0 && (
              <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '30px 0', lineHeight: 1.6 }}>
                {L('searchNothing')}<br />{L('searchOpenFirst')}
              </div>
            )}
          </div>
        </div>
      )}


      {/* ═══ TAB NEWS ═══ */}
      {/* b.365 — QUI NON SI SCORRE PIU. Da quando il pannello si
          RIBALTA per leggere un articolo, lo scorrimento deve stare
          DENTRO la faccia che si vede: se restasse qui, girando il
          foglio l'elenco perderebbe il segno e l'articolo si
          troverebbe gia a meta pagina. */}
      {tab === 'news' && !cercando && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 5 }}>
          {/* b.324 — audit Mondo D8: su schermo largo il contenuto andava a
              tutta larghezza; ora sta nella colonna centrata (regola di Luca,
              gia standard in Life). */}
          <div style={{ ...COLONNA, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <MondoNews strumenti={strumenti} suChiudiStrumenti={() => setStrumenti(false)} apriDiscussioneId={apriDiscussione} suApertaDiscussione={() => setApriDiscussione(null)} paeseDalGlobo={paeseScelto}
              // b.398 — e il ritorno: la bandiera toccata dentro le News
              // risale fin qui, e da qui va al pianeta e alle Stanze.
              suPaeseScelto={(codice) => { setPaeseScelto(codice); setLangFilter(codice ? (linguaDelPaese(codice) || 'all') : 'all'); }}
              suScorrimento={seguiScorrimento}
              temaDaFuori={temaDaMondo}
              suTemaLetto={() => setTemaDaMondo(null)}
              C={C} onJoinRoom={onJoinRoom} onParlane={onParlane} />
          </div>
        </div>
      )}

      {/* ═══ LANGUAGE PILLS ═══ */}
      {/* ═══ ROOM LIST ═══ */}
      {/* b.364 — SOVRAPPOSIZIONE (segnalata da Luca con lo schermo):
          la scheda News si nascondeva durante la ricerca, l'elenco delle
          stanze NO. Cosi cercando restavano disegnati tutti e due: la
          popup dei risultati sopra, le stanze sotto, mescolate. */}
      {/* b.402 — LA SFUMATURA CHE UNISCE PIANETA E CONTENUTI. Dal
          documento di Luca: «una sfumatura verticale collega il globo al
          contenuto» e «la superficie contenuti sale progressivamente e
          copre il globo». Finora il bordo era netto: le schede spuntavano
          dal nulla a meta pianeta, tagliate di netto. Questa fascia sta
          fra i due e non prende tocchi: e solo il punto in cui il globo
          finisce e la pagina comincia. Si fa piu decisa mentre scendi,
          insieme al velo, cosi il passaggio segue il gesto. */}
      {/* b.476 — il velo in cima serviva a staccare gli elenchi DAL PIANETA.
          Senza pianeta dietro non stacca piu niente: sarebbe un'ombra sopra
          una pagina normale. Resta solo dove il pianeta c'e. */}
      {tab === 'mondo' && !cercando && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: 96,
          pointerEvents: 'none', zIndex: 4,
          background: `linear-gradient(180deg, rgba(5,7,15,${0.22 + discesa * 0.68}) 0%, rgba(5,7,15,0) 100%)`, // b.400 — stessa cura del velo grande
          transition: 'background 160ms linear',
        }} />
      )}

      {tab === 'stanze' && !cercando && (
      // b.206 — bottom alzato: le ultime stanze finivano sotto la BottomNav (76px)
      // b.361 — IL GLOBO SI TRASCINA sotto la lista (collaudo di Luca): la
      // colonna non ruba i tocchi (pointerEvents none), solo le card e i
      // pulsanti veri li riprendono.
      // b.482 — l'elenco rientra di venti come la testata: erano sedici,
      // e il contenuto si spostava di lato passando da una scheda all'altra.
      <div onScroll={seguiScorrimento} style={{ flex: 1, overflowY: 'auto', padding: '4px 20px calc(106px + env(safe-area-inset-bottom))', scrollbarWidth: 'none', pointerEvents: 'none' }}>
        {/* b.324 — D8: colonna centrata anche qui. */}
        <div style={{ ...COLONNA, pointerEvents: 'auto' }}>

        {/* b.401 — «IL PAESE DISCUTE», dal documento di Luca. Entrando in
            un Paese non basta dire quanti temi ci sono: va detto QUALI, e
            devono essere toccabili — e il modo naturale di passare da
            «sono in Giappone» a «vediamo cosa dicono dello yen».
            Sono i temi VERI delle discussioni aperte li, in ordine di
            quante ce ne sono: nessuna classifica di importanza, nessun
            giudizio nostro. Compare solo quando c'e qualcosa da dire, e
            sta sopra l'elenco senza spingerlo: quando non c'e, non
            occupa nulla. */}
        {paeseScelto && schedaPaese?.temiCaldi?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>
              {L('talkedAboutHere')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {schedaPaese.temiCaldi.map((t) => (
                <button key={t.topic}
                  onClick={() => { vibrate(8); setTemaDaMondo(t.topic); setTab('news'); }}
                  style={{
                    // b.482 — alta 44: e una pillola, ma si tocca, e cio
                    // che si tocca deve stare sotto un dito. Il testo
                    // dentro non cambia misura.
                    display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '7px 12px',
                    borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                    background: C.card, border: `1px solid ${C.cardBorder}`,
                    color: C.textPrimary, fontSize: 12.5, fontWeight: 600,
                  }}>
                  <span>{t.topic}</span>
                  <span style={{ color: C.textMuted, fontWeight: 600 }}>{t.discussioni}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* b.363 — ECCO LE CARD FANTASMA CHE LUCA VEDEVA A OGNI APERTURA DI
            MONDO. Erano quattro rettangoli finti alti 80 pixel, con il velo
            bianco luccicante: uno scheletro di caricamento nato quando la
            pagina ERA la lista delle stanze. Da quando la pagina e il PIANETA,
            quei quattro riquadri si disegnano SOPRA il globo — mezzo mondo
            coperto da schede vuote a ogni ricarico, per tutto il tempo del
            caricamento. Non e uno sfondo che traspare: sono loro.
            Sul pianeta non si mette nessuno scheletro: le stanze arrivano
            nella tendina in basso, e finche non ci sono non si mostra niente. */}

        {/* Error */}
        {error && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>
            <button onClick={handleRefresh} style={{
              minHeight: 44, padding: '8px 20px', borderRadius: 12,
              background: `${C.accent}15`, border: `1px solid ${C.accent}25`,
              color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            }}>
              {L('retryWord')}
            </button>
          </div>
        )}

        {/* Empty state — no rooms at all */}
        {!loading && !error && rooms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
              border: `1px solid ${C.accent}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
            }}><Icon name="globe" size={34} color={C.accent || 'rgba(255,255,255,0.4)'} /></div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
              {L('noRoomsYet')}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, maxWidth: 260, margin: '0 auto 20px' }}>
              {L('createPublicRoomDesc')}
            </div>
            <button onClick={onCreateRoom || (() => setView('home'))} style={{
              minHeight: 44, padding: '12px 28px', borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FONT,
              boxShadow: `0 4px 20px ${C.accent}35`,
            }}>
              {L('createBarTalk')}
            </button>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && rooms.length > 0 && filteredRooms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            {/* b.363 — qui c'era un riquadro alto 36 pixel con dentro NIENTE:
                il posto di un'icona tolta, che spingeva in basso il testo
                senza mostrare nulla. */}
            <Icon name="search" size={28} color={C.textMuted} />
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
              {L('noRoomsFilters')}
            </div>
            <button onClick={() => { setSearch(''); setLangFilter('all'); setModeFilter('all'); }} style={{
              minHeight: 44, padding: '7px 18px', borderRadius: 10,
              background: 'none', border: `1px solid ${C.cardBorder}`,
              color: C.textSecondary, fontSize: 11, cursor: 'pointer', fontFamily: FONT,
            }}>
              {L('resetFilters')}
            </button>
          </div>
        )}

        {/* Room cards */}
        {/* b.363 — L'AVVISO SULLA RISERVATEZZA, UNA VOLTA SOLA. Stava
            ripetuto identico dentro OGNI scheda: una cosa vera, detta
            trenta volte di fila, smette di essere letta e diventa rumore
            che allontana lo sguardo da cio che serve per scegliere.
            Qui vale per tutte le stanze dell'elenco. */}
        {/* b.504 — M1: «Aperte adesso» — le stanze VIVE hanno la loro
            etichetta, come sulla tavola. */}
        {filteredRooms.length > 0 && (
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.1, textTransform: 'uppercase', color: C.textMuted, margin: '2px 0 6px' }}>
            {L('openNowWord')}
          </div>
        )}
        {filteredRooms.length > 0 && (
          <div style={{ fontSize: 10.5, color: C.textMuted, opacity: 0.85, padding: '0 4px 8px', lineHeight: 1.5 }}>
            {L('openRoomNotice')}
          </div>
        )}

        {/* b.363 — LA STESSA GRAMMATICA DI NEWS (vedi lib/schedaMondo.js).
            Prima questa scheda aveva cinque righe impilate — nome, cinque
            distintivi, chi ospita, l'avviso sulla riservatezza, la
            descrizione, i conteggi — e l'avviso era ripetuto identico su
            OGNI stanza, che e rumore: una cosa vera detta trenta volte
            smette di essere letta. Ora l'avviso sta una volta in cima
            all'elenco, e la scheda dice quello che serve per decidere:
            da dove si parla, di che tipo e, quanto e fresca, chi ospita,
            e quanta gente c'e dentro. Restano in evidenza i due avvisi
            che vanno visti PRIMA di entrare: si bussa, e si litiga. */}
        {filteredRooms.map((room, idx) => {
          const modeInfo = MODE_LABELS[room.mode] || { label: room.mode, icon: '', color: PALETTE.teal };
          const eta = quando(room.createdAt, L);
          const dentro = viva(room.membri ?? room.memberCount, 4);
          const eti = stileEtichetta(C);
          // b.482 — IL FONDO DELLA SCHEDA VIENE DAL TEMA. Era un blu quasi
          // nero scritto a mano: serviva a restare leggibile sopra il
          // pianeta, che da b.476 non sta piu dietro questo elenco. Sul
          // tema chiaro quel fondo restava notturno mentre il testo si
          // faceva scuro, cioe scritta scura su scheda scura. Ora e il
          // colore delle schede, lo stesso di tutte le altre.
          return (
            <button key={room.roomId} onClick={() => onJoinRoom(room.roomId)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%',
                minHeight: 44, padding: 12, marginBottom: 8,
                background: C.card, border: `1px solid ${C.cardBorder}`,
                borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: FONT,
                WebkitTapHighlightColor: 'transparent',
                animation: `vtSlideUp 0.3s ease-out ${idx * 0.05}s both`,
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 1. DA DOVE, DI CHE TIPO, QUANDO */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                  {/* b.363 — LA LINGUA, col suo nome. Ridisegnando la scheda
                      avevo lasciato la sola bandiera: ma una bandiera non e
                      una lingua (in Brasile e in Portogallo si parla la
                      stessa, in Svizzera quattro diverse), e su un'app di
                      traduzione la lingua che si parla dentro e cio che
                      decide se puoi parlarci. */}
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{getLangFlag(room.hostLang || room.lang)}</span>
                  <span style={eti}>{getLangName(room.hostLang || room.lang)}</span>
                  <span style={{ ...eti, opacity: 0.5 }}>{PUNTO}</span>
                  <span style={{ ...eti, color: modeInfo.color }}>{nomeModalita(modeInfo, L)}</span>
                  {eta && <><span style={{ ...eti, opacity: 0.5 }}>{PUNTO}</span><span style={eti}>{eta}</span></>}
                  {/* si bussa e l'host apre: dirlo PRIMA che uno tocchi,
                      altrimenti sembra una stanza che non risponde */}
                  {/* b.482 — l'ambra e quella della tavolozza: il colore
                      scritto a mano che le stava accanto non e mai stato
                      usato, ma stava li pronto a diventare un secondo
                      giallo il giorno che la tavolozza cambiasse. */}
                  {room.suApprovazione && (
                    <span style={{ ...eti, color: PALETTE.amber, background: `${PALETTE.amber}18`, borderRadius: 5, padding: '1px 6px' }}>
                      {L('onApproval')}
                    </span>
                  )}
                  {/* b.111 — litigio libero: e la ragione per cui uno sceglie
                      questa stanza, o per cui gira alla larga. Scoprirlo
                      dentro sarebbe un'imboscata. */}
                  {/* b.482 — il rosso del litigio libero era scritto a
                      mano: uguale a nient'altro nell'applicazione e cieco
                      al tema. Ora e il rosso del tema. */}
                  {room.hot && (
                    <span style={{ ...eti, color: C.red, background: `${C.red}1F`, borderRadius: 5, padding: '1px 6px' }} title={L('freeFightTip')}>
                      {L('freeFight')}
                    </span>
                  )}
                </div>

                {/* 2. IL NOME: e cio che si sceglie */}
                <div style={{
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: C.textPrimary,
                }}>
                  {room.nome || room.host}
                </div>

                {/* 3. CHI OSPITA, E QUANTA GENTE C'E' DENTRO */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={eti}>{room.host}</span>
                  <span style={{ ...eti, opacity: 0.5 }}>{PUNTO}</span>
                  {/* b.482 — la stanza piena si distingue dal COLORE, non
                      dal peso: qui c'erano un 800 e un 700, cioe due
                      grassetti in una riga di etichette. */}
                  <span style={{ ...eti, color: dentro.accesa ? C.accent : C.textMuted, fontWeight: 600 }}>
                    {dentro.n}{room.maxPartecipanti ? `/${room.maxPartecipanti}` : ''} {L('insideWord')}
                  </span>
                  {room.myRole && ROLE_BADGES[room.myRole] && (
                    <span style={{ ...eti, background: ROLE_BADGES[room.myRole].bg, color: ROLE_BADGES[room.myRole].color, borderRadius: 5, padding: '1px 6px' }}>
                      {ROLE_BADGES[room.myRole].labelKey ? L(ROLE_BADGES[room.myRole].labelKey) : ROLE_BADGES[room.myRole].label}
                    </span>
                  )}
                </div>
              </div>

              {/* il pallino acceso quando la stanza e viva: si vede da lontano */}
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0, alignSelf: 'center',
                background: `${modeInfo.color}12`, border: `1px solid ${modeInfo.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: modeInfo.color, fontSize: 14, fontWeight: 600,
              }}>
                →
              </div>
            </button>
          );
        })}
        </div>
      </div>
      )}

      {/* CSS */}
      <style>{`
        /* b.363 — l'animazione del luccichio se n'e andata con lo scheletro
           che copriva il pianeta: qui non la usa piu nessuno. */
        @keyframes vtSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export default memo(MondoView);
