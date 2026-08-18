'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { getLang } from '../lib/constants.js';
import { createNoiseGate } from '../lib/noiseGate.js';
import { deepgramAmmesso, USO } from '../lib/sttPolicy.js';
import { createLogger } from '../lib/logger.js';
const dbg = createLogger('streaming');

// ═══════════════════════════════════════════════════════════════
// useStreamingInterpreter — Subtitle-First + TTS a Frase
//
// Pipeline per modalità faccia-a-faccia:
// 1. Deepgram WebSocket STT streaming → trascrizioni interim/final
// 2. Ogni frase final (is_final + pausa) → traduzione con context → subtitle
// 3. Fine frase (utterance_end o pausa >800ms) → TTS sulla traduzione completa
// 4. Il partner vede subtitle in real-time, sente voce per frase completata
//
// Sfrutta la conversation memory per traduzione speculativa:
// - Il LLM sa di cosa si parla (context tags + ultimi 10 messaggi)
// - Frammenti parziali tradotti con alta confidenza grazie al contesto
// ═══════════════════════════════════════════════════════════════

const SENTENCE_PAUSE_MS = 800;       // Pausa che indica fine frase → trigger TTS
const MIN_WORDS_FOR_TRANSLATE = 2;   // Minimo parole per avviare traduzione chunk
const MAX_SUBTITLE_AGE_MS = 10000;   // Auto-clear subtitle dopo 10s
const TRANSLATE_DEBOUNCE_MS = 300;   // Debounce tra traduzioni incrementali

