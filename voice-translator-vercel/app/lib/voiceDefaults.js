// ═══════════════════════════════════════════════
// VOICE DEFAULTS — Admin-configurable voice settings
//
// This file defines the DEFAULT voices for each TTS engine and language.
// The admin (Luca) can edit this file to change the system defaults.
// Users can override these defaults in their personal preferences.
//
// Priority chain (highest first):
// 1. User's per-language voice preference (stored in localStorage)
// 2. User's global voice preference (in Settings)
// 3. These system defaults (this file)
//
// HOW TO UPDATE:
// - Change the voice IDs below
// - Push to GitHub → Vercel auto-deploys
// - All users get the new defaults (unless they have personal overrides)
//
// ElevenLabs voice IDs can be found at:
// - Dashboard: https://elevenlabs.io/app/voice-lab → click voice → Copy ID
// - API: GET https://api.elevenlabs.io/v1/voices
// ═══════════════════════════════════════════════

// ── ELEVENLABS DEFAULT VOICES PER LANGUAGE ──
// Format: { female: 'voice_id', male: 'voice_id' }
// Set to null to use ElevenLabs' own default
export const EL_VOICES_BY_LANG = {
  // European languages
  'en': { female: null, male: null },       // ElevenLabs default — already optimized for English
  'it': { female: null, male: null },       // Use ElevenLabs default
  'es': { female: null, male: null },
  'fr': { female: null, male: null },
  'de': { female: null, male: null },
  'pt': { female: null, male: null },
  'nl': { female: null, male: null },
  'pl': { female: null, male: null },
  'sv': { female: null, male: null },
  'ru': { female: null, male: null },
  'el': { female: null, male: null },
  'cs': { female: null, male: null },
  'ro': { female: null, male: null },
  'hu': { female: null, male: null },
  'fi': { female: null, male: null },
  'tr': { female: null, male: null },

  // Asian languages
  'th': { female: null, male: null },       // Thai — use multilingual voice
  'zh': { female: null, male: null },       // Chinese Mandarin
  'ja': { female: null, male: null },       // Japanese
  'ko': { female: null, male: null },       // Korean
  'vi': { female: null, male: null },       // Vietnamese

  // Middle Eastern / South Asian
  'ar': { female: null, male: null },       // Arabic
  'hi': { female: null, male: null },       // Hindi

  // Southeast Asian
  'id': { female: null, male: null },       // Indonesian
  'ms': { female: null, male: null },       // Malay
};

// ── OPENAI TTS DEFAULT VOICE PER LANGUAGE ──
// Available voices: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
// Set to null to use the global default (nova)
export const OPENAI_VOICES_BY_LANG = {
  'th': 'shimmer',   // Shimmer: clearer tone separation for tonal languages
  'zh': 'shimmer',
  'ja': 'nova',      // Nova: natural pitch accent
  'ko': 'nova',
  'vi': 'shimmer',
  'ar': 'onyx',      // Onyx: deep, authoritative
  'hi': 'nova',
  'ru': 'onyx',
  'de': 'fable',     // Fable: clear pronunciation
  'fr': 'shimmer',   // Shimmer: elegant
  // All other languages: null → use user's choice or 'nova' default
};

// ── EDGE TTS SPEED PER LANGUAGE ──
// Asian tonal languages need slower delivery for clarity
// Format: rate string for Edge TTS ('+0%' = normal)
export const EDGE_RATE_BY_LANG = {
  'th': '-12%',
  'zh': '-8%',
  'ja': '-8%',
  'ko': '-5%',
  'vi': '-10%',
  'ar': '-5%',
  'hi': '-5%',
  // All other languages: '+0%' (normal speed)
};

// ── OPENAI TTS SPEED PER LANGUAGE ──
// 1.0 = normal, 0.9 = 10% slower
export const OPENAI_SPEED_BY_LANG = {
  'th': 0.9,
  'zh': 0.92,
  'ja': 0.92,
  'vi': 0.9,
  'ar': 0.95,
  // All other languages: 1.0 (normal)
};

// ── ELEVENLABS MODEL PER LANGUAGE ──
// flash_v2_5 = fastest (75ms), multilingual_v2 = broadest, v3 = newest
export const EL_MODEL_BY_LANG = {
  'th': 'eleven_v3',
  'vi': 'eleven_v3',
  'hu': 'eleven_v3',
  // All other supported languages: 'eleven_flash_v2_5'
  // Unlisted languages: 'eleven_multilingual_v2'
};

// ── HELPER: Get ElevenLabs voice for a language + gender ──
export function getELVoiceForLang(langCode, gender = 'female') {
  const lang2 = langCode?.replace(/-.*/, '') || 'en';
  const entry = EL_VOICES_BY_LANG[lang2];
  if (!entry) return null;
  return entry[gender] || entry.female || null;
}

// ── HELPER: Get OpenAI voice for a language ──
export function getOpenAIVoiceForLang(langCode) {
  const lang2 = langCode?.replace(/-.*/, '') || 'en';
  return OPENAI_VOICES_BY_LANG[lang2] || null;
}

// ── HELPER: Get Edge TTS rate for a language ──
export function getEdgeRateForLang(langCode) {
  const lang2 = langCode?.replace(/-.*/, '') || 'en';
  return EDGE_RATE_BY_LANG[lang2] || '+0%';
}

// ── HELPER: Get OpenAI speed for a language ──
export function getOpenAISpeedForLang(langCode) {
  const lang2 = langCode?.replace(/-.*/, '') || 'en';
  return OPENAI_SPEED_BY_LANG[lang2] || 1.0;
}

// ── HELPER: Get ElevenLabs model for a language ──
export function getELModelForLang(langCode) {
  const lang2 = langCode?.replace(/-.*/, '') || 'en';
  if (EL_MODEL_BY_LANG[lang2]) return EL_MODEL_BY_LANG[lang2];
  // Flash v2.5 supported languages
  const flashLangs = new Set([
    'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'sv', 'tr',
    'id', 'ms', 'cs', 'ro', 'fi', 'el', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'
  ]);
  return flashLangs.has(lang2) ? 'eleven_flash_v2_5' : 'eleven_multilingual_v2';
}
