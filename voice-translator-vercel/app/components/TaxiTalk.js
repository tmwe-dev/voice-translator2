'use client';
import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { FONT, getLang, vibrate } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import Icon from './Icon.js';
// b.482 — il microfono di questa schermata era disegnato a mano: stessa
// funzione della Home e della chat, altra forma. Ora usa la veste comune,
// cosi chi impara un microfono li riconosce tutti.
import { vesteMicrofono } from './ui/Microfono.js';
import TaxiMap from './TaxiMap.js';
import { buildMapsUrl } from '../lib/mapsLink.js';
import { creaCodaAudio } from '../lib/codaAudio.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// TaxiTalk — rifatto da capo, semplice e immediato (Luca).
//
// Tre cose, nient'altro:
//   1) DOVE VAI  → indirizzo → mappa visibile + QR con il link alla mappa
//                  (il tassista inquadra e gli si apre la SUA app mappe).
//   2) PARLA/SCRIVI → testo scritto o dettato, tradotto nella lingua del
//                  tassista, con il tasto "Mostra ribaltato" che gira il
//                  testo di 180° verso di lui + ascolto (voce).
//   3) CHAT (opzionale) → riusa la conversazione tradotta che già esiste
//                  (vista 'taxi-chat' = vecchia SpeakerView).
//
// Riusa i percorsi PROVATI di BarTalk: /api/translate, /api/tts-edge →
// /api/tts (in coda), Nominatim per l'indirizzo, TaxiMap per la mappa,
// buildMapsUrl per il link. Lo sfondo dell'app NON cambia: qui è
// trasparente e si vede lo SpatialBackdrop dietro.
// ═══════════════════════════════════════════════════════════════

// b.247 — le 20 chiavi di questa schermata ora esistono in tutti e quindici
// i pacchetti: via i ripieghi `L('chiave') || 'testo'`, che erano codice
// morto (t() torna la chiave, mai undefined, quindi il || non scattava e a
// schermo compariva la chiave nuda). Via anche la bandiera bianca emoji:
// come negli altri componenti, senza bandiera si mostra solo il nome.

// b.248 — tre stati che potevano mentire, piu una verifica di fatturazione:
//   · la traduzione non seguiva ne il campo ne la lingua del tassista:
//     cambiata la frase (o la lingua) restava sullo schermo — e girata
//     verso il tassista — la traduzione VECCHIA come se fosse quella nuova.
//     Ora si ricorda che cosa e stato tradotto e verso quale lingua
//     (fonteTraduzione) e la si mostra solo se combacia ancora
//     (tradottoValido): la dettatura incrementale non butta niente, la
//     traduzione resta solo nascosta finche non torna a corrispondere.
//   · la destinazione non seguiva la ricerca: scelto un posto, riscrivere
//     la query lasciava mappa e QR sul posto vecchio. Ora modificarla
//     invalida la scelta (cambiaQuery), e lo stesso vale nel pannello
//     "Dove vai?" (TaxiDestinationPanel).
//   · verificato (§5) il sospetto "il tassista traduce senza credenziale":
//     TaxiDriverView chiama /api/translate senza gettoni, MA resolveAuth
//     (apiAuth.js, Path 4) dichiara da b.154 un accesso libero con chiave
//     di piattaforma, coperto dal tetto giornaliero di piattaforma e dal
//     limite per IP: il tassista traduce davvero, niente 401/402, e non e
//     un buco nuovo. Qui, sullo schermo del passeggero, paga come sempre
//     il passeggero (userToken nel corpo della richiesta).

// Le lingue del tassista più comuni, in cima; le altre restano nel menu.
const LINGUE_TAXI = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ar', 'zh', 'ja', 'ko', 'hi', 'ru', 'tr', 'th', 'vi'];

