'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { createNoiseGate } from '../lib/noiseGate.js';
import { apiCircuitBreaker } from '../lib/circuitBreaker.js';
import useStreamingInterpreter from './useStreamingInterpreter.js';
import { createLogger } from '../lib/logger.js';
import { getVolumeTTS } from '../lib/audioPrefs.js';
import { prendiVoce, rendiVoce } from '../lib/microfonoMaster.js';
const dbg = createLogger('interpreter');

// ═══════════════════════════════════════
// useInterpreterMode — Bidirectional real-time STT → Translate → TTS
//
// TWO MODES:
// A) STREAMING (Deepgram available): subtitle-first pipeline
//    - Real-time STT via WebSocket
//    - Incremental translation with conversation context
//    - Subtitles appear instantly, TTS per completed sentence
//
// B) LEGACY (Deepgram unavailable): 3-second chunk pipeline
//    - Capture 3s audio chunks via MediaRecorder
//    - STT → Translate → TTS per chunk (sequenziale)
//
// Works on both voice and video calls.
// ═══════════════════════════════════════

const CHUNK_DURATION = 3000; // 3 seconds (legacy mode)

// b.247 — tetto della coda dei blocchi audio in attesa di essere tradotti.
// Dodici blocchi da 3 secondi sono 36 secondi di parlato accumulato: oltre
// quella soglia non si e piu in ritardo, si e in un'altra conversazione, e
// consegnare quella roba serve solo a confondere. Vedi `accodaChunk`.
const MAX_CODA_CHUNK = 12;

