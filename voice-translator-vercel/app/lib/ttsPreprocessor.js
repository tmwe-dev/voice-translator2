// ═══════════════════════════════════════════════
// TTS Preprocessor — Clean text before speech synthesis
// Adapted from BarTalk v79 ttsPreprocessor.ts
//
// Pipeline: stripMarkdown → stripEmoji → normalizePunctuation → cleanWhitespace
// ═══════════════════════════════════════════════

/**
 * Strip markdown formatting for TTS readability
 */
function stripMarkdown(text) {
  return text
    // Headers
    .replace(/^#{1,6}\s+/gm, '')
    // Bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Strikethrough
    .replace(/~~([^~]+)~~/g, '$1')
    // Code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Links: [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Images: ![alt](url) → (nothing)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Blockquotes
    .replace(/^>\s+/gm, '')
    // Horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // List markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // HTML tags
    .replace(/<[^>]+>/g, '');
}

/**
 * Remove emoji characters
 */
function stripEmoji(text) {
  return text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{FE0F}]/gu,
    ''
  );
}

/**
 * Normalize punctuation for natural speech
 */
function normalizePunctuation(text) {
  return text
    // Multiple exclamation/question marks → single
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    // Ellipsis normalization
    .replace(/\.{3,}/g, '...')
    // Remove stray asterisks/underscores
    .replace(/[*_]{1,3}/g, '')
    // Normalize dashes
    .replace(/\s*[-–—]{2,}\s*/g, ' — ');
}

/**
 * Clean whitespace
 */
function cleanWhitespace(text) {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Main preprocessing pipeline for TTS
 * @param {string} text - Raw text (possibly from LLM translation)
 * @param {string} lang - BCP-47 language code (e.g., 'it', 'th', 'zh')
 * @returns {string} Cleaned text ready for TTS
 */
export function preprocessForTTS(text, lang) {
  if (!text) return '';

  let cleaned = text;
  cleaned = stripMarkdown(cleaned);
  cleaned = stripEmoji(cleaned);
  cleaned = normalizePunctuation(cleaned);
  cleaned = cleanWhitespace(cleaned);

  // Language-specific post-processing
  if (lang === 'th') {
    // Thai: ensure no Latin transliterations leaked through
    // If text is >50% Latin chars but should be Thai, something went wrong
    const thaiChars = (cleaned.match(/[\u0E00-\u0E7F]/g) || []).length;
    const latinChars = (cleaned.match(/[a-zA-Z]/g) || []).length;
    if (thaiChars === 0 && latinChars > 0) {
      // Text is pure Latin but should be Thai — flag it
      console.warn('[TTS Preprocessor] Thai text appears to be Latin transliteration');
    }
  }

  // Truncate for TTS safety (most engines have limits)
  if (cleaned.length > 4000) {
    cleaned = cleaned.substring(0, 4000);
    // Don't cut mid-sentence
    const lastPeriod = cleaned.lastIndexOf('.');
    if (lastPeriod > 3500) cleaned = cleaned.substring(0, lastPeriod + 1);
  }

  return cleaned;
}

/**
 * Build TTS knowledge base instructions for the translation LLM
 * Tells the LLM to produce text optimized for speech synthesis
 * @param {string} lang - Target language
 * @returns {string} Instructions to append to system prompt
 */
export function buildTTSKnowledgeBase(lang) {
  const LANG_DISPLAY = {
    'it': 'Italian', 'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'pt': 'Portuguese', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean',
    'ar': 'Arabic', 'hi': 'Hindi', 'ru': 'Russian', 'tr': 'Turkish', 'th': 'Thai',
    'vi': 'Vietnamese', 'nl': 'Dutch', 'pl': 'Polish', 'sv': 'Swedish', 'el': 'Greek',
  };
  const langName = LANG_DISPLAY[lang] || lang;

  return `
TTS OPTIMIZATION (your output will be spoken aloud in ${langName}):
- Write numbers as words ("tre" not "3", "cinquecento" not "500")
- Expand abbreviations ("dottore" not "Dr.", "per esempio" not "es.")
- No markdown, no bullet points, no formatting
- Use natural spoken punctuation (commas for pauses, periods for stops)
- Avoid parenthetical asides — restructure as separate sentences
- Keep sentences under 30 words for natural speech rhythm
- No URLs, email addresses, or code snippets`;
}
