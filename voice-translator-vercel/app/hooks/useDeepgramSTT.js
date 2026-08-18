'use client';
import { useRef, useEffect, useCallback } from 'react';
import { getLang } from '../lib/constants.js';
import { deepgramAmmesso, USO } from '../lib/sttPolicy.js';
import { createLogger } from '../lib/logger.js';
const dbg = createLogger('deepgram');

/**
 * Deepgram Streaming STT hook — server-grade WebSocket speech recognition.
 *
 * Responsibilities:
 * - Check Deepgram availability via /api/stt-token
 * - Start/stop WebSocket streaming with PCM16 audio capture
 * - Accumulate final + interim transcripts
 * - Clean up all resources on stop or unmount
 *
 * Returns: { deepgramAvailableRef, startDeepgramStreaming, stopDeepgramStreaming }
 */
export default function useDeepgramSTT({
  allWordsRef,
  streamingModeRef,
  setStreamingMsg,
  setRecording,
  setSpeakingState,
  roomId,
  roomSessionTokenRef,
  userToken,
  unlockAudio,
  speakingKeepAliveRef,
}) {
  const deepgramAvailableRef = useRef(null); // null = checking, true/false
  const deepgramWsRef = useRef(null);
  const deepgramStreamRef = useRef(null);
  const deepgramProcessorRef = useRef(null);
  const deepgramAudioCtxRef = useRef(null);
  const deepgramKeyRef = useRef(null);

  // b.172 — DEEPGRAM DISATTIVATO su richiesta esplicita dell'utente
  // ("non voglio Deepgram"). Deepgram e la dettatura vocale (voce→testo)
  // di un fornitore esterno, in questa app dal 6/3/2026: NON serve, e in
  // produzione la sua rotta /api/stt-token falliva (401/403 identita e,
  // soprattutto, 503 perche la creazione della chiave temporanea
  // Deepgram non andava — chiave assente/senza permesso/quota). Quei
  // fallimenti riempivano la console di "high error count".
  //
  // La dettatura NON si perde: la catena di ripiego in useTranslation.js
  // usa gia il riconoscimento del browser e soprattutto Whisper
  // (/api/transcribe, OpenAI — gia pagato), che funziona anche su
  // telefono. Qui si evita del tutto la chiamata a /api/stt-token
  // segnando la disponibilita a false: il ramo Deepgram in
  // useTranslation.js (`if (deepgramAvailableRef.current && ...)`) non
  // scatta mai, e non parte nessuna richiesta verso il fornitore.
  //
  // Reversibile: per riattivarlo si ripristina la fetch qui sotto e si
  // configura DEEPGRAM_API_KEY (con permesso di creare chiavi temporanee)
  // su Vercel. Le funzioni start/stopDeepgramStreaming restano nel file,
  // inerti finche availableRef e false.
  //
  // b.247 — quel «false» era scritto A MANO qui, e intanto
  // useStreamingInterpreter.js chiamava /api/stt-token e apriva il suo
  // WebSocket verso Deepgram: la stessa decisione, presa due volte in due
  // file che non si parlavano, con esiti opposti. Chi leggeva solo questo
  // file concludeva che Deepgram fosse spento ovunque, e si sbagliava.
  // La decisione ora vive in un posto solo, lib/sttPolicy.js, con scritto
  // il perche; qui la si chiede. L'esito per la traduzione resta false —
  // il comportamento non cambia, cambia il fatto che sia UNA decisione.
  useEffect(() => {
    deepgramAvailableRef.current = deepgramAmmesso(USO.TRADUZIONE);
  }, []);

  /**
   * Start Deepgram WebSocket streaming STT.
   * @param {string|object} langObj — language code or language object
   * @returns {Promise<boolean>} — true if connected, false if fallback needed
   */
  const startDeepgramStreaming = useCallback(async (langObj) => {
    // b.247 — seconda porta sulla stessa stanza: questa funzione apriva il
    // microfono e il WebSocket senza chiedere niente a nessuno, e bastava
    // una chiamata diretta (o un ripristino distratto della riga qui sopra)
    // per riaccendere Deepgram senza accorgersene. La guardia sta PRIMA di
    // qualunque effetto collaterale: niente microfono, niente stato di
    // registrazione, si torna false e chiama il ripiego.
    if (!deepgramAmmesso(USO.TRADUZIONE)) {
      dbg.debug('[STT-Deepgram] non ammesso dalla policy: si usa il ripiego');
      return false;
    }

    const speechLang = getLang(langObj)?.speech || 'en-US';
    const dgLang = speechLang.split('-')[0]; // 'it-IT' → 'it'

    unlockAudio();
    setRecording(true);
    if (roomId) setSpeakingState(roomId, true);
    allWordsRef.current = '';
    streamingModeRef.current = true;
    setStreamingMsg({ original: '', translated: null, isStreaming: true });

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      console.error('[STT-Deepgram] Mic access error:', e);
      return false;
    }
    deepgramStreamRef.current = stream;

    const params = new URLSearchParams({
      model: 'nova-2', language: dgLang, smart_format: 'true',
      interim_results: 'true', utterance_end_ms: '1500',
      encoding: 'linear16', sample_rate: '16000', channels: '1',
    });

    const ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params.toString()}`,
      ['token', deepgramKeyRef.current]
    );
    deepgramWsRef.current = ws;

    return new Promise((resolve) => {
      let resolved = false;

      ws.onopen = () => {
        dbg.debug('[STT-Deepgram] WebSocket connected');
        // Start audio capture
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          deepgramAudioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          deepgramProcessorRef.current = processor;

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
        } catch (e) {
          console.error('[STT-Deepgram] Audio capture error:', e);
        }

        // Keepalive
        if (speakingKeepAliveRef.current) clearInterval(speakingKeepAliveRef.current);
        speakingKeepAliveRef.current = setInterval(() => {
          if (roomId && streamingModeRef.current) setSpeakingState(roomId, true);
        }, 15000);

        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      };

      ws.onmessage = (event) => {
        try {
          let data; try { data = JSON.parse(event.data); } catch { console.warn('[useDeepgramSTT] WS parse failed'); return; }
          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript || '';
            if (!transcript) return;
            if (data.is_final) {
              allWordsRef.current += (allWordsRef.current ? ' ' : '') + transcript;
              setStreamingMsg(prev => prev ? { ...prev, original: allWordsRef.current } : null);
            } else {
              const preview = allWordsRef.current + (allWordsRef.current ? ' ' : '') + transcript;
              setStreamingMsg(prev => prev ? { ...prev, original: preview } : null);
            }
          }
        } catch (e) { /* message parse failed */ }
      };

      ws.onerror = () => {
        console.warn('[STT-Deepgram] WebSocket error');
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };

      ws.onclose = () => {
        dbg.debug('[STT-Deepgram] WebSocket closed');
      };

      // Timeout: if WebSocket doesn't connect in 3s, fall back
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, 3000);
    });
  }, [roomId, unlockAudio, setSpeakingState, setRecording, setStreamingMsg, allWordsRef, streamingModeRef, speakingKeepAliveRef]);

  /**
   * Stop Deepgram streaming and clean up all resources.
   */
  const stopDeepgramStreaming = useCallback(async () => {
    if (deepgramProcessorRef.current) {
      try { deepgramProcessorRef.current.disconnect(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      deepgramProcessorRef.current = null;
    }
    if (deepgramAudioCtxRef.current && deepgramAudioCtxRef.current.state !== 'closed') {
      try { deepgramAudioCtxRef.current.close(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      deepgramAudioCtxRef.current = null;
    }
    if (deepgramStreamRef.current) {
      deepgramStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ } });
      deepgramStreamRef.current = null;
    }
    if (deepgramWsRef.current) {
      try {
        if (deepgramWsRef.current.readyState === WebSocket.OPEN) {
          // Send CloseStream and wait for Deepgram to flush final results
          deepgramWsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
          await new Promise(r => setTimeout(r, 400)); // Wait for final transcription
        }
        deepgramWsRef.current.close();
      } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      deepgramWsRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopDeepgramStreaming();
  }, [stopDeepgramStreaming]);

  return {
    deepgramAvailableRef,
    startDeepgramStreaming,
    stopDeepgramStreaming,
  };
}
