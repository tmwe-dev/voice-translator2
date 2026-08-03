// ═══════════════════════════════════════════════════════════════
// Translation Quality Scoring & Chain-of-Translation
// Post-translation quality checks + bridge translation for hard pairs
// ═══════════════════════════════════════════════════════════════

/**
 * Quick quality score for a translation (0-1).
 * Checks for common LLM failure modes without needing another LLM call.
 *
 * @param {string} source - Original text
 * @param {string} translated - Translated text
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @returns {{ score: number, issues: string[] }}
 */
export function quickQualityScore(source, translated, sourceLang, targetLang) {
  const issues = [];
  let score = 1.0;

  if (!translated || !translated.trim()) {
    return { score: 0, issues: ['empty_output'] };
  }

  // 1. Length ratio check — translations shouldn't be wildly different in length
  const ratio = translated.length / source.length;
  const expectedRatios = getExpectedLengthRatio(sourceLang, targetLang);
  if (ratio < expectedRatios.min) {
    score -= 0.15;
    issues.push('too_short');
  } else if (ratio > expectedRatios.max) {
    score -= 0.10;
    issues.push('too_long');
  }

  // 2. Meta-text detection — LLM added notes/explanations
  const metaPatterns = [
    /^(Translation|Translated|Here is|Note:|Nota:|Traduzione:)/i,
    /^(I'd be happy|I can help|Sure,|Of course)/i,
    /\(Note:.*\)$/i,
    /\[.*translation.*\]/i,
  ];
  for (const pat of metaPatterns) {
    if (pat.test(translated)) {
      score -= 0.25;
      issues.push('meta_text');
      break;
    }
  }

  // 3. Script validation — CJK target should have CJK chars
  if (isCJK(targetLang) && !hasCJKChars(translated)) {
    score -= 0.30;
    issues.push('wrong_script');
  }

  // 4. Same as source — might not be translated at all
  if (translated.trim().toLowerCase() === source.trim().toLowerCase() && sourceLang !== targetLang) {
    score -= 0.40;
    issues.push('not_translated');
  }

  // 5. Repetition detection — LLM hallucination
  const words = translated.split(/\s+/);
  if (words.length > 10) {
    const unique = new Set(words);
    const uniqueRatio = unique.size / words.length;
    if (uniqueRatio < 0.3) {
      score -= 0.20;
      issues.push('repetitive');
    }
  }

  // 6. Diacritic check for tonal languages
  if (['vi', 'th'].includes(targetLang)) {
    // Vietnamese should have diacritics
    if (targetLang === 'vi' && !/[àáảãạ]/i.test(translated) && translated.length > 10) {
      score -= 0.15;
      issues.push('missing_diacritics');
    }
    // Thai should have Thai script
    if (targetLang === 'th' && !/[\u0E00-\u0E7F]/.test(translated)) {
      score -= 0.30;
      issues.push('wrong_script');
    }
  }

  return { score: Math.max(0, score), issues };
}

/**
 * Get expected length ratio range for a language pair
 */
function getExpectedLengthRatio(src, tgt) {
  // CJK languages are much more compact
  const cjk = new Set(['zh', 'ja', 'ko']);
  if (cjk.has(src) && !cjk.has(tgt)) return { min: 1.5, max: 6.0 }; // CJK→EU expands
  if (!cjk.has(src) && cjk.has(tgt)) return { min: 0.15, max: 0.8 }; // EU→CJK compresses
  if (cjk.has(src) && cjk.has(tgt)) return { min: 0.5, max: 2.5 };   // CJK→CJK
  return { min: 0.4, max: 3.0 }; // EU→EU
}

function isCJK(lang) {
  return ['zh', 'ja', 'ko'].includes(lang?.replace(/-.*/, ''));
}

function hasCJKChars(text) {
  return /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(text);
}

/**
 * Determine if a language pair should use bridge translation (English pivot).
 * Bridge translation: source → English → target
 * Used for pairs with low confidence and no direct training data.
 *
 * @param {string} sourceLang
 * @param {string} targetLang
 * @param {number} directConfidence - Confidence of direct translation
 * @returns {boolean}
 */
export function shouldUseBridge(sourceLang, targetLang, directConfidence) {
  // Never bridge if either language is English (already a direct pair)
  if (sourceLang === 'en' || targetLang === 'en') return false;

  // Never bridge high-confidence pairs
  if (directConfidence >= 0.85) return false;

  // Bridge for rare pairs: e.g. Thai↔Hungarian, Vietnamese↔Finnish
  const rareLangs = new Set(['th', 'vi', 'hu', 'fi', 'cs', 'ro', 'el', 'bg', 'hr', 'et', 'lt', 'lv', 'sk', 'sl']);
  if (rareLangs.has(sourceLang) && rareLangs.has(targetLang)) return true;

  // Bridge for CJK↔non-common-European pairs
  const cjk = new Set(['zh', 'ja', 'ko']);
  if ((cjk.has(sourceLang) || cjk.has(targetLang)) && directConfidence < 0.75) return true;

  return directConfidence < 0.65;
}
