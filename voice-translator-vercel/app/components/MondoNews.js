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
// ═══════════════════════════════════════════════════════════════

import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { segnaApertura } from '../lib/interessi.js';
import { COLONNA } from '../lib/righello.js';
import { ordinaFeed } from '../lib/ordineFeed.js';
import { ordinaPerPunteggio, mescolaConInteresse } from '../lib/punteggioFeed.js';
import { chiaveContenuto, mieiCuori } from '../lib/gradimento.js';
import { giraBacheca, nascondi, senzaNascosti, bachecaDi, spostaInBacheca, togliDaBacheca } from '../lib/bacheca.js';
import { soloRecenti, quantiFreschi } from '../lib/topics/freschezza.js';
import { vistiDiRecente, primaIlNuovo } from '../lib/visti.js';
import { componi, annota } from '../lib/regia.js';
import { ordinaArticoli } from '../lib/mondo/ponte.js';
import { MOTORE_NUOVO_ARTICOLI } from '../lib/mondo/rankingConfig.js';
import { giornaleSalvato, salvaGiornale } from '../lib/giornaleSalvato.js';
import { daChiedere, semiDaInteressi } from '../lib/accoglienza.js';
import { ramiDelGiorno, mescolaSemi } from '../lib/topics/rami.js';
import SceltaInteressi from './ui/SceltaInteressi.js';
import { eDiCronaca } from '../lib/topics/enciclopediaUtile.js';
import { cercaTopics, chiediRami, chiediFonti } from '../lib/topics/cliente.js';
import { semiDi, prossimaQuery, esaurito, sanaRami } from '../lib/giardino.js';
import { listaVecchia, giorniDiVita } from '../lib/topics/fonti.js';
import { vociDaTradurre, applicaTraduzioni, traduzioneAccesa } from '../lib/topics/titoliTradotti.js';
import Scelta from './ui/Scelta.js';
import { ricerchePredefinite } from '../lib/casaEViaggio.js';
import { preferitiAggiunti, ePreferita, aggiungiPreferita, togliPreferita } from '../lib/preferitiRicerche.js';
import { testataChiusa } from '../lib/testateChiuse.js';
import { bandieraPaese, nomePaese, quando, tipoContenuto, fonteDi, viva, stileEtichetta, PUNTO, paeseDaLingua } from '../lib/schedaMondo.js';
import PannelloLaterale from './ui/PannelloLaterale.js';
import CardSezione from './ui/CardSezione.js';
import ParlaneCon from './ui/ParlaneCon.js';
import { sesSet, memGet } from '../lib/memoria.js';
import PreferenzeMondo from './ui/PreferenzeMondo.js';
import PreferitiTemi from './ui/PreferitiTemi.js';
import { PAESI } from '../lib/paesi.js';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import AnteprimaCoperta from './ui/AnteprimaCoperta.js';
import SchedaArgomento from './SchedaArgomento.js';
import FeedNotizieMondo from './FeedNotizieMondo.js';
import MondoDiscussioni from './MondoDiscussioni.js';
import Ribalta from './ui/Ribalta.js';
import LettoreArticolo from './ui/LettoreArticolo.js';
import Campanella from './ui/Campanella.js';
import FiloCommenti from './ui/FiloCommenti.js';
import MondoPersona from './MondoPersona.js';
import { useApp } from '../contexts/AppContext.js';
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

const QUERY_RAPIDE = {
  top:        { it: 'ultime notizie', en: 'top news today', es: 'últimas noticias', fr: 'dernières nouvelles', de: 'nachrichten heute' },
  mondo:      { it: 'notizie dal mondo', en: 'world news', es: 'noticias del mundo', fr: 'actualités monde', de: 'weltnachrichten' },
  sport:      { it: 'sport', en: 'sports', es: 'deportes', fr: 'sport', de: 'sport' },
  tecnologia: { it: 'tecnologia', en: 'technology', es: 'tecnología', fr: 'technologie', de: 'technologie' },
  economia:   { it: 'economia', en: 'economy business', es: 'economía', fr: 'économie', de: 'wirtschaft' },
  scienza:    { it: 'scienza', en: 'science', es: 'ciencia', fr: 'science', de: 'wissenschaft' },
  arte:       { it: 'arte cultura', en: 'art culture', es: 'arte cultura', fr: 'art culture', de: 'kunst kultur' },
};

