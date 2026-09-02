'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang } from '../lib/constants.js';
import useTTSEngine from './useTTSEngine.js';
import { getVolumeTTS } from '../lib/audioPrefs.js';
import { creaCodaAudio } from '../lib/codaAudio.js';
// b.262 — per avvisare (una volta) chi ha l'audio bloccato: vedi sotto.
import { toast } from '../lib/avvisi.js';
import { tFuori } from '../lib/i18n.js';
import { segnalaVoceMuta } from '../lib/segnaleVoce.js';
import { prendiVoce, rendiVoce } from '../lib/microfonoMaster.js';
import { avvisaTTS } from '../lib/eventi.js';
import { createLogger } from '../lib/logger.js';
const log = createLogger('useAudioSystem');   // b.604 — niente console.* sparsi: tutto dal logger

/**
 * useAudioSystem — Audio orchestration (mic, queue, ducking, playback)
 *
 * Responsibilities (after refactor):
 * - Mic management (persistent stream, live mode constraints)
 * - Audio context + unlock
 * - Ducking (reduce partner volume during TTS)
 * - Audio queue (sequential TTS playback, dedup by msg ID)
 * - Notification sound
 * - playMessage (pick correct translation, select engine, play)
 *
 * TTS engines are in useTTSEngine.js (browser, Edge, OpenAI, ElevenLabs)
 */
