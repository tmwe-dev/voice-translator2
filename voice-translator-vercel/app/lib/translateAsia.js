// ═══════════════════════════════════════════════
// Asia Translation — Qwen-MT + Qwen LLM fallback
// Optimized for CJK language pairs
//
// b.234 — RIPRISTINATO. Questo file era stato spostato in attic/ dal commit
// b.59 ("lib orfane") credendolo morto, MA /api/translate lo importa in modo
// DINAMICO (`await import('./translateAsia.js')`), che l'analisi statica non
// vede. Risultato: da b.59 ogni traduzione instradata in Asia (CJK) falliva
// l'import e ricadeva IN SILENZIO sul Global — il Qwen-MT non veniva mai usato.
// Contenuto identico all'originale (parent di 3c2a6ca).
// ═══════════════════════════════════════════════

import { translateQwenMT, callQwen, isDashScopeAvailable } from './llmAsia.js';
import { QWEN_MODELS } from './asiaConstants.js';
import { createLogger } from './logger.js';
const log = createLogger('translateAsia');

/**
 * Translate text using Asia providers.
 * Primary: Qwen-MT Turbo (fast, dedicated translation model)
 * Fallback: Qwen LLM (for unsupported pairs or MT failures)
 *
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {object} [opts]
 * @param {string} [opts.context] - Domain context (medical, business, etc.)
 * @param {string} [opts.apiKey] - Override API key
 * @returns {{ translated: string, provider: string, cost: number }}
 */
export async function translateAsia(text, sourceLang, targetLang, opts = {}) {
  if (!isDashScopeAvailable() && !opts.apiKey) {
    throw new Error('Asia translation unavailable: no DashScope API key');
  }

  // b.235 — CONTRATTO UNICO: se il percorso principale passa il systemPrompt
  // completo (glossario, dominio, contesto conversazione, modalità), si usa il
  // Qwen LLM con QUEL prompt. qwen-mt-turbo è un modello di traduzione secca:
  // ignorerebbe glossario e contesto. Così Asia diventa semanticamente
  // equivalente al Global, pur usando un modello diverso.
  if (opts.systemPrompt) {
    const r = await callQwen({
      model: QWEN_MODELS.flash,
      messages: [{ role: 'user', content: text }],
      systemPrompt: opts.systemPrompt,
      temperature: 0.2,
      maxTokens: 1000,
      apiKey: opts.apiKey,
    });
    const cost = ((r.usage.prompt_tokens * 0.30) + (r.usage.completion_tokens * 0.60)) / 1_000_000;
    return { translated: r.translated, provider: 'qwen-llm', cost };
  }

  // Nessun contratto fornito: Qwen-MT (veloce, coppie semplici) con fallback LLM.
  // Try Qwen-MT first (cheaper, faster for supported pairs)
  try {
    const result = await translateQwenMT(text, sourceLang, targetLang, opts.apiKey);
    if (result.translated && result.translated.trim().length > 0) {
      return {
        translated: result.translated,
        provider: 'qwen-mt',
        cost: result.cost,
      };
    }
  } catch (mtErr) {
    log.warn('Qwen-MT failed, falling back to LLM:', mtErr.message);
  }

  // Fallback: Qwen LLM with translation prompt
  const contextPrompt = opts.context
    ? `This is a ${opts.context} conversation. Use appropriate domain terminology.`
    : '';

  const systemPrompt = [
    `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}.`,
    'Output ONLY the translation, no explanations, no quotes, no extra text.',
    contextPrompt,
  ].filter(Boolean).join(' ');

  const result = await callQwen({
    model: QWEN_MODELS.flash,
    messages: [{ role: 'user', content: text }],
    systemPrompt,
    temperature: 0.2,
    maxTokens: 1000,
    apiKey: opts.apiKey,
  });

  // Estimate cost from token usage
  const tokenCost = ((result.usage.prompt_tokens * 0.30) + (result.usage.completion_tokens * 0.60)) / 1_000_000;

  return {
    translated: result.translated,
    provider: 'qwen-llm',
    cost: tokenCost,
  };
}

// b.363 — qui c'era isAsiaTranslateAvailable, che si limitava a girare la
// domanda a isDashScopeAvailable. Un passacarte che nessuno interrogava:
// chi vuole sapere se il fornitore asiatico e acceso lo chiede gia
// direttamente.
