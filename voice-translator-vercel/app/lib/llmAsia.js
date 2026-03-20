// ═══════════════════════════════════════════════
// Asia LLM Caller — Alibaba DashScope / Qwen
// OpenAI-compatible API for CJK language translation
// ═══════════════════════════════════════════════

import OpenAI from 'openai';
import { DASHSCOPE_BASE_URL, DASHSCOPE_API_KEY, QWEN_MODELS, MODEL_REMAP } from './asiaConstants.js';

let _client = null;

function getClient(apiKey) {
  const key = apiKey || DASHSCOPE_API_KEY;
  if (!key) throw new Error('DASHSCOPE_API_KEY not configured');
  if (!_client || _client._apiKey !== key) {
    _client = new OpenAI({ apiKey: key, baseURL: DASHSCOPE_BASE_URL });
    _client._apiKey = key;
  }
  return _client;
}

/**
 * Call Qwen LLM via DashScope (OpenAI-compatible interface)
 * @param {object} opts - Same interface as callLLM in llmCaller.js
 * @returns {{ translated: string, usage: object }}
 */
export async function callQwen(opts) {
  const {
    model: requestedModel,
    apiKey,
    messages = [],
    systemPrompt = '',
    temperature = 0.3,
    maxTokens = 500,
  } = opts;

  // Remap global model ID to Qwen equivalent
  const model = MODEL_REMAP[requestedModel] || QWEN_MODELS.flash;
  const client = getClient(apiKey);

  const msgArray = [];
  if (systemPrompt) {
    msgArray.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages) {
    if (m.role !== 'system') {
      msgArray.push({ role: m.role, content: m.content });
    }
  }

  const response = await client.chat.completions.create({
    model,
    messages: msgArray,
    temperature,
    max_tokens: maxTokens,
  });

  const text = response.choices?.[0]?.message?.content?.trim() || '';
  const usage = response.usage || {};

  return {
    translated: text,
    usage: {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
    },
  };
}

/**
 * Qwen Machine Translation (Qwen-MT Turbo)
 * Dedicated translation model, faster and cheaper than LLM
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {string} [apiKey] - Optional API key override
 * @returns {{ translated: string, cost: number }}
 */
export async function translateQwenMT(text, sourceLang, targetLang, apiKey) {
  const client = getClient(apiKey);

  const response = await client.chat.completions.create({
    model: 'qwen-mt-turbo',
    messages: [
      {
        role: 'system',
        content: `Translate from ${sourceLang} to ${targetLang}. Output ONLY the translation, nothing else.`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
    max_tokens: 1000,
  });

  const translated = response.choices?.[0]?.message?.content?.trim() || '';
  const charCount = text.length;
  const cost = (charCount / 1000) * 0.02; // $0.02 per 1000 chars

  return { translated, cost };
}

/**
 * Check if DashScope is available (API key configured)
 */
export function isDashScopeAvailable() {
  return !!(DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY);
}
