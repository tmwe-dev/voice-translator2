'use client';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { FONT, getLang, vibrate } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import Icon from './Icon.js';
import { toast } from '../lib/avvisi.js';
import { creaCodaAudio } from '../lib/codaAudio.js';
import TaxiDestinationPanel from './TaxiDestinationPanel.js';
import TaxiQRView from './TaxiQRView.js';
// ── INIZIO b.88 — mappa vettoriale anche qui, non solo dal tassista ──
import TaxiMap from './TaxiMap.js';
import { IconClose } from './Icons.js';
// ── FINE b.88 ──
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import { glossarioPerTesto } from '../lib/glossario.js'; // b.95

// ═══════════════════════════════════════════════════════════════
// TaxiTalk — Redesigned: "Parla, Traduci, Mostra"
//
// Single-screen translator with big mic CTA, chat-style results,
// optional destination overlay, and mirror mode for face-to-face.
//
// Flow: speak/type → translate → TTS → show (mirror optional)
// ═══════════════════════════════════════════════════════════════

const COMMON_LANGS = ['en','it','es','fr','de','pt','zh','ja','ko','ar','hi','ru','tr','th','vi'];

// b.145 — restavano tre scritte in italiano fisso, tutte nel pannello
// della destinazione: "Nessuna destinazione impostata" al posto della
// mappa, l'occhiello "DESTINAZIONE" sopra l'indirizzo, e le unita km e
// min accanto al percorso. Le prime due erano testo nudo fra due tag —
// la forma che i controlli sui letterali non vedono — e l'occhiello ora
// prende la maiuscola dallo stile invece che dalla lingua, perche in
// arabo e in cinese il MAIUSCOLO non esiste e la chiave sarebbe rimasta
// italiana per forza.
function SpeakerView({ userToken }) {
  const { L, S, prefs, setView, theme } = useApp();
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
    popup: col.popupBg || 'rgba(10,14,26,0.96)',
  };

  // ── State ──
  const [sourceLang, setSourceLang] = useState(prefs?.lang || 'it');
  const [targetLang, setTargetLang] = useState(prefs?.lang === 'en' ? 'it' : 'en');
  const [mode, setMode] = useState('batch'); // 'live' | 'batch'
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [history, setHistory] = useState([]);
  const [showLangPicker, setShowLangPicker] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(false);
  // b.88 — la schermata per il tassista ha due schede affiancate
  const [schedaTassista, setSchedaTassista] = useState('mappa'); // 'mappa' | 'testo'
  const [destination, setDestination] = useState('');
  const [destCoords, setDestCoords] = useState(null);
  const [destLoading, setDestLoading] = useState(false);
  const [destError, setDestError] = useState('');
  const [textMessage, setTextMessage] = useState('');
  const [userPos, setUserPos] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showRouteSteps, setShowRouteSteps] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showDestPanel, setShowDestPanel] = useState(false);
  const [showStructuredDest, setShowStructuredDest] = useState(false);
  const [structuredDestination, setStructuredDestination] = useState(null);
  const [showQRView, setShowQRView] = useState(false);
  const [erroreUltimo, setErroreUltimo] = useState(''); // b.95 — cosa e andato storto, in italiano

  // ── Refs ──
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const dgKeyRef = useRef(null);
  const sentenceRef = useRef('');
  const translateTimerRef = useRef(null);
  const audioRef = useRef(null);
  const scrollRef = useRef(null);
  const speechRecRef = useRef(null);
  const fetchRouteRef = useRef(null);
  const campoTestoRef = useRef(null); // b.90 — per mettere a fuoco il campo

  // ─── SUL COMPUTER IL CURSORE TORNA NEL CAMPO (b.133) ───
  //
  // Al computer si scrive con la tastiera e si mandano piu messaggi di
  // fila. Dopo ogni invio il fuoco spariva e bisognava ricliccare dentro.
  //
  // Il motivo e nel ramo qui sotto: `textMessage.trim() ? <invia> :
  // <microfono>`. Appena il campo si svuota il bottone che si e appena
  // premuto viene SOSTITUITO da quello del microfono. Il nodo che aveva
  // il fuoco non esiste piu, e il fuoco torna al documento — non al
  // campo, che nel frattempo non l'ha mai avuto.
  //
  // Sul telefono resta com'e, ed e voluto: li riprendere il fuoco
  // richiama la tastiera a schermo e copre meta conversazione. Percio la
  // condizione non guarda solo la larghezza ma anche `pointer: fine` —
  // un tablet largo col dito resta trattato come un telefono.
  const suComputer = useCallback(() => (
    typeof window !== 'undefined'
    && !!window.matchMedia?.('(min-width: 768px) and (pointer: fine)')?.matches
  ), []);

  // b.178 — FIX CRASH: `inviaTesto` era qui ma usa `sendTextMessage`, che
  // e dichiarato piu sotto (riga ~380). L'array di dipendenze si valuta
  // SUBITO a render → si toccava `sendTextMessage` prima che esistesse →
  // "Cannot access 'sendTextMessage' before initialization": SpeakerView
  // (nel chunk del TaxiTalk / "Parla con chi hai davanti") crashava con
  // il riquadro "Qualcosa e andato storto". Spostato DOPO sendTextMessage.

  // ── INIZIO b.95 — STATO PARLANTE ──
  // Prima: premevi il microfono, parlavi, rilasciavi, e poi SILENZIO.
  // Non sapevi se ti aveva sentito, se stava traducendo, se era fallito.
  // Ora ogni momento ha la sua frase, in un punto solo dello schermo.
  const statoParlante = (() => {
    if (recording) return { testo: mode === 'batch' ? L('taxiIListen') : L('taxiListenLive'), tono: 'attivo' };
    if (processing) return { testo: L('translatingDots'), tono: 'attesa' };
    if (playing) return { testo: L('readingAloud'), tono: 'attesa' };
    if (erroreUltimo) return { testo: erroreUltimo, tono: 'errore' };
    return null;
  })();
  // ── FINE b.95 ──

  // ── Fetch Deepgram key on mount ──
  // b.157 — audit pagamenti: questa richiesta non mandava mai un corpo,
  // e /api/stt-token risponde 401 senza userToken ne roomSessionToken:
  // il ramo Deepgram non si attivava mai, si ripiegava sempre e solo
  // sulla registrazione a blocchi senza che nessuno se ne accorgesse.
  useEffect(() => {
    fetch('/api/stt-token', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userToken: userToken || '' }),
    }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.key) dgKeyRef.current = d.key; })
      .catch(e => console.warn('[SpeakerView] STT token fetch failed:', e.message));
  }, [userToken]);

  // ── Auto-scroll history ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  // ── Auto mirror on phone flip ──
  useEffect(() => {
    let lastFlip = false;
    const handleOrientation = (e) => {
      const beta = e.beta ?? 0;
      const isFlipped = Math.abs(beta) > 120;
      if (isFlipped !== lastFlip) {
        lastFlip = isFlipped;
        setMirrorMode(isFlipped);
      }
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // ── INIZIO b.181 — all'apertura del Taxi so gia dove sei ──
  // Prima la posizione si chiedeva SOLO dopo aver scelto una destinazione
  // (per calcolare la rotta). Ma serve gia PRIMA: se so dove sei, la
  // ricerca dell'indirizzo mette in cima i posti vicini invece di
  // sparpagliarli per il mondo. Quindi la chiedo una volta all'apertura,
  // in modo indipendente dalla destinazione.
  useEffect(() => {
    if (userPos || typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {},
      { timeout: 10000, maximumAge: 60000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo all'apertura
  // ── FINE b.181 ──

  // ── GPS + route when destination is set ──
  useEffect(() => {
    // b.181 — la posizione (userPos) e ora indipendente dalla destinazione:
    // qui si azzera solo la ROTTA quando la destinazione sparisce, non la
    // posizione, altrimenti la ricerca perderebbe il vantaggio della
    // prossimita appena si cancella una destinazione.
    if (!destCoords) { setRouteInfo(null); return; }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lon: position.coords.longitude };
        setUserPos(pos);
        if (fetchRouteRef.current) fetchRouteRef.current(pos.lat, pos.lon, destCoords.lat, destCoords.lon);
      },
      () => {},
      { timeout: 10000 }
    );
  }, [destCoords]);

  // ── Swap languages ──
  const swapLangs = useCallback(() => {
    vibrate();
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setLiveText('');
    setTranslatedText('');
  }, [sourceLang, targetLang]);

  // ── Translate text ──
  const translateText = useCallback(async (text, isFinal = true) => {
    if (!text || text.trim().length < 2) return '';
    try {
      const src = getLang(sourceLang);
      const tgt = getLang(targetLang);
      const res = await fetch('/api/translate', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(), sourceLang, targetLang,
          sourceLangName: src?.name || sourceLang,
          targetLangName: tgt?.name || targetLang,
          userToken: userToken || '',
          // b.95 — solo i termini che compaiono in QUESTA frase
          glossario: glossarioPerTesto(text),
        }),
      });
      if (!res.ok) {
        // b.95 — prima tornava stringa vuota e l'utente non capiva nulla
        setErroreUltimo(res.status === 402
          ? L('creditExhausted')
          : L('translationRetryLater'));
        return '';
      }
      // b.363 — prima la lettura non era protetta: una risposta rotta finiva
      // nel catch generico e al pubblico si diceva "sei senza connessione"
      // anche quando la connessione c'era eccome.
      const data = await res.json().catch(() => null);
      if (!data) { setErroreUltimo(L('translationRetryLater')); return ''; }
      // b.363 — LA TRAPPOLA DEL "200 CHE MENTE": quando la validazione
      // respinge la traduzione, la rotta risponde comunque 200 ma con il
      // testo ORIGINALE e validationFailed:true. Senza questo controllo il
      // pubblico si vedeva leggere la frase NELLA LINGUA DI PARTENZA come
      // se fosse una traduzione riuscita.
      if (data.validationFailed) {
        setErroreUltimo(L('translationRetryLater'));
        return '';
      }
      if (data.ripiego) setErroreUltimo(L('fallbackTranslation'));
      return data.translated || '';
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/translate:', e?.message || e);
      setErroreUltimo(L('youHaveNoConnection'));
      return '';
    }
  }, [sourceLang, targetLang, userToken, L]);

  // ── b.111 · TTS in coda, procurata in anticipo ──
  //
  // COS'ERA. Ogni frase tradotta chiamava direttamente questa funzione,
  // che come prima cosa faceva `audioRef.current.pause()`. Cioe: la
  // frase nuova AMMAZZAVA quella in corso. Nel taxi — il telefono
  // appoggiato fra due persone che si parlano addosso — bastava una
  // seconda frase perche la prima traduzione non venisse mai udita per
  // intero. Nessun errore, nessun avviso: solo una voce che si
  // interrompe a meta e un passeggero che non ha capito.
  //
  // Ora si accoda: si parla in ordine di arrivo, una alla volta, e
  // l'audio della frase successiva si va a prendere mentre la
  // precedente sta ancora parlando.
  const codaRef = useRef(null);
  if (!codaRef.current) codaRef.current = creaCodaAudio();
  useEffect(() => () => codaRef.current?.ferma(), []);

  const procura = useCallback(async (text, lang) => {
    const langCode = getLang(lang)?.speech || lang || 'en';
    try {
      const edgeRes = await fetch('/api/tts-edge', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, langCode, gender: 'female' }),
      });
      if (edgeRes.ok) {
        const blob = await edgeRes.blob();
        if (blob.size > 0) return blob;
      }
    } catch (e) { console.warn('[SpeakerView] Edge TTS non disponibile:', e?.message); }
    try {
      const res = await fetch('/api/tts', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: prefs?.voice || 'nova', lang, userToken: userToken || '' }),
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/tts:', e?.message || e);
      return null; }
  }, [prefs?.voice, userToken]);

  const suona = useCallback((blob) => new Promise((finito) => {
    if (!blob || blob.size === 0) { finito(); return; }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.volume = 1.0;
    const chiudi = () => { URL.revokeObjectURL(url); finito(); };
    audio.onended = chiudi;
    audio.onerror = chiudi;
    // Rete di sicurezza: se il browser non chiama ne onended ne
    // onerror, la coda resterebbe bloccata per sempre.
    setTimeout(chiudi, 30000);
    audio.play().catch(chiudi);
  }), []);

  const playTTS = useCallback(async (text, lang) => {
    if (!text) return;
    setPlaying(true);
    codaRef.current.accoda(
      `${text.slice(0, 60)}|${lang}`,
      () => procura(text, lang),
      async (blob) => {
        await suona(blob);
        if (codaRef.current.inCoda() === 0) setPlaying(false);
      }
    );
  }, [procura, suona]);

  // ── Destination geocoding ──
  const searchDestination = useCallback(async (query) => {
    if (!query || query.trim().length < 2) return;
    setDestLoading(true); setDestError(''); setSearchResults([]);
    try {
      const q = encodeURIComponent(query.trim());
      // b.181 — se conosco la posizione, do a Nominatim un riquadro di
      // ~55km attorno a te (viewbox, non vincolante): i posti vicini
      // salgono in cima. Senza posizione, ricerca globale come prima.
      const bias = userPos
        ? `&viewbox=${userPos.lon - 0.5},${userPos.lat + 0.5},${userPos.lon + 0.5},${userPos.lat - 0.5}`
        : '';
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}${bias}&format=json&limit=5&addressdetails=1`,
        { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */, headers: { 'Accept-Language': targetLang || 'en' } }
      );
      if (!res.ok) throw new Error('Geocoding failed');
      // b.363 — prima la lettura non era protetta: la ricerca del luogo
      // usciva senza dire nulla e la casella restava com'era.
      const data = await res.json().catch(() => null);
      if (!data) { setDestError(L('searchError')); setDestCoords(null); setDestLoading(false); return; }
      if (data.length === 0) {
        setDestError(L('placeNotFound'));
        setDestCoords(null);
      } else if (data.length === 1) {
        const place = data[0];
        setDestCoords({ lat: parseFloat(place.lat), lon: parseFloat(place.lon), displayName: place.display_name });
        setShowDestPanel(false);
      } else {
        setSearchResults(data.map(p => ({
          lat: parseFloat(p.lat), lon: parseFloat(p.lon),
          displayName: p.display_name, type: p.type || '',
        })));
      }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] https://nominatim.openstreetmap.org:', e?.message || e);
      setDestError(L('searchError')); setDestCoords(null); }
    setDestLoading(false);
  }, [targetLang, L, userPos]);

  const selectSearchResult = useCallback((result) => {
    setDestCoords(result); setSearchResults([]); setDestError(''); setShowDestPanel(false);
  }, []);

  const clearDestination = useCallback(() => {
    setDestination(''); setDestCoords(null); setDestError('');
    setTextMessage(''); setSearchResults([]);
  }, []);

  // ── Fetch route via OSRM ──
  const fetchRoute = useCallback(async (fromLat, fromLon, toLat, toLon) => {
    setRouteLoading(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
      if (!res.ok) throw new Error();
      // b.363 — prima la lettura non era protetta: con una risposta rotta il
      // percorso spariva in silenzio, senza nemmeno una riga nel registro.
      const data = await res.json().catch(() => null);
      if (!data) throw new Error('percorso illeggibile');
      if (data.routes?.[0]) {
        const route = data.routes[0];
        const distKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        const steps = [];
        route.legs?.forEach(leg => leg.steps?.forEach(step => {
          steps.push({
            instruction: step.maneuver?.instruction || 'Continue',
            modifier: step.maneuver?.modifier || '',
            distance: (step.distance / 1000).toFixed(2),
          });
        }));
        setRouteInfo({ distKm, durationMin, steps });
      }
    } catch (e) { console.warn('[SpeakerView] Route fetch failed:', e?.message); }
    setRouteLoading(false);
  }, []);
  fetchRouteRef.current = fetchRoute;

  // ── Send typed message ──
  const sendTextMessage = useCallback(async () => {
    if (!textMessage.trim()) return;
    vibrate(); setErroreUltimo(''); setProcessing(true); setLiveText(textMessage.trim());
    const translated = await translateText(textMessage.trim(), true);
    setTranslatedText(translated);
    if (translated) {
      setHistory(prev => [...prev.slice(-50), {
        original: textMessage.trim(), translated, sourceLang, targetLang, ts: Date.now(),
        destination: destCoords?.displayName?.split(',').slice(0, 2).join(',') || '',
      }]);
      playTTS(translated, targetLang);
    } else {
      toast.error(L('translationError'));
    }
    setProcessing(false); setTextMessage('');
  }, [textMessage, translateText, sourceLang, targetLang, destCoords, playTTS, L]);

  // b.178 — spostato qui da sopra: ora `sendTextMessage` esiste gia,
  // niente piu TDZ nell'array di dipendenze.
  const inviaTesto = useCallback(() => {
    sendTextMessage();
    if (!suComputer()) return;
    // Dopo il ridisegno, altrimenti si mette a fuoco il campo di prima
    // e il cambio di ramo lo porta via subito dopo.
    setTimeout(() => { try { campoTestoRef.current?.focus(); } catch (e) { /* il campo puo essere sparito uscendo dalla stanza: non e un errore da mostrare */ } }, 0);
  }, [sendTextMessage, suComputer]);

  // ── Batch recording (Web Speech API) ──
  const startBatchRecord = useCallback(async () => {
    vibrate(); setRecording(true); setLiveText(''); setTranslatedText('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setMode('live'); setRecording(false); return; }
    const rec = new SpeechRecognition();
    speechRecRef.current = rec;
    rec.lang = getLang(sourceLang)?.speech || 'en-US';
    rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setLiveText(finalText + interim);
    };
    rec.onerror = (e) => { if (e.error === 'no-speech') return; };
    rec.onend = async () => {
      const original = finalText.trim();
      if (!original) { setRecording(false); return; }
      setProcessing(true); setLiveText(original);
      const translated = await translateText(original, true);
      setTranslatedText(translated);
      if (translated) {
        setHistory(prev => [...prev.slice(-50), {
          original, translated, sourceLang, targetLang, ts: Date.now(),
          destination: destCoords?.displayName?.split(',').slice(0, 2).join(',') || '',
        }]);
        playTTS(translated, targetLang);
      }
      setProcessing(false); setRecording(false);
    };
    try { rec.start(); } catch { setRecording(false); }
  }, [sourceLang, targetLang, translateText, playTTS, destCoords]);

  const stopBatchRecord = useCallback(() => {
    if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch { /* si sta smontando: se era gia chiuso non cambia nulla */ } speechRecRef.current = null; }
  }, []);

  // ── Live mode (Deepgram streaming) ──
  const startLiveMode = useCallback(async () => {
    vibrate();
    if (!dgKeyRef.current) {
      try {
        const res = await fetch('/api/stt-token', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userToken: userToken || '' }),
        });
        // b.363 — prima la lettura non era protetta: la chiave restava vuota
        // e si scivolava in registrazione a blocchi senza sapere perche'.
        if (res.ok) { const d = await res.json().catch(() => null); if (d?.key) dgKeyRef.current = d.key; else console.warn('[b.363] stt-token: risposta illeggibile'); }
      } catch (e) { console.warn('[SpeakerView] STT retry failed:', e.message); }
    }
    if (!dgKeyRef.current) { setMode('batch'); startBatchRecord(); return; }
    setRecording(true); setLiveText(''); setTranslatedText(''); sentenceRef.current = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const speechLang = getLang(sourceLang)?.speech || 'en-US';
      const params = new URLSearchParams({
        model: 'nova-2', language: speechLang.split('-')[0], smart_format: 'true',
        interim_results: 'true', utterance_end_ms: '900',
        endpointing: '400', encoding: 'linear16', sample_rate: '16000', channels: '1',
      });
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', dgKeyRef.current]);
      wsRef.current = ws;
      ws.onopen = () => {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
          ws.send(pcm16.buffer);
        };
        source.connect(processor); processor.connect(audioCtx.destination);
      };
      ws.onmessage = (event) => {
        try {
          let data; try { data = JSON.parse(event.data); } catch { console.warn('[SpeakerView] WS message parse failed'); return; }
          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript || '';
            if (!transcript) return;
            if (data.is_final) {
              sentenceRef.current += (sentenceRef.current ? ' ' : '') + transcript;
              setLiveText(sentenceRef.current);
              clearTimeout(translateTimerRef.current);
              translateTimerRef.current = setTimeout(async () => {
                const t = await translateText(sentenceRef.current, false);
                if (t) setTranslatedText(t);
              }, 250);
            } else {
              setLiveText(sentenceRef.current + (sentenceRef.current ? ' ' : '') + transcript);
            }
          }
          if (data.type === 'UtteranceEnd' && sentenceRef.current.trim()) {
            const sentence = sentenceRef.current.trim();
            sentenceRef.current = '';
            (async () => {
              const translated = await translateText(sentence, true);
              if (translated) {
                setTranslatedText(translated);
                setHistory(prev => [...prev.slice(-50), { original: sentence, translated, sourceLang, targetLang, ts: Date.now() }]);
                playTTS(translated, targetLang);
              }
              setTimeout(() => { setLiveText(''); setTranslatedText(''); }, 3000);
            })();
          }
        } catch (e) { console.warn('[SpeakerView] WebSocket message handling failed:', e?.message); }
      };
    } catch (e) { console.warn('[SpeakerView] WebSocket setup failed:', e?.message); setRecording(false); }
  }, [sourceLang, targetLang, translateText, playTTS, startBatchRecord, userToken]);

  const stopLiveMode = useCallback(() => {
    if (sentenceRef.current.trim()) {
      const sentence = sentenceRef.current.trim();
      sentenceRef.current = '';
      translateText(sentence, true).then(translated => {
        if (translated) {
          setTranslatedText(translated);
          setHistory(prev => [...prev.slice(-50), { original: sentence, translated, sourceLang, targetLang, ts: Date.now() }]);
          playTTS(translated, targetLang);
        }
      });
    }
    clearTimeout(translateTimerRef.current);
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch { /* si sta smontando: se era gia chiuso non cambia nulla */ } processorRef.current = null; }
    if (audioCtxRef.current?.state !== 'closed') { try { audioCtxRef.current?.close(); } catch { /* si sta smontando: se era gia chiuso non cambia nulla */ } audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* si sta smontando: se era gia chiuso non cambia nulla */ } }); streamRef.current = null; }
    if (wsRef.current) {
      try { if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'CloseStream' })); wsRef.current.close(); } catch { /* si sta smontando: se era gia chiuso non cambia nulla */ }
      wsRef.current = null;
    }
    setRecording(false);
  }, [sourceLang, targetLang, translateText, playTTS]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (audioRef.current) try { audioRef.current.pause(); } catch { /* si sta smontando: se era gia chiuso non cambia nulla */ }
      if (wsRef.current) try { wsRef.current.close(); } catch { /* si sta smontando: se era gia chiuso non cambia nulla */ }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* si sta smontando: se era gia chiuso non cambia nulla */ } });
      if (audioCtxRef.current?.state !== 'closed') try { audioCtxRef.current?.close(); } catch { /* si sta smontando: se era gia chiuso non cambia nulla */ }
      clearTimeout(translateTimerRef.current);
    };
  }, []);

  // ── Bbox helper ──
  const computeBbox = useCallback((p1, p2, pad = 0.01) => {
    if (!p1 || !p2) return null;
    return {
      minLon: Math.min(p1.lon, p2.lon) - pad, maxLon: Math.max(p1.lon, p2.lon) + pad,
      minLat: Math.min(p1.lat, p2.lat) - pad, maxLat: Math.max(p1.lat, p2.lat) + pad,
    };
  }, []);

  const srcInfo = getLang(sourceLang);
  const tgtInfo = getLang(targetLang);

  // ═══════════════════════════════════════════════
  // MIRROR MODE — fullscreen split for face-to-face
  // ═══════════════════════════════════════════════
  // ── INIZIO b.88 — schermata per il tassista, rifatta a DUE SCHEDE ──
  // Prima: schermo diviso a metà, il mio testo sotto e la mappa schiacciata
  // sopra a testa in giù, dentro un iframe raster chiaro. Illeggibile.
  // Ora: due schede affiancate.
  //   MAPPA → mappa vettoriale a tutto schermo, indirizzo sotto in grande
  //   TESTO → il messaggio girato di 180° per chi sta di fronte, caratteri
  //           da leggere a mezzo metro, scelta rapida della lingua e
  //           riproduzione vocale nella lingua dell'autista
  if (mirrorMode) {
    // Cosa deve leggere l'autista: l'ultima traduzione, o l'indirizzo.
    const indirizzo = destCoords?.displayName?.split(',').slice(0, 4).join(', ') || '';
    const testoAutista = translatedText || indirizzo;
    // Caratteri: si legge da ~50 cm, quindi grande davvero. Scende solo
    // se il testo è lungo, mai sotto una misura comoda.
    const corpo = testoAutista.length > 120 ? 30 : testoAutista.length > 60 ? 40 : testoAutista.length > 25 ? 52 : 64;

    const scheda = (id, etichetta) => (
      <button key={id} onClick={() => { vibrate(10); setSchedaTassista(id); }} style={{
        flex: 1, padding: '13px 10px', borderRadius: 13, border: 'none', cursor: 'pointer',
        fontFamily: FONT, fontSize: 15, fontWeight: 500,
        background: schedaTassista === id ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : 'rgba(255,255,255,0.06)',
        color: schedaTassista === id ? '#fff' : 'rgba(255,255,255,0.55)',
        WebkitTapHighlightColor: 'transparent',
      }}>{etichetta}</button>
    );

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000', display: 'flex', flexDirection: 'column',
        fontFamily: FONT, overflow: 'hidden',
      }}>
        {/* Barra: le due schede affiancate + chiusura esplicita */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px 8px', alignItems: 'center' }}>
          {scheda('mappa', L('mapWord'))}
          {scheda('testo', L('textWord'))}
          <button onClick={() => { vibrate(); setMirrorMode(false); }} aria-label={L('closeWord')} style={{
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <IconClose size={20} />
          </button>
        </div>

        {schedaTassista === 'mappa' ? (
          <>
            {/* Mappa a tutto schermo — vettoriale, col tema, con i comandi */}
            <div style={{ flex: 1, minHeight: 0, padding: '0 20px' }}>
              {destCoords ? (
                <TaxiMap lat={destCoords.lat} lng={destCoords.lon} altezza="100%" raggio={16} />
              ) : (
                <div style={{
                  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 16, border: '1px dashed rgba(255,255,255,0.14)',
                  color: 'rgba(255,255,255,0.45)', fontSize: 16, textAlign: 'center', padding: 24,
                }}>
                  {L('noDestinationSet')}
                </div>
              )}
            </div>

            {/* L'indirizzo sotto la mappa, leggibile */}
            {destCoords && (
              <div style={{ padding: '14px 20px 96px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 500, color: '#fff', lineHeight: 1.35 }}>
                  {indirizzo}
                </div>
                {routeInfo && (
                  <div style={{ fontSize: 17, fontWeight: 500, color: C.accent, marginTop: 6 }}>
                    {routeInfo.distKm} {L('unitKm')} &middot; ~{routeInfo.durationMin} {L('unitMin')}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Lingua dell'autista: scelta in un tocco */}
            <div style={{ padding: '0 12px 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.2, color: 'rgba(255,255,255,0.4)', marginBottom: 7 }}>
                {L('driverLanguage')}
              </div>
              <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
                {COMMON_LANGS.map(codice => {
                  const l = getLang(codice);
                  const scelta = targetLang === codice;
                  return (
                    <button key={codice} onClick={() => { vibrate(10); setTargetLang(codice); }} style={{
                      flexShrink: 0, padding: '9px 15px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT,
                      background: scelta ? `${C.accent}22` : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${scelta ? `${C.accent}70` : 'rgba(255,255,255,0.10)'}`,
                      color: scelta ? '#fff' : 'rgba(255,255,255,0.65)',
                      fontSize: 15, fontWeight: scelta ? 600 : 600, whiteSpace: 'nowrap',
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                      {l?.flag} {l?.name || codice}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Il testo girato di 180°: lo legge chi sta di fronte */}
            <div style={{
              flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 22px', overflow: 'hidden',
            }}>
              <div style={{
                transform: 'rotate(180deg)',
                fontSize: corpo, fontWeight: 500, color: '#fff',
                textAlign: 'center', lineHeight: 1.25, letterSpacing: -0.5,
                maxHeight: '100%', overflowY: 'auto', wordBreak: 'break-word',
                textShadow: `0 0 34px ${C.accent}35`,
              }}>
                {testoAutista || (processing ? L('translatingDots') : L('mirrorHint'))}
              </div>
            </div>

            {/* Ascolto ad alta voce nella lingua dell'autista */}
            {testoAutista && (
              <div style={{ padding: '0 20px 96px', display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => { vibrate(); playTTS(testoAutista, targetLang); }} disabled={playing} style={{
                  padding: '15px 30px', borderRadius: 16, cursor: playing ? 'default' : 'pointer',
                  background: playing ? 'rgba(255,255,255,0.10)' : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                  border: 'none', color: '#fff', fontSize: 17, fontWeight: 500, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: playing ? 'none' : `0 10px 30px -8px ${C.accent}70`,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  <Icon name="speaker" size={20} color="#fff" />
                  {playing ? L('readingNow') : L('readInLang').replace('{x}', tgtInfo?.name || targetLang)}
                </button>
              </div>
            )}
          </>
        )}
        {/* ── FINE b.88 ── */}

        {/* Bottom mic controls */}
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <button
            onPointerDown={mode === 'batch' && !recording ? startBatchRecord : undefined}
            onPointerUp={mode === 'batch' && recording ? stopBatchRecord : undefined}
            onPointerLeave={mode === 'batch' && recording ? stopBatchRecord : undefined}
            onClick={mode === 'live' ? (recording ? stopLiveMode : startLiveMode) : undefined}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: recording ? 'linear-gradient(135deg, #FF3B30, #FF6584)' : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recording ? '0 0 40px rgba(255,59,48,0.5)' : `0 0 40px ${C.accent}50`,
              animation: recording ? 'vtMirrorPulse 1.5s ease-in-out infinite' : 'none',
              WebkitTapHighlightColor: 'transparent',
            }}>
            {/* b.88 — icone mono al posto delle emoji */}
            <Icon name={recording ? 'stop' : 'mic'} size={26} color="#fff" />
          </button>
        </div>

        <style>{`
          @keyframes vtMirrorPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        `}</style>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // MAIN VIEW — Single-screen translator
  // ═══════════════════════════════════════════════
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'hidden',
      // ── INIZIO b.90 — spazio per la barra di navigazione ──
      // Prima il campo di scrittura finiva SOTTO il menu fisso (alto 76px)
      // e diventava invisibile: si vedeva il suggerimento "Scrivi
      // messaggio" ma non c'era modo di scrivere.
      boxSizing: 'border-box',
      // b.247 — stessi 88px di b.206, ma scritti come 76px di menu + 12px
      // di margine dal FAB sporgente: cosi si legge da dove viene il numero.
      paddingBottom: 'calc(76px + 12px + env(safe-area-inset-bottom))',
      // ── FINE b.90 ──
    }}>

      {/* ── Ambient background orb ── */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-30%', width: '70vw', height: '70vw',
        borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}08 0%, transparent 70%)`,
        pointerEvents: 'none', animation: 'vtOrbBreathe 8s ease-in-out infinite',
      }} />

      {/* ═══ HEADER ═══ */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 10px', flexShrink: 0, position: 'relative', zIndex: 5,
      }}>
        <button onClick={() => setView('home')} style={{
          width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent', color: C.textMuted, fontSize: 18,
        }}>
          {'‹'}
        </button>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 17, fontWeight: 500, color: C.textPrimary, letterSpacing: -0.5,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            TaxiTalk
            <span style={{
              fontSize: 9, fontWeight: 500, padding: '2px 8px', borderRadius: 6,
              background: mode === 'live' ? `${C.red}20` : `${C.accent}15`,
              color: mode === 'live' ? C.red : C.accent,
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              {mode === 'live' ? 'Live' : 'Voce'}
            </span>
          </div>
        </div>

        {/* Mode toggle */}
        <button onClick={() => { setMode(mode === 'batch' ? 'live' : 'batch'); vibrate(); }}
          style={{
            padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
            background: C.card, border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            fontFamily: FONT, fontSize: 10, fontWeight: 500,
            color: C.textMuted, WebkitTapHighlightColor: 'transparent',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
          {/* b.88 — icone mono */}
          <Icon name={mode === 'batch' ? 'zap' : 'stop'} size={12} color={C.textMuted} />
          {mode === 'batch' ? 'Live' : 'Batch'}
        </button>

        {/* Mirror button */}
        <button onClick={() => { vibrate(); setMirrorMode(true); }}
          style={{
            width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
            background: C.card, border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label={L('showToDriver')}>
          {/* b.88 — icona mono: due frecce, "gira lo schermo verso l'altro" */}
          <Icon name="swap" size={17} color={C.accent} />
        </button>
      </header>

      {/* ═══ LANGUAGE SELECTOR — Pill style ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        margin: '0 16px 8px', borderRadius: 16, overflow: 'hidden',
        background: C.card, border: `1px solid ${C.cardBorder}`,
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        position: 'relative', zIndex: 5,
      }}>
        {/* Source lang */}
        <button onClick={() => { vibrate(); setShowLangPicker(showLangPicker === 'source' ? null : 'source'); }}
          style={{
            flex: 1, padding: '10px 14px', cursor: 'pointer', border: 'none',
            background: 'transparent', fontFamily: FONT,
            display: 'flex', alignItems: 'center', gap: 8,
            WebkitTapHighlightColor: 'transparent',
          }}>
          <span style={{ fontSize: 22 }}>{srcInfo?.flag || ''}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>{srcInfo?.name || sourceLang}</div>
            <div style={{ fontSize: 9, color: C.textMuted }}>{L('iSpeakIn')}</div>
          </div>
        </button>

        {/* Swap button */}
        <button onClick={swapLangs} style={{
          width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
          background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, WebkitTapHighlightColor: 'transparent',
          boxShadow: `0 2px 12px ${C.accent}30`,
        }}>
          <Icon name="swap" size={18} color="#fff" />
        </button>

        {/* Target lang */}
        <button onClick={() => { vibrate(); setShowLangPicker(showLangPicker === 'target' ? null : 'target'); }}
          style={{
            flex: 1, padding: '10px 14px', cursor: 'pointer', border: 'none',
            background: 'transparent', fontFamily: FONT,
            display: 'flex', alignItems: 'center', gap: 8,
            justifyContent: 'flex-end',
            WebkitTapHighlightColor: 'transparent',
          }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>{tgtInfo?.name || targetLang}</div>
            <div style={{ fontSize: 9, color: C.textMuted }}>{L('translateIntoLabel')}</div>
          </div>
          <span style={{ fontSize: 22 }}>{tgtInfo?.flag || ''}</span>
        </button>
      </div>

      {/* Language picker dropdown */}
      {showLangPicker && (
        <div style={{
          margin: '0 16px 8px', padding: 10, borderRadius: 16,
          background: C.popup, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          maxHeight: 180, overflowY: 'auto',
          display: 'flex', flexWrap: 'wrap', gap: 4,
          position: 'relative', zIndex: 10,
        }}>
          {COMMON_LANGS.map(code => {
            const info = getLang(code);
            const isSel = showLangPicker === 'source' ? code === sourceLang : code === targetLang;
            return (
              <button key={code} onClick={() => {
                vibrate();
                if (showLangPicker === 'source') setSourceLang(code); else setTargetLang(code);
                setShowLangPicker(null);
              }} style={{
                padding: '7px 12px', borderRadius: 10, cursor: 'pointer',
                background: isSel ? `${C.accent}15` : 'transparent',
                border: isSel ? `1px solid ${C.accent}30` : '1px solid transparent',
                fontFamily: FONT, fontSize: 12, fontWeight: isSel ? 600 : 500,
                color: isSel ? C.accent : C.textSecondary,
                display: 'flex', alignItems: 'center', gap: 6,
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ fontSize: 16 }}>{info?.flag}</span>
                {info?.name || code}
              </button>
            );
          })}
        </div>
      )}

      {/* ── INIZIO b.95 — la riga che racconta cosa sta succedendo ── */}
      {statoParlante && (
        <div style={{
          margin: '0 16px 8px', padding: '9px 14px', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 9,
          fontFamily: FONT, fontSize: 12.5, fontWeight: 500,
          background: statoParlante.tono === 'errore' ? `${C.red}14` : `${C.accent}12`,
          border: `1px solid ${statoParlante.tono === 'errore' ? `${C.red}30` : `${C.accent}25`}`,
          color: statoParlante.tono === 'errore' ? C.red : C.accent,
        }} role="status" aria-live="polite">
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: statoParlante.tono === 'errore' ? C.red : C.accent,
            animation: statoParlante.tono === 'attivo' ? 'vtMicPulse 1.2s ease-in-out infinite' : 'none',
          }} />
          {statoParlante.testo}
          {statoParlante.tono === 'errore' && (
            <button onClick={() => setErroreUltimo('')} aria-label={L('closeWord')}
              style={{ marginLeft: 'auto', background: 'none', border: 'none',
                color: C.red, cursor: 'pointer', display: 'flex' }}>
              <IconClose size={13} />
            </button>
          )}
        </div>
      )}
      {/* ── FINE b.95 ── */}

      {/* ═══ BARRA DESTINAZIONE ═══ */}
      {/* ── INIZIO b.88 — da fascia a riga compatta ──
          Prima: <iframe> raster di openstreetmap.org alto 100px a tutta
          larghezza. Su schermo largo diventava un lenzuolo chiaro con la
          scritta OSM, fuori dal tema. Ora: miniatura quadrata di 76px con
          la mappa VETTORIALE che segue il tema (TaxiMap, gia usata dal
          tassista), indirizzo e distanza accanto, azioni a destra.
          Nessuna funzione persa: "Mostra" e la X fanno esattamente
          quello che facevano prima. */}
      {destCoords ? (
        <div style={{
          margin: '0 16px 8px', padding: 8, borderRadius: 16,
          display: 'flex', alignItems: 'center', gap: 12,
          background: C.card, border: `1px solid ${C.accent}20`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        }}>
          {/* Miniatura: immagine, non attrezzo — niente comandi, niente trascinamento */}
          <div style={{ width: 76, height: 76, flexShrink: 0 }}>
            <TaxiMap lat={destCoords.lat} lng={destCoords.lon}
              altezza={76} comandi={false} interattiva={false} raggio={12} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1.2, color: C.textMuted, marginBottom: 3, textTransform: 'uppercase' }}>
              {L('destinationWord')}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, lineHeight: 1.3,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {destCoords.displayName?.split(',').slice(0, 3).join(',')}
            </div>
            {routeInfo && (
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 500, marginTop: 3 }}>
                {routeInfo.distKm} {L('unitKm')} &middot; ~{routeInfo.durationMin} {L('unitMin')}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <button onClick={() => { vibrate(); setMirrorMode(true); }} style={{
              padding: '8px 14px', borderRadius: 11,
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 500, fontFamily: FONT,
            }}>
              {L('showWord')}
            </button>
            <button onClick={clearDestination} aria-label={L('removeDestination')} style={{
              padding: '7px 14px', borderRadius: 11,
              background: 'transparent', border: `1px solid ${C.cardBorder}`,
              cursor: 'pointer', fontSize: 11, color: C.textMuted, fontFamily: FONT,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <IconClose size={12} /> {L('removeWord')}
            </button>
          </div>
        </div>
      /* ── FINE b.88 ── */
      ) : (
        <div style={{ margin: '0 16px 8px', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowDestPanel(!showDestPanel)} style={{
            flex: 1, padding: '8px 14px', borderRadius: 12,
            background: showDestPanel ? `${C.accent}10` : C.card,
            border: `1px solid ${showDestPanel ? `${C.accent}25` : C.cardBorder}`,
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            cursor: 'pointer', fontFamily: FONT,
            display: 'flex', alignItems: 'center', gap: 8,
            WebkitTapHighlightColor: 'transparent',
          }}>
            {/* b.88 — icone mono */}
            <Icon name="globe" size={14} color={C.textMuted} />
            <span style={{ fontSize: 11, color: C.textMuted, flex: 1, textAlign: 'left' }}>{L('quickDestination')}</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>{showDestPanel ? '▼' : '+'}</span>
          </button>
          <button onClick={() => { vibrate(15); setShowStructuredDest(true); }} style={{
            padding: '8px 14px', borderRadius: 12,
            background: `linear-gradient(135deg, ${C.accent}12, ${C.purple}08)`,
            border: `1px solid ${C.accent}20`,
            cursor: 'pointer', fontFamily: FONT,
            display: 'flex', alignItems: 'center', gap: 6,
            WebkitTapHighlightColor: 'transparent',
          }}>
            <Icon name="doorCreate" size={14} color={C.accent} />
            <span style={{ fontSize: 11, color: C.accent, fontWeight: 500 }}>{L('qrTaxiBtn')}</span>
          </button>
        </div>
      )}

      {/* Destination search panel */}
      {showDestPanel && !destCoords && (
        <div style={{
          margin: '0 16px 8px', padding: 14, borderRadius: 16,
          background: C.popup, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && destination.trim()) searchDestination(destination); }}
              placeholder={L('addressPlaceholder')}
              autoFocus
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 12,
                background: C.input, border: `1px solid ${C.inputBorder}`,
                color: C.textPrimary, fontSize: 13, fontFamily: FONT, outline: 'none',
              }}
            />
            <button onClick={() => searchDestination(destination)}
              disabled={destLoading || !destination.trim()}
              style={{
                padding: '10px 16px', borderRadius: 12,
                background: destination.trim() ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : C.card,
                border: 'none', cursor: destination.trim() ? 'pointer' : 'default',
                color: '#fff', fontSize: 13, fontWeight: 500, fontFamily: FONT,
                opacity: destLoading || !destination.trim() ? 0.4 : 1,
              }}>
              {destLoading ? '...' : 'Cerca'}
            </button>
          </div>
          {destError && <div style={{ fontSize: 10, color: C.red, marginTop: 6 }}>{destError}</div>}
          {searchResults.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => selectSearchResult(r)} style={{
                  padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                  background: C.input, border: `1px solid ${C.inputBorder}`,
                  color: C.textPrimary, fontSize: 11, textAlign: 'left', fontFamily: 'inherit', lineHeight: 1.4,
                }}>
                  {r.displayName?.split(',').slice(0, 3).join(',')}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ CHAT AREA — translation results ═══ */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', scrollbarWidth: 'none', minHeight: 0,
        padding: '0 20px', position: 'relative', zIndex: 1,
      }}>
        {/* Current translation (if any) */}
        {(liveText || translatedText) && (
          <div style={{
            padding: 14, borderRadius: 18, marginBottom: 10,
            background: C.card, border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            animation: 'vtSlideUp 0.3s ease-out',
          }}>
            {liveText && (
              <div style={{
                fontSize: 13, color: C.textSecondary, lineHeight: 1.5,
                marginBottom: translatedText ? 10 : 0,
                paddingBottom: translatedText ? 10 : 0,
                borderBottom: translatedText ? `1px solid ${C.cardBorder}` : 'none',
              }}>
                <span style={{ fontSize: 16, marginRight: 6 }}>{srcInfo?.flag}</span>
                {liveText}
                {recording && mode === 'live' && (
                  <span style={{
                    display: 'inline-block', width: 6, height: 14,
                    background: C.accent, marginLeft: 4, borderRadius: 1,
                    animation: 'vtBlink 1s step-end infinite',
                  }} />
                )}
              </div>
            )}
            {translatedText && (
              <div style={{ fontSize: 17, fontWeight: 500, color: C.textPrimary, lineHeight: 1.5 }}>
                <span style={{ fontSize: 20, marginRight: 6 }}>{tgtInfo?.flag}</span>
                {translatedText}
              </div>
            )}
            {translatedText && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => playTTS(translatedText, targetLang)} disabled={playing}
                  style={{
                    padding: '6px 14px', borderRadius: 10,
                    background: playing ? C.card : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                    border: 'none', cursor: playing ? 'default' : 'pointer',
                    color: '#fff', fontFamily: FONT, fontSize: 11, fontWeight: 500,
                    opacity: playing ? 0.5 : 1,
                    boxShadow: playing ? 'none' : `0 2px 12px ${C.accent}25`,
                  }}>
                  {/* b.88 — icone mono */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Icon name={playing ? 'refresh' : 'speaker'} size={13} color="#fff" />
                    {playing ? '...' : L('listenWord')}
                  </span>
                </button>
                <button onClick={() => { vibrate(); setMirrorMode(true); }}
                  style={{
                    padding: '6px 14px', borderRadius: 10,
                    background: `${C.accent}12`, border: `1px solid ${C.accent}25`,
                    cursor: 'pointer', color: C.accent, fontFamily: FONT, fontSize: 11, fontWeight: 500,
                  }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="swap" size={13} color={C.accent} /> {L('showWord')}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.map((item, i) => (
          <div key={`${item.ts}-${i}`}
            onClick={() => { vibrate(); playTTS(item.translated, item.targetLang); }}
            style={{
              padding: '10px 14px', marginBottom: 6, borderRadius: 14,
              background: C.card, border: `1px solid ${C.cardBorder}`,
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              cursor: 'pointer', transition: 'transform 0.1s',
            }}>
            {item.destination && (
              <div style={{ fontSize: 9, color: C.accent, fontWeight: 500, marginBottom: 3 }}>
                {item.destination}
              </div>
            )}
            <div style={{ fontSize: 12, color: C.textMuted }}>{getLang(item.sourceLang)?.flag} {item.original}</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, marginTop: 3 }}>
              {getLang(item.targetLang)?.flag} {item.translated}
            </div>
            <div style={{ fontSize: 8, color: C.textMuted, marginTop: 3, opacity: 0.4 }}>
              {new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {history.length === 0 && !liveText && !translatedText && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
              border: `1px solid ${C.accent}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* b.94 — il riquadro era rimasto vuoto dopo la pulizia delle emoji */}
              <Icon name="mic" size={34} color={C.accent} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 6 }}>
              {L('speakOrType')}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, maxWidth: 260, margin: '0 auto' }}>
              {mode === 'batch'
                ? L('taxiHintBatch')
                : L('taxiHintLive')}
            </div>
            <div style={{
              marginTop: 20, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              {/* ── INIZIO b.90 — erano finti pulsanti ──
                  Avevano icona, bordo e aria da tasto, ma erano <div>:
                  ci cliccavi sopra e non succedeva niente. Ora sono
                  pulsanti veri, e quello che è solo un'istruzione ("tieni
                  premuto") è scritto come istruzione, non come tasto. */}
              {[
                { icona: 'send', label: L('writeMessage'),
                  azione: () => { vibrate(); campoTestoRef.current?.focus(); } },
                { icona: 'swap', label: L('showToDriver'),
                  azione: () => { vibrate(); setMirrorMode(true); } },
              ].map((tasto, i) => (
                <button key={i} onClick={tasto.azione} style={{
                  padding: '9px 15px', borderRadius: 11, cursor: 'pointer', fontFamily: FONT,
                  background: `${C.accent}12`, border: `1px solid ${C.accent}28`,
                  fontSize: 12, fontWeight: 500, color: C.accent,
                  display: 'flex', alignItems: 'center', gap: 7,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  <Icon name={tasto.icona} size={14} color={C.accent} /> {tasto.label}
                </button>
              ))}
              {/* ── FINE b.90 ── */}
            </div>
          </div>
        )}
      </div>

      {/* ═══ BOTTOM COMPOSE BAR ═══ */}
      <div style={{
        padding: '8px 16px', flexShrink: 0, position: 'relative', zIndex: 5,
        borderTop: `1px solid ${C.cardBorder}`,
        background: `${C.bg}E0`,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="text" ref={campoTestoRef} value={textMessage}
            onChange={(e) => setTextMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') inviaTesto(); }}
            placeholder={recording ? (mode === 'batch' ? `${L('releaseToTranslate')}...` : L('listening')) : `${L('writeMessage')}...`}
            disabled={recording}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 14,
              background: C.input, border: `1px solid ${recording ? `${C.red}30` : C.inputBorder}`,
              color: C.textPrimary, fontSize: 14, fontFamily: FONT, outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />

          {/* Send text OR mic button */}
          {textMessage.trim() ? (
            <button onClick={inviaTesto} disabled={processing} style={{
              width: 46, height: 46, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent', flexShrink: 0,
              boxShadow: `0 4px 16px ${C.accent}30`,
            }}>
              {/* b.88 — icone mono al posto delle emoji */}
              <Icon name={processing ? 'refresh' : 'send'} size={19} color="#fff" />
            </button>
          ) : (
            <button
              onPointerDown={mode === 'batch' && !recording ? startBatchRecord : undefined}
              onPointerUp={mode === 'batch' && recording ? stopBatchRecord : undefined}
              onPointerLeave={mode === 'batch' && recording ? stopBatchRecord : undefined}
              onClick={mode === 'live' ? (recording ? stopLiveMode : startLiveMode) : undefined}
              disabled={processing}
              style={{
                width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                background: recording
                  ? 'linear-gradient(135deg, #FF3B30, #FF6584)'
                  : `linear-gradient(135deg, ${C.accent} 0%, ${C.purple} 100%)`,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: recording ? 'vtMicPulse 1.2s ease-in-out infinite' : 'none',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: recording ? '0 0 30px rgba(255,59,48,0.4)' : `0 4px 16px ${C.accent}30`,
              }}>
              {/* b.88 — icone mono al posto delle emoji */}
              <Icon name={processing ? 'refresh' : recording ? 'stop' : 'mic'} size={19} color="#fff" />
            </button>
          )}
        </div>

        {/* Recording hint */}
        {recording && (
          <div style={{
            textAlign: 'center', paddingTop: 6,
            fontSize: 10, color: C.red, fontWeight: 500,
            animation: 'vtPulse 1.5s ease-in-out infinite',
          }}>
            {mode === 'batch' ? `● ${L('releaseToTranslate')}` : `● ${L('liveTranslationOn')}`}
          </div>
        )}
      </div>

      {/* ═══ STRUCTURED DESTINATION PANEL ═══ */}
      {showStructuredDest && (
        <TaxiDestinationPanel
          onDestinationReady={(dest) => {
            setStructuredDestination(dest);
            setShowStructuredDest(false);
            setShowQRView(true);
            // Also set the simple destination coords for map/mirror
            setDestCoords({ lat: dest.lat, lon: dest.lng, displayName: dest.normalizedAddress });
          }}
          onClose={() => setShowStructuredDest(false)}
          targetLang={targetLang}
          S={_S}
        />
      )}

      {/* ═══ QR VIEW FOR TAXI DRIVER ═══ */}
      {showQRView && structuredDestination && (
        <TaxiQRView
          destination={structuredDestination}
          onClose={() => setShowQRView(false)}
          onStartConversation={() => {
            setShowQRView(false);
            vibrate(15);
            setMirrorMode(true);
          }}
          S={_S}
        />
      )}

      {/* ═══ CSS ANIMATIONS ═══ */}
      <style>{`
        @keyframes vtMicPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes vtBlink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes vtSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vtPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes vtOrbBreathe { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.05); } }
      `}</style>
    </div>
  );
}

export default memo(SpeakerView);