function MondoNews({ C, onJoinRoom, onParlane, apriDiscussioneId = null, suApertaDiscussione, strumenti = false, suChiudiStrumenti, suApriStrumenti, paeseDalGlobo = null, suPaeseScelto, suScorrimento, temaDaFuori = null, suTemaLetto }) {
  const { L, prefs, userToken, savePrefs, setView } = useApp();
  const lingua = prefs.uiLang || 'en';
  const [discAperta, setDiscAperta] = useState(null);
  const [lettura, setLettura] = useState(null);
  useEffect(() => {
    if (!apriDiscussioneId) return;
    setDiscAperta(apriDiscussioneId);
    suApertaDiscussione?.();
  }, [apriDiscussioneId, suApertaDiscussione]);
  const [creando, setCreando] = useState(false);
  const [feed, setFeed] = useState(null);
  const [personaAperta, setPersonaAperta] = useState(null);

  const [query, setQuery] = useState('');
  const [cercando, setCercando] = useState(false);
  const [processo, setProcesso] = useState([]);
  const [argomenti, setArgomenti] = useState(null);
  const [stanze, setStanze] = useState([]);
  const [daCache, setDaCache] = useState(false);
  const [errore, setErrore] = useState('');
  const [chipAttiva, setChipAttiva] = useState(null);
  const [scheda, setScheda] = useState(null);
  const [feedAperto, setFeedAperto] = useState(false);
  const [primoIncontro, setPrimoIncontro] = useState(null);
  useEffect(() => {
    let posate = null;
    try { posate = JSON.parse(memGet('vt-prefs') || 'null'); } catch { posate = null; }
    setPrimoIncontro(posate ? daChiedere(posate) : daChiedere(prefs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setFeedAperto(true); }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (argomenti !== null || cercando) return;
    const ieri = giornaleSalvato();
    if (ieri) {
      const gia = vistiDiRecente();
      setArgomenti(primaIlNuovo(ieri.argomenti, gia));
      if (ieri.video?.length) setVideo(primaIlNuovo(ieri.video, gia));
    }
    if (primoIncontro === null) return;
    if (primoIncontro === true && daChiedere(prefs)) return;
    try {
      let n = 0;
      try {
        n = parseInt(localStorage.getItem('vt-gazzetta-giro') || '0', 10) || 0;
        localStorage.setItem('vt-gazzetta-giro', String(n + 1));
      } catch { /* senza memoria si parte dal primo giro */ }
      const semiUtente = semiDi(prefs, []);
      const ultimora = (ricerchePredefinite(prefs, nomePaese)[0] || {}).query || '';
      const giri = mescolaSemi(
        semiUtente,
        ramiDelGiorno({ lingua, ultimora, giro: n, quanti: 4 }),
        { quanti: 4 },
      );
      const scelti = giri.filter((g) => g?.query).slice(0, 4);
      if (!scelti.length) return;
      (async () => {
        await cerca(scelti[0].query, 'notizie', false, true);
        for (const altro of scelti.slice(1)) {
          await cerca(altro.query, 'notizie', false, true, true);
        }
        const mia = String(lingua || 'it').slice(0, 2);
        const fuori = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ar'].filter((x) => x !== mia);
        const scelta = fuori[n % fuori.length];
        const domanda = (QUERY_RAPIDE.mondo || {})[scelta] || QUERY_RAPIDE.mondo.en;
        await cerca(domanda, 'notizie', false, true, true, scelta);
      })();
    } catch { /* senza default si resta sull'invito a cercare */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la guardia e `argomenti`, non le dipendenze
  }, [primoIncontro, prefs?.interessi, prefs?.interessiSaltati, prefs?.ricercheRecenti?.length]);
  const feedFiltro = prefs?.mondoFeedFiltro || 'video';
  const [video, setVideo] = useState(null);
  const [videoAttivi, setVideoAttivi] = useState(false);
  const profonda = (prefs?.mondoModo || 'approfondita') === 'approfondita';
  const [numFonti, setNumFonti] = useState(10);
  const abortRef = useRef(null);
  const cercandoRef = useRef(false);
  const abortDietroRef = useRef(null);
  const [feedGuasto, setFeedGuasto] = useState(false);
  const giaCercato = useRef(false);
  const tornaAlFeedRef = useRef(false);
  useEffect(() => {
    if ((prefs?.mondoAggiorna || 'apertura') !== 'apertura') return;
    if (giaCercato.current || !userToken) return;
    giaCercato.current = true;
    cercaChip(CATEGORIE[0], true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs?.mondoAggiorna, userToken]);

  const [argomentoFiltro, setArgomentoFiltro] = useState(null);
  const [paeseFiltro, setPaeseFiltro] = useState(null);
  const [ultimaRicerca, setUltimaRicerca] = useState(null);
  const [ramiNoti, setRamiNoti] = useState([]);
  const usateRef = useRef([]);
  const vistiRef = useRef(new Set());
  const [crescendo, setCrescendo] = useState(false);
  const [listaFonti, setListaFonti] = useState(null);
  const [fontiInCorso, setFontiInCorso] = useState(false);
  const [bozzaPaese, setBozzaPaese] = useState(null);
  const [bozzaCategoria, setBozzaCategoria] = useState('');
  useEffect(() => { if (paeseDalGlobo !== undefined) setPaeseFiltro(paeseDalGlobo); }, [paeseDalGlobo]);
  useEffect(() => { if (strumenti) { setBozzaPaese(paeseFiltro); setBozzaCategoria(chipAttiva || ''); } }, [strumenti]); // eslint-disable-line react-hooks/exhaustive-deps -- la bozza si fotografa all'apertura
  useEffect(() => {
    if (!temaDaFuori) return;
    setArgomentoFiltro(temaDaFuori);
    suTemaLetto?.();
  }, [temaDaFuori, suTemaLetto]);

  const [temaMondo, setTemaMondo] = useState(null);
  const [confronto, setConfronto] = useState(null);
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

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/mondo/discussioni${chipAttiva ? `?topic=${encodeURIComponent(chipAttiva)}` : ''}`, { signal: AbortSignal.timeout(10000) });
        if (!vivo) return;
        if (r.ok) { const d = await r.json().catch(() => null); if (d) { setFeed(d.discussioni || []); setFeedGuasto(false); } else setFeedGuasto(true); }
        else setFeedGuasto(true);
      } catch (e) {
        if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
        if (vivo) setFeedGuasto(true); }
    })();
    return () => { vivo = false; };
  }, [chipAttiva, discAperta, riprova]);

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

  const salvaRef = useRef(null);
  useEffect(() => {
    if (!Array.isArray(argomenti) || !argomenti.length) return undefined;
    clearTimeout(salvaRef.current);
    salvaRef.current = setTimeout(() => salvaGiornale(argomenti, video), 4000);
    return () => clearTimeout(salvaRef.current);
  }, [argomenti, video]);

  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  const cercaVideoPer = useCallback(async (q, dietro = false) => {
    if (!dietro) setVideo(null);
    try {
      const r = await fetch(`/api/topics/video?q=${encodeURIComponent(q)}&lang=${lingua}&ore=${Number(prefsRef.current?.finestraOre ?? 48)}`, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) return;
      const d = await r.json().catch(() => null);
      if (!d) { console.warn('[b.363] topics/video: risposta illeggibile'); return; }
      setVideoAttivi(!!d.disponibile);
      if (d.disponibile) {
        setVideo((prima) => {
          const base = dietro && Array.isArray(prima) ? prima : [];
          const visti = new Set(base.map((v) => v?.id || v?.url || v?.titolo).filter(Boolean));
          const nuovi = (d.video || []).filter((v) => {
            const k = v?.id || v?.url || v?.titolo;
            if (!k || visti.has(k)) return false;
            visti.add(k); return true;
          });
          const puliti = primaIlNuovo(senzaNascosti([...base, ...nuovi], prefsRef.current), vistiDiRecente());
          return componi([], puliti.map((v) => ({ ...v, seme: v.seme || q, lingua: v.lingua || lingua })),
            { gusti: prefsRef.current?.gusti || {}, miaLingua: lingua, quantaRichiesta: 0 });
        });
      }
    } catch { /* i video sono un di piu, mai un errore in faccia */ }
  }, [lingua]);

  const tradottiRef = useRef(new Map());
  const [inTraduzione, setInTraduzione] = useState(false);
  const traduciSchede = useCallback(async (schede) => {
    if (!traduzioneAccesa(prefs)) return;
    const mia = prefs?.uiLang || prefs?.lang || 'it';
    const voci = vociDaTradurre(schede, mia);
    if (!voci.length) return;
    setInTraduzione(true);
    try {
      const rese = {};
      const nonTradotte = voci.filter((v) => {
        const gia = tradottiRef.current.get(`${mia}|${v.testo}`);
        if (gia) { rese[`${v.id}|${v.campo}`] = gia; return false; }
        return true;
      });
      await Promise.all(nonTradotte.map(async (v) => {
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

  const interessiMiei = useMemo(() => ({
    interessi: semiDi(prefs, []).map((x) => x.query),
    argomentiVisti: prefs?.argomentiVisti || {},
  }), [prefs]);

  const argomentiRef = useRef(null);
  useEffect(() => { argomentiRef.current = argomenti; }, [argomenti]);

  const mandaSegnale = useCallback((chiave, tipo, valore = 1) => {
    const k = String(chiave || '').trim();
    if (!k) return;
    fetch('/api/mondo/segnali', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ chiave: k, tipo, valore }),
    }).catch((e) => {
      if (e?.name !== 'AbortError') console.warn('[b.545] POST /api/mondo/segnali:', e?.message || e);
    });
  }, []);

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
    const testa = fermi > 0 ? contenuti.slice(0, fermi) : [];
    const daOrdinare = fermi > 0 ? contenuti.slice(fermi) : contenuti;
    const ordinati = [
      ...testa,
      ...mescolaConInteresse(ordinaPerPunteggio(daOrdinare, conteggi, Date.now()), interessiMiei),
    ];
    setArgomenti((prima) => (
      Array.isArray(prima) && prima.length === contenuti.length && prima.every((x, i) => x === contenuti[i])
        ? ordinati
        : prima
    ));
  }, [interessiMiei]);

  const cerca = useCallback(async (q, cat = 'notizie', fresca = false, silenziosa = false, accoda = false, linguaAlt = '') => {
    const pulita = (q || '').trim();
    if (!pulita) return;

    // b.585 — UNA SOLA DISTINZIONE. Una ricerca silenziosa e automatica
    // solo se NON nasce da un seme della persona. Preferiti, ricerche
    // recenti, interessi dichiarati e «Oggi voglio» restano richieste
    // specifiche e possono sempre allargarsi sul web. I rami inventati
    // dal giornale, invece, usano prima il patrimonio di fonti.
    const chiavePulita = pulita.toLowerCase();
    const eSemeUtente = semiDi(prefsRef.current, []).some((s) => String(s?.query || '').trim().toLowerCase() === chiavePulita);
    const automatica = !!silenziosa && !eSemeUtente;

    const dietro = !!accoda;
    if (cercandoRef.current) {
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
      const paeseAutomatico = automatica && !linguaAlt
        ? (paeseDaLingua(prefsRef.current?.lang || lingua) || '')
        : '';
      const fine = await cercaTopics(
        { q: pulita, lingua: linguaAlt || lingua, cat, fresca, profonda, fonti: profonda ? numFonti : 0, segnale: ac.signal,
          paeseFonti: paeseFiltro || paeseAutomatico, settoreFonti: bozzaCategoria || '', automatico: automatica },
        (r) => {
          if (r.stadio === 'parziale' && Array.isArray(r.argomenti) && r.argomenti.length) {
            const primi = senzaNascosti(r.argomenti, prefsRef.current)
              .map((a) => ({ ...a, seme: a.seme || pulita, lingua: a.lingua || linguaAlt || lingua }));
            if (primi.length) {
              const gusti = prefsRef.current?.gusti || {};
              const opz = { prefs: prefsRef.current, miaLingua: lingua, query: pulita };
              setArgomenti((prima) => {
                if (MOTORE_NUOVO_ARTICOLI) {
                  return (accoda || dietro)
                    ? [...(prima || []), ...ordinaArticoli(primi, opz)]
                    : ordinaArticoli(primi, opz);
                }
                return (accoda || dietro)
                  ? [...(prima || []), ...componi([], primi, { gusti, miaLingua: lingua, quantaRichiesta: 0 })]
                  : componi(primi, [], { gusti, miaLingua: lingua });
              });
            }
            return;
          }
          if (dietro) return;
          const testo = descriviStadio(r);
          if (testo) setProcesso(p => [...p.slice(-5), { testo, id: p.length }]);
        },
      );
      if (fine) {
        const arrivati = fine.argomenti || [];
        let puliti = senzaNascosti(arrivati, prefs);
        const oreIndietro = Number(prefs?.finestraOre ?? 48);
        if (oreIndietro > 0 && eDiCronaca(pulita)) {
          const finestra = oreIndietro * 3600 * 1000;
          if (quantiFreschi(puliti, { finestra }) >= 4) puliti = soloRecenti(puliti, { finestra });
        }
        puliti = primaIlNuovo(puliti, vistiDiRecente());
        puliti = puliti.map((a) => ({ ...a, seme: a.seme || pulita, lingua: a.lingua || linguaAlt || lingua }));
        const nuovi = puliti.filter((a) => {
          const chiave = a?.url || a?.id || a?.titolo;
          if (!chiave || vistiRef.current.has(chiave)) return false;
          vistiRef.current.add(chiave);
          return true;
        });
        usateRef.current = [...usateRef.current, pulita];
        if (nuovi.length) traduciSchede(nuovi);
        setArgomenti((prima) => {
          const gusti = prefsRef.current?.gusti || {};
          if (MOTORE_NUOVO_ARTICOLI) {
            const opz = { prefs: prefsRef.current, miaLingua: lingua, query: pulita };
            if (!accoda) return ordinaArticoli(puliti, opz);
            return [...(prima || []), ...ordinaArticoli(nuovi, opz)];
          }
          if (!accoda) return componi(puliti, [], { gusti, miaLingua: lingua });
          const testa = prima || [];
          return [...testa, ...componi([], nuovi, { gusti, miaLingua: lingua, quantaRichiesta: 0 })];
        });
        riordinaConSegnali(
          accoda ? [...(argomentiRef.current || []), ...nuovi] : puliti,
          dietro ? (argomentiRef.current || []).length : 0,
        );
        if (!accoda) setStanze(fine.stanze || []);
        setDaCache(!!fine.daCache);
        if (accoda && esaurito({ trovati: puliti.length, nuovi: nuovi.length })) {
          setRamiNoti((r) => r.map((x) => (x.query === pulita ? { ...x, secco: true } : x)));
        }
        try {
          if (silenziosa) throw new Error('auto');
          const VUOTE = new Set(['di','della','del','dello','delle','dei','degli','la','il','lo','le','gli','un','una','uno','che','per','con','sul','sulla','the','of','a','an','and']);
          const parole = pulita.split(/[\s,]+/).filter(w => w.length > 1 && !VUOTE.has(w.toLowerCase()));
          const etichetta = parole.slice(0, 2).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || pulita.slice(0, 18);
          const img = (fine.argomenti || []).find(t => t.immagine)?.immagine || null;
          const vecchie = Array.isArray(prefs?.ricercheRecenti) ? prefs.ricercheRecenti : [];
          const nuove = [{ q: pulita, etichetta, img }, ...vecchie.filter(r => r.q !== pulita)].slice(0, 6);
          savePrefs?.({ ...prefs, ricercheRecenti: nuove });
          setUltimaRicerca({ q: pulita, etichetta, img });
        } catch { /* la memoria delle ricerche non deve mai rompere la ricerca */ }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/topics/search:', e?.message || e);
      if (e.name !== 'AbortError' && !dietro) setErrore('guasto');
    } finally {
      cercandoRef.current = false;
      if (!dietro) setCercando(false);
    }
  }, [lingua, cercando, descriviStadio, cercaVideoPer, profonda, numFonti, prefs, savePrefs, riordinaConSegnali, paeseFiltro, bozzaCategoria, traduciSchede]);

  const cresci = useCallback(async () => {
    if (crescendo || cercando) return;
    setCrescendo(true);
    try {
      const semi = semiDi(prefs, ricerchePredefinite(prefs, nomePaese));
      let rami = ramiNoti.filter((r) => !r.secco);
      let scelta = prossimaQuery({ semi, rami, usate: usateRef.current });

      if (!scelta) {
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

  const gustiRef = useRef(null);
  const salvaGustiRef = useRef(null);
  const suGesto = useCallback((d, gesto) => {
    const tema = String(d?.seme || d?.canale || '').toLowerCase();
    if (!tema) return;
    const base = gustiRef.current || prefsRef.current?.gusti || {};
    gustiRef.current = annota(base, tema, gesto);
    clearTimeout(salvaGustiRef.current);
    const subito = gesto === 'bacheca' || gesto === 'cuore' || gesto === 'nascosto';
    salvaGustiRef.current = setTimeout(() => {
      savePrefs?.({ ...prefsRef.current, gusti: gustiRef.current });
    }, subito ? 0 : 20000);
  }, [savePrefs]);

  const suBacheca = useCallback((d) => {
    const url = d?.url || (d?.id ? `youtube.com/watch?v=${d.id}` : '');
    savePrefs?.(giraBacheca(prefs, { ...d, url }));
    suGesto(d, 'bacheca');
  }, [prefs, savePrefs, suGesto]);

  const suNascondi = useCallback((d) => {
    const url = d?.url || (d?.id ? `youtube.com/watch?v=${d.id}` : '');
    if (!url) return;
    const dopo = nascondi(prefs, url);
    savePrefs?.(dopo);
    suGesto(d, 'nascosto');
    setArgomenti((prima) => senzaNascosti(prima, dopo));
    setVideo((prima) => senzaNascosti(prima, dopo));
  }, [prefs, savePrefs, suGesto]);

  const suInteressi = useCallback((scelti) => {
    setPrimoIncontro(false);
    const dopo = { ...prefsRef.current, interessi: scelti };
    dopo.semiInteressi = semiDaInteressi(dopo, L);
    savePrefs?.(dopo);
    const semi = dopo.semiInteressi;
    if (semi.length) {
      (async () => {
        await cerca(semi[0].query, 'notizie', false, true);
        for (const altro of semi.slice(1, 3)) await cerca(altro.query, 'notizie', false, true, true);
      })();
    }
  }, [savePrefs, L, cerca]);

  const suSaltaInteressi = useCallback(() => {
    setPrimoIncontro(false);
    savePrefs?.({ ...prefsRef.current, interessiSaltati: true });
  }, [savePrefs]);

  const cercaChip = useCallback((c, silenziosa = false) => {
    setChipAttiva(c.id);
    const q = (QUERY_RAPIDE[c.id] || {})[lingua] || (QUERY_RAPIDE[c.id] || {}).en || c.id;
    setQuery('');
    cerca(q, c.cat, false, silenziosa);
  }, [lingua, cerca]);

  const apriDiscussione = useCallback(async (t) => {
    if (creando) return;
    if (!userToken) { setErrore('account'); return; }
    setCreando(true); vibrate(12);
    try {
      const media = t.url ? { url: t.url, thumb: t.immagine || '', source: (t.fonti?.[0]?.dominio) || '' } : {};
      const r = await fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000),
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azione: 'crea', userToken, nick: prefs?.mondoNick || '',
          title: t.titolo || '', titleLang: lingua, lang: lingua,
          topic: chipAttiva || null, media,
        }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.id) setDiscAperta(d.id);
      else setErrore('guasto');
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
      setErrore('guasto'); }
    setCreando(false);
  }, [creando, userToken, lingua, chipAttiva, prefs]);

  const argomentiVeri = useMemo(() => {
    const conto = new Map();
    for (const d of feed || []) {
      if (!d.topic) continue;
      conto.set(d.topic, (conto.get(d.topic) || 0) + 1);
    }
    return [...conto.entries()].sort((a, b) => b[1] - a[1]);
  }, [feed]);

  const feedMostrato = useMemo(() => {
    let v = feed || [];
    if (argomentoFiltro) v = v.filter((d) => d.topic === argomentoFiltro);
    if (paeseFiltro) v = v.filter((d) => d.country === paeseFiltro);
    return ordinaFeed(v, prefs);
  }, [feed, argomentoFiltro, paeseFiltro, prefs]);

  const discussionePerLink = useMemo(() => {
    const m = new Map();
    for (const d of feed || []) {
      const u = d?.media?.url;
      if (u && !m.has(u)) m.set(u, { id: d.id, persone: d.comment_count || 0 });
    }
    return m;
  }, [feed]);

  const chiaviSeguite = useMemo(() => {
    const cuori = mieiCuori();
    const miei = semiDi(prefs, []).map((x) => String(x.query || '').trim().toLowerCase()).filter(Boolean);
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

  const temaMondoUi = useMemo(() => ({
    ...C,
    accent1: C.accent, accent2: C.purple, accent3: C.red,
    glassCard: C.card, inputBg: C.input,
  }), [C]);

  const apriDaChiave = useCallback((chiave) => {
    const k = String(chiave || '').trim();
    if (!k) return;
    const t = (argomenti || []).find((x) => chiaveContenuto(x?.url) === k);
    if (t) {
      setFeedAperto(false);
      setLettura({ url: t.url, titolo: t.titolo, fonte: t.fonti?.[0]?.fonte, dati: t, faccia: testataChiusa(t.url) ? 'sintesi' : 'articolo' });
      return;
    }
    const d = (feed || []).find((x) => chiaveContenuto(x?.media?.url) === k);
    if (!d) return;
    setFeedAperto(false);
    const suaFonte = fonteDi(d.media);
    if (d.media?.url && tipoContenuto(d.media) !== 'video') {
      setLettura({
        url: d.media.url, titolo: d.title, fonte: suaFonte,
        dati: { titolo: d.title, fonti: suaFonte ? [{ fonte: suaFonte, titolo: d.title }] : [] },
      });
    } else setDiscAperta(d.id);
  }, [argomenti, feed]);

  const [parlaneCon, setParlaneCon] = useState(null);
  const smistaParlane = useCallback((modo, contenuto) => {
    setParlaneCon(null);
    setFeedAperto(false);
    if (modo === 'persone') { onParlane?.(contenuto); return; }
    const argomento = [contenuto?.titolo, contenuto?.sintesi].filter(Boolean).join(' — ').slice(0, 300);
    const scheda = modo === 'compagno' ? 'amico' : modo;
    try { sesSet('vt-vita-da-mondo', JSON.stringify({ argomento, scheda })); }
    catch { /* senza memoria di sessione Vita si apre vuota: meglio che non aprirsi */ }
    setView('life');
  }, [onParlane, setView]);

  const [filo, setFilo] = useState(null);

  const apriCommenti = useCallback((c) => {
    const url = c?.url || c?.media?.url
      || (c?.id && c?.canale ? `https://www.youtube.com/watch?v=${c.id}` : '');
    if (!url) return;
    vibrate(8);
    setFilo({ url, titolo: c?.titolo || c?.title || '', dati: c?.dati || c });
  }, []);

  useEffect(() => {
    if (!lettura?.url) return;
    mandaSegnale(chiaveContenuto(lettura.url), 'apertura', 1);
  }, [lettura, mandaSegnale]);

  const bordo = `1px solid ${C.cardBorder}`;

  return (
    <>
    <Ribalta girato={!!(lettura || discAperta)}
      fronte={
      <div onScroll={suScorrimento} style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none' }}>
      <div style={{ padding: '0 0 106px', overflowX: 'hidden', fontFamily: FONT, ...COLONNA }}>

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
        <button
          onClick={() => {
            if (chipAttiva) cercaChip(CATEGORIE.find(c => c.id === chipAttiva));
            else cerca(query, 'notizie', true);
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
        <Campanella C={temaMondoUi} L={L}
          chiaviSeguite={chiaviSeguite}
          onApriContenuto={apriDaChiave} />
      </div>

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

      <PannelloLaterale aperto={strumenti} onChiudi={suChiudiStrumenti} titolo={L('tabNews')} C={C} sopra={feedAperto}>
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
                  if (v.tipo === 'video') { setScheda({ tipo: 'video', dati: { id: (v.url.split('v=')[1] || ''), titolo: v.titolo, canale: v.fonte, miniatura: v.img } }); }
                  else { setLettura({ url: v.url, titolo: v.titolo, fonte: v.fonte, dati: v, faccia: testataChiusa(v.url) ? 'sintesi' : 'articolo' }); }
                  suChiudiStrumenti?.();
                }}
                  title={v.titolo}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
                  {v.img
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

      <CardSezione icona="globe" titolo={L('sbWhereTitle')} sotto={L('sbWhereCaption')} C={C}>
        <Scelta C={C}
          valore={bozzaPaese || 'tutto'}
          opzioni={[
            { valore: 'tutto', etichetta: L('wholeWorld'), conto: feed?.length || 0 },
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

      {(() => {
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
      </PannelloLaterale>

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

      {errore && (
        <div role="alert" style={{ padding: '18px 4px', fontSize: 13, color: C.red }}>
          {errore === 'account' ? L('accessToCreate') : L('newsError')}
        </div>
      )}
      {!errore && !cercando && argomenti !== null && argomenti.length === 0 && (
        <div style={{ padding: '18px 4px', fontSize: 13, color: C.textMuted }}>{L('newsNoResults')}</div>
      )}

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

      {feedMostrato.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1.2, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8, padding: '0 16px' }}>
            {L('worldNowTitle')}
          </div>
          {feedMostrato.slice(0, 12).map(d => (
            (() => {
              const tipo = tipoContenuto(d.media);
              const fonte = fonteDi(d.media);
              const bandiera = bandieraPaese(d.country);
              const eta = quando(d.last_activity_at || d.created_at, L);
              const vita = viva(d.comment_count);
              const eti = stileEtichetta(C);
              const foto = d.media?.thumb;
              const leggibile = !!d.media?.url && tipo !== 'video';
              const perLettore = leggibile ? {
                url: d.media.url, titolo: d.title, fonte,
                dati: { titolo: d.title, fonti: fonte ? [{ fonte, titolo: d.title }] : [] },
              } : null;
              return (
                <article key={d.id} style={{
                  marginBottom: 12, borderRadius: 0, overflow: 'hidden',
                  background: 'rgba(11,15,28,0.94)', borderTop: bordo, borderBottom: bordo, fontFamily: FONT,
                }}>
                  <button onClick={() => {
                      vibrate(8);
                      if (d.topic && savePrefs) savePrefs(segnaApertura(prefs, d.topic));
                      if (perLettore) setLettura(perLettore);
                      else setDiscAperta(d.id);
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: 0,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
                    }}>
                    <span style={{
                      display: 'block', position: 'relative', width: '100%', aspectRatio: '16 / 9',
                      background: `linear-gradient(135deg, ${C.accent}14, ${C.purple}18)`, overflow: 'hidden',
                    }}>
                      <span style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 34, fontWeight: 500, color: `${C.accent}55`, letterSpacing: 1,
                      }}>{(fonte || d.title || '\u00b7').slice(0, 1).toUpperCase()}</span>
                      {foto && (
                        <AnteprimaCoperta src={foto} contenuto={d.media} L={L}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          stile={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      <span style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'linear-gradient(180deg, transparent 58%, rgba(11,15,28,0.92))',
                      }} />
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
                            <Icon name="play" size={17} color="#fff" />
                          </span>
                        </span>
                      )}
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
                              fontSize: 22, lineHeight: 1, cursor: 'pointer', borderRadius: 8,
                              padding: '4px 7px', background: 'rgba(6,9,18,0.72)',
                              border: '1px solid rgba(255,255,255,0.16)',
                              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44,
                              outline: paeseFiltro === d.country ? `1px solid ${C.accent}` : 'none',
                            }}>{bandiera}</span>
                        )}
                        {d.topic && (
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
          {t.immagine && (
            <div onClick={() => { vibrate(8); setLettura({ url: t.url, titolo: t.titolo, fonte: t.fonti?.[0]?.fonte, dati: t, faccia: testataChiusa(t.url) ? 'sintesi' : 'articolo' }); }} style={{
              position: 'relative', aspectRatio: '16/9', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${C.accent}14, ${C.purple}18)`,
              overflow: 'hidden',
            }}>
              <span style={{ fontSize: 26, fontWeight: 500, color: `${C.accent}55`, letterSpacing: 1 }}>
                {(t.fonti?.[0]?.fonte || '·').slice(0, 1).toUpperCase()}
              </span>
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

          <div style={{ display: 'flex', gap: 8, padding: '10px 20px 0', alignItems: 'center' }}>
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
            {(() => {
              const attiva = discussionePerLink.get(t.url);
              return (
                <button onClick={() => { vibrate(10); if (attiva) setDiscAperta(attiva.id); else apriDiscussione(t); }}
                  disabled={creando}
                  aria-label={L('newsTalkAbout')} title={L('newsTalkAbout')}
                  style={{
                    minWidth: 38, height: 38, padding: attiva?.persone ? '0 11px' : 0,
                    borderRadius: 11, cursor: 'pointer', flexShrink: 0,
                    background: attiva ? `${C.accent}12` : 'transparent',
                    border: attiva ? `1px solid ${C.accent}30` : bordo,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: creando ? 0.6 : 1, fontFamily: FONT,
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  <Icon name="chat" size={15} color={attiva ? C.accent : C.textSecondary} />
                  {!!attiva?.persone && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.accent }}>{attiva.persone}</span>
                  )}
                </button>
              );
            })()}
          </div>

          <div style={{ padding: '10px 20px 13px' }}>
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
                {(t.fonti || []).slice(0, 3).map(f => f.fonte || f.dominio).join(' · ')}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                — {(t.fonti || []).length} {(t.fonti || []).length === 1 ? L('newsSourceOne') : L('newsSources')}
                {t.pubblicato ? ` · ${quando(t.pubblicato, L)}` : ''}
              </span>
            </div>
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
          </div>
        </article>
      ))}

      {daCache && argomenti?.length > 0 && (
        <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', padding: '2px 0 10px' }}>
          {L('newsCobraCache')}
        </div>
      )}

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

      {primoIncontro === true && daChiedere(prefs) && (
        <SceltaInteressi C={C} L={L} onConferma={suInteressi} onSalta={suSaltaInteressi} />
      )}

      <FeedNotizieMondo aperto={feedAperto} onChiudi={() => setFeedAperto(false)} C={C} L={L}
        argomenti={argomenti || []} video={video || []} filtro={feedFiltro}
        caricando={cercando}
        onFiltro={(id) => {
          savePrefs({ ...prefs, mondoFeedFiltro: id });
          const manca = (id === 'video' && !(video || []).length)
            || (id === 'articoli' && !(argomenti || []).length);
          if (manca && !cercandoRef.current) cresci();
        }}
        onParlane={(d) => setParlaneCon(d)}
        onStrumenti={suApriStrumenti}
        onCresci={cresci}
        miaLingua={prefs?.lang || prefs?.uiLang || 'it'}
        onCommenta={apriCommenti}
        prefs={prefs} onBacheca={suBacheca} onNascondi={suNascondi} onGesto={suGesto}
        crescendo={crescendo}
        onCerca={(q) => { setQuery(q); setChipAttiva(null); cerca(q); }}
        onApriArticolo={(d) => { tornaAlFeedRef.current = true; setFeedAperto(false); setLettura({ url: d.url, titolo: d.titolo, fonte: d.fonti?.[0]?.fonte, dati: d, faccia: testataChiusa(d.url) ? 'sintesi' : 'articolo' }); }} />

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

      {personaAperta && (
        <MondoPersona publicId={personaAperta} onClose={() => setPersonaAperta(null)}
          onOpenDiscussione={(id) => { setPersonaAperta(null); setDiscAperta(id); }} />
      )}

      <ParlaneCon aperto={!!parlaneCon} contenuto={parlaneCon}
        onScegli={smistaParlane} onChiudi={() => setParlaneCon(null)} C={C} L={L} />

      <FiloCommenti aperto={!!filo} url={filo?.url} titolo={filo?.titolo}
        C={temaMondoUi} L={L} nome={prefs?.mondoNick || ''}
        onChiudi={() => setFilo(null)}
        onApriStanza={() => {
          const dati = filo?.dati;
          setFilo(null);
          setFeedAperto(false);
          onParlane?.(dati || { titolo: filo?.titolo || '', url: filo?.url || '' });
        }} />

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
