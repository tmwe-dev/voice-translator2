'use client';
import Icon from './Icon.js';
import { quando, viva, stileEtichetta, PUNTO, paeseDaLingua, linguaDelPaese, bandieraPaese, nomePaese } from '../lib/schedaMondo.js';
import PannelloLaterale, { LinguettaPannello } from './ui/PannelloLaterale.js';
import { COLONNA } from '../lib/righello.js';
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
  listener: { label: '', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
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
      const p = paeseDaLingua(r.hostLang || r.lang);
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
    const paesi = [...new Set(rooms.map((r) => paeseDaLingua(r.hostLang || r.lang)).filter(Boolean))];
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
      {(tab === 'stanze' || tab === 'news') && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
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
            background: `linear-gradient(180deg, rgba(5,7,15,${0.42 + discesa * 0.5}) 0%, rgba(5,7,15,${0.66 + discesa * 0.32}) 42%, rgba(5,7,15,${0.86 + discesa * 0.14}) 100%)`,
            transition: 'background 160ms linear',
          }} />
        </div>
      )}

      {/* b.363 — LA LINGUETTA DEL PANNELLO, sul bordo sinistro: si vede
          sempre, dice da che parte si apre, e non copre il mondo. Dentro
          ci sono la ricerca e i filtri di questa sezione. */}
      {!cercando && !strumenti && (
        <LinguettaPannello onApri={() => setStrumenti(true)} C={C}
          etichetta={tab === 'news' ? L('tabNews') : L('searchRooms')} />
      )}

      {/* ═══ TESTATA (Luca): solo il testo e l'icona della scheda al centro,
          con la freccia a sinistra e a destra che scorrono le schede. Sopra
          l'area di ricerca. Le icone sono quelle in acciaio. ═══ */}
      {/* b.367 — LA TESTATA DIMAGRISCE. Qui stavano un'icona da 62 pixel
          e due frecce: quasi novanta pixel di altezza spesi per dire in
          che sezione sei, in cima a una pagina che deve essere fatta di
          elenchi. Ora resta il nome, e la scelta della sezione e scesa
          in fondo, dove arriva il pollice (vedi la tendina sotto). */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px 4px', flexShrink: 0, position: 'relative', zIndex: 6,
      }}>
        {/* b.370 — IL SELETTORE TORNA IN ALTO. L'avevo messo in fondo
            perche Luca aveva chiesto «tendina sotto»: ma li sotto
            finisce contro la barra di sistema e sotto il menu, e una
            tendina che si apre meta coperta non e una tendina. Qui in
            testata occupa la riga che c'era gia — nessuna altezza in
            piu rubata agli elenchi, che era il motivo per cui l'avevo
            spostata. */}
        <div style={{ minWidth: 168 }}>
          <Scelta C={C}
            valore={tab}
            opzioni={[
              { valore: 'stanze', etichetta: L('tabRooms'), conto: rooms?.length || null },
              { valore: 'news', etichetta: L('tabNews') },
            ]}
            onCambia={(v) => { vibrate(6); setTab(v); }} />
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
        <div style={{ marginLeft: 'auto', minHeight: 30, display: 'flex', alignItems: 'center' }}>
          {paeseScelto ? (
            <button onClick={() => { vibrate(8); setPaeseScelto(null); setLangFilter('all'); }}
              aria-label={`${L('changeWord')} — ${nomePaese(paeseScelto)}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                background: C.card, border: `1px solid ${C.cardBorder}`,
                color: C.textPrimary, fontSize: 12.5, fontWeight: 700,
                maxWidth: 190, whiteSpace: 'nowrap', overflow: 'hidden',
              }}>
              <span style={{ fontSize: 15 }}>{bandieraPaese(paeseScelto)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomePaese(paeseScelto)}</span>
              <span style={{ color: C.textMuted, fontWeight: 600 }}>{L('changeWord')}</span>
              <span style={{ color: C.textMuted }}>›</span>
            </button>
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.textMuted, whiteSpace: 'nowrap' }}>
              {`\u{1F30D} ${L('wholeWorld')}`}
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
      <PannelloLaterale aperto={strumenti && tab === 'stanze'} onChiudi={() => setStrumenti(false)}
        titolo={L('tabRooms')} C={C}>
      {/* b.363 — LA RICERCA IN ALTO (ordine di Luca): e la cosa che si usa
          piu spesso e quella per cui si apre il pannello. Le preferenze,
          che si sistemano una volta sola, scendono sotto i filtri. */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%', maxWidth: 420,
          display: 'flex', alignItems: 'center', gap: 10,
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <Icon name="globe" size={14} color={C.textMuted} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={L('searchRooms')}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: C.textPrimary, fontSize: 13, fontFamily: FONT,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 16, padding: 0,
            }}>×</button>
          )}
        </div>
      </div>
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
      <Scelta C={C}
        etichetta={L('yourLang')}
        valore={langFilter}
        opzioni={[
          { valore: 'all', etichetta: L('filterAllVoices'), conto: rooms.length },
          ...LANG_FILTERS.filter((l) => l.code !== 'all').map((l) => ({
            valore: l.code,
            etichetta: `${l.flag} ${l.nameKey ? L(l.nameKey) : l.name}`,
            conto: perLingua[l.code] || 0,
          })),
        ]}
        onCambia={(v) => { setLangFilter(v); setPaeseScelto(v === 'all' ? null : paeseDaLingua(v)); }} />

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
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '4px 16px', pointerEvents: 'none' }}>
          <div style={{ width: '100%', maxWidth: 420, maxHeight: '68vh', overflowY: 'auto', scrollbarWidth: 'none', pointerEvents: 'auto', background: C.card, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: `1px solid ${C.cardBorder}`, borderRadius: 18, padding: 14, boxShadow: '0 24px 60px -14px rgba(0,0,0,0.65)' }}>

            {risultati.paesi.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>{L('searchCountriesLangs')}</div>
              {/* b.363 — scegliendo di qui, il PIANETA ci va sopra: il codice
                  viaggia al globo e parte lo zoom che sa gia fare da se */}
              {risultati.paesi.map((l) => (
                <button key={l.code} onClick={() => { setLangFilter(l.code); setPaeseScelto(paeseDaLingua(l.code)); setSearch(''); setTab('stanze'); }}
                  style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{l.flag}</span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: C.textPrimary }}>{l.name}</span>
                  {l.vive > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: C.accent }}>
                      <span style={{ width: 7, height: 7, borderRadius: 4, background: C.accent, boxShadow: `0 0 8px ${C.accent}` }} />
                      {l.vive}
                    </span>
                  )}
                  <span style={{ color: C.textMuted }}>›</span>
                </button>
              ))}
            </>)}

            {risultati.stanze.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textMuted, margin: '14px 0 8px' }}>{(L('liveRoomsNow') !== 'liveRoomsNow' ? L('liveRoomsNow') : 'STANZE VIVE ADESSO')}</div>
              {risultati.stanze.map((r) => (
                <button key={r.roomId} onClick={() => onJoinRoom?.(r.roomId)}
                  style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{r.membri} {(L('inRoomWord') !== 'inRoomWord' ? L('inRoomWord') : 'dentro')}{r.lang ? ` · ${getLangFlag(r.lang)} ${getLangName(r.lang)}` : ''}</div>
                </button>
              ))}
            </>)}

            {risultati.discussioni.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textMuted, margin: '14px 0 8px' }}>{(L('trendNow') !== 'trendNow' ? L('trendNow') : 'DI COSA SI PARLA')}</div>
              {risultati.discussioni.map((d, i) => (
                <button key={d.id || i} onClick={() => { setSearch(''); setTab('news'); setApriDiscussione(d.id || null); }}
                  style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titolo}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{d.commenti} {(L('commentsWord') !== 'commentsWord' ? L('commentsWord') : 'commenti')}{d.topic ? ` · ${d.topic}` : ''}</div>
                </button>
              ))}
            </>)}

            {/* b.363 — se l'elenco delle discussioni e caduto lo si dice qui,
                invece di far passare il guasto per un mondo silenzioso. */}
            {feedCaldoGuasto && (
              <button onClick={() => { setFeedCaldoGuasto(false); setRiprovaCaldo((n) => n + 1); }}
                style={{ width: '100%', margin: '10px 0', padding: '10px 12px', borderRadius: 12, background: 'none',
                  border: `1px solid ${C.cardBorder}`, color: C.textMuted, fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>
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
      {tab === 'stanze' && !cercando && (
      // b.206 — bottom alzato: le ultime stanze finivano sotto la BottomNav (76px)
      // b.361 — IL GLOBO SI TRASCINA sotto la lista (collaudo di Luca): la
      // colonna non ruba i tocchi (pointerEvents none), solo le card e i
      // pulsanti veri li riprendono.
      <div onScroll={seguiScorrimento} style={{ flex: 1, overflowY: 'auto', padding: '4px 16px calc(106px + env(safe-area-inset-bottom))', scrollbarWidth: 'none', pointerEvents: 'none' }}>
        {/* b.324 — D8: colonna centrata anche qui. */}
        <div style={{ ...COLONNA, pointerEvents: 'auto' }}>

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
              padding: '8px 20px', borderRadius: 12,
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
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
              {L('noRoomsYet')}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, maxWidth: 260, margin: '0 auto 20px' }}>
              {L('createPublicRoomDesc')}
            </div>
            <button onClick={onCreateRoom || (() => setView('home'))} style={{
              padding: '12px 28px', borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT,
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
              padding: '7px 18px', borderRadius: 10,
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
          return (
            <button key={room.roomId} onClick={() => onJoinRoom(room.roomId)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%',
                padding: 12, marginBottom: 8,
                background: 'rgba(11,15,28,0.94)', border: `1px solid ${C.cardBorder}`,
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
                  {room.suApprovazione && (
                    <span style={{ ...eti, color: PALETTE.amber || '#F59E0B', background: `${PALETTE.amber || '#F59E0B'}18`, borderRadius: 5, padding: '1px 6px' }}>
                      {L('onApproval')}
                    </span>
                  )}
                  {/* b.111 — litigio libero: e la ragione per cui uno sceglie
                      questa stanza, o per cui gira alla larga. Scoprirlo
                      dentro sarebbe un'imboscata. */}
                  {room.hot && (
                    <span style={{ ...eti, color: '#FF7A5C', background: 'rgba(255,90,60,0.12)', borderRadius: 5, padding: '1px 6px' }} title={L('freeFightTip')}>
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
                  <span style={{ ...eti, color: dentro.accesa ? C.accent : C.textMuted, fontWeight: dentro.accesa ? 800 : 700 }}>
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
                color: modeInfo.color, fontSize: 14, fontWeight: 700,
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
