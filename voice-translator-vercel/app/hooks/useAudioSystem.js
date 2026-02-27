'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang, AVATAR_NAMES, AVATARS } from '../lib/constants.js';

export default function useAudioSystem({
  prefsRef,
  myLangRef,
  isTrialRef,
  isTopProRef,
  canUseElevenLabsRef,
  selectedELVoice,
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
  const voiceCacheRef = useRef({});

  // Sync audioEnabled ref
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  // Preload browser voices (Chrome loads them asynchronously)
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.getVoices();
    const handler = () => { voiceCacheRef.current = {}; };
    speechSynthesis.addEventListener('voiceschanged', handler);
    return () => speechSynthesis.removeEventListener('voiceschanged', handler);
  }, []);

  function getPersistentAudio() {
    if (!persistentAudioRef.current) {
      persistentAudioRef.current = new Audio();
      persistentAudioRef.current.volume = 1.0;
    }
    return persistentAudioRef.current;
  }

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
    } catch (e) {}
  }

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
      if (persistentAudioRef.current) {
        persistentAudioRef.current.pause();
        persistentAudioRef.current.src = '';
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (e) {}
      }
      if (persistentMicRef.current) {
        persistentMicRef.current.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
        persistentMicRef.current = null;
      }
      activeBlobUrlsRef.current.forEach(url => {
        try { URL.revokeObjectURL(url); } catch (e) {}
      });
      activeBlobUrlsRef.current.clear();
      audioQueueRef.current = [];
      playedMsgIdsRef.current.clear();
      // Cancel any browser speech
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    };
  }, []);

  async function getMicStream() {
    if (persistentMicRef.current) {
      const tracks = persistentMicRef.current.getTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') return persistentMicRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    persistentMicRef.current = stream;
    return stream;
  }

  function requestMicEarly() {
    if (persistentMicRef.current) return;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => { persistentMicRef.current = stream; })
      .catch(() => {});
  }

  // =============================================
  // BROWSER TTS (FREE tier) — Promise-based with onend
  // =============================================

  function findBestVoice(lang) {
    if (typeof speechSynthesis === 'undefined') return null;
    if (voiceCacheRef.current[lang]) return voiceCacheRef.current[lang];

    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;

    const langLower = lang.toLowerCase();
    const langBase = langLower.split('-')[0];

    // Collect ALL matching voices for this language
    const matchingVoices = voices.filter(v => {
      const vLang = v.lang.toLowerCase();
      const vBase = vLang.split('-')[0];
      return vBase === langBase;
    });

    if (matchingVoices.length === 0) return null;

    // Score voices: higher = better quality
    function scoreVoice(v) {
      let score = 0;
      const name = v.name.toLowerCase();
      // Exact locale match (e.g. it-IT vs it-IT)
      if (v.lang.toLowerCase() === langLower) score += 10;
      // Premium voice engines
      if (name.includes('google')) score += 50;
      if (name.includes('microsoft')) score += 45;
      if (name.includes('neural')) score += 40;
      if (name.includes('natural')) score += 40;
      if (name.includes('premium')) score += 35;
      if (name.includes('enhanced')) score += 30;
      if (name.includes('wavenet')) score += 25;
      // Avoid compact/espeak voices
      if (name.includes('compact')) score -= 20;
      if (name.includes('espeak')) score -= 30;
      return score;
    }

    matchingVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
    const best = matchingVoices[0];
    voiceCacheRef.current[lang] = best;
    return best;
  }

  // Split text into chunks for Chrome's 15-second speech bug
  function splitTextForSpeech(text, maxChars = 180) {
    if (text.length <= maxChars) return [text];
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxChars) {
        chunks.push(remaining);
        break;
      }
      // Find best split point: sentence end, comma, or space
      let splitAt = -1;
      // Try sentence boundaries first
      for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.5; i--) {
        if ('.!?;'.includes(remaining[i])) { splitAt = i + 1; break; }
      }
      // Try comma
      if (splitAt === -1) {
        for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.5; i--) {
          if (remaining[i] === ',') { splitAt = i + 1; break; }
        }
      }
      // Try space
      if (splitAt === -1) {
        for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.3; i--) {
          if (remaining[i] === ' ') { splitAt = i + 1; break; }
        }
      }
      // Hard split as last resort
      if (splitAt === -1) splitAt = maxChars;
      chunks.push(remaining.substring(0, splitAt).trim());
      remaining = remaining.substring(splitAt).trim();
    }
    return chunks.filter(c => c.length > 0);
  }

  // Speak a single chunk with Promise — resolves when speech ends
  function speakChunk(text, lang, voice) {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === 'undefined') { resolve(); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 0.95;
      u.pitch = 1.0;
      u.volume = 1.0;
      if (voice) u.voice = voice;

      // Safety timeout: ~120ms per char, min 3s, max 20s
      const timeoutMs = Math.min(20000, Math.max(3000, text.length * 120));
      const safetyTimer = setTimeout(() => {
        speechSynthesis.cancel();
        resolve();
      }, timeoutMs);

      u.onend = () => { clearTimeout(safetyTimer); resolve(); };
      u.onerror = () => { clearTimeout(safetyTimer); resolve(); };

      // Chrome bug workaround: resume if paused
      if (speechSynthesis.paused) speechSynthesis.resume();
      speechSynthesis.speak(u);

      // Chrome bug: keep alive with periodic resume for long utterances
      const keepAlive = setInterval(() => {
        if (speechSynthesis.speaking && !speechSynthesis.paused) return;
        if (speechSynthesis.paused) speechSynthesis.resume();
      }, 5000);
      u.onend = () => { clearInterval(keepAlive); clearTimeout(safetyTimer); resolve(); };
      u.onerror = () => { clearInterval(keepAlive); clearTimeout(safetyTimer); resolve(); };
    });
  }

  // Full browser TTS — splits text, speaks each chunk sequentially
  async function browserSpeak(text, lang) {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();

    const voice = findBestVoice(lang);
    const chunks = splitTextForSpeech(text);

    for (const chunk of chunks) {
      await speakChunk(chunk, lang, voice);
    }
  }

  // =============================================
  // FASE 5: Voice availability check
  // Returns quality info about browser TTS for a given language
  // =============================================
  function checkVoiceAvailability(lang) {
    if (typeof speechSynthesis === 'undefined') return { available: false, quality: 'none' };
    const voice = findBestVoice(lang);
    if (!voice) return { available: false, quality: 'none' };
    const name = voice.name.toLowerCase();
    let quality = 'basic';
    if (name.includes('google') || name.includes('microsoft') || name.includes('neural') || name.includes('natural')) {
      quality = 'premium';
    } else if (name.includes('enhanced') || name.includes('wavenet')) {
      quality = 'good';
    } else if (name.includes('compact') || name.includes('espeak')) {
      quality = 'low';
    }
    return { available: true, quality, voiceName: voice.name };
  }

  // =============================================
  // EDGE TTS (FREE tier) — Neural voices, no cost
  // =============================================

  async function fetchEdgeTTSBlob(text, langCode, gender) {
    // Race with timeout for faster fallback
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
      const res = await fetch('/api/tts-edge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          langCode: langCode || 'en',
          gender: gender || prefsRef.current?.edgeTtsVoiceGender || 'female',
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`EdgeTTS ${res.status}`);
      return await res.blob();
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  // Pre-warm Edge TTS connection when audio is ready
  const edgePrewarmedRef = useRef(false);
  useEffect(() => {
    if (!audioReady || edgePrewarmedRef.current) return;
    edgePrewarmedRef.current = true;
    // Silent pre-warm request to reduce first-speech latency
    fetch('/api/tts-edge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '.', langCode: 'en', gender: 'female' })
    }).catch(() => {});
  }, [audioReady]);

  async function playEdgeTTS(text, langCode) {
    let blob;
    try {
      blob = await fetchEdgeTTSBlob(text, langCode);
    } catch {
      // Edge TTS failed or timed out — try opposite gender as retry
      try {
        const currentGender = prefsRef.current?.edgeTtsVoiceGender || 'female';
        const altGender = currentGender === 'female' ? 'male' : 'female';
        blob = await fetchEdgeTTSBlob(text, langCode, altGender);
      } catch {
        // All Edge TTS failed — fallback to browser speech
        await browserSpeak(text, langCode);
        return;
      }
    }

    const url = URL.createObjectURL(blob);
    activeBlobUrlsRef.current.add(url);

    let played = await playBlobAudio(url);
    if (!played) played = await playBlobNewAudio(url);
    if (!played) {
      // Audio playback failed — browser TTS as last resort
      activeBlobUrlsRef.current.delete(url);
      URL.revokeObjectURL(url);
      await browserSpeak(text, langCode);
      return;
    }

    activeBlobUrlsRef.current.delete(url);
    URL.revokeObjectURL(url);
  }

  // =============================================
  // OPENAI TTS (PRO tier) — with retry
  // =============================================

  async function fetchTTSBlob(text, langCode, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: prefsRef.current.voice || 'nova',
            langCode: langCode || undefined,
            userToken: getEffectiveToken(),
            roomId: roomIdRef.current || undefined
          })
        });
        if (!res.ok) {
          if (attempt < retries) continue;
          throw new Error(`TTS ${res.status}`);
        }
        return await res.blob();
      } catch (e) {
        if (attempt < retries) continue;
        throw e;
      }
    }
  }

  // Play an audio blob URL via an Audio element, returns Promise
  function playBlobAudio(blobUrl) {
    return new Promise((resolve) => {
      const audio = getPersistentAudio();
      // Clean up old handlers
      audio.onended = null;
      audio.onerror = null;

      const timeoutMs = 30000;
      const safetyTimer = setTimeout(() => {
        audio.pause();
        cleanup();
        resolve(false);
      }, timeoutMs);

      function cleanup() {
        clearTimeout(safetyTimer);
        audio.onended = null;
        audio.onerror = null;
      }

      audio.onended = () => { cleanup(); resolve(true); };
      audio.onerror = () => { cleanup(); resolve(false); };
      audio.src = blobUrl;
      audio.play().catch(() => { cleanup(); resolve(false); });
    });
  }

  // Play blob in a fresh Audio element (fallback if persistent one fails)
  function playBlobNewAudio(blobUrl) {
    return new Promise((resolve) => {
      const a = new Audio(blobUrl);
      a.volume = 1.0;
      const safetyTimer = setTimeout(() => { a.pause(); resolve(false); }, 30000);
      a.onended = () => { clearTimeout(safetyTimer); resolve(true); };
      a.onerror = () => { clearTimeout(safetyTimer); resolve(false); };
      a.play().catch(() => { clearTimeout(safetyTimer); resolve(false); });
    });
  }

  async function playTTS(text, lang) {
    let blob;
    try {
      blob = await fetchTTSBlob(text, lang);
    } catch {
      // API failed after retry — fall back to browser
      await browserSpeak(text, lang);
      return;
    }

    const url = URL.createObjectURL(blob);
    activeBlobUrlsRef.current.add(url);

    // Try persistent audio element first
    let played = await playBlobAudio(url);

    // If persistent failed, try a fresh Audio element (same blob, no re-fetch)
    if (!played) {
      played = await playBlobNewAudio(url);
    }

    // If both failed, browser TTS as last resort
    if (!played) {
      await browserSpeak(text, lang);
    }

    activeBlobUrlsRef.current.delete(url);
    URL.revokeObjectURL(url);
  }

  // =============================================
  // ELEVENLABS TTS (TOP PRO tier)
  // =============================================

  function getAvatarName() {
    const avatar = prefsRef.current?.avatar;
    if (!avatar) return undefined;
    const idx = AVATARS.indexOf(avatar);
    return idx >= 0 ? AVATAR_NAMES[idx] : undefined;
  }

  async function fetchElevenLabsBlob(text, langCode) {
    const res = await fetch('/api/tts-elevenlabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceId: selectedELVoice || undefined,
        langCode: langCode || undefined,
        avatarName: getAvatarName(),
        userToken: getEffectiveToken(),
        roomId: roomIdRef.current || undefined
      })
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
    return await res.blob();
  }

  async function playTTSElevenLabs(text, langCode) {
    let blob;
    try {
      blob = await fetchElevenLabsBlob(text, langCode);
    } catch {
      // ElevenLabs failed — try OpenAI as fallback
      return playTTS(text, langCode);
    }

    const url = URL.createObjectURL(blob);
    activeBlobUrlsRef.current.add(url);

    let played = await playBlobAudio(url);
    if (!played) played = await playBlobNewAudio(url);
    if (!played) {
      // All audio playback failed — try OpenAI, then browser
      activeBlobUrlsRef.current.delete(url);
      URL.revokeObjectURL(url);
      return playTTS(text, langCode);
    }

    activeBlobUrlsRef.current.delete(url);
    URL.revokeObjectURL(url);
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
    } catch {}
  }

  // =============================================
  // AUDIO QUEUE
  // =============================================

  async function queueAudio(text, lang, msgId) {
    if (msgId && playedMsgIdsRef.current.has(msgId)) return;
    if (msgId) playedMsgIdsRef.current.add(msgId);
    if (!audioEnabledRef.current) {
      playNotifSound();
      return;
    }
    audioQueueRef.current.push({ text, lang });
    processAudioQueue();
  }

  async function processAudioQueue() {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const { text, lang } = audioQueueRef.current.shift();
    try {
      const voiceEngine = prefsRef.current?.voiceEngine || 'auto';
      if (voiceEngine === 'edge') {
        await playEdgeTTS(text, lang);
      } else if (voiceEngine === 'elevenlabs') {
        await playTTSElevenLabs(text, lang);
      } else if (voiceEngine === 'openai') {
        await playTTS(text, lang);
      } else {
        // Auto mode: select based on tier
        if (isTrialRef.current) {
          await playEdgeTTS(text, lang);
        } else if (canUseElevenLabsRef?.current) {
          await playTTSElevenLabs(text, lang);
        } else {
          await playTTS(text, lang);
        }
      }
    } catch (e) {
      console.error('[Audio] playback error:', e);
    }
    isPlayingRef.current = false;
    processAudioQueue();
  }

  async function playMessage(msg) {
    unlockAudio();
    setPlayingMsgId(msg.id);
    try {
      // Multi-lang: pick translation for MY language from translations object
      const myLang = myLangRef?.current;
      let text = '';
      let speechLang = '';
      if (myLang && msg.translations && msg.translations[myLang]) {
        text = msg.translations[myLang];
        speechLang = getLang(myLang).speech;
      } else if (msg.translated) {
        // Backward compat: single translation
        text = msg.translated;
        speechLang = getLang(msg.targetLang).speech;
      }
      if (text && speechLang) {
        const voiceEngine = prefsRef.current?.voiceEngine || 'auto';
        if (voiceEngine === 'edge') {
          await playEdgeTTS(text, speechLang);
        } else if (voiceEngine === 'elevenlabs') {
          await playTTSElevenLabs(text, speechLang);
        } else if (voiceEngine === 'openai') {
          await playTTS(text, speechLang);
        } else {
          // Auto mode
          if (isTrialRef.current) {
            await playEdgeTTS(text, speechLang);
          } else if (canUseElevenLabsRef?.current) {
            await playTTSElevenLabs(text, speechLang);
          } else {
            await playTTS(text, speechLang);
          }
        }
      }
    } catch (e) {
      console.error('[Audio] playMessage error:', e);
    }
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
    checkVoiceAvailability
  };
}
