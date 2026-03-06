// ═══════════════════════════════════════════════
// Translation Output Validation & Model Configuration
// Extracted from translate/route.js for reuse and testability
// ═══════════════════════════════════════════════

// Script ranges for non-Latin target language validation
export const SCRIPT_RANGES = {
  'th': /[\u0E00-\u0E7F]/,      // Thai
  'zh': /[\u4E00-\u9FFF]/,      // CJK Unified
  'ja': /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/, // Hiragana + Katakana + CJK
  'ko': /[\uAC00-\uD7AF\u1100-\u11FF]/, // Hangul
  'ar': /[\u0600-\u06FF]/,      // Arabic
  'hi': /[\u0900-\u097F]/,      // Devanagari
  'ru': /[\u0400-\u04FF]/,      // Cyrillic
  'el': /[\u0370-\u03FF]/,      // Greek
};

export const LATIN_LANGS = new Set(['en','es','fr','de','it','pt','nl','pl','sv','tr','vi','id','ms','cs','ro','hu','fi']);

/**
 * Validate translation output for common LLM failure modes:
 * - Empty output
 * - Meta-text leaking (e.g. "Translation:", "Here is")
 * - Abnormal length ratio (expansion/contraction)
 * - Wrong script for target language
 */
export function validateOutput(original, translated, targetLang) {
  if (!translated || !translated.trim()) return { valid: false, reason: 'empty' };
  const t = translated.trim();
  // Check for LLM meta-text leaking through
  if (t.startsWith('Translation:') || t.startsWith('Here is') || t.startsWith('Note:'))
    return { valid: false, reason: 'meta_text' };
  // Length ratio sanity (allow wider for CJK)
  const ratio = t.length / Math.max(original.trim().length, 1);
  if (ratio > 8 || ratio < 0.05) return { valid: false, reason: 'length_ratio' };
  // Script validation for non-Latin targets
  if (!LATIN_LANGS.has(targetLang) && SCRIPT_RANGES[targetLang]) {
    if (!SCRIPT_RANGES[targetLang].test(t)) return { valid: false, reason: 'wrong_script' };
  }
  return { valid: true };
}

// Model mapping: our model IDs → actual API model strings + provider
export const MODEL_MAP = {
  'gpt-4o-mini':    { actual: 'gpt-4o-mini', provider: 'openai' },
  'gpt-4o':         { actual: 'gpt-4o', provider: 'openai' },
  'claude-sonnet':  { actual: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
  'claude-haiku':   { actual: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
  'gemini-flash':   { actual: 'gemini-2.0-flash', provider: 'gemini' },
  'gemini-pro':     { actual: 'gemini-2.5-pro-preview-05-06', provider: 'gemini' },
};

// Language pair notes for problematic combinations
export const PAIR_NOTES = {
  'it->th': 'Italian→Thai: very different structures. Thai is SVO with topic-comment. Rearrange naturally.',
  'it->zh': 'Italian→Chinese: use measure words (量词) and topic-prominent structure. Sound native, not translated.',
  'it->ja': 'Italian→Japanese: SOV order, use です/ます form unless very casual.',
  'en->th': 'English→Thai: no verb conjugation/articles in Thai. Use particles (ค่ะ/ครับ) appropriately.',
  'th->en': 'Thai→English: Thai is pro-drop. Infer and add appropriate pronouns.',
  'zh->en': 'Chinese→English: restructure topic-comment to natural SVO.',
  'th->it': 'Thai→Italian: add articles and conjugations that Thai lacks.',
  'zh->it': 'Chinese→Italian: add articles, conjugations, restructure from topic-comment to SVO.',
  'ja->en': 'Japanese→English: restructure SOV to SVO. Expand implied subjects.',
  'ja->it': 'Japanese→Italian: restructure SOV, add articles and conjugations.',
  'ko->en': 'Korean→English: restructure SOV to SVO, expand honorifics contextually.',
};

/**
 * Calculate confidence score for a translation
 */
export function calcConfidence(sourceText, translatedText, sourceLang, targetLang) {
  let score = 0.85; // Base confidence for AI translation

  // Well-supported language pairs get a boost
  const wellSupported = new Set(['en','es','fr','de','it','pt','zh','ja','ko','ru']);
  if (wellSupported.has(sourceLang)) score += 0.05;
  if (wellSupported.has(targetLang)) score += 0.05;

  // Very short text has lower confidence
  if (sourceText.length < 5) score -= 0.15;
  else if (sourceText.length < 15) score -= 0.05;

  // If translation is identical to source, something's wrong
  if (translatedText.trim() === sourceText.trim()) score -= 0.3;

  // If translation is empty or too short compared to source
  if (!translatedText || translatedText.length < sourceText.length * 0.1) score -= 0.4;

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

/**
 * Simple hash for cache key (first 32 chars of base64-encoded text)
 */
export function getSimpleHash(text) {
  const encoded = Buffer.from(text).toString('base64');
  return encoded.substring(0, 32);
}
