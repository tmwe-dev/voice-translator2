import { PAIR_NOTES } from './translateValidation.js';
import { buildTTSKnowledgeBase } from './ttsPreprocessor.js';

// Language-specific tonal/script instructions
const TONAL_LANGS = {
  'th': 'Thai (tonal, no spaces between words, use Thai script ภาษาไทย)',
  'zh': 'Chinese (Simplified, use 简体中文)',
  'ja': 'Japanese (use appropriate kanji/hiragana/katakana)',
  'vi': 'Vietnamese (tonal, ALL diacritics critical — never omit dấu)',
  'ko': 'Korean (use Hangul 한국어)'
};

const LANG_NAMES = {
  th: 'Thai', en: 'English', it: 'Italian', es: 'Spanish', fr: 'French', de: 'German',
  pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', hi: 'Hindi',
  ru: 'Russian', tr: 'Turkish', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay', nl: 'Dutch',
  pl: 'Polish', sv: 'Swedish', el: 'Greek', cs: 'Czech', ro: 'Romanian', hu: 'Hungarian', fi: 'Finnish'
};

/**
 * Build the system prompt for translation.
 * @param {Object} opts - { sourceLang, targetLang, sourceLangName, targetLangName, roomMode, nativeLang, domainContext, description, isReview, context }
 * @returns {string} systemPrompt
 */
export function buildSystemPrompt({
  sourceLang, targetLang, sourceLangName, targetLangName,
  roomMode, nativeLang, domainContext, description, isReview
}) {
  const srcTonal = TONAL_LANGS[sourceLang];
  const tgtTonal = TONAL_LANGS[targetLang];
  let toneNote = '';
  if (tgtTonal) toneNote = ` The target language is ${tgtTonal}. Preserve all diacritics, tone marks, and native script exactly. Use natural ${targetLangName} phrasing — NOT transliteration.`;
  else if (srcTonal) toneNote = ` The source language is ${srcTonal}. Interpret tone marks and diacritics accurately.`;

  let systemPrompt;

  if (roomMode === 'classroom') {
    const studentNativeName = LANG_NAMES[nativeLang] || targetLangName;
    const teachingLangName = sourceLangName;
    systemPrompt = `You are a language teaching assistant. The teacher is speaking in ${teachingLangName} (the language being taught). The student's native language is ${studentNativeName}.${toneNote}

YOUR TASK:
1. First, provide the translation of what the teacher said in ${studentNativeName} (the student's native language)
2. Then, add a brief educational note in ${studentNativeName} explaining key vocabulary, grammar patterns, or pronunciation tips from the teacher's ${teachingLangName} speech

FORMAT your output exactly like this:
[Translation in ${studentNativeName}]

📝 [Brief educational note in ${studentNativeName} — vocabulary, grammar, or pronunciation tip]

RULES:
- The translation MUST be in ${studentNativeName} — the student's native language
- The educational note MUST also be in ${studentNativeName}
- Keep educational notes concise (1-2 sentences max)
- Focus on the most useful learning points from the teacher's speech
- If the teacher's speech is very simple, you may omit the educational note
- Use natural, friendly teaching tone
- NEVER respond in ${teachingLangName} only — always include ${studentNativeName}`;
  } else {
    systemPrompt = `You are a real-time voice interpreter translating live speech from ${sourceLangName} to ${targetLangName}.${toneNote}

RULES:
- Output ONLY the translated text — nothing else
- NO notes, NO explanations, NO labels, NO commentary, NO transliterations
- This is SPOKEN language: keep the same register, tone, and emotion
- Preserve casual/informal style — do NOT formalize slang or colloquialisms
- Keep exclamations, questions, hesitations natural in the target language
- Translate idioms to equivalent idioms, NOT literally
- If speech is fragmented or unclear, reconstruct the most likely meaning naturally
- NEVER output the original language — always translate to ${targetLangName}`;
  }

  if (domainContext) systemPrompt += `\n\nDomain: ${domainContext}`;
  if (description) systemPrompt += `\nTopic: ${description}`;
  if (isReview) systemPrompt += `\nRefine the translation for coherence and accuracy as a complete passage.`;

  const pairKey = `${sourceLang}->${targetLang}`;
  if (PAIR_NOTES[pairKey]) systemPrompt += `\n\nLanguage pair note: ${PAIR_NOTES[pairKey]}`;

  systemPrompt += buildTTSKnowledgeBase(targetLang);

  return systemPrompt;
}

/**
 * Build the messages array for the LLM call.
 */
export function buildMessages(systemPrompt, text, context) {
  const messages = [{ role: 'system', content: systemPrompt }];
  if (context) {
    messages.push({ role: 'assistant', content: context });
    messages.push({ role: 'user', content: `[This is a continuation fragment from ongoing speech] ${text}` });
  } else {
    messages.push({ role: 'user', content: text });
  }
  return messages;
}
