'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang, AVATAR_NAMES, AVATARS, BROWSER_SPEAK_MIN_DURATION, BROWSER_SPEAK_CHAR_RATE } from '../lib/constants.js';

export default function useAudioSystem({
  prefsRef,
  isTrialRef,
  isTopProRef,
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

  // Sync audioEnabled ref
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  // Preload browser voices (Chrome loads them asynchronously)
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.getVoices(); // trigger initial load
    const handler = () => { voiceCacheRef.current = {}; }; // clear cache when voices change
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
      // Stop all audio playback
      if (persistentAudioRef.current) {
        persistentAudioRef.current.pause();
        persistentAudioRef.current.src = '';
      }

      // Close AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (e) {}
      }

      // Stop all microphone tracks
      if (persistentMicRef.current) {
        persistentMicRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {}
        });
        persistentMicRef.current = null;
      }

      // Revoke all blob URLs
      activeBlobUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      });
      activeBlobUrlsRef.current.clear();

      // Clear queues
      audioQueueRef.current = [];
      playedMsgIdsRef.current.clear();
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
      .then(stream => {
        persistentMicRef.current = stream;
      })
      .catch(() => {});
  }

  async function playTTS(text, lang) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: prefsRef.current.voice || 'nova',
          userToken: getEffectiveToken(),
          roomId: roomIdRef.current || undefined
        })
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      activeBlobUrlsRef.current.add(url);
      return new Promise((resolve) => {
        // Dynamic safety timeout based on text length (~100ms per char, min 5s, max 30s)
        const timeoutMs = Math.min(30000, Math.max(5000, text.length * 100));
        const safetyTimer = setTimeout(() => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          resolve();
        }, timeoutMs);
        const done = () => {
          clearTimeout(safetyTimer);
          resolve();
        };
        const audio = getPersistentAudio();
        audio.onended = () => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          done();
        };
        audio.onerror = () => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          clearTimeout(safetyTimer);
          playWithNewAudio(text, lang, done);
        };
        audio.src = url;
        audio.play().catch(() => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          clearTimeout(safetyTimer);
          playWithNewAudio(text, lang, done);
        });
      });
    } catch {
      browserSpeak(text, lang);
    }
  }

  function playWithNewAudio(text, lang, resolve) {
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: prefsRef.current.voice || 'nova',
        userToken: getEffectiveToken(),
        roomId: roomIdRef.current || undefined
      })
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        activeBlobUrlsRef.current.add(url);
        const a = new Audio(url);
        a.onended = () => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          resolve();
        };
        a.play().catch(() => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          browserSpeak(text, lang);
          resolve();
        });
      })
      .catch(() => {
        browserSpeak(text, lang);
        resolve();
      });
  }

  // Cache of best voice per language
  const voiceCacheRef = useRef({});

  function findBestVoice(lang) {
    if (typeof speechSynthesis === 'undefined') return null;
    // Return cached voice if available
    if (voiceCacheRef.current[lang]) return voiceCacheRef.current[lang];

    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;

    const langBase = lang.split('-')[0].toLowerCase(); // 'it-IT' → 'it'

    // Priority 1: exact match (e.g. 'it-IT' matches 'it-IT')
    let best = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase());

    // Priority 2: base language match (e.g. 'it' matches 'it-IT')
    if (!best) best = voices.find(v => v.lang.toLowerCase().startsWith(langBase));

    // Priority 3: any voice whose lang starts with the base
    if (!best) best = voices.find(v => v.lang.toLowerCase().split('-')[0] === langBase);

    // Prefer non-default/Google/Microsoft voices (they tend to be better quality)
    if (best) {
      const betterVoices = voices.filter(v => {
        const vBase = v.lang.toLowerCase().split('-')[0];
        return vBase === langBase && (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Natural') || v.name.includes('Neural'));
      });
      if (betterVoices.length > 0) best = betterVoices[0];
    }

    if (best) voiceCacheRef.current[lang] = best;
    return best;
  }

  function browserSpeak(text, lang) {
    if (typeof speechSynthesis === 'undefined') return;
    // Cancel any ongoing speech first
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.0;
    u.pitch = 1.0;
    // Select the best voice for this language
    const voice = findBestVoice(lang);
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  // Get avatar name from prefs (avatar URL like /avatars/1.png → 'Marcus')
  function getAvatarName() {
    const avatar = prefsRef.current?.avatar;
    if (!avatar) return undefined;
    const idx = AVATARS.indexOf(avatar);
    return idx >= 0 ? AVATAR_NAMES[idx] : undefined;
  }

  async function playTTSElevenLabs(text, langCode) {
    try {
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
      if (!res.ok) throw new Error('ElevenLabs TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      activeBlobUrlsRef.current.add(url);
      return new Promise((resolve) => {
        // Dynamic safety timeout based on text length (~100ms per char, min 5s, max 30s)
        const timeoutMs = Math.min(30000, Math.max(5000, text.length * 100));
        const safetyTimer = setTimeout(() => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          resolve();
        }, timeoutMs);
        const done = () => {
          clearTimeout(safetyTimer);
          resolve();
        };
        const audio = getPersistentAudio();
        audio.onended = () => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          done();
        };
        audio.onerror = () => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          clearTimeout(safetyTimer);
          playTTS(text, langCode).then(done);
        };
        audio.src = url;
        audio.play().catch(() => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          clearTimeout(safetyTimer);
          playTTS(text, langCode).then(done);
        });
      });
    } catch {
      return playTTS(text, langCode);
    }
  }

  // Notification "ding" sound using Web Audio API — works even in privacy mode
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
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.06); // E6
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }

  async function queueAudio(text, lang, msgId) {
    if (msgId && playedMsgIdsRef.current.has(msgId)) return;
    if (msgId) playedMsgIdsRef.current.add(msgId);
    // Always play notification ding for new messages
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
      if (isTrialRef.current) {
        await new Promise(resolve => {
          browserSpeak(text, lang);
          setTimeout(resolve, Math.max(BROWSER_SPEAK_MIN_DURATION, text.length * BROWSER_SPEAK_CHAR_RATE));
        });
      } else if (isTopProRef.current) {
        await playTTSElevenLabs(text, lang);
      } else {
        await playTTS(text, lang);
      }
    } catch (e) {}
    isPlayingRef.current = false;
    processAudioQueue();
  }

  async function playMessage(msg) {
    unlockAudio();
    setPlayingMsgId(msg.id);
    if (isTrialRef.current) {
      await new Promise(resolve => {
        browserSpeak(msg.translated, getLang(msg.targetLang).speech);
        setTimeout(resolve, Math.max(BROWSER_SPEAK_MIN_DURATION, msg.translated.length * BROWSER_SPEAK_CHAR_RATE));
      });
    } else if (isTopProRef.current) {
      await playTTSElevenLabs(msg.translated, getLang(msg.targetLang).speech);
    } else {
      await playTTS(msg.translated, getLang(msg.targetLang).speech);
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
    audioEnabledRef
  };
}