export default function useStreamingInterpreter({
  webrtc,
  myLang,
  partnerLang,
  roomId,
  roomSessionTokenRef,
  userToken,
  conversationContext,  // { getContext, addMessage }
  startDucking,
  stopDucking,
}) {
  const [active, setActive] = useState(false);
  const [myLiveText, setMyLiveText] = useState('');           // Testo STT in tempo reale (mio)
  const [partnerLiveSubtitle, setPartnerLiveSubtitle] = useState(''); // Subtitle tradotto in real-time
  const [mySubtitles, setMySubtitles] = useState([]);         // Cronologia subtitle miei
  const [partnerSubtitles, setPartnerSubtitles] = useState([]); // Cronologia subtitle partner

  // Refs
  const activeRef = useRef(false);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const noiseGateRef = useRef(null);
  const convContextRef = useRef(conversationContext);

  // Sentence accumulator
  const currentSentenceRef = useRef('');    // Frase corrente accumulata da final transcripts
  const interimTextRef = useRef('');         // Ultimo interim (preview)
  const lastFinalTimeRef = useRef(0);        // Timestamp ultimo final transcript
  const sentencePauseTimerRef = useRef(null); // Timer per detect fine frase
  const translateTimerRef = useRef(null);     // Debounce traduzione
  const currentTranslationRef = useRef('');   // Traduzione corrente della frase in corso
  const ttsQueueRef = useRef([]);             // Coda TTS frasi completate
  const processingTTSRef = useRef(false);
  const deepgramKeyRef = useRef(null);

  // Subtitle cleanup timers
  const subtitleTimersRef = useRef([]);

  // Sync refs
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { convContextRef.current = conversationContext; }, [conversationContext]);

  // ═══ FETCH DEEPGRAM KEY ═══
  useEffect(() => {
    // b.247 — la decisione «Deepgram si o no» era scritta in DUE posti che
    // non si parlavano: useDeepgramSTT.js la spegneva (b.172) e questo file
    // chiamava /api/stt-token lo stesso. Ora la risposta e una sola e sta in
    // lib/sttPolicy.js; qui ci si limita a chiederla.
    if (!deepgramAmmesso(USO.INTERPRETE)) return;
    // b.161 — roomSessionToken obbligatorio per il percorso roomId (vedi
    // stt-token/route.js, punto 2 quarto audit).
    fetch('/api/stt-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, roomId, roomSessionToken: roomSessionTokenRef?.current || undefined }) }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.key) deepgramKeyRef.current = d.key; })
      .catch(e => console.warn('[Interpreter] STT token failed:', e.message));
  }, [userToken, roomId, roomSessionTokenRef]);

  // ═══ INCREMENTAL TRANSLATION ═══
  // Traduce un frammento di frase con il conversation context
  const translateChunk = useCallback(async (text, isFinal = false) => {
    if (!text || text.trim().length < 3) return '';
    try {
      const context = convContextRef.current?.getContext?.() || '';
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          sourceLang: myLang,
          targetLang: partnerLang,
          sourceLangName: getLang(myLang)?.name || myLang,
          targetLangName: getLang(partnerLang)?.name || partnerLang,
          userToken: userToken || '',
          roomId,
          // b.161 — obbligatorio per il percorso roomId (vedi apiAuth.js,
          // punto 2 quarto audit).
          roomSessionToken: roomId ? (roomSessionTokenRef?.current || undefined) : undefined,
          conversationContext: context,
          // Hint per il modello: frammento parziale vs frase completa
          fragmentHint: isFinal ? undefined : 'partial',
        }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      return data.translated || '';
    } catch {
      return '';
    }
  }, [myLang, partnerLang, roomId, roomSessionTokenRef, userToken]);

  // ═══ SEND SUBTITLE TO PARTNER ═══
  const sendSubtitleToPartner = useCallback((translatedText, originalText, isFinal) => {
    if (!webrtc?.sendDirectMessage || !translatedText) return;
    webrtc.sendDirectMessage({
      type: 'interpreter-subtitle',
      text: translatedText,
      lang: partnerLang,
      originalText,
      originalLang: myLang,
      isFinal: !!isFinal,  // Partner sa se è parziale o finale
    });
  }, [webrtc, myLang, partnerLang]);

  // ═══ TTS + SEND AUDIO ═══
  const speakAndSend = useCallback(async (translatedText) => {
    if (!translatedText || translatedText.trim().length < 2) return;
    try {
      const ttsRes = await fetch('/api/tts-edge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: translatedText, langCode: partnerLang,
          // b.167 — stesso motivo delle altre chiamate di questo file
          // verso /api/stt-token qualche riga sopra.
          roomId,
          roomSessionToken: roomId ? (roomSessionTokenRef?.current || undefined) : undefined,
        }),
      });
      if (!ttsRes.ok) return;

      const ttsBlob = await ttsRes.blob();
      const buffer = await ttsBlob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);

      // Send audio via DataChannel
      if (webrtc?.sendDirectMessage) {
        const MAX_DC_SIZE = 10000;
        if (base64.length <= MAX_DC_SIZE) {
          webrtc.sendDirectMessage({ type: 'interpreter-audio', data: base64 });
        } else {
          const parts = Math.ceil(base64.length / MAX_DC_SIZE);
          const id = Date.now().toString(36);
          for (let i = 0; i < parts; i++) {
            webrtc.sendDirectMessage({
              type: 'interpreter-audio-part',
              id, part: i, total: parts,
              data: base64.slice(i * MAX_DC_SIZE, (i + 1) * MAX_DC_SIZE),
            });
          }
        }
      }
    } catch (e) {
      console.warn('[StreamInterp] TTS error:', e);
    }
  }, [partnerLang, webrtc, roomId, roomSessionTokenRef]);

  // ═══ TTS QUEUE PROCESSOR ═══
  // Processa la coda TTS sequenzialmente (una frase alla volta)
  const processTTSQueue = useCallback(async () => {
    if (processingTTSRef.current) return;
    processingTTSRef.current = true;
    try {
      while (ttsQueueRef.current.length > 0) {
        const item = ttsQueueRef.current.shift();
        if (item?.text) {
          startDucking?.();
          await speakAndSend(item.text);
          stopDucking?.();
        }
      }
    } finally {
      processingTTSRef.current = false;
    }
  }, [speakAndSend, startDucking, stopDucking]);

  // ═══ HANDLE SENTENCE COMPLETE ═══
  // Chiamata quando una frase è completa (pausa rilevata)
  const handleSentenceComplete = useCallback(async (sentence) => {
    if (!sentence || sentence.trim().length < 2) return;
    const trimmed = sentence.trim();

    // Traduzione finale della frase completa
    const translated = await translateChunk(trimmed, true);
    if (!translated) return;

    // Update translation display
    currentTranslationRef.current = translated;
    setPartnerLiveSubtitle(translated);

    // Send FINAL subtitle to partner
    sendSubtitleToPartner(translated, trimmed, true);

    // Add to subtitle history
    const sub = { text: translated, original: trimmed, ts: Date.now(), isFinal: true };
    setMySubtitles(prev => [...prev.slice(-20), sub]);

    // Add to conversation context (memory per disambiguation futura)
    convContextRef.current?.addMessage?.({
      sender: 'me',
      original: trimmed,
      translated,
      sourceLang: myLang,
      targetLang: partnerLang,
    });

    // Queue TTS (voce per frase completa)
    ttsQueueRef.current.push({ text: translated });
    processTTSQueue();

    // Clear current sentence
    currentSentenceRef.current = '';
    currentTranslationRef.current = '';
  }, [translateChunk, sendSubtitleToPartner, myLang, partnerLang, processTTSQueue]);

  // ═══ HANDLE TRANSCRIPT FROM DEEPGRAM ═══
  const handleTranscript = useCallback((transcript, isFinal) => {
    if (!activeRef.current || !transcript) return;

    if (isFinal) {
      // Accumula nella frase corrente
      currentSentenceRef.current += (currentSentenceRef.current ? ' ' : '') + transcript;
      lastFinalTimeRef.current = Date.now();
      interimTextRef.current = '';

      // Update live text display
      setMyLiveText(currentSentenceRef.current);

      // Debounced incremental translation (subtitle preview)
      if (currentSentenceRef.current.split(/\s+/).length >= MIN_WORDS_FOR_TRANSLATE) {
        clearTimeout(translateTimerRef.current);
        translateTimerRef.current = setTimeout(async () => {
          if (!activeRef.current) return;
          const partial = await translateChunk(currentSentenceRef.current, false);
          if (partial && activeRef.current) {
            currentTranslationRef.current = partial;
            setPartnerLiveSubtitle(partial);
            // Send interim subtitle to partner
            sendSubtitleToPartner(partial, currentSentenceRef.current, false);
          }
        }, TRANSLATE_DEBOUNCE_MS);
      }

      // Reset sentence pause timer — se non arriva nulla per SENTENCE_PAUSE_MS, la frase è finita
      clearTimeout(sentencePauseTimerRef.current);
      sentencePauseTimerRef.current = setTimeout(() => {
        if (currentSentenceRef.current.trim()) {
          handleSentenceComplete(currentSentenceRef.current);
        }
      }, SENTENCE_PAUSE_MS);

    } else {
      // Interim: mostra preview ma non accumula
      interimTextRef.current = transcript;
      const preview = currentSentenceRef.current + (currentSentenceRef.current ? ' ' : '') + transcript;
      setMyLiveText(preview);
    }
  }, [translateChunk, sendSubtitleToPartner, handleSentenceComplete]);

  // ═══ HANDLE UTTERANCE END (Deepgram) ═══
  // Deepgram manda UtteranceEnd quando rileva fine discorso
  const handleUtteranceEnd = useCallback(() => {
    clearTimeout(sentencePauseTimerRef.current);
    if (currentSentenceRef.current.trim()) {
      handleSentenceComplete(currentSentenceRef.current);
    }
  }, [handleSentenceComplete]);

  // ═══ ABORT COMPLETO (b.247) ═══
  // Era il difetto peggiore della modalita interprete: `start()` poteva
  // restituire false (errore del WebSocket, o scadenza dei 4 secondi)
  // LASCIANDO APERTO tutto quello che aveva gia acceso — il WebSocket, il
  // microfono di getUserMedia, l'AudioContext e lo ScriptProcessor che
  // continuava a spingere PCM dentro il socket. useInterpreterMode legge
  // quel false come «streaming non disponibile» e avvia subito la pipeline
  // a blocchi da 3 secondi: se il WebSocket Deepgram si apriva un istante
  // dopo, restavano DUE microfoni aperti e DUE trascrizioni in corso sulla
  // stessa voce — doppio consumo a pagamento, sottotitoli duplicati e
  // l'audio del dispositivo mai rilasciato.
  //
  // Qui si spegne tutto in un colpo solo. E IDEMPOTENTE: ogni pezzo viene
  // toccato solo se c'e ancora, e il ref viene azzerato subito dopo, cosi
  // chiamarla due volte (abort + stop, o abort + smontaggio) non e un
  // guasto. Nessuna dipendenza: lavora solo su ref.
  const abortaStreaming = useCallback(() => {
    if (processorRef.current) {
      try { processorRef.current.onaudioprocess = null; } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      try { processorRef.current.disconnect(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      if (ctx.state !== 'closed') { try { ctx.close(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ } }
    }
    if (noiseGateRef.current) {
      try { noiseGateRef.current.destroy(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      noiseGateRef.current = null;
    }
    if (streamRef.current) {
      const tracce = streamRef.current;
      streamRef.current = null;
      tracce.getTracks().forEach(t => { try { t.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ } });
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      try {
        // Si stacca prima l'ascolto: un socket in chiusura puo ancora
        // consegnare trascrizioni, e finirebbero sui sottotitoli di una
        // sessione che l'utente ha gia abbandonato.
        ws.onmessage = null; ws.onerror = null; ws.onclose = null; ws.onopen = null;
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'CloseStream' }));
        ws.close();
      } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
    }
    activeRef.current = false;
    setActive(false);
  }, []);

  // ═══ START STREAMING ═══
  const start = useCallback(async () => {
    // b.247 — chi decide se Deepgram si puo usare e lib/sttPolicy.js, non
    // questo file (vedi il commento sulla fetch della chiave).
    if (!deepgramAmmesso(USO.INTERPRETE)) {
      dbg.debug('[StreamInterp] Deepgram non ammesso dalla policy: si usa la pipeline a blocchi');
      return false;
    }

    if (!deepgramKeyRef.current) {
      // Try to get key
      try {
        const res = await fetch('/api/stt-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, roomId, roomSessionToken: roomSessionTokenRef?.current || undefined }) });
        if (res.ok) {
          const d = await res.json();
          if (d?.key) deepgramKeyRef.current = d.key;
        }
      } catch (e) { console.warn('[Interpreter] STT key retry failed:', e.message); }
    }

    if (!deepgramKeyRef.current) {
      console.error('[StreamInterp] No Deepgram key available');
      return false;
    }

    try {
      // Get mic stream
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = rawStream;

      // Noise gate
      let recordStream = rawStream;
      try {
        const ng = createNoiseGate(rawStream, { threshold: -45 });
        if (ng?.cleanStream) {
          noiseGateRef.current = ng;
          recordStream = ng.cleanStream;
        }
      } catch { /* filtro del rumore non applicabile: si registra il flusso cosi com e */ }

      // Deepgram WebSocket
      const speechLang = getLang(myLang)?.speech || 'en-US';
      const dgLang = speechLang.split('-')[0];
      const params = new URLSearchParams({
        model: 'nova-2',
        language: dgLang,
        smart_format: 'true',
        interim_results: 'true',
        utterance_end_ms: String(SENTENCE_PAUSE_MS),
        endpointing: '300',  // Più aggressivo per real-time
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
      });

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ['token', deepgramKeyRef.current]
      );
      wsRef.current = ws;

      return new Promise((resolve) => {
        // b.247 — UNA SOLA PORTA D'USCITA da questa promessa.
        // Prima l'esito negativo si dava in due punti scollegati
        // (`ws.onerror` e un `setTimeout(..., 4000)`) e nessuno dei due
        // spegneva niente; per giunta il temporizzatore non veniva mai
        // annullato, quindi continuava a scattare anche dopo una
        // connessione riuscita. Ora: si esce una volta sola, il
        // temporizzatore si annulla, e ogni esito NEGATIVO passa
        // obbligatoriamente dall'abort completo.
        let risolto = false;
        let timerAperturaId = null;
        const concludi = (esito) => {
          if (risolto) return;
          risolto = true;
          clearTimeout(timerAperturaId);
          if (!esito) abortaStreaming();
          resolve(esito);
        };

        ws.onopen = () => {
          dbg.debug('[StreamInterp] Connected to Deepgram');

          // Audio capture → PCM16 → WebSocket
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(recordStream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const input = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) {
              const s = Math.max(-1, Math.min(1, input[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            ws.send(pcm16.buffer);
          };

          source.connect(processor);
          // Don't connect processor to destination - this causes echo!
          // Processor only needs to capture audio, not output it
          setActive(true);
          concludi(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'Results') {
              const transcript = data.channel?.alternatives?.[0]?.transcript || '';
              if (transcript) {
                handleTranscript(transcript, data.is_final);
              }
            }
            // Deepgram UtteranceEnd = silenzio prolungato → frase finita
            if (data.type === 'UtteranceEnd') {
              handleUtteranceEnd();
            }
          } catch { /* messaggio del riconoscitore in un formato inatteso: si aspetta il prossimo */ }
        };

        ws.onerror = () => { console.warn('[StreamInterp] WS error'); concludi(false); };
        ws.onclose = () => {
          dbg.debug('[StreamInterp] WS closed');
          // Se si chiude PRIMA di essersi aperto (chiave rifiutata, rete
          // caduta) non ha senso aspettare i 4 secondi: si dichiara subito
          // il fallimento, cosi la pipeline di ripiego parte prima. Dopo
          // l'apertura riuscita `risolto` e gia true e questa e una riga
          // che non fa niente.
          concludi(false);
        };
        timerAperturaId = setTimeout(() => concludi(false), 4000);
      });
    } catch (e) {
      console.error('[StreamInterp] Start failed:', e);
      // b.247 — anche qui il microfono poteva essere gia stato aperto da
      // getUserMedia qualche riga sopra: senza abort restava acceso mentre
      // partiva la pipeline a blocchi.
      abortaStreaming();
      return false;
    }
  }, [myLang, handleTranscript, handleUtteranceEnd, userToken, roomId, roomSessionTokenRef, abortaStreaming]);

  // ═══ STOP STREAMING ═══
  const stop = useCallback(() => {
    setActive(false);
    clearTimeout(sentencePauseTimerRef.current);
    clearTimeout(translateTimerRef.current);

    // Flush remaining sentence
    if (currentSentenceRef.current.trim()) {
      handleSentenceComplete(currentSentenceRef.current);
    }

    // b.247 — la chiusura delle risorse era ricopiata qui riga per riga,
    // mentre i rami di fallimento di start() non ne avevano nessuna. Ora e
    // una funzione sola: se un giorno si aggiunge una risorsa da spegnere,
    // la si spegne anche nei rami di fallimento senza doverselo ricordare.
    abortaStreaming();

    // Reset state
    currentSentenceRef.current = '';
    interimTextRef.current = '';
    currentTranslationRef.current = '';
    setMyLiveText('');
    setPartnerLiveSubtitle('');
  }, [handleSentenceComplete, abortaStreaming]);

  // ═══ HANDLE INCOMING FROM PARTNER ═══
  // Il partner che usa lo stesso hook manda subtitle e audio
  const handleIncomingMessage = useCallback((msg) => {
    if (!msg) return;

    if (msg.type === 'interpreter-subtitle') {
      if (msg.isFinal) {
        setPartnerSubtitles(prev => [...prev.slice(-20), {
          text: msg.text, original: msg.originalText, lang: msg.lang, ts: Date.now()
        }]);
      }
      setPartnerLiveSubtitle(msg.text);
      // Clear old timers before adding new one
      subtitleTimersRef.current.forEach(id => clearTimeout(id));
      subtitleTimersRef.current = [];
      // Auto-clear
      const timerId = setTimeout(() => {
        setPartnerLiveSubtitle(prev => prev === msg.text ? '' : prev);
      }, MAX_SUBTITLE_AGE_MS);
      subtitleTimersRef.current.push(timerId);

      // Add partner message to conversation context
      if (msg.isFinal && msg.originalText) {
        convContextRef.current?.addMessage?.({
          sender: 'partner',
          original: msg.originalText,
          translated: msg.text,
          sourceLang: msg.originalLang || partnerLang,
          targetLang: myLang,
        });
      }
    }

    // Audio playback (same logic as old interpreter)
    if (msg.type === 'interpreter-audio' && msg.data) {
      playBase64Audio(msg.data);
    }
    if (msg.type === 'interpreter-audio-part') {
      handleAudioPart(msg);
    }
  }, [myLang, partnerLang]);

  // ═══ AUDIO PLAYBACK HELPERS ═══
  const audioPartsRef = useRef({});

  const playBase64Audio = useCallback((base64Data) => {
    try {
      const audioBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 0.9;
      startDucking?.();
      audio.play().catch(() => {});
      audio.onended = () => { URL.revokeObjectURL(url); stopDucking?.(); };
      audio.onerror = () => { stopDucking?.(); };
    } catch { stopDucking?.(); }
  }, [startDucking, stopDucking]);

  const handleAudioPart = useCallback((msg) => {
    const buf = audioPartsRef.current;
    if (!buf[msg.id]) buf[msg.id] = { parts: {}, total: msg.total, ts: Date.now() };
    buf[msg.id].parts[msg.part] = msg.data;
    const entry = buf[msg.id];
    if (Object.keys(entry.parts).length === entry.total) {
      let full = '';
      for (let i = 0; i < entry.total; i++) full += entry.parts[i] || '';
      delete buf[msg.id];
      playBase64Audio(full);
    }
  }, [playBase64Audio]);

  // Cleanup stale audio buffers
  useEffect(() => {
    const interval = setInterval(() => {
      const buf = audioPartsRef.current;
      const now = Date.now();
      for (const id of Object.keys(buf)) {
        if (now - (buf[id].ts || 0) > 30000) delete buf[id];
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // b.247 — qui lo smontaggio dimenticava il filtro del rumore (che
      // tiene un suo AudioContext) e non azzerava i ref: stessa cura di
      // stop(), stessa funzione.
      abortaStreaming();
      subtitleTimersRef.current.forEach(id => clearTimeout(id));
      subtitleTimersRef.current = [];
      clearTimeout(sentencePauseTimerRef.current);
      clearTimeout(translateTimerRef.current);
    };
  }, [abortaStreaming]);

  return {
    active,
    start,
    stop,
    myLiveText,                    // Testo STT real-time (quello che sto dicendo)
    partnerLiveSubtitle,           // Subtitle tradotto real-time (preview per partner)
    mySubtitles,                   // Cronologia frasi tradotte mie
    partnerSubtitles,              // Cronologia frasi tradotte partner
    handleIncomingMessage,         // Handler per messaggi P2P dal partner
  };
}
