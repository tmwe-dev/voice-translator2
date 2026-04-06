'use client';
import { useRef, useEffect } from 'react';
import { AVATAR_NAMES, AVATARS } from '../lib/constants.js';

/**
 * useTTSEngine — All TTS engines extracted from useAudioSystem.
 *
 * Manages 4 TTS engines with fallback chain:
 * 1. ElevenLabs (Top PRO) → fallback to OpenAI
 * 2. OpenAI gpt-4o-mini-tts (PRO) → streaming, fallback to browser
 * 3. Edge TTS (FREE) → neural voices, fallback to browser
 * 4. Browser SpeechSynthesis (last resort)
 *
 * Also handles: voice scoring, text splitting for CJK/Thai,
 * language-specific speech rates, TTS pre-warming.
 *
 * Returns: { playEdgeTTS, playTTS, playTTSElevenLabs, browserSpeak,
 *            checkVoiceAvailability, playBlobAudio, playBlobNewAudio }
 */
export default function useTTSEngine({
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
}) {
  const voiceCacheRef = useRef({});
  const ttsPrewarmedRef = useRef(false);

  // Preload browser voices (Chrome loads them asynchronously)
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.getVoices();
    const handler = () => { voiceCacheRef.current = {}; };
    speechSynthesis.addEventListener('voiceschanged', handler);
    return () => speechSynthesis.removeEventListener('voiceschanged', handler);
  }, []);

  // Pre-warm TTS connections when audio is ready
  useEffect(() => {
    if (!audioReady || ttsPrewarmedRef.current) return;
    ttsPrewarmedRef.current = true;
    fetch('/api/tts-edge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '.', langCode: 'en', gender: 'female' })
    }).catch(() => {});
    if (!isTrialRef.current) {
      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '.', voice: 'nova', langCode: 'en', userToken: getEffectiveToken() })
      }).catch(() => {});
    }
  }, [audioReady]);

  // ═══════════════════════════════════════════════
  // BROWSER TTS
  // ═══════════════════════════════════════════════

  function findBestVoice(lang) {
    if (typeof speechSynthesis === 'undefined') return null;
    if (voiceCacheRef.current[lang]) return voiceCacheRef.current[lang];
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    const langLower = lang.toLowerCase();
    const langBase = langLower.split('-')[0];
    const matching = voices.filter(v => v.lang.toLowerCase().split('-')[0] === langBase);
    if (matching.length === 0) return null;

    function scoreVoice(v) {
      let score = 0;
      const name = v.name.toLowerCase();
      if (v.lang.toLowerCase() === langLower) score += 10;
      if (name.includes('google')) score += 50;
      if (name.includes('microsoft')) score += 45;
      if (name.includes('neural')) score += 40;
      if (name.includes('natural')) score += 40;
      if (name.includes('premium')) score += 35;
      if (name.includes('enhanced')) score += 30;
      if (name.includes('wavenet')) score += 25;
      if (name.includes('compact')) score -= 20;
      if (name.includes('espeak')) score -= 30;
      return score;
    }

    matching.sort((a, b) => scoreVoice(b) - scoreVoice(a));
    const best = matching[0];
    voiceCacheRef.current[lang] = best;
    return best;
  }

  // Split text for Chrome's 15-second speech bug (CJK/Thai aware)
  function splitTextForSpeech(text, maxChars = 180) {
    if (text.length <= maxChars) return [text];
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxChars) { chunks.push(remaining); break; }
      let splitAt = -1;
      for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.5; i--) {
        const ch = remaining[i];
        if ('.!?;\u3002\uFF01\uFF1F\u0E2F'.includes(ch)) { splitAt = i + 1; break; }
      }
      if (splitAt === -1) {
        for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.5; i--) {
          if (',\u3001\uFF0C'.includes(remaining[i])) { splitAt = i + 1; break; }
        }
      }
      if (splitAt === -1) {
        for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.3; i--) {
          if (remaining[i] === ' ') { splitAt = i + 1; break; }
        }
      }
      if (splitAt === -1) {
        for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.4; i--) {
          const ch = remaining.charCodeAt(i);
          if (ch >= 0x0E40 && ch <= 0x0E44) { splitAt = i; break; }
        }
      }
      if (splitAt === -1) splitAt = maxChars;
      chunks.push(remaining.substring(0, splitAt).trim());
      remaining = remaining.substring(splitAt).trim();
    }
    return chunks.filter(c => c.length > 0);
  }

  const BROWSER_TTS_RATE = { 'th': 0.8, 'zh': 0.85, 'ja': 0.85, 'ko': 0.88, 'vi': 0.82, 'ar': 0.88, 'hi': 0.9 };

  function speakChunk(text, lang, voice) {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === 'undefined') { resolve(); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const langBase = lang.split('-')[0].toLowerCase();
      u.rate = BROWSER_TTS_RATE[langBase] || 0.95;
      u.pitch = 1.0;
      u.volume = 1.0;
      if (voice) u.voice = voice;
      const timeoutMs = Math.min(20000, Math.max(3000, text.length * 120));
      const safetyTimer = setTimeout(() => { speechSynthesis.cancel(); resolve(); }, timeoutMs);
      function done() { clearInterval(keepAlive); clearTimeout(safetyTimer); resolve(); }
      u.onend = done;
      u.onerror = done;
      if (speechSynthesis.paused) speechSynthesis.resume();
      speechSynthesis.speak(u);
      const keepAlive = setInterval(() => {
        if (speechSynthesis.speaking && !speechSynthesis.paused) return;
        if (speechSynthesis.paused) speechSynthesis.resume();
      }, 5000);
    });
  }

  async function browserSpeak(text, lang) {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const voice = findBestVoice(lang);
    const chunks = splitTextForSpeech(text);
    for (const chunk of chunks) {
      await speakChunk(chunk, lang, voice);
    }
  }

  function checkVoiceAvailability(lang) {
    if (typeof speechSynthesis === 'undefined') return { available: false, quality: 'none' };
    const voice = findBestVoice(lang);
    if (!voice) return { available: false, quality: 'none' };
    const name = voice.name.toLowerCase();
    let quality = 'basic';
    if (name.includes('google') || name.includes('microsoft') || name.includes('neural') || name.includes('natural')) quality = 'premium';
    else if (name.includes('enhanced') || name.includes('wavenet')) quality = 'good';
    else if (name.includes('compact') || name.includes('espeak')) quality = 'low';
    return { available: true, quality, voiceName: voice.name };
  }

  // ═══════════════════════════════════════════════
  // BLOB PLAYBACK HELPERS (shared by all engines)
  // ═══════════════════════════════════════════════

  function playBlobAudio(blobUrl) {
    return new Promise((resolve) => {
      const audio = getPersistentAudio();
      audio.onended = null;
      audio.onerror = null;
      const safetyTimer = setTimeout(() => { audio.pause(); cleanup(); resolve(false); }, 30000);
      function cleanup() { clearTimeout(safetyTimer); audio.onended = null; audio.onerror = null; }
      audio.onended = () => { cleanup(); resolve(true); };
      audio.onerror = () => { cleanup(); resolve(false); };
      audio.src = blobUrl;
      audio.play().catch(() => { cleanup(); resolve(false); });
    });
  }

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

  async function playBlobWithFallback(blob, text, lang) {
    const url = URL.createObjectURL(blob);
    activeBlobUrlsRef.current.add(url);
    let played = await playBlobAudio(url);
    if (!played) played = await playBlobNewAudio(url);
    if (!played) await browserSpeak(text, lang);
    activeBlobUrlsRef.current.delete(url);
    URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════════════
  // EDGE TTS (FREE)
  // ═══════════════════════════════════════════════

  async function fetchEdgeTTSBlob(text, langCode, gender) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
      try {
        const res = await fetch('/api/tts-edge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text, langCode: langCode || 'en',
            gender: gender || prefsRef.current?.edgeTtsVoiceGender || 'female',
          }),
          signal: controller.signal
        });
        if (!res.ok) throw new Error(`EdgeTTS ${res.status}`);
        return await res.blob();
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e) { throw e; }
  }

  async function playEdgeTTS(text, langCode) {
    let blob;
    try {
      blob = await fetchEdgeTTSBlob(text, langCode);
    } catch {
      try {
        const alt = (prefsRef.current?.edgeTtsVoiceGender || 'female') === 'female' ? 'male' : 'female';
        blob = await fetchEdgeTTSBlob(text, langCode, alt);
      } catch {
        await browserSpeak(text, langCode);
        return;
      }
    }
    await playBlobWithFallback(blob, text, langCode);
  }

  // ═══════════════════════════════════════════════
  // OPENAI TTS (PRO) — streaming
  // ═══════════════════════════════════════════════

  async function fetchTTSBlob(text, langCode, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text, voice: prefsRef.current.voice || 'nova',
            langCode: langCode || undefined,
            userToken: getEffectiveToken(),
            roomId: roomIdRef.current || undefined,
          })
        });
        if (!res.ok) { if (attempt < retries) continue; throw new Error(`TTS ${res.status}`); }
        return await res.blob();
      } catch (e) { if (attempt < retries) continue; throw e; }
    }
  }

  async function playTTS(text, lang) {
    try {
      const blob = await fetchTTSBlob(text, lang);
      await playBlobWithFallback(blob, text, lang);
    } catch (e) {
      console.warn('[TTS-OpenAI] Failed, falling back to browser:', e.message);
      await browserSpeak(text, lang);
    }
  }

  // ═══════════════════════════════════════════════
  // ELEVENLABS TTS (TOP PRO)
  // ═══════════════════════════════════════════════

  function getAvatarName() {
    const avatar = prefsRef.current?.avatar;
    if (!avatar) return undefined;
    const idx = AVATARS.indexOf(avatar);
    return idx >= 0 ? AVATAR_NAMES[idx] : undefined;
  }

  async function playTTSElevenLabs(text, langCode) {
    let blob;
    try {
      const res = await fetch('/api/tts-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId: clonedVoiceIdRef?.current || selectedELVoice || undefined,
          langCode: langCode || undefined,
          avatarName: getAvatarName(),
          userToken: getEffectiveToken(),
          roomId: roomIdRef.current || undefined
        })
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
      blob = await res.blob();
    } catch {
      return playTTS(text, langCode); // Fallback to OpenAI
    }
    await playBlobWithFallback(blob, text, langCode);
  }

  return {
    browserSpeak,
    checkVoiceAvailability,
    playEdgeTTS,
    playTTS,
    playTTSElevenLabs,
    playBlobAudio,
    playBlobNewAudio,
  };
}
