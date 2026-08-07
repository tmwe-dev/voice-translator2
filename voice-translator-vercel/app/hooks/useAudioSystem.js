'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang } from '../lib/constants.js';
import useTTSEngine from './useTTSEngine.js';
import { getVolumeTTS } from '../lib/audioPrefs.js';
import { creaCodaAudio } from '../lib/codaAudio.js';

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
  getEffectiveToken
}) {
  const [audioReady, setAudioReady] = useState(false);
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
      window.dispatchEvent(new CustomEvent('bartalk:tts', { detail: { attivo } }));
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
    getEffectiveToken,
    audioReady,
    getPersistentAudio,
    activeBlobUrlsRef,
  });

  // =============================================
  // AUDIO UNLOCK + CONTEXT
  // =============================================

  function unlockAudio() {
    if (audioReady) return;
    requestMicEarly();
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
    } catch (e) { console.warn('[AUDIO] unlockAudio error:', e); }
  }

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
    } catch (e) { console.warn('[useAudioSystem] connectToDucking failed:', e?.message || e); return null; }
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
        persistentMicRef.current.getTracks().forEach(track => { try { track.stop(); } catch (e) { /* si sta smontando: se era gia chiuso non cambia nulla */ } });
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
      try { await audioContextRef.current.resume(); } catch (e) { console.warn('[useAudioSystem] resume context failed:', e?.message || e); }
    }
    if (persistentMicRef.current) {
      const tracks = persistentMicRef.current.getTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') {
        const track = tracks[0];
        if (liveModeRef.current && track.applyConstraints) {
          try {
            await track.applyConstraints({ noiseSuppression: true, echoCancellation: true, autoGainControl: true });
          } catch (e) { console.warn('[useAudioSystem] applyConstraints failed:', e?.message || e); }
        }
        return persistentMicRef.current;
      }
      persistentMicRef.current = null;
    }
    const audioConstraints = liveModeRef.current
      ? { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
      : true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    persistentMicRef.current = stream;
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
            console.warn('[LiveMode] Could not apply constraints:', e);
            try {
              persistentMicRef.current.getTracks().forEach(t => t.stop());
              persistentMicRef.current = null;
              await getMicStream();
            } catch (e2) { console.warn('[useAudioSystem] mic reset failed:', e2?.message || e2); }
          }
        }
      }
    }
    return enabled;
  }

  function requestMicEarly() {
    if (persistentMicRef.current) return;
    const audioConstraints = liveModeRef.current
      ? { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
      : true;
    navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
      .then(stream => { persistentMicRef.current = stream; })
      .catch(e => console.warn('[useAudioSystem] requestMicEarly failed:', e?.message || e));
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
    } catch (e) { console.warn('[useAudioSystem] playNotifSound failed:', e?.message || e); }
  }

  // =============================================
  // AUDIO QUEUE — Sequential TTS playback
  // =============================================

  async function queueAudio(text, lang, msgId) {
    if (msgId && playedMsgIdsRef.current.has(msgId)) return;
    const contentKey = `${text?.substring(0, 60)}|${lang}`;
    if (playedMsgIdsRef.current.has(contentKey)) return;
    // Mark as played IMMEDIATELY (like b.41) to prevent duplicates from multi-channel delivery
    if (msgId) playedMsgIdsRef.current.add(msgId);
    playedMsgIdsRef.current.add(contentKey);
    if (playedMsgIdsRef.current.size > 500) {
      const first = playedMsgIdsRef.current.values().next().value;
      playedMsgIdsRef.current.delete(first);
    }
    setTimeout(() => { playedMsgIdsRef.current.delete(contentKey); }, 30000);
    if (!audioEnabledRef.current) { playNotifSound(); return; }
    accodaConAnticipo(text, lang, msgId || contentKey);
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
        try { await tts.suonaVoce(blob, text, lang); }
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
          const hasClonedVoice = !!clonedVoiceIdRef?.current;
          if (hasClonedVoice && canUseElevenLabsRef?.current) await tts.playTTSElevenLabs(text, speechLang);
          else await tts.playEdgeTTS(text, speechLang);
        }
      }
    } catch (e) { console.error('[Audio] playMessage error:', e); }
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
