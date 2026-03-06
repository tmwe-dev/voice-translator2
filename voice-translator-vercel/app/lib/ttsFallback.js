// ═══════════════════════════════════════════════
// TTS Fallback Chain
// Order: OpenAI gpt-4o-mini-tts → ElevenLabs → Edge TTS → Web Speech API
// Each provider is tried in sequence; on failure, falls through to next
// ═══════════════════════════════════════════════

/**
 * Try TTS with multiple providers in fallback order
 * @param {string} text - Text to speak
 * @param {string} langCode - Language code (e.g., 'it', 'en')
 * @param {Object} opts - Options
 * @param {string} opts.voice - Preferred voice name
 * @param {string} opts.userToken - Auth token
 * @param {string} opts.roomId - Room ID for guest auth
 * @param {string[]} opts.engines - Ordered list of engines to try
 * @returns {Promise<{ blob: Blob, engine: string }>}
 */
export async function ttsFallback(text, langCode, opts = {}) {
  const {
    voice = 'nova',
    userToken = null,
    roomId = null,
    engines = ['openai', 'elevenlabs', 'edge', 'browser'],
  } = opts;

  for (const engine of engines) {
    try {
      const blob = await tryEngine(engine, text, langCode, voice, userToken, roomId);
      if (blob && blob.size > 0) {
        return { blob, engine };
      }
    } catch (e) {
      console.warn(`[TTS Fallback] ${engine} failed:`, e.message);
      // Continue to next engine
    }
  }

  throw new Error('All TTS engines failed');
}

async function tryEngine(engine, text, langCode, voice, userToken, roomId) {
  const baseBody = { text, langCode, voice };
  const headers = { 'Content-Type': 'application/json' };
  if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

  switch (engine) {
    case 'openai': {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...baseBody, userToken, roomId }),
      });
      if (!res.ok) throw new Error(`OpenAI TTS: ${res.status}`);
      return await res.blob();
    }

    case 'elevenlabs': {
      const res = await fetch('/api/tts-elevenlabs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...baseBody, userToken, roomId }),
      });
      if (!res.ok) throw new Error(`ElevenLabs: ${res.status}`);
      return await res.blob();
    }

    case 'edge': {
      const res = await fetch('/api/tts-edge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, langCode, voice }),
      });
      if (!res.ok) throw new Error(`Edge TTS: ${res.status}`);
      return await res.blob();
    }

    case 'browser': {
      // Web Speech API — last resort (no blob, direct playback)
      return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) {
          return reject(new Error('Web Speech API not supported'));
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        utterance.rate = 1.0;

        // Try to find a voice matching the language
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find(v => v.lang.startsWith(langCode));
        if (match) utterance.voice = match;

        // We can't get a blob from Web Speech, so we create a "marker" blob
        utterance.onend = () => resolve(new Blob(['browser-speech'], { type: 'text/plain' }));
        utterance.onerror = reject;

        window.speechSynthesis.speak(utterance);
      });
    }

    default:
      throw new Error(`Unknown engine: ${engine}`);
  }
}