function TaxiTalk({ userToken }) {
  const { L, prefs, setView, theme } = useApp();
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    text: col.textPrimary || PALETTE.grayLight,
    muted: col.textMuted || 'rgba(238,242,255,0.58)',
    // b.394 — CONTRASTO SUL TEMA CHIARO. Queste due voci erano le sole
    // della tavolozza a NON venire dal tema: restavano da tema scuro
    // sempre. Con il tema chiaro il testo diventa nero e le carte
    // bianche, quindi la didascalia sotto il microfono era bianca su
    // bianco (spariva) e i tasti stampavano nero sopra un blu-notte.
    faint: col.textTertiary || 'rgba(238,242,255,0.38)',
    card: col.glassCard || 'rgba(14,19,34,0.72)',
    card2: col.toggleOff || 'rgba(20,26,44,0.7)',
    border: col.cardBorder || 'rgba(255,255,255,0.08)',
    input: col.inputBg || 'rgba(9,13,26,0.7)',
    accent: col.accent1 || PALETTE.teal,
    purple: col.accent2 || PALETTE.violet,
    // b.482 — il giallo del taxi resta (e voluto), ma il ripiego scritto a
    // mano no: PALETTE e gia la fonte unica dei colori grezzi.
    amber: PALETTE.amber,
    bg: col.bg || PALETTE.bgDeep,
    // b.482 — il rosso degli errori viene dal tema, non da un esadecimale
    // scritto nel componente: sul tema chiaro e piu scuro, e deve esserlo.
    errore: col.statusError || PALETTE.coral,
    // b.482 — l'inchiostro scuro che si stampa SOPRA i fondi accesi (la
    // sfumatura dei tasti, il giallo del taxi). Erano due esadecimali
    // scritti a mano in cinque punti: adesso e un colore solo, e viene
    // dalla tavolozza che e la fonte unica dei colori grezzi.
    inchiostro: PALETTE.black,
  };

  // La MIA lingua (di partenza) e quella del TASSISTA (di arrivo).
  const myLang = prefs?.lang || 'it';
  const [driverLang, setDriverLang] = useState(myLang === 'en' ? 'es' : 'en');
  const [pickerLingua, setPickerLingua] = useState(false);

  // Destinazione
  const [query, setQuery] = useState('');
  const [dest, setDest] = useState(null); // { lat, lon, displayName }
  const [risultati, setRisultati] = useState([]);
  const [cercando, setCercando] = useState(false);
  const [erroreDest, setErroreDest] = useState('');
  const [userPos, setUserPos] = useState(null);

  // Parla / scrivi
  const [testo, setTesto] = useState('');
  const [tradotto, setTradotto] = useState('');
  // b.248 — che cosa e stato tradotto e verso quale lingua: senza questa
  // memoria la traduzione restava "vera" per sempre, anche dopo aver
  // cambiato frase o lingua del tassista.
  const [fonteTraduzione, setFonteTraduzione] = useState(null); // { testo, lingua }
  const [traducendo, setTraducendo] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [erroreTrad, setErroreTrad] = useState('');
  const [flip, setFlip] = useState(false);
  const [suonando, setSuonando] = useState(false);

  const speechRef = useRef(null);
  const audioRef = useRef(null);
  const codaRef = useRef(null);
  if (!codaRef.current) codaRef.current = creaCodaAudio();
  useEffect(() => () => codaRef.current?.ferma(), []);

  const driverInfo = getLang(driverLang);

  // b.482 — la veste del microfono comune a tutta l'applicazione: il colore
  // dell'alone dice se sta registrando, la forma resta sempre la stessa.
  // Cosa fa al tocco non cambia di una virgola: chiama sempre `dettatura`.
  const veste = vesteMicrofono({ misura: 64, acceso: registrando, C: col });

  // b.248 — il cancello: la traduzione si mostra SOLO se corrisponde ancora
  // a cio che c'e nel campo e alla lingua scelta. Qualunque modifica
  // (tastiera, dettatura, cambio lingua) la marca da rifare senza cancellare
  // nulla: se il testo torna identico, ricompare senza richiedere il server.
  const tradottoValido = (tradotto && fonteTraduzione
    && fonteTraduzione.testo === testo.trim()
    && fonteTraduzione.lingua === driverLang) ? tradotto : '';

  // ── Posizione: fa salire in cima i risultati vicini ──
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {}, { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // ── Cerca indirizzo (Nominatim, come SpeakerView) ──
  const cerca = useCallback(async (q) => {
    if (!q || q.trim().length < 2) return;
    setCercando(true); setErroreDest(''); setRisultati([]);
    try {
      const enc = encodeURIComponent(q.trim());
      const bias = userPos
        ? `&viewbox=${userPos.lon - 0.5},${userPos.lat + 0.5},${userPos.lon + 0.5},${userPos.lat - 0.5}`
        : '';
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${enc}${bias}&format=json&limit=5&addressdetails=1`,
        { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */, headers: { 'Accept-Language': driverLang || 'en' } }
      );
      if (!res.ok) throw new Error('geocoding');
      // b.363 — prima la lettura non era protetta: la ricerca chiudeva senza
      // esito e la destinazione restava quella vecchia.
      const data = await res.json().catch(() => null);
      if (!data) { setErroreDest(L('searchError')); setCercando(false); return; }
      if (data.length === 0) { setErroreDest(L('placeNotFound')); }
      else if (data.length === 1) {
        setDest({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), displayName: data[0].display_name });
      } else {
        setRisultati(data.map(p => ({ lat: parseFloat(p.lat), lon: parseFloat(p.lon), displayName: p.display_name })));
      }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] https://nominatim.openstreetmap.org:', e?.message || e);
      setErroreDest(L('searchError')); }
    setCercando(false);
  }, [userPos, driverLang, L]);

  const scegli = useCallback((r) => { vibrate(12); setDest(r); setRisultati([]); setQuery(r.displayName.split(',').slice(0, 3).join(', ')); }, []);

  // b.248 — modificare la ricerca dopo aver scelto una destinazione invalida
  // la scelta: campo, mappa e QR non possono dire due cose diverse. La
  // riscrittura programmatica di `query` dentro `scegli` non passa da qui
  // (un input controllato non emette onChange per le scritture da codice),
  // quindi la destinazione appena scelta non si auto-invalida.
  const cambiaQuery = useCallback((v) => { setQuery(v); setDest(null); }, []);

  // ── Traduci (percorso /api/translate provato) ──
  const traduci = useCallback(async (raw) => {
    const text = (raw ?? testo).trim();
    if (text.length < 1) return '';
    setTraducendo(true); setErroreTrad('');
    try {
      const src = getLang(myLang); const tgt = getLang(driverLang);
      const res = await fetch('/api/translate', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, sourceLang: myLang, targetLang: driverLang,
          sourceLangName: src?.name || myLang, targetLangName: tgt?.name || driverLang,
          userToken: userToken || '',
        }),
      });
      if (!res.ok) { setErroreTrad(res.status === 402 ? L('creditExhausted') : L('translationRetryLater')); setTraducendo(false); return ''; }
      // b.363 — prima la lettura non era protetta: una risposta rotta finiva
      // nel catch generico e si annunciava "sei senza connessione" anche con
      // la rete perfettamente funzionante.
      const data = await res.json().catch(() => null);
      if (!data) { setErroreTrad(L('translationRetryLater')); setTraducendo(false); return ''; }
      // b.363 — traduzione respinta = 200 col testo di partenza. Qui la frase
      // viene MOSTRATA e poi LETTA ad alta voce al tassista: dirgli la frase
      // nella lingua del passeggero, spacciata per tradotta, e peggio che
      // dirgli che la traduzione non e riuscita.
      if (data.validationFailed) { setErroreTrad(L('translationRetryLater')); setTraducendo(false); return ''; }
      const out = data.translated || '';
      setTradotto(out);
      // b.248 — si fissa la coppia (testo, lingua) a cui questa traduzione
      // appartiene: e il metro con cui tradottoValido decide se mostrarla.
      setFonteTraduzione({ testo: text, lingua: driverLang });
      setTraducendo(false);
      return out;
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/translate:', e?.message || e);
      setErroreTrad(L('youHaveNoConnection')); setTraducendo(false); return ''; }
  }, [testo, myLang, driverLang, userToken, L]);

  // ── Voce (Edge → OpenAI, in coda: come SpeakerView) ──
  const procura = useCallback(async (text, lang) => {
    const langCode = getLang(lang)?.speech || lang || 'en';
    try {
      const edge = await fetch('/api/tts-edge', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, langCode, gender: 'female' }),
      });
      if (edge.ok) { const b = await edge.blob(); if (b.size > 0) return b; }
    } catch { /* Edge non disponibile: si passa a OpenAI */ }
    try {
      const res = await fetch('/api/tts', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    const audio = new Audio(url); audioRef.current = audio; audio.volume = 1.0;
    const chiudi = () => { URL.revokeObjectURL(url); finito(); };
    audio.onended = chiudi; audio.onerror = chiudi;
    setTimeout(chiudi, 30000);
    audio.play().catch(chiudi);
  }), []);

  const ascolta = useCallback((text) => {
    if (!text) return;
    setSuonando(true);
    codaRef.current.accoda(`${text.slice(0, 60)}|${driverLang}`, () => procura(text, driverLang), async (blob) => {
      await suona(blob);
      if (codaRef.current.inCoda() === 0) setSuonando(false);
    });
  }, [driverLang, procura, suona]);

  // ── Dettatura (Web Speech API, nella MIA lingua) ──
  const dettaturaOff = useCallback(() => {
    if (speechRef.current) { try { speechRef.current.stop(); } catch { /* il riconoscimento era già chiuso: fermarlo di nuovo non serve */ } speechRef.current = null; }
    setRegistrando(false);
  }, []);

  const dettatura = useCallback(() => {
    if (registrando) { dettaturaOff(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErroreTrad(L('speechNotSupported')); return; }
    vibrate(); setRegistrando(true);
    const rec = new SR(); speechRef.current = rec;
    rec.lang = getLang(myLang)?.speech || 'it-IT';
    rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    let finale = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finale += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setTesto((finale + interim).trim());
    };
    rec.onerror = (e) => { if (e.error === 'no-speech') return; };
    rec.onend = async () => {
      speechRef.current = null; setRegistrando(false);
      const t = finale.trim();
      // b.248 — il campo si allinea al testo DAVVERO tradotto: onresult
      // scrive (finale+interim), ma qui si traduce solo `finale`. Se un
      // residuo provvisorio li facesse divergere, il cancello tradottoValido
      // nasconderebbe una traduzione appena fatta.
      if (t) { setTesto(t); const out = await traduci(t); if (out) ascolta(out); }
    };
    try { rec.start(); } catch { setRegistrando(false); }
  }, [registrando, dettaturaOff, myLang, traduci, ascolta, L]);

  useEffect(() => () => dettaturaOff(), [dettaturaOff]);

  // Link mappa + QR (il QR contiene il link alla mappa vera del tassista)
  const mapUrl = dest ? buildMapsUrl({ lat: dest.lat, lng: dest.lon, normalizedAddress: dest.displayName }, 'google') : '';
  const qrSrc = mapUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(mapUrl)}`
    : '';

  const condividiMappa = useCallback(async () => {
    if (!mapUrl) return; vibrate(12);
    if (navigator.share) { try { await navigator.share({ title: 'TaxiTalk', text: dest?.displayName || '', url: mapUrl }); } catch { /* l'utente ha annullato la condivisione: nessuna azione necessaria */ } }
    else { try { await navigator.clipboard.writeText(mapUrl); } catch { /* clipboard non disponibile */ } }
  }, [mapUrl, dest]);

  // ── Stili ──
  // b.482 — VENTI di rientro laterale dentro la carta, come il template e
  // come le altre schermate: erano sedici, e passando da una pagina
  // all'altra il contenuto saltava di quattro punti.
  const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '16px 20px', margin: '10px 0' };
  const inputStyle = { flex: 1, background: C.input, border: `1px solid ${C.border}`, borderRadius: 13, padding: '12px 14px', color: C.text, fontSize: 14, fontFamily: FONT, outline: 'none', minWidth: 0 };
  // b.482 — QUARANTAQUATTRO di altezza utile: sotto questa misura, su un
  // telefono, il dito sbaglia bersaglio. L'aspetto del tasto non cambia.
  const miniBtn = (on) => ({ minHeight: 44, padding: '0 16px', borderRadius: 13, border: 'none', cursor: on ? 'pointer' : 'default', background: on ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : C.card2, color: on ? C.inchiostro : C.muted, fontWeight: 600, fontFamily: FONT, fontSize: 13, opacity: on ? 1 : 0.6 });

  return (
    // b.482 — margini laterali a 20, la misura comune di tutte le schermate.
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', color: C.text, fontFamily: FONT, background: 'transparent', padding: '0 20px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 2px 6px' }}>
        {/* b.206 — pulsante indietro uniforme (glifo ‹, r12) come le altre pagine */}
        {/* b.482 — e sale a 44×44 come la cornice comune: e il tasto piu premuto
            dell'applicazione, ed era l'unico qui sotto la soglia. */}
        <button onClick={() => { vibrate(8); setView('home'); }} aria-label={L('back')}
          style={{ width: 44, height: 44, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {'‹'}
        </button>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.3px' }}>Taxi<span style={{ color: C.accent }}>Talk</span></div>
        {/* b.482 — bersaglio da 44 anche per la targhetta della lingua: il
            disegno resta identico, sale solo l'altezza utile. */}
        <button onClick={() => { vibrate(8); setPickerLingua(true); }}
          style={{ marginLeft: 'auto', minHeight: 44, display: 'flex', alignItems: 'center', gap: 7, background: C.card, border: `1px solid ${C.border}`, padding: '7px 12px', borderRadius: 12, cursor: 'pointer', color: C.text }}>
          <span style={{ fontSize: 16 }}>{driverInfo?.flag || ''}</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{driverInfo?.name || driverLang.toUpperCase()}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      <div style={{ fontSize: 12, color: C.muted, padding: '0 2px 4px' }}>{L('taxiDriverLangHint')}: <b style={{ color: C.text }}>{driverInfo?.name}</b></div>

      {/* 1 · DOVE VAI */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: C.inchiostro }}>1</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{L('taxiWhereTo')}</span>
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>{L('taxiShowOrScan')}</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input value={query} onChange={(e) => cambiaQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) cerca(query); }}
            placeholder={L('searchAddress')} style={inputStyle} />
          <button onClick={() => query.trim() && cerca(query)} disabled={!query.trim() || cercando} style={miniBtn(!!query.trim() && !cercando)}>
            {cercando ? '…' : L('search')}
          </button>
        </div>

        {risultati.length > 0 && (
          <div style={{ marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {risultati.map((r, i) => (
              // b.482 — ogni riga dell'elenco e un bersaglio da 44: si sceglie
              // un indirizzo col dito, spesso in movimento.
              <button key={i} onClick={() => scegli(r)} style={{ width: '100%', minHeight: 44, textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', borderBottom: i < risultati.length - 1 ? `1px solid ${C.border}` : 'none', color: C.text, fontSize: 12, fontFamily: FONT, cursor: 'pointer', lineHeight: 1.4 }}>
                <b>{r.displayName.split(',').slice(0, 2).join(',')}</b>
                <div style={{ fontSize: 10, color: C.muted }}>{r.displayName.split(',').slice(2, 5).join(',')}</div>
              </button>
            ))}
          </div>
        )}
        {erroreDest && <div style={{ fontSize: 11, color: C.errore, marginTop: 6 }}>{erroreDest}</div>}

        {dest && (
          <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TaxiMap lat={dest.lat} lng={dest.lon} altezza={150} raggio={16} comandi={false} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dest.displayName.split(',').slice(0, 3).join(',')}</div>
            </div>
            <div style={{ width: 132, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: C.input, border: `1px solid ${C.border}`, borderRadius: 16, padding: '12px 10px' }}>
              {/* b.482 — la descrizione del QR era la parola inglese "QR"
                  scritta a mano: ora viene dal pacchetto lingua. Il QR resta
                  nero su bianco, che e la sua condizione per essere letto. */}
              {qrSrc
                ? <img src={qrSrc} alt={L('qrTaxiBtn')} width={104} height={104} style={{ borderRadius: 10, background: '#fff', padding: 6, display: 'block' }} />
                : <div style={{ width: 104, height: 104, borderRadius: 10, background: C.card2 }} />}
              <div style={{ fontSize: 10, color: C.muted, textAlign: 'center', lineHeight: 1.35 }}>{L('taxiScanOpensMap')}</div>
              {/* b.482 — "condividi il link" era un testo nudo senza altezza:
                  bersaglio da 44 come tutti gli altri tasti. */}
              <button onClick={condividiMappa} style={{ minHeight: 44, fontSize: 11, fontWeight: 600, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>{L('taxiShareLink')}</button>
            </div>
          </div>
        )}
      </div>

      {/* 2 · PARLA / SCRIVI */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: C.inchiostro }}>2</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{L('taxiSpeakOrType')}</span>
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>{driverInfo?.name}</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input value={testo} onChange={(e) => setTesto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && testo.trim()) traduci(); }}
            placeholder={L('taxiTypeHere')} style={inputStyle} />
          <button onClick={() => testo.trim() && traduci()} disabled={!testo.trim() || traducendo} style={miniBtn(!!testo.trim() && !traducendo)}>
            {traducendo ? '…' : L('translate')}
          </button>
        </div>

        {erroreTrad && <div style={{ fontSize: 11, color: C.errore, marginTop: 6 }}>{erroreTrad}</div>}

        {tradottoValido && (
          <div style={{ marginTop: 14, background: `linear-gradient(145deg, ${C.accent}14, ${C.purple}0e)`, border: `1px solid ${C.accent}38`, borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{driverInfo?.flag} {driverInfo?.name}</div>
            <div style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.32 }}>{tradottoValido}</div>
            {testo && <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 8 }}>{testo}</div>}
          </div>
        )}

        {/* b.482 — i due tasti sotto la traduzione salgono a 44 di altezza
            utile: erano quarantadue, appena sotto la soglia. */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => { if (tradottoValido) { vibrate(10); setFlip(true); } }} disabled={!tradottoValido}
            style={{ flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12, borderRadius: 14, border: 'none', cursor: tradottoValido ? 'pointer' : 'default', background: tradottoValido ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : C.card2, color: tradottoValido ? C.inchiostro : C.muted, fontWeight: 600, fontSize: 13, fontFamily: FONT, opacity: tradottoValido ? 1 : 0.6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
            {L('taxiShowFlipped')}
          </button>
          <button onClick={() => tradottoValido && ascolta(tradottoValido)} disabled={!tradottoValido || suonando}
            style={{ flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12, borderRadius: 14, border: `1px solid ${C.border}`, cursor: tradottoValido ? 'pointer' : 'default', background: C.card2, color: C.text, fontWeight: 600, fontSize: 13, fontFamily: FONT, opacity: tradottoValido ? 1 : 0.6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>
            {suonando ? '…' : L('taxiListen')}
          </button>
        </div>

        {/* Mic dettatura */}
        {/* b.482 — IL MICROFONO COMUNE. Qui era un tondo pieno con una
            sfumatura e due esadecimali scritti a mano (il rosso della
            registrazione e il colore dell'icona): un disegno in piu per un
            gesto che nell'applicazione ne ha gia uno. Adesso e quello di
            ui/Microfono.js — il colore lo porta l'alone, l'icona resta
            chiara. Cosa fa al tocco non e cambiato: accende e spegne la
            dettatura come prima. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <button onClick={dettatura} aria-label={L('taxiDictate')}
            style={{ ...veste.cerchio, flexShrink: 0, ...(registrando ? { animation: 'ttPulse 1.2s ease-in-out infinite' } : {}) }}>
            <Icon name="mic" size={veste.icona} color={veste.coloreIcona} />
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: C.faint, marginTop: 8 }}>{registrando ? `● ${L('taxiListeningTap')}` : L('taxiTapToDictate')}</div>
      </div>

      {/* 3 · CHAT opzionale */}
      <button onClick={() => { vibrate(8); setView('taxi-chat'); }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderRadius: 16, background: C.card, border: `1px dashed ${C.border}`, cursor: 'pointer', margin: '4px 0', fontFamily: FONT, textAlign: 'left' }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: `${C.purple}24`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.purple, flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
        </span>
        <span style={{ flex: 1 }}>
          <b style={{ fontSize: 13, fontWeight: 600, display: 'block', color: C.text }}>{L('taxiChatOptional')}</b>
          <span style={{ fontSize: 11, color: C.muted }}>{L('taxiChatHint')}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>

      {/* Picker lingua tassista */}
      {pickerLingua && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setPickerLingua(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
          {/* b.482 — rientro laterale a 20 anche nel foglio delle lingue. */}
          <div style={{ width: '100%', background: C.bg, borderRadius: '20px 20px 0 0', maxHeight: '80dvh', overflowY: 'auto', padding: '16px 20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{L('taxiDriverLangHint')}</div>
              {/* b.482 — la crocetta per chiudere sale a 44×44. */}
              <button onClick={() => setPickerLingua(false)} aria-label={L('close')} style={{ marginLeft: 'auto', width: 44, height: 44, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {LINGUE_TAXI.map((code) => {
                const li = getLang(code); const on = code === driverLang;
                return (
                  <button key={code} onClick={() => { vibrate(10); setDriverLang(code); setPickerLingua(false); }}
                    style={{ padding: '12px 8px', borderRadius: 14, cursor: 'pointer', background: on ? `${C.accent}20` : C.card, border: `1px solid ${on ? C.accent : C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontFamily: FONT }}>
                    <span style={{ fontSize: 24 }}>{li?.flag || ''}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: on ? C.accent : C.text }}>{li?.name || code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY RIBALTATO — girato verso il tassista */}
      {flip && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: col.bgGradient || C.bg, display: 'flex', flexDirection: 'column', animation: 'ttUp 0.28s ease-out' }}>
          {/* b.482 — testata del ribaltamento: rientro 20 e crocetta da 44. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{L('taxiTurnedToDriver')}</div>
            <button onClick={() => setFlip(false)} aria-label={L('close')} style={{ width: 44, height: 44, borderRadius: '50%', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '34px 26px', transform: 'rotate(180deg)' }}>
            <div style={{ fontSize: 34, marginBottom: 6 }}>{driverInfo?.flag}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>{driverInfo?.name}</div>
            <div style={{ fontSize: 30, fontWeight: 600, textAlign: 'center', lineHeight: 1.35, color: C.text, maxWidth: '90%', wordBreak: 'break-word' }}>{tradottoValido}</div>
            {testo && <div style={{ fontSize: 14, color: C.muted, fontStyle: 'italic', marginTop: 20, textAlign: 'center' }}>{testo}</div>}
          </div>
          {/* b.482 — rientro laterale a 20 anche nella fascia dell'ascolto. */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 20px 30px', borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => ascolta(tradottoValido)} disabled={suonando} aria-label={L('taxiListen')}
              style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', background: C.amber, color: C.inchiostro, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(245,166,35,0.34)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ttPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.07); } }
        @keyframes ttUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

export default memo(TaxiTalk);