export default function useAudioSystem({
  prefsRef,
  myLangRef,
  isTrialRef,
  isTopProRef,
  canUseElevenLabsRef,
  selectedELVoice,
  clonedVoiceIdRef,
  roomIdRef,
  roomSessionTokenRef,
  getEffectiveToken
}) {
  const [audioReady, setAudioReady] = useState(false);
  // b.273 — una sola apertura del microfono per volta (vedi requestMicEarly).
  const micInCorsoRef = useRef(false);
  // b.280 — vero se il microfono persistente e una copia del master: alla
  // chiusura va resa, non solo fermata.
  const micDalMasterRef = useRef(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [playingMsgId, setPlayingMsgId] = useState(null);

  // Mounted guard for async operations
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Audio refs
  const persistentAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  // b.111 — la coda con l'anticipo: prepara la voce successiva mentre
  // quella corrente sta ancora parlando. Prima il silenzio fra una
  // frase e l'altra era lungo quanto la richiesta di rete.
  const codaRef = useRef(null);
  if (!codaRef.current) codaRef.current = creaCodaAudio();
  const playedMsgIdsRef = useRef(new Set());
  // b.262 — l'avviso "audio bloccato" si mostra una volta per sessione.
  const avvisoAudioMutoRef = useRef(false);
  const persistentMicRef = useRef(null);
  const audioEnabledRef = useRef(audioEnabled);
  const activeBlobUrlsRef = useRef(new Set());

  // Ducking
  const duckingGainRef = useRef(null);
  const [duckingLevel, setDuckingLevel] = useState(0.2);
  const duckingLevelRef = useRef(0.2);

  // Sync refs
  const audioReadyRef = useRef(false);
  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);
  useEffect(() => { duckingLevelRef.current = duckingLevel; }, [duckingLevel]);
  useEffect(() => { audioReadyRef.current = audioReady; }, [audioReady]);

  // ── Semaforo TTS: vero mentre la voce sintetica locale sta parlando ──
  function segnalaTTS(attivo) {
    try {
      window.__bartalkTTS = attivo;
      avvisaTTS(attivo);   // b.599 — nome ed evento in lib/eventi.js
    } catch { /* sul server non esistono finestra e audio: qui non si fa nulla */ }
  }

  function getPersistentAudio() {
    if (!persistentAudioRef.current) {
      persistentAudioRef.current = new Audio();
      persistentAudioRef.current.volume = 1.0;
      persistentAudioRef.current.playsInline = true;
      // iOS: setAttribute also needed for some versions
      persistentAudioRef.current.setAttribute('playsinline', '');
      persistentAudioRef.current.setAttribute('webkit-playsinline', '');
    }
    return persistentAudioRef.current;
  }

  // ── TTS Engine hook (all 4 engines) ──
  const tts = useTTSEngine({
    prefsRef,
    isTrialRef,
    canUseElevenLabsRef,
    selectedELVoice,
    clonedVoiceIdRef,
    roomIdRef,
    roomSessionTokenRef,
    getEffectiveToken,
    audioReady,
    getPersistentAudio,
    activeBlobUrlsRef,
  });

  // =============================================
  // AUDIO UNLOCK + CONTEXT
  // =============================================

  // b.268 — L'AUDIO SI SBLOCCA AL PRIMO TOCCO, OVUNQUE SIA.
  // Trovato dal vivo (Luca): l'ospite al primo messaggio si vedeva
  // comparire "tocca lo schermo per attivare l'audio". Non era un
  // difetto del suono: il browser concede l'audio solo dopo un gesto
  // della persona, e noi quel gesto lo raccoglievamo troppo tardi —
  // solo su certi pulsanti. L'ospite che arriva da un invito tocca dieci
  // cose (cookie, paese, avanti, avatar) prima di ricevere un messaggio:
  // ora il PRIMO di quei tocchi sblocca l'audio, e quando il messaggio
  // arriva il suono e gia pronto.
  // Il microfono NON si chiede qui: quello resta legato ai pulsanti che
  // servono davvero a parlare, altrimenti la richiesta di permesso
  // salterebbe fuori mentre uno accetta i cookie.
  function sbloccaSuono() {
    if (audioReadyRef.current) return;
    try {
      // Create or resume AudioContext
      let ctx = audioContextRef.current;
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = ctx;
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Play silent buffer through AudioContext (unlocks WebAudio on iOS)
      try {
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      } catch { /* sblocco audio: il browser lo concede solo dopo un tocco, si riprova al prossimo */ }

      // Play silent audio to unlock HTML5 Audio on mobile
      const pa = getPersistentAudio();
      pa.playsInline = true;
      pa.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      pa.play().catch(() => {});

      // Also try with a fresh element (some browsers need this)
      try {
        const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
        a.playsInline = true;
        a.volume = 0.01;
        a.play().catch(() => {});
      } catch { /* il browser puo rifiutare di suonare senza un tocco dell utente */ }

      // CRITICAL: set audioReady IMMEDIATELY (like b.41 that worked)
      // Don't wait for ctx.state === 'running' — that blocks on mobile
      // and prevents browserSpeak fallback from working
      setAudioReady(true);
    } catch (e) { log.warn('[AUDIO] unlockAudio error:', e); }
  }

  function unlockAudio() {
    // b.271 — QUI b.268 AVEVA ROTTO IL MICROFONO, e con lui le chiamate.
    // Con lo sblocco al primo tocco, `audioReady` diventa vero prima che
    // qualcuno prema un pulsante vero. Da quel momento questa funzione
    // usciva alla prima riga — e `requestMicEarly()` non veniva chiamato
    // MAI PIU: il microfono non veniva piu chiesto in anticipo, e la
    // chiamata partiva senza. Ora il microfono si chiede sempre (dentro
    // e' gia protetto: se c'e gia, non fa niente) e solo lo sblocco del
    // suono si salta quando e' gia fatto.
    requestMicEarly();
    if (audioReady) return;
    sbloccaSuono();
  }

  // b.268 — il primo tocco della persona, dovunque cada, apre l'audio.
  // Una volta sola: dopo, i cacciatori si tolgono da soli.
  useEffect(() => {
    if (audioReady) return;
    const apri = () => sbloccaSuono();
    const eventi = ['pointerdown', 'touchend', 'keydown'];
    for (const e of eventi) document.addEventListener(e, apri, { once: true, capture: true, passive: true });
    return () => { for (const e of eventi) document.removeEventListener(e, apri, { capture: true }); };
  }, [audioReady]);

  // =============================================
  // DUCKING
  // =============================================

  function startDucking() {
    const gain = duckingGainRef.current;
    const ctx = audioContextRef.current;
    if (!gain || !ctx) return;
    try { gain.gain.setTargetAtTime(duckingLevelRef.current, ctx.currentTime, 0.03); } catch (e) { /* si sta smontando: se era gia chiuso non cambia nulla */ }
  }

  function stopDucking() {
    const gain = duckingGainRef.current;
    const ctx = audioContextRef.current;
    if (!gain || !ctx) return;
    try { gain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.06); } catch (e) { /* si sta smontando: se era gia chiuso non cambia nulla */ }
  }

  function connectToDucking(audioElement) {
    const ctx = audioContextRef.current;
    const gain = duckingGainRef.current;
    if (!ctx || !gain || !audioElement) return null;
    try {
      const source = ctx.createMediaElementSource(audioElement);
      source.connect(gain);
      return source;
    } catch (e) { log.warn('[useAudioSystem] connectToDucking failed:', e?.message || e); return null; }
  }

  // b.111 — qui si rilanciava la vecchia coda quando l'audio veniva
  // sbloccato. Non serve piu: la coda nuova non aspetta lo sblocco per
  // partire, e chi suona ha gia i suoi ripieghi (altro elemento audio,
  // e in ultima istanza la voce del browser).

  // Auto-unlock on first touch/click (same as b.41)
  useEffect(() => {
    if (audioReady) return;
    const handler = () => unlockAudio();
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('click', handler, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('click', handler);
    };
  }, [audioReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (persistentAudioRef.current) { persistentAudioRef.current.pause(); persistentAudioRef.current.src = ''; }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (e) { /* si sta smontando: se era gia chiuso non cambia nulla */ }
      }
      if (persistentMicRef.current) {
        // b.280 — la copia del master si rende: il contatore deve tornare
        // a zero perche l'hardware si spenga davvero.
        if (micDalMasterRef.current) { rendiVoce(persistentMicRef.current); micDalMasterRef.current = false; }
        else persistentMicRef.current.getTracks().forEach(track => { try { track.stop(); } catch (e) { /* si sta smontando: se era gia chiuso non cambia nulla */ } });
        persistentMicRef.current = null;
      }
      activeBlobUrlsRef.current.forEach(url => { try { URL.revokeObjectURL(url); } catch (e) { /* si sta smontando: se era gia chiuso non cambia nulla */ } });
      activeBlobUrlsRef.current.clear();
      codaRef.current?.svuota();
      playedMsgIdsRef.current.clear();
      if (typeof speechSynthesis !== 'undefined') {
        try {
          speechSynthesis.cancel();
        } catch (e) { /* si sta smontando: se era gia chiuso non cambia nulla */ }
      }
    };
  }, []);

  // =============================================
  // MIC MANAGEMENT
  // =============================================

  const liveModeRef = useRef(false);

  async function getMicStream() {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try { await audioContextRef.current.resume(); } catch (e) { log.warn('[useAudioSystem] resume context failed:', e?.message || e); }
    }
    if (persistentMicRef.current) {
      const tracks = persistentMicRef.current.getTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') {
        const track = tracks[0];
        if (liveModeRef.current && track.applyConstraints) {
          try {
            await track.applyConstraints({ noiseSuppression: true, echoCancellation: true, autoGainControl: true });
          } catch (e) { log.warn('[useAudioSystem] applyConstraints failed:', e?.message || e); }
        }
        return persistentMicRef.current;
      }
      persistentMicRef.current = null;
    }
    const audioConstraints = liveModeRef.current
      ? { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
      : true;
    // b.288 — anche QUESTA porta passa dal microfono unico: era l'ultima
    // apertura diretta rimasta ("una sola porta" deve valere sempre, non
    // quasi sempre). Ripiego sull'apertura diretta solo se il master non
    // parte, come ovunque.
    try {
      const stream = await prendiVoce();
      persistentMicRef.current = stream;
      micDalMasterRef.current = true;
      return stream;
    } catch { /* master non disponibile: apertura diretta qui sotto */ }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    persistentMicRef.current = stream;
    micDalMasterRef.current = false;
    return stream;
  }

  async function setLiveMode(enabled) {
    liveModeRef.current = enabled;
    if (persistentMicRef.current) {
      const tracks = persistentMicRef.current.getAudioTracks();
      for (const track of tracks) {
        if (track.readyState === 'live' && track.applyConstraints) {
          try {
            await track.applyConstraints({ noiseSuppression: enabled, echoCancellation: enabled, autoGainControl: enabled });
          } catch (e) {
            log.warn('[LiveMode] Could not apply constraints:', e);
            try {
              persistentMicRef.current.getTracks().forEach(t => t.stop());
              persistentMicRef.current = null;
              await getMicStream();
            } catch (e2) { log.warn('[useAudioSystem] mic reset failed:', e2?.message || e2); }
          }
        }
      }
    }
    return enabled;
  }

  function requestMicEarly() {
    if (persistentMicRef.current) return;
    // b.273 — RITARDO NELLA TRADUZIONE, colpa di b.271.
    // Da b.271 il microfono si chiede a ogni sblocco audio. Ma qui
    // mancava la guardia sulla richiesta GIA IN CORSO: finche il
    // permesso non e concesso, `persistentMicRef` resta vuoto, quindi
    // ogni tocco faceva partire un'altra apertura del microfono. Piu
    // aperture in parallelo sullo stesso dispositivo si mettono in fila
    // e rallentano tutto quello che viene dopo — la voce compresa.
    // Ora se ne apre una sola per volta.
    if (micInCorsoRef.current) return;
    micInCorsoRef.current = true;
    const audioConstraints = liveModeRef.current
      ? { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
      : true;
    // b.277 — anche la richiesta anticipata passa dal microfono unico:
    // apre l'hardware una volta sola e riceve una copia. Il ripiego
    // sull'apertura diretta resta per qualunque intoppo.
    prendiVoce()
      .then(stream => { persistentMicRef.current = stream; micDalMasterRef.current = true; })
      .catch(() => navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
        .then(stream => { persistentMicRef.current = stream; })
        .catch(e => log.warn('[useAudioSystem] requestMicEarly failed:', e?.message || e)))
      .finally(() => { micInCorsoRef.current = false; });
  }

  // =============================================
  // NOTIFICATION SOUND
  // =============================================

  function playNotifSound() {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) { log.warn('[useAudioSystem] playNotifSound failed:', e?.message || e); }
  }

  // =============================================
  // AUDIO QUEUE — Sequential TTS playback
  // =============================================

  async function queueAudio(text, lang, msgId) {
    // ── b.248 · con un id si dedup SOLO per id, mai per contenuto ──
    //
    // Qui c'era una seconda impronta sul testo (`primi 60 caratteri |
    // lingua`, finestra di 30 s) che scattava ANCHE quando l'id c'era:
    // due messaggi veri con lo stesso testo ("Si." detto due volte, con
    // due id di cattura diversi da b.247) perdevano la seconda voce.
    //
    // Un id NUOVO si legge SEMPRE, qualunque sia il testo: la protezione
    // contro lo stesso messaggio arrivato da piu canali (P2P + Realtime +
    // polling) sta tutta nell'id, che chi chiama passa gia unificato
    // (l'id di cattura, conservato dalla copia del server come clientId).
    // Si annota SUBITO, prima di suonare, come da b.41: i canali arrivano
    // a ~50 ms e la coda e asincrona.
    //
    // Il confronto sul contenuto resta SOLO per le chiamate senza id
    // (client vecchi, riascolti manuali): li si usa il testo INTERO — un
    // prefisso trasforma due frasi diverse nella stessa — e la chiave
    // scade dopo 30 s, cosi la stessa frase puo essere ridetta piu tardi.
    // Le chiavi per id invece NON scadono: un messaggio gia letto non si
    // rilegge (ci pensa il tetto LRU a non farle crescere per sempre).
    const chiave = msgId || `testo:${text}|${lang}`;
    if (playedMsgIdsRef.current.has(chiave)) return;
    playedMsgIdsRef.current.add(chiave);
    if (playedMsgIdsRef.current.size > 500) {
      const first = playedMsgIdsRef.current.values().next().value;
      playedMsgIdsRef.current.delete(first);
    }
    if (!msgId) setTimeout(() => { playedMsgIdsRef.current.delete(chiave); }, 30000);
    if (!audioEnabledRef.current) { playNotifSound(); return; }
    accodaConAnticipo(text, lang, chiave);
  }

  /**
   * b.111 — mette la voce in coda e ne comincia SUBITO la preparazione,
   * anche se davanti c'e ancora qualcuno che parla. Il turno di parola
   * resta rigorosamente quello di arrivo: preparare in anticipo non
   * vuol dire parlare prima.
   */
  function accodaConAnticipo(text, lang, chiave) {
    const primaVoce = !codaRef.current.attiva();
    if (primaVoce) preparaUscitaAudio();

    codaRef.current.accoda(
      chiave,
      () => tts.procuraVoce(text, lang),
      async (blob) => {
        startDucking();
        try {
          const suonato = await tts.suonaVoce(blob, text, lang);
          // ═══ INIZIO b.262 — un messaggio rimasto MUTO si puo riprovare ═══
          // TROVATO DAL VIVO ("l'ospite non sente"): b.248 marca la chiave
          // PRIMA di suonare e per sempre — giusto contro i doppioni
          // multi-canale, ma se il primo tentativo fallisce DEL TUTTO
          // (fornitore giu E audio del telefono ancora bloccato) quel
          // messaggio restava muto per l'eternita. Ora il fallimento
          // totale libera la chiave: la prossima consegna dello stesso
          // messaggio (polling) riprova. E la persona viene AVVISATA,
          // una volta sola, invece del silenzio.
          if (suonato === false) {
            playedMsgIdsRef.current.delete(chiave);
            // b.325 (era b.265, mai arrivato su GitHub) — anche lo strato
            // ESTERNO (processedForTTSRef in useRoomPolling) deve liberare la
            // sua chiave: senza, la consegna successiva veniva scartata prima
            // di arrivare qui e il messaggio restava muto per sempre.
            segnalaVoceMuta(chiave);
            if (!avvisoAudioMutoRef.current) {
              avvisoAudioMutoRef.current = true;
              toast.warning(tFuori('audioBlockedTapScreen'));
            }
          }
          // ═══ FINE b.262 ═══
        }
        finally {
          stopDucking();
          // Quando la coda si e svuotata si smette di segnalare "sto
          // parlando", altrimenti il microfono resta sordo per sempre.
          if (codaRef.current.inCoda() === 0) segnalaTTS(false);
        }
      }
    );
  }

  /** Sblocco audio, volume e avviso "parla la TTS": una volta sola. */
  function preparaUscitaAudio() {
    if (!audioReadyRef.current) { try { unlockAudio(); } catch { /* sblocco audio: il browser lo concede solo dopo un tocco, si riprova al prossimo */ } }
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
    try { getPersistentAudio().volume = getVolumeTTS(); } catch { /* il contesto audio era gia nello stato voluto */ }
    // Chi ascolta: RoomView (attenua la voce del partner, iOS-safe) e
    // il riconoscimento vocale (scarta l'audio: anti-eco).
    segnalaTTS(true);
  }

  // b.111 — qui stavano playOneItem e processAudioQueue: la vecchia
  // coda, che preparava una voce solo dopo che la precedente aveva
  // finito di parlare. Sostituite da accodaConAnticipo + lib/codaAudio.
  // Tolte e non lasciate a dormire: due code audio nello stesso file
  // sono il modo piu sicuro per far suonare due volte la stessa frase
  // fra sei mesi.

  // =============================================
  // PLAY MESSAGE (manual replay)
  // =============================================

  async function playMessage(msg) {
    unlockAudio();
    setPlayingMsgId(msg.id);
    try {
      const myLang = myLangRef?.current;
      let text = '';
      let speechLang = '';
      if (myLang && msg.translations && msg.translations[myLang]) {
        text = msg.translations[myLang];
        speechLang = getLang(myLang).speech;
      } else if (myLang && msg.sourceLang === myLang && msg.original) {
        text = msg.original;
        speechLang = getLang(myLang).speech;
      } else if (myLang && msg.targetLang === myLang && msg.translated) {
        text = msg.translated;
        speechLang = getLang(myLang).speech;
      }
      if (text && speechLang) {
        const voiceEngine = prefsRef.current?.voiceEngine || 'auto';
        if (voiceEngine === 'edge') await tts.playEdgeTTS(text, speechLang);
        else if (voiceEngine === 'elevenlabs') await tts.playTTSElevenLabs(text, speechLang);
        else if (voiceEngine === 'openai') await tts.playTTS(text, speechLang);
        else {
          // b.204 — la barra motore mostra "ElevenLabs" quando ne hai
          // diritto: l'audio DEVE corrispondere, non ripiegare su Edge
          // (voce meccanica) solo perche manca una voce clonata. Prima
          // l'etichetta diceva ElevenLabs e si sentiva Edge. Ora in auto
          // si usa ElevenLabs se disponibile (playTTSElevenLabs ripiega da
          // solo su OpenAI/Edge se il credito finisce). Edge solo se non
          // hai ElevenLabs.
          if (canUseElevenLabsRef?.current) await tts.playTTSElevenLabs(text, speechLang);
          else await tts.playEdgeTTS(text, speechLang);
        }
      }
    } catch (e) { log.error('[Audio] playMessage error:', e); }
    if (mountedRef.current) setPlayingMsgId(null);
  }

  return {
    audioReady,
    audioEnabled,
    setAudioEnabled,
    playingMsgId,
    unlockAudio,
    queueAudio,
    playMessage,
    playNotifSound,
    getMicStream,
    requestMicEarly,
    getPersistentAudio,
    persistentMicRef,
    audioEnabledRef,
    checkVoiceAvailability: tts.checkVoiceAvailability,
    // Ducking
    duckingLevel,
    setDuckingLevel,
    startDucking,
    stopDucking,
    connectToDucking,
    audioContextRef,
    // Live mode
    setLiveMode,
    liveModeRef,
  };
}
