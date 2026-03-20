// ═══════════════════════════════════════════════
// Asia Translation — Qwen-MT + Qwen LLM fallback
// Optimized for CJK language pairs
// ═══════════════════════════════════════════════

import { translateQwenMT, callQwen, isDashScopeAvailable } from './llmAsia.js';
import { QWEN_MODELS } from './asiaConstants.js';

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
    console.warn('[translateAsia] Qwen-MT failed, falling back to LLM:', mtErr.message);
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

/**
 * Check if Asia translation is available
 */
export function isAsiaTranslateAvailable() {
  return isDashScopeAvailable();
}
