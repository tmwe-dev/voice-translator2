'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang } from '../lib/constants.js';
import useTTSEngine from './useTTSEngine.js';

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

  // Audio refs
  const persistentAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const playedMsgIdsRef = useRef(new Set());
  const persistentMicRef = useRef(null);
  const audioEnabledRef = useRef(audioEnabled);
  const activeBlobUrlsRef = useRef(new Set());

  // Ducking
  const duckingGainRef = useRef(null);
  const [duckingLevel, setDuckingLevel] = useState(0.2);
  const duckingLevelRef = useRef(0.2);

  // Sync refs
  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);
  useEffect(() => { duckingLevelRef.current = duckingLevel; }, [duckingLevel]);

  function getPersistentAudio() {
    if (!persistentAudioRef.current) {
      persistentAudioRef.current = new Audio();
      persistentAudioRef.current.volume = 1.0;
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
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      const pa = getPersistentAudio();
      pa.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      pa.play().catch(() => {});
      const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      a.volume = 0.01;
      a.play().catch(() => {});
      setAudioReady(true);
    } catch (e) { /* cleanup */ }
  }

  // =============================================
  // DUCKING
  // =============================================

  function startDucking() {
    const gain = duckingGainRef.current;
    const ctx = audioContextRef.current;
    if (!gain || !ctx) return;
    try { gain.gain.setTargetAtTime(duckingLevelRef.current, ctx.currentTime, 0.03); } catch (e) { /* cleanup */ }
  }

  function stopDucking() {
    const gain = duckingGainRef.current;
    const ctx = audioContextRef.current;
    if (!gain || !ctx) return;
    try { gain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.06); } catch (e) { /* cleanup */ }
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

  // Auto-unlock on first touch/click
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
        try { audioContextRef.current.close(); } catch (e) { /* cleanup */ }
      }
      if (persistentMicRef.current) {
        persistentMicRef.current.getTracks().forEach(track => { try { track.stop(); } catch (e) { /* cleanup */ } });
        persistentMicRef.current = null;
      }
      activeBlobUrlsRef.current.forEach(url => { try { URL.revokeObjectURL(url); } catch (e) { /* cleanup */ } });
      activeBlobUrlsRef.current.clear();
      audioQueueRef.current = [];
      playedMsgIdsRef.current.clear();
      if (typeof speechSynthesis !== 'undefined') {
        try {
          speechSynthesis.cancel();
        } catch (e) { /* cleanup */ }
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
    // Content-based dedup: same text should never play twice within 30s
    // regardless of message ID (tmp_xxx vs msg_xxx can differ for same message)
    const contentKey = `${text?.substring(0, 60)}|${lang}`;
    if (playedMsgIdsRef.current.has(contentKey)) return;
    if (msgId) {
      playedMsgIdsRef.current.add(msgId);
    }
    playedMsgIdsRef.current.add(contentKey);
    if (playedMsgIdsRef.current.size > 500) {
      const first = playedMsgIdsRef.current.values().next().value;
      playedMsgIdsRef.current.delete(first);
    }
    // Auto-expire content key after 30s to allow replaying same text later
    setTimeout(() => { playedMsgIdsRef.current.delete(contentKey); }, 30000);
    if (!audioEnabledRef.current) { playNotifSound(); return; }
    audioQueueRef.current.push({ text, lang });
    processAudioQueue();
  }

  async function playOneItem(text, lang) {
    const voiceEngine = prefsRef.current?.voiceEngine || 'auto';
    if (voiceEngine === 'edge') await tts.playEdgeTTS(text, lang);
    else if (voiceEngine === 'elevenlabs') await tts.playTTSElevenLabs(text, lang);
    else if (voiceEngine === 'openai') await tts.playTTS(text, lang);
    else {
      const hasClonedVoice = !!clonedVoiceIdRef?.current;
      if (hasClonedVoice && canUseElevenLabsRef?.current) await tts.playTTSElevenLabs(text, lang);
      else await tts.playEdgeTTS(text, lang);
    }
  }

  async function processAudioQueue() {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const { text, lang } = audioQueueRef.current.shift();
      startDucking();
      try {
        await playOneItem(text, lang);
      } catch (e) { console.error('[Audio] playback error:', e); }
      stopDucking();
    }

    isPlayingRef.current = false;
  }

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
    setPlayingMsgId(null);
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
