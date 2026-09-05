'use client';
import { useRef, useEffect, useCallback } from 'react';
import { getLang } from '../lib/constants.js';
import { deepgramAmmesso, USO } from '../lib/sttPolicy.js';
import { createLogger } from '../lib/logger.js';
// b.602 — chiave, socket e cattura PCM16: client Deepgram unico
// (lib/audio/sttLive.js), lo stesso di interprete e relatore. Qui
// c'era la seconda delle tre copie. La voce viene dal microfono unico.
import { chiediChiaveSTT, apriAscolto } from '../lib/audio/sttLive.js';
import { prendiVoce, rendiVoce } from '../lib/microfonoMaster.js';
const log = createLogger('deepgram');

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
  const sessioneRef = useRef(null);      // b.602 — { chiudi } dal client unico
  const deepgramStreamRef = useRef(null);
  const daRendereRef = useRef(null);     // b.602 — copia del microfono unico da rendere

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
   * Stop Deepgram streaming and clean up all resources.
   */
  const stopDeepgramStreaming = useCallback(async () => {
    // b.602 — socket + cattura nel client unico; la copia del microfono si
    // RENDE al master (b.277), non si ferma a mano.
    if (sessioneRef.current) {
      const sess = sessioneRef.current; sessioneRef.current = null;
      try { await sess.chiudi(); } catch { /* era gia chiusa: chiuderla due volte non e un guasto */ }
    }
    if (deepgramStreamRef.current) {
      const st = deepgramStreamRef.current; deepgramStreamRef.current = null;
      if (daRendereRef.current === st) { rendiVoce(st); daRendereRef.current = null; }
      else st.getTracks().forEach(t => { try { t.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ } });
    }
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
      log.debug('[STT-Deepgram] non ammesso dalla policy: si usa il ripiego');
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

    // b.637 — un gettone per socket: quello di ElevenLabs e monouso e
    // conservarlo vuol dire aprire il socket con un gettone consumato.
    const credenziale = await chiediChiaveSTT({ userToken, roomId, roomSessionToken: roomSessionTokenRef?.current });
    if (!credenziale) return false;

    let stream;
    try { stream = await prendiVoce(); daRendereRef.current = stream; }
    catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
        });
        daRendereRef.current = null;
      } catch (e) {
        log.error('[STT-Deepgram] Mic access error:', e);
        return false;
      }
    }
    deepgramStreamRef.current = stream;

    const sessione = await apriAscolto({
      chiave: credenziale.chiave, fornitore: credenziale.fornitore, stream, lingua: dgLang,
      utteranceEndMs: 1500,
      onTesto: (transcript, isFinal) => {
        if (isFinal) {
          allWordsRef.current += (allWordsRef.current ? ' ' : '') + transcript;
          setStreamingMsg(prev => prev ? { ...prev, original: allWordsRef.current } : null);
        } else {
          const preview = allWordsRef.current + (allWordsRef.current ? ' ' : '') + transcript;
          setStreamingMsg(prev => prev ? { ...prev, original: preview } : null);
        }
      },
      onChiuso: () => { log.debug('[STT-Deepgram] WebSocket closed'); },
    });
    if (!sessione) {
      log.warn('[STT-Deepgram] WebSocket error');
      await stopDeepgramStreaming();
      return false;
    }
    sessioneRef.current = sessione;
    log.debug('[STT-Deepgram] WebSocket connected');

    // Keepalive
    if (speakingKeepAliveRef.current) clearInterval(speakingKeepAliveRef.current);
    speakingKeepAliveRef.current = setInterval(() => {
      if (roomId && streamingModeRef.current) setSpeakingState(roomId, true);
    }, 15000);
    return true;
  }, [roomId, roomSessionTokenRef, userToken, unlockAudio, setSpeakingState, setRecording, setStreamingMsg, allWordsRef, streamingModeRef, speakingKeepAliveRef, stopDeepgramStreaming]);


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
