'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang, BROWSER_SPEAK_MIN_DURATION, BROWSER_SPEAK_CHAR_RATE } from '../lib/constants.js';

export default function useAudioSystem({
  prefsRef,
  isTrialRef,
  isTopProRef,
  selectedELVoice,
  roomId,
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
          roomId: roomId || undefined
        })
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      activeBlobUrlsRef.current.add(url);
      return new Promise((resolve) => {
        const audio = getPersistentAudio();
        audio.onended = () => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          playWithNewAudio(text, lang, resolve);
        };
        audio.src = url;
        audio.play().catch(() => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          playWithNewAudio(text, lang, resolve);
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
        roomId: roomId || undefined
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

  function browserSpeak(text, lang) {
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  }

  async function playTTSElevenLabs(text, langCode) {
    try {
      const res = await fetch('/api/tts-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId: selectedELVoice || undefined,
          langCode: langCode?.split('-')[0] || undefined,
          userToken: getEffectiveToken(),
          roomId: roomId || undefined
        })
      });
      if (!res.ok) throw new Error('ElevenLabs TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      activeBlobUrlsRef.current.add(url);
      return new Promise((resolve) => {
        const audio = getPersistentAudio();
        audio.onended = () => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          playTTS(text, langCode).then(resolve);
        };
        audio.src = url;
        audio.play().catch(() => {
          activeBlobUrlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          playTTS(text, langCode).then(resolve);
        });
      });
    } catch {
      return playTTS(text, langCode);
    }
  }

  async function queueAudio(text, lang, msgId) {
    if (!audioEnabledRef.current) return;
    if (msgId && playedMsgIdsRef.current.has(msgId)) return;
    if (msgId) playedMsgIdsRef.current.add(msgId);
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
    getMicStream,
    requestMicEarly,
    getPersistentAudio,
    persistentMicRef,
    audioEnabledRef
  };
}
