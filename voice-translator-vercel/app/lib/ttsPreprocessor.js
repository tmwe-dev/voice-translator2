// ═══════════════════════════════════════════════
// TTS Preprocessor — Clean text before speech synthesis
// Adapted from BarTalk v79 ttsPreprocessor.ts
//
// Pipeline: stripMarkdown → stripEmoji → normalizePunctuation → cleanWhitespace
// ═══════════════════════════════════════════════

import { createLogger } from './logger.js';
const log = createLogger('ttsPreprocessor');

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

// b.299 — I NUMERI ROMANI. La voce leggeva "XXIV" come "iks-iks-i-vu" —
// una fila di lettere. Nei corsi di storia e ovunque (secoli, papi,
// capitoli, Luigi XIV) sono continui. Qui si convertono nell'ordinale
// PARLATO della lingua, prima che la voce ci metta le mani.
// Si toccano SOLO i romani veri e isolati: parole tutte in I V X L C D M,
// lunghe almeno due segni (una "I" o "V" sola sarebbe un pronome o una
// nota), spesso precedute da secolo/capitolo/re o seguite da secolo.
const VAL_ROMANI = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function romanoANumero(r) {
  let tot = 0;
  for (let i = 0; i < r.length; i++) {
    const v = VAL_ROMANI[r[i]], succ = VAL_ROMANI[r[i + 1]] || 0;
    tot += v < succ ? -v : v;
  }
  return tot;
}
const ORDINALI = {
  it: (n) => n <= 20
    ? ['zero','primo','secondo','terzo','quarto','quinto','sesto','settimo','ottavo','nono','decimo','undicesimo','dodicesimo','tredicesimo','quattordicesimo','quindicesimo','sedicesimo','diciassettesimo','diciottesimo','diciannovesimo','ventesimo'][n]
    : `${n}\u00BA`,
};
// Parole che ANNUNCIANO un numero romano: solo con una di queste vicino
// si converte. Senza contesto, MIX/CIVIC/LID sono romani validi ma sono
// parole, non numeri — e non vanno toccate.
const CONTESTO_ROMANO = /\b(secol[oi]|capitol[oi]|tom[oi]|libr[oi]|part[ei]|volum[ei]|paragraf[oi]|re|regina|papa|luigi|enrico|carlo|giovanni|pio|benedetto|napoleone|guerra mondiale|millenni[oi]|dinastia|olimpiad[ei]|century|chapter|book|part|volume|king|queen|pope|louis|henry|world war)\b/i;
function espandiRomani(text, lang) {
  const inParola = ORDINALI[lang];
  return text.replace(/(\b[\p{L}]+\b[ ,]+)?\b([IVXLCDM]{2,})\b([ ,]+\b[\p{L}]+\b)?/gu, (intero, prima, r, dopo) => {
    const n = romanoANumero(r);
    if (n <= 0 || n > 3000) return intero;
    if (numeroARomano(n) !== r) return intero;             // non canonico: era una parola
    // serve una parola-contesto PRIMA o DOPO (secolo XXIV, Luigi XIV, XVIII secolo)
    const haContesto = CONTESTO_ROMANO.test(prima || '') || CONTESTO_ROMANO.test(dopo || '');
    if (!haContesto) return intero;
    const parola = inParola ? inParola(n) : String(n);
    return `${prima || ''}${parola}${dopo || ''}`;
  });
}
function numeroARomano(n) {
  const tab = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let out = '';
  for (const [v, sim] of tab) while (n >= v) { out += sim; n -= v; }
  return out;
}

export function preprocessForTTS(text, lang) {
  if (!text) return '';

  let cleaned = text;
  cleaned = stripMarkdown(cleaned);
  cleaned = stripEmoji(cleaned);
  cleaned = espandiRomani(cleaned, lang);
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
      log.warn('Thai text appears to be Latin transliteration');
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

  // b.234 — FEDELTÀ prima della voce: prima il prompt diceva "niente numeri in
  // cifre, niente URL/email/codici" → il modello LI ELIMINAVA o li alterava,
  // perdendo dati critici (un codice "73829", un'email, un dosaggio "2,5 mg").
  // Ora: prosa naturale per la voce, MA identificatori/cifre-significative
  // riportati ESATTI, mai persi.
  return `
TTS OPTIMIZATION (your output will be spoken aloud in ${langName}):
- Prose numbers that are quantities may be written as words ("cinquecento euro").
- BUT keep EXACT and unchanged any identifier: codes, PINs, phone numbers, prices with decimals or currency, dosages, URLs, email addresses, @handles, order/tracking numbers. NEVER drop them, NEVER spell them out, NEVER round them.
- No markdown, no bullet points, no formatting
- Use natural spoken punctuation (commas for pauses, periods for stops)
- Avoid parenthetical asides — restructure as separate sentences
- Keep sentences under 30 words for natural speech rhythm when possible`;
}