export default function useInterpreterMode({
  webrtc, myLang, partnerLang, roomId, roomSessionTokenRef, userToken, useOwnKeys,
  startDucking, stopDucking,
  conversationContext,  // NEW: { getContext, addMessage } from useConversationContext
  preferisciEleven = false, // b.352 — la voce premium in chiamata
}) {
  const [active, setActive] = useState(false);
  const [mySubtitles, setMySubtitles] = useState([]);
  const [partnerSubtitles, setPartnerSubtitles] = useState([]);
  const [lastSubtitle, setLastSubtitle] = useState(null);
  const daRendereRef = useRef(null);        // b.277 — la copia del microfono unico da rendere

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const noiseGateRef = useRef(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const processChunkRef = useRef(null);
  // b.247 — coda FIFO dei blocchi audio (vedi `accodaChunk`)
  const codaChunkRef = useRef([]);
  const accodaChunkRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { activeRef.current = active; }, [active]);

  // Dedup: track recently processed message fingerprints to prevent duplicate audio/subtitles
  const seenMsgsRef = useRef(new Set());
  // Track subtitle timeout IDs for cleanup on unmount
  const subtitleTimersRef = useRef([]);

  // Buffer for reassembling chunked audio parts
  const audioPartsRef = useRef({}); // { [id]: { parts: {}, total: number, ts: number } }

  // Cleanup stale incomplete audio buffers every 30s (prevents memory leaks)
  useEffect(() => {
    const interval = setInterval(() => {
      const buf = audioPartsRef.current;
      const now = Date.now();
      for (const id of Object.keys(buf)) {
        if (now - (buf[id].ts || 0) > 30000) {
          console.warn('[Interpreter] Dropping stale audio buffer:', id);
          delete buf[id];
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Play base64 audio helper — activates ducking while playing
  const playBase64Audio = useCallback((base64Data) => {
    try {
      const audioBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      // b.276 — P1: IL VOLUME ORA LO COMANDI TU.
      // Era fisso a 0,9: spegnere "Ascolta la voce" o abbassare il
      // cursore non aveva alcun effetto sull'interprete, perche questa
      // riga non guardava la preferenza. Ora la legge, e a volume zero
      // non si riproduce affatto.
      const volume = getVolumeTTS();
      if (volume <= 0) { URL.revokeObjectURL(url); return; }
      audio.volume = volume;
      // Duck partner audio while interpreter speaks
      // b.276 — P1: L'ATTENUAZIONE DELL'ORIGINALE.
      // startDucking abbassa un volume interno che la voce del partner
      // in videochiamata non attraversa: "Solo tradotta / Attenuata /
      // Entrambe" restava senza effetto durante l'interprete. La stanza
      // ascolta un avviso preciso per abbassare la voce vera: ora
      // l'interprete lo manda, come gia fa la voce normale.
      const avvisa = (acceso) => {
        try { window.dispatchEvent(new CustomEvent('bartalk:tts', { detail: { attivo: acceso } })); }
        catch { /* fuori dal browser non c'e nessuno da avvisare: si prosegue */ }
      };
      startDucking?.();
      avvisa(true);
      audio.play().catch(() => {});
      audio.onended = () => {
        URL.revokeObjectURL(url);
        stopDucking?.();
        avvisa(false);
      };
      audio.onerror = () => { stopDucking?.(); avvisa(false); };
    } catch (e) {
      console.warn('[Interpreter] Failed to play audio:', e);
      stopDucking?.();
    }
  }, [startDucking, stopDucking]);

  // Process incoming interpreter data from partner
  const handleInterpreterMessage = useCallback((msg) => {
    if (!msg) return;

    if (msg.type === 'interpreter-subtitle') {
      // Dedup: skip if we already showed this exact subtitle recently
      const fingerprint = `sub:${msg.text}:${msg.lang}`;
      if (seenMsgsRef.current.has(fingerprint)) return;
      seenMsgsRef.current.add(fingerprint);
      // LRU: cap at 50 entries
      if (seenMsgsRef.current.size > 50) {
        seenMsgsRef.current.delete(seenMsgsRef.current.values().next().value);
      }

      const sub = { text: msg.text, original: msg.originalText || '', lang: msg.lang, ts: Date.now() };
      setPartnerSubtitles(prev => [...prev.slice(-20), sub]);
      // b.276 — P0: UN SOLO CONTRATTO PER IL SOTTOTITOLO.
      // Qui prima finiva una STRINGA, e la schermata della videochiamata
      // le chiedeva "originale" e "tradotto" — due campi che una stringa
      // non ha. Risultato: la traduzione era giusta e il sottotitolo
      // restava vuoto. Ora esce sempre una scheda con gli stessi campi,
      // da tutti e due i percorsi.
      setLastSubtitle(sub);
      // Auto-clear after 8s — track timer for cleanup on unmount
      const timerId = setTimeout(() => {
        setLastSubtitle(prev => (prev && prev.text === msg.text) ? null : prev);
        subtitleTimersRef.current = subtitleTimersRef.current.filter(id => id !== timerId);
      }, 8000);
      subtitleTimersRef.current.push(timerId);
    }

    // Single audio message (fits in one DC frame)
    if (msg.type === 'interpreter-audio' && msg.data) {
      // Dedup: skip if we already played this audio (first 40 chars as fingerprint)
      const audioFp = `audio:${msg.data.substring(0, 40)}`;
      if (seenMsgsRef.current.has(audioFp)) return;
      seenMsgsRef.current.add(audioFp);
      if (seenMsgsRef.current.size > 50) {
        seenMsgsRef.current.delete(seenMsgsRef.current.values().next().value);
      }
      playBase64Audio(msg.data);
    }

    // Chunked audio message (split across multiple DC frames)
    if (msg.type === 'interpreter-audio-part' && msg.id && msg.data != null) {
      const buf = audioPartsRef.current;
      if (!buf[msg.id]) buf[msg.id] = { parts: {}, total: msg.total, ts: Date.now() };
      buf[msg.id].parts[msg.part] = msg.data;
      // Check if all parts received
      const entry = buf[msg.id];
      if (Object.keys(entry.parts).length === entry.total) {
        // Reassemble in order
        let fullBase64 = '';
        for (let i = 0; i < entry.total; i++) {
          fullBase64 += entry.parts[i] || '';
        }
        delete buf[msg.id];
        playBase64Audio(fullBase64);
      }
    }
  }, [playBase64Audio]);

  // Process a single audio chunk: STT → Translate → TTS → Send
  //
  // b.247 — qui c'era `if (!activeRef.current || processingRef.current) return;`
  // e quel `processingRef.current` BUTTAVA VIA il blocco. Il MediaRecorder ne
  // consegna uno ogni 3 secondi (CHUNK_DURATION), ma la catena
  // STT → traduzione → TTS → base64 → DataChannel spesso ci mette di piu: il
  // blocco successivo arrivava mentre il precedente era ancora in viaggio e
  // spariva senza un rigo di registro. Su rete lenta si perdevano frasi
  // intere, in silenzio — in un interprete e il difetto peggiore possibile,
  // perche chi parla non ha modo di accorgersene.
  // Ora chi decide l'ordine e la coda (`accodaChunk` / `elaboraCoda`) e
  // `processingRef` serve solo a garantire che si elabori uno per volta.
  const processChunk = useCallback(async (blob) => {
    if (!activeRef.current) return;
    if (!blob || blob.size < 1000) return; // Skip tiny/silent chunks

    try {
      // 1. STT — Transcribe audio
      // /api/transcribe reads userToken + sourceLang from formData (NOT headers)
      const formData = new FormData();
      formData.append('audio', blob, 'chunk.webm');
      formData.append('sourceLang', myLang);
      if (userToken) formData.append('userToken', userToken);
      if (roomId) formData.append('roomId', roomId);
      // b.161 — senza questo, resolveAuth rifiuta con 401 il percorso
      // roomId (vedi apiAuth.js, punto 2 quarto audit).
      if (roomId && roomSessionTokenRef?.current) formData.append('roomSessionToken', roomSessionTokenRef.current);

      const sttRes = await apiCircuitBreaker.execute('interpreter-stt', () =>
        fetch('/api/transcribe', { method: 'POST', body: formData })
      );

      if (!sttRes.ok) { return; }
      const { original: transcript } = await sttRes.json();
      if (!transcript || transcript.trim().length < 2) { return; }

      // Add to my subtitles
      const mySub = { text: transcript, lang: myLang, ts: Date.now() };
      setMySubtitles(prev => [...prev.slice(-20), mySub]);

      // 2. Translate — /api/translate expects sourceLang/targetLang/userToken in JSON body
      const translateRes = await apiCircuitBreaker.execute('interpreter-translate', () =>
        fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: transcript,
            sourceLang: myLang,
            targetLang: partnerLang,
            userToken: userToken || '',
            roomId,
            roomSessionToken: roomId ? (roomSessionTokenRef?.current || undefined) : undefined,
          }),
        })
      );

      if (!translateRes.ok) { return; }
      const risposta = await translateRes.json();
      // b.363 — LA TRAPPOLA DEL "200 CHE MENTE": traduzione respinta dal
      // controllo qualita = 200 col testo ORIGINALE. Qui il testo va sia nel
      // sottotitolo dell'interlocutore sia in bocca alla voce sintetica: si
      // sarebbe sentito parlare nella lingua di partenza credendo di
      // ascoltare una traduzione. Meglio niente che una bugia.
      if (risposta?.validationFailed) { return; }
      const { translated } = risposta;
      if (!translated) { return; }

      // b.277 — P1: IL TESTO NON ASPETTA LA VOCE.
      // Il sottotitolo era pronto qui, ma partiva solo DOPO la sintesi
      // vocale e la conversione dell'audio: chi leggeva aspettava
      // secondi per un testo che esisteva gia. Ora il sottotitolo parte
      // subito; la voce lo raggiunge quando e pronta.
      if (webrtc?.sendDirectMessage) {
        webrtc.sendDirectMessage({
          type: 'interpreter-subtitle',
          text: translated,
          lang: partnerLang,
          originalText: transcript,
          originalLang: myLang,
        });
      }

      // 3. TTS — Generate audio of translation
      // /api/tts-edge expects langCode (not lang)
      const ttsRes = await apiCircuitBreaker.execute('interpreter-tts', () =>
        fetch('/api/tts-edge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: translated,
            langCode: partnerLang,
            // b.167 — vedi la POST verso /api/translate poco sopra: stesso
            // motivo, stesso schema.
            roomId,
            roomSessionToken: roomId ? (roomSessionTokenRef?.current || undefined) : undefined,
          }),
        })
      );

      if (!ttsRes.ok) { return; }
      const ttsBlob = await ttsRes.blob();
      const ttsBuffer = await ttsBlob.arrayBuffer();
      // Convert to base64 in chunks to avoid "Maximum call stack size exceeded"
      // (String.fromCharCode(...spread) crashes when array > ~64K elements)
      const bytes = new Uint8Array(ttsBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const ttsBase64 = btoa(binary);

      // 4. Send via DataChannel to partner
      // IMPORTANT: pass objects (not strings) — sendDirectMessage handles JSON.stringify + E2E
      if (webrtc?.sendDirectMessage) {
        // b.277 — il sottotitolo e gia partito, qui viaggia solo la voce.
        // Send audio (split into chunks if too large for DC)
        // Browser RTCDataChannel limit is ~16KB per message.
        // After JSON.stringify + E2E encryption overhead (~200 bytes),
        // 10KB base64 chunks stay safely under the 16KB browser limit.
        const MAX_DC_SIZE = 10000; // 10KB safe for 16KB browser limit + encryption overhead
        if (ttsBase64.length <= MAX_DC_SIZE) {
          webrtc.sendDirectMessage({
            type: 'interpreter-audio',
            data: ttsBase64,
          });
        } else {
          // Split into parts
          const parts = Math.ceil(ttsBase64.length / MAX_DC_SIZE);
          const id = Date.now().toString(36);
          for (let i = 0; i < parts; i++) {
            webrtc.sendDirectMessage({
              type: 'interpreter-audio-part',
              id,
              part: i,
              total: parts,
              data: ttsBase64.slice(i * MAX_DC_SIZE, (i + 1) * MAX_DC_SIZE),
            });
          }
        }
      }
    } catch (e) {
      console.warn('[Interpreter] Process chunk error:', e);
    }
  }, [myLang, partnerLang, roomId, roomSessionTokenRef, userToken, webrtc]);

  // Keep processChunkRef in sync so recorder.ondataavailable always calls latest version
  // (avoids stale closure if myLang/partnerLang/userToken change mid-recording)
  useEffect(() => { processChunkRef.current = processChunk; }, [processChunk]);

  // ═══ CODA FIFO DEI BLOCCHI AUDIO (b.247) ═══
  // Elabora la coda un blocco alla volta, in ordine di arrivo. Non salta
  // niente: se e in corso un'elaborazione questa chiamata torna subito e il
  // ciclo gia avviato prendera in carico anche i blocchi appena accodati.
  const elaboraCoda = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (codaChunkRef.current.length > 0 && activeRef.current) {
        const blob = codaChunkRef.current.shift();
        await processChunkRef.current?.(blob);
      }
    } finally {
      processingRef.current = false;
      // Se nel frattempo l'interprete e stato spento, quello che resta in
      // coda e roba di una conversazione finita: non si consegna.
      if (!activeRef.current) codaChunkRef.current = [];
    }
  }, []);

  // Accoda un blocco e fa ripartire l'elaborazione.
  // Il tetto MAX_CODA_CHUNK esiste perche una coda che cresce all'infinito
  // e un altro modo di rompersi: si finisce a tradurre, con un minuto di
  // ritardo, frasi a cui nessuno risponde piu. Quando si supera si butta il
  // PIU VECCHIO (la conversazione recente conta piu di quella vecchia) e lo
  // si DICHIARA in console: il difetto originale non era lo scarto, era lo
  // scarto in SILENZIO.
  const accodaChunk = useCallback((blob) => {
    if (!activeRef.current) return;
    if (!blob || blob.size < 1000) return; // blocchi vuoti o di solo silenzio
    codaChunkRef.current.push(blob);
    if (codaChunkRef.current.length > MAX_CODA_CHUNK) {
      const scartati = codaChunkRef.current.length - MAX_CODA_CHUNK;
      codaChunkRef.current.splice(0, scartati);
      console.warn(`[Interpreter] b.247 — coda STT piena (max ${MAX_CODA_CHUNK}): scartati ${scartati} blocchi audio, i piu vecchi. La catena STT/traduzione/TTS non tiene il passo del microfono.`);
    }
    elaboraCoda();
  }, [elaboraCoda]);

  useEffect(() => { accodaChunkRef.current = accodaChunk; }, [accodaChunk]);

  // Start recording + processing loop
  const startInterpreter = useCallback(async () => {
    try {
      // b.277 — copia dal microfono unico, ripiego sull'apertura diretta.
      let rawStream;
      try { rawStream = await prendiVoce(); daRendereRef.current = rawStream; }
      catch { rawStream = await navigator.mediaDevices.getUserMedia({ audio: true }); daRendereRef.current = null; }
      streamRef.current = rawStream;

      // Apply noise gate for cleaner STT in noisy environments
      let recordStream = rawStream;
      try {
        const ng = createNoiseGate(rawStream, { threshold: -45 });
        if (ng?.cleanStream) {
          noiseGateRef.current = ng;
          recordStream = ng.cleanStream;
        }
      } catch (e) {
        console.warn('[Interpreter] Noise gate unavailable, using raw stream:', e);
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(recordStream, { mimeType });
      recorderRef.current = recorder;

      // b.247 — il blocco non si elabora piu qui: si ACCODA. Prima veniva
      // passato dritto a processChunk, che lo buttava via se era ancora
      // occupato con il precedente.
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0 && activeRef.current) {
          accodaChunkRef.current?.(e.data);
        }
      };

      // La coda parte vuota: quello che era rimasto da una sessione
      // precedente non ha piu niente a che fare con questa.
      codaChunkRef.current = [];
      recorder.start(CHUNK_DURATION);
      setActive(true);
      dbg.debug('[Interpreter] Started');
    } catch (e) {
      console.error('[Interpreter] Failed to start:', e);
      setActive(false);
    }
  }, []);

  // Stop recording
  const stopInterpreter = useCallback(() => {
    setActive(false);
    // b.247 — activeRef si allinea solo al render successivo: qui lo si
    // mette a posto subito, altrimenti un blocco consegnato in questo
    // istante dal MediaRecorder finirebbe ancora in coda. Poi la coda si
    // svuota: e parlato di una conversazione chiusa.
    activeRef.current = false;
    codaChunkRef.current = [];
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
    }
    recorderRef.current = null;
    if (noiseGateRef.current) {
      try { noiseGateRef.current.destroy(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      noiseGateRef.current = null;
    }
    if (streamRef.current) {
      // b.277 — se era una copia del microfono unico si rende al master.
      if (daRendereRef.current === streamRef.current) { rendiVoce(streamRef.current); daRendereRef.current = null; }
      else streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ } });
      streamRef.current = null;
    }
    dbg.debug('[Interpreter] Stopped');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // b.247 — vedi stopInterpreter: chi se ne va non deve lasciare blocchi
      // audio in attesa di essere tradotti.
      activeRef.current = false;
      codaChunkRef.current = [];
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      }
      if (streamRef.current) {
        // b.277 — se era una copia del microfono unico si rende al master.
      if (daRendereRef.current === streamRef.current) { rendiVoce(streamRef.current); daRendereRef.current = null; }
      else streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ } });
      }
      // Clear all pending subtitle timers
      subtitleTimersRef.current.forEach(id => clearTimeout(id));
      subtitleTimersRef.current = [];
    };
  }, []);

  // Auto-stop when webrtc disconnects
  useEffect(() => {
    if (webrtc?.webrtcState !== 'connected' && active) {
      stopInterpreter();
    }
  }, [webrtc?.webrtcState, active, stopInterpreter]);

  // ═══ STREAMING INTERPRETER (subtitle-first pipeline) ═══
  const streaming = useStreamingInterpreter({
    webrtc, myLang, partnerLang, roomId, roomSessionTokenRef, userToken,
    conversationContext,
    startDucking, stopDucking,
    preferisciEleven,
  });

  // ═══ UNIFIED API ═══
  // Try streaming first; if Deepgram unavailable, fall back to legacy chunks
  // b.277 — P1: l'avvio dura qualche secondo (permesso microfono, presa
  // di linea con chi trascrive) e in quel tempo `active` e ancora falso:
  // un ridisegno della schermata poteva far ripartire l'avvio SOPRA
  // quello in corso — due microfoni, due trascrizioni, doppio consumo.
  // Ora un avvio in corso chiude la porta al successivo.
  const avvioInCorsoRef = useRef(false);
  const startUnifiedInterno = useCallback(async () => {
    const streamingOk = await streaming.start();
    if (streamingOk) {
      dbg.debug('[Interpreter] Using streaming pipeline (subtitle-first)');
      return;
    }
    // Fallback to legacy chunk-based pipeline
    dbg.debug('[Interpreter] Streaming unavailable, using legacy 3s chunks');
    startInterpreter();
  }, [streaming.start, startInterpreter]);

  const startUnified = useCallback(async () => {
    if (avvioInCorsoRef.current) return;
    avvioInCorsoRef.current = true;
    try { await startUnifiedInterno(); }
    finally { avvioInCorsoRef.current = false; }
  }, [startUnifiedInterno]);

  const stopUnified = useCallback(() => {
    if (streaming.active) streaming.stop();
    else stopInterpreter();
  }, [streaming.active, streaming.stop, stopInterpreter]);

  const unifiedActive = active || streaming.active;
  const isStreaming = streaming.active;

  // Route incoming messages to the right handler
  const handleUnifiedMessage = useCallback((msg) => {
    if (streaming.active) {
      streaming.handleIncomingMessage(msg);
    } else {
      handleInterpreterMessage(msg);
    }
  }, [streaming.active, streaming.handleIncomingMessage, handleInterpreterMessage]);

  return {
    active: unifiedActive,
    isStreaming,
    setActive,
    mySubtitles: isStreaming ? streaming.mySubtitles : mySubtitles,
    partnerSubtitles: isStreaming ? streaming.partnerSubtitles : partnerSubtitles,
    // b.276 — la stessa scheda in tutti e due i percorsi: chi disegna non
    // deve piu indovinare se gli arriva una stringa o un oggetto.
    lastSubtitle: isStreaming
      ? (streaming.partnerLiveSubtitle
        ? { text: streaming.partnerLiveSubtitle, original: streaming.partnerLiveOriginale || '', ts: Date.now() }
        : null)
      : lastSubtitle,
    myLiveText: streaming.myLiveText,
    partnerLiveSubtitle: streaming.partnerLiveSubtitle,
    start: startUnified,
    stop: stopUnified,
    handleInterpreterMessage: handleUnifiedMessage,
    // b.352 — il silenzio spiegato: la voce non partita si dichiara.
    voceGuasta: streaming.voceGuasta,
    partnerVoceMancata: streaming.partnerVoceMancata,
  };
}
