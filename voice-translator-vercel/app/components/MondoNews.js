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
import Scelta from './ui/Scelta.js';
import { bandieraPaese, quando, tipoContenuto, fonteDi, viva, stileEtichetta, PUNTO, paeseDaLingua } from '../lib/schedaMondo.js';
import PannelloLaterale from './ui/PannelloLaterale.js';
import PreferenzeMondo from './ui/PreferenzeMondo.js';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import AnteprimaCoperta from './ui/AnteprimaCoperta.js';
import SchedaArgomento from './SchedaArgomento.js';
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

function MondoNews({ C, onJoinRoom, onParlane, apriDiscussioneId = null, suApertaDiscussione, strumenti = false, suChiudiStrumenti }) {
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
  const [scheda, setScheda] = useState(null); // { tipo: 'articolo'|'video', dati }
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
      const paramProfonda = profonda ? `&deep=1&fonti=${numFonti}` : '';
      const res = await fetch(
        `/api/topics/search?q=${encodeURIComponent(pulita)}&lang=${lingua}&cat=${cat}${fresca ? '&fresh=1' : ''}${paramProfonda}`,
        { signal: ac.signal });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let resto = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        resto += decoder.decode(value, { stream: true });
        const righe = resto.split('\n');
        resto = righe.pop();
        for (const riga of righe) {
          if (!riga.trim()) continue;
          let r; try { r = JSON.parse(riga); } catch { continue; }
          if (r.stadio === 'fine') {
            setArgomenti(r.argomenti || []);
            setStanze(r.stanze || []);
            setDaCache(!!r.daCache);
          } else if (r.stadio === 'errore') {
            setErrore('guasto');
          } else {
            const testo = descriviStadio(r);
            if (testo) setProcesso(p => [...p.slice(-5), { testo, id: p.length }]);
          }
        }
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
  }, [lingua, cercando, descriviStadio, cercaVideoPer, profonda, numFonti]);

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

  const quando = (ts) => {
    if (!ts) return '';
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return L('timeNow');
    if (min < 60) return `${min}m`;
    if (min < 1440) return `${Math.floor(min / 60)}h`;
    return `${Math.floor(min / 1440)}g`;
  };

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

  const bordo = `1px solid ${C.cardBorder}`;

  // b.149 — su un monitor largo le card diventavano lenzuola con
  // riquadri-immagine giganteschi (schermate di Luca). Le news hanno
  // il passo di un telefono: colonna centrata, mai piu larga di 680px,
  // come la Home.
  return (
    <>
    <Ribalta girato={!!(lettura || discAperta)}
      fronte={
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none' }}>
      <div style={{ padding: '0 16px 106px', fontFamily: FONT, ...COLONNA }}>

      {/* b.363 — GLI STRUMENTI STANNO DIETRO IL GIORNALE. Sopra il pianeta
          restavano accesi tre blocchi — il campo "cosa vuoi seguire", i due
          modi, la fila delle categorie — che coprivano meta mondo anche
          quando nessuno li stava usando. Ora si aprono toccando l'icona
          del giornale in alto a sinistra, e si richiudono. */}
      <PannelloLaterale aperto={strumenti} onChiudi={suChiudiStrumenti} titolo={L('tabNews')} C={C}>
      {/* b.363 — LE PREFERENZE PER PRIME (ordine di Luca). Sono le
          decisioni che valgono sempre: si sistemano una volta e poi non
          si toccano piu. Metterle in cima vuol dire che chi apre il
          pannello la prima volta le vede, invece di scoprirle in fondo
          dopo tre file di bottoni. */}
      {/* ─── Cerca + Aggiorna ─── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setChipAttiva(null); }}
          onKeyDown={e => { if (e.key === 'Enter') cerca(query); }}
          placeholder={L('newsWhatFollow')}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 14,
            background: C.input, border: bordo, outline: 'none',
            color: C.textPrimary, fontSize: 14, fontFamily: FONT,
          }} />
        <button
          onClick={() => (chipAttiva
            ? cercaChip(CATEGORIE.find(c => c.id === chipAttiva))
            : cerca(query, 'notizie', true))}
          disabled={cercando || (!query.trim() && !chipAttiva)}
          aria-label={L('newsUpdate')}
          style={{
            padding: '0 18px', borderRadius: 14, cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
            fontFamily: FONT, opacity: cercando || (!query.trim() && !chipAttiva) ? 0.5 : 1,
            WebkitTapHighlightColor: 'transparent',
          }}>
          {L('newsUpdate')}
        </button>
      </div>

      {/* b.363 — I DUE MODI SONO DIVENTATI UNA PREFERENZA (qui sopra):
          era una scelta da rifare a ogni apertura, e invece e una cosa
          che si decide una volta. Qui resta solo quante fonti leggere
          quando si va a fondo, che e un dettaglio del momento. */}
      {profonda && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT }}>{L('newsSourcesShort')}</span>
          {[3, 6, 10].map(n => (
            <button key={n} onClick={() => { setNumFonti(n); vibrate(8); }}
              style={{
                width: 30, height: 28, borderRadius: 9, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700,
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
        valore={chipAttiva || ''}
        opzioni={[
          { valore: '', etichetta: L('allTopicsWord') },
          ...CATEGORIE.map((c) => ({ valore: c.id, etichetta: L(c.labelKey) })),
        ]}
        onCambia={(v) => {
          if (!v) { setChipAttiva(null); return; }
          const c = CATEGORIE.find((x) => x.id === v);
          if (c) cercaChip(c);
        }} />


      <div style={{ height: 1, background: C.cardBorder, margin: '6px 0 16px' }} />
      <PreferenzeMondo C={C} bandieraMia={bandieraPaese(paeseDaLingua(prefs?.lang))} />
      </PannelloLaterale>

      {/* ─── Il pannello COBRA: il lavoro si vede ─── */}
      {(cercando || (processo.length > 0 && argomenti === null)) && (
        <div style={{
          margin: '6px 0 12px', padding: '12px 14px', borderRadius: 14,
          background: C.card, border: bordo,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 4, background: C.accent,
              animation: 'vtPulse 1.2s infinite ease-in-out',
            }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: C.accent }}>
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
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>
            {L('newsTalkingRooms')}
          </div>
          {stanze.map(s => (
            <button key={s.roomId} onClick={() => { vibrate(10); onJoinRoom?.(s.roomId); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', marginBottom: 6, borderRadius: 12, cursor: 'pointer',
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
      {feedGuasto && (!feed || feed.length === 0) && (
        <button onClick={() => { vibrate(8); setFeedGuasto(false); setRiprova(n => n + 1); }}
          style={{
            width: '100%', marginBottom: 16, padding: '12px 14px', borderRadius: 12,
            background: 'none', border: `1px solid ${C.border || 'rgba(255,255,255,0.12)'}`,
            color: C.textMuted, fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
          }}>
          {L('newsError')} · {L('retryWord')}
        </button>
      )}

      {/* ─── b.187 · Feed delle discussioni pubbliche persistenti ─── */}
      {feedMostrato.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
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
              // b.365 — L'IMMAGINE COMANDA (ordine di Luca). Misurate le
              // foto che Cobra porta a casa: 1400x933 e 1218x762. Erano
              // vere fotografie, e le stavamo spegnendo dentro un
              // francobollo da 62 pixel accanto al testo. Ora prendono
              // tutta la larghezza, in 16:9, e sono la prima cosa che
              // l'occhio incontra — come su qualunque giornale.
              return (
                <article key={d.id} style={{
                  marginBottom: 12, borderRadius: 16, overflow: 'hidden',
                  background: 'rgba(11,15,28,0.94)', border: bordo, fontFamily: FONT,
                }}>
                  <button onClick={() => {
                      vibrate(8);
                      // b.363 — quello che uno APRE vale piu di quello che
                      // dichiara: si tiene il conto, e ordina il prossimo giro.
                      if (d.topic && savePrefs) savePrefs(segnaApertura(prefs, d.topic));
                      // b.365 — leggere l'articolo RIBALTA l'elenco; se non
                      // c'e un articolo da leggere si apre la discussione.
                      if (leggibile) setLettura({ url: d.media.url, titolo: d.title, fonte });
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
                        fontSize: 34, fontWeight: 800, color: `${C.accent}55`, letterSpacing: 1,
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
                          }}>&#9654;</span>
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
                            onClick={(e) => { e.stopPropagation(); vibrate(6); setPaeseFiltro(paeseFiltro === d.country ? null : d.country); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setPaeseFiltro(paeseFiltro === d.country ? null : d.country); } }}
                            style={{
                              fontSize: 14, lineHeight: 1, cursor: 'pointer', borderRadius: 5,
                              padding: '2px 4px', background: 'rgba(6,9,18,0.6)',
                              outline: paeseFiltro === d.country ? `1px solid ${C.accent}` : 'none',
                            }}>{bandiera}</span>
                        )}
                        {d.topic && (
                          <span style={{
                            ...eti, background: 'rgba(6,9,18,0.6)', borderRadius: 5, padding: '2px 6px',
                            color: 'rgba(226,236,252,0.9)',
                          }}>{d.topic}</span>
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
                    <span style={{ display: 'block', padding: '10px 12px 8px' }}>
                      <span style={{
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', fontSize: 15, fontWeight: 700, lineHeight: 1.35,
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
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px 10px', borderTop: bordo,
                  }}>
                    <button onClick={() => { vibrate(6); setDiscAperta(d.id); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px',
                        borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 12,
                        background: 'rgba(255,255,255,0.045)', border: bordo,
                        color: vita.accesa ? C.accent : C.textMuted,
                        fontWeight: vita.accesa ? 800 : 700, WebkitTapHighlightColor: 'transparent',
                      }}>
                      <Icon name="chat" size={13} color={vita.accesa ? C.accent : C.textMuted} />
                      {vita.n > 0 ? `${vita.n} ${L('commentsWord')}` : L('commentsWord')}
                    </button>

                    <span style={{ flex: 1 }} />

                    {leggibile && (
                      <button onClick={() => { vibrate(6); setLettura({ url: d.media.url, titolo: d.title, fonte }); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px',
                          borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 800,
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
          marginBottom: 14, borderRadius: 18, overflow: 'hidden',
          background: C.card, border: bordo,
        }}>
          {/* La miniatura: 16:9, col fondale pronto SOTTO la foto.
              b.149 — se l'immagine muore in volo, onError toglie solo
              il livello <img> e resta il fondale con l'iniziale.
              b.151 — Luca: "tante pagine vuote". Una card SENZA foto
              non mostra nessun riquadro: solo testo, compatta. Il
              riquadro esiste soltanto quando c'e una foto da farci
              stare dentro. */}
          {t.immagine && (
            <div onClick={() => { vibrate(8); setScheda({ tipo: 'articolo', dati: t }); }} style={{
              position: 'relative', aspectRatio: '16/9', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${C.accent}14, ${C.purple}18)`,
              overflow: 'hidden',
            }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: `${C.accent}55`, letterSpacing: 1 }}>
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

          <div style={{ padding: '12px 14px 13px' }}>
            {/* b.153 — il titolo apre la scheda di lettura: sintesi
                BarTalk, citazione attribuita, e "Leggi su [fonte]". */}
            <h3 onClick={() => { vibrate(8); setScheda({ tipo: 'articolo', dati: t }); }} style={{
              margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35,
              color: C.textPrimary, letterSpacing: -0.2, cursor: 'pointer',
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
                {t.pubblicato ? ` · ${quando(t.pubblicato)}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
              <a href={t.url} target="_blank" rel="noopener noreferrer"
                onClick={() => vibrate(8)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 11, textAlign: 'center',
                  background: 'transparent', border: bordo, color: C.textSecondary,
                  fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {L('newsOpen')}
              </a>
              <button onClick={() => { vibrate(12); onParlane?.(t); }}
                style={{
                  flex: 1.4, padding: '9px 0', borderRadius: 11, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                  border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700,
                  fontFamily: FONT, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <Icon name="send" size={13} color="#fff" />
                {L('newsTalkAbout')}
              </button>
            </div>
            {/* b.186 — apri una discussione pubblica PERSISTENTE col link */}
            <button onClick={() => apriDiscussione(t)} disabled={creando}
              style={{
                width: '100%', marginTop: 8, padding: '9px 0', borderRadius: 11, cursor: 'pointer',
                background: `${C.accent}12`, border: `1px solid ${C.accent}30`, color: C.accent,
                fontSize: 12, fontWeight: 700, fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: creando ? 0.6 : 1, WebkitTapHighlightColor: 'transparent',
              }}>
              <Icon name="doorCreate" size={13} color={C.accent} /> {L('openDiscussion')}
            </button>
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
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>
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
                <div style={{ padding: '8px 10px 10px' }}>
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
                    style={{ display: 'inline-block', marginTop: 7, padding: '4px 10px', borderRadius: 8,
                      background: `${C.accent}1f`, border: `1px solid ${C.accent}55`, color: C.accent,
                      fontSize: 11, fontWeight: 700 }}>
                    {L('newsTalkAbout')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── La scheda di lettura/visione ─── */}
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
    </>
  );
}

export default memo(MondoNews);
