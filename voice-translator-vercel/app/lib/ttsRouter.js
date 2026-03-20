// ═══════════════════════════════════════════════
// TTS Router — Smart voice engine selection
//
// Hierarchy: ElevenLabs (premium) > CosyVoice (CJK) > OpenAI TTS > Edge TTS (free)
// Selects optimal engine per language with automatic fallback
// ═══════════════════════════════════════════════

import { getLangFamily, baseLang, CJK_LANGS, SEA_LANGS } from './asiaConstants.js';
import { isCosyVoiceAvailable } from './ttsAsia.js';
import { getEdgeVoice } from './edgeVoices.js';

// ── Per-engine language quality scores (0-10) ──
const ELEVENLABS_SCORES = {
  en: 10, es: 9, fr: 9, de: 9, it: 9, pt: 9, nl: 8, pl: 8, ru: 8,
  zh: 7, ja: 7, ko: 7, ar: 7, hi: 7, tr: 8, vi: 6, th: 5, id: 6,
};

const COSYVOICE_SCORES = {
  zh: 10, ja: 9, ko: 8, th: 7, vi: 7,
};

const OPENAI_SCORES = {
  en: 9, es: 8, fr: 8, de: 8, it: 8, pt: 8, zh: 7, ja: 7, ko: 7,
  ar: 6, hi: 6, ru: 7, tr: 7, nl: 7, pl: 7, th: 6, vi: 6,
};

// Edge TTS: universal baseline (always available, free)
const EDGE_BASE_SCORE = 6;

/**
 * Route TTS request to the optimal engine.
 *
 * @param {string} langCode - Target language code
 * @param {object} [opts]
 * @param {boolean} [opts.hasElevenLabs] - User has ElevenLabs key
 * @param {boolean} [opts.hasOpenAI] - User has OpenAI key
 * @param {string} [opts.tier] - User tier: FREE, PRO, TOP_PRO
 * @param {string} [opts.gender] - 'female' or 'male'
 * @returns {{ engine: string, score: number, voice: string, reason: string, fallback: string }}
 */
export function routeTTS(langCode, opts = {}) {
  const lang2 = baseLang(langCode);
  const family = getLangFamily(langCode);
  const candidates = [];

  // 1. ElevenLabs (premium — requires API key)
  if (opts.hasElevenLabs) {
    const score = ELEVENLABS_SCORES[lang2] || 5;
    candidates.push({ engine: 'elevenlabs', score: score + 2, reason: 'premium_quality' }); // +2 bonus for quality
  }

  // 2. CosyVoice (CJK specialist — requires DashScope key)
  if (isCosyVoiceAvailable(langCode) && (family === 'CJK' || family === 'SEA')) {
    const score = COSYVOICE_SCORES[lang2] || 5;
    candidates.push({ engine: 'cosyvoice', score, reason: 'cjk_specialist' });
  }

  // 3. OpenAI TTS (good all-around — requires OpenAI key)
  if (opts.hasOpenAI) {
    const score = OPENAI_SCORES[lang2] || 5;
    candidates.push({ engine: 'openai', score, reason: 'openai_tts' });
  }

  // 4. Edge TTS (always available, free)
  candidates.push({ engine: 'edge', score: EDGE_BASE_SCORE, reason: 'free_universal' });

  // Sort by score (descending)
  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];
  const fallback = candidates[1]?.engine || 'edge';

  // Determine voice for the selected engine
  let voice = '';
  const gender = opts.gender || 'female';

  switch (best.engine) {
    case 'edge':
      voice = getEdgeVoice(langCode, gender);
      break;
    case 'openai':
      // Tonal languages get shimmer (clearer tone separation), others get nova
      voice = (CJK_LANGS.has(lang2) || SEA_LANGS.has(lang2)) ? 'shimmer' : 'nova';
      break;
    case 'cosyvoice':
      voice = gender === 'male' ? 'longcheng' : 'longxiaochun';
      break;
    case 'elevenlabs':
      voice = 'default'; // Resolved later by voiceDefaults.js
      break;
  }

  return {
    engine: best.engine,
    score: best.score,
    voice,
    reason: best.reason,
    fallback,
  };
}

/**
 * Get all available TTS engines for a language (for Settings UI)
 */
export function getAvailableTTSEngines(langCode, opts = {}) {
  const lang2 = baseLang(langCode);
  const engines = [];

  if (opts.hasElevenLabs) {
    engines.push({ id: 'elevenlabs', name: 'ElevenLabs', quality: 'Premium', score: ELEVENLABS_SCORES[lang2] || 5 });
  }
  if (isCosyVoiceAvailable(langCode)) {
    engines.push({ id: 'cosyvoice', name: 'CosyVoice', quality: 'CJK Specialist', score: COSYVOICE_SCORES[lang2] || 5 });
  }
  if (opts.hasOpenAI) {
    engines.push({ id: 'openai', name: 'OpenAI', quality: 'High', score: OPENAI_SCORES[lang2] || 5 });
  }
  engines.push({ id: 'edge', name: 'Edge TTS', quality: 'Free', score: EDGE_BASE_SCORE });

  return engines.sort((a, b) => b.score - a.score);
}
