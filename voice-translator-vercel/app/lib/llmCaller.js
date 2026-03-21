import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { apiCircuitBreaker } from './circuitBreaker.js';

const DEFAULT_TIMEOUT_MS = 10000; // 10s max per LLM call

/**
 * Timeout helper — rejects after ms
 */
function withTimeout(promise, ms, label = 'LLM') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Call an LLM provider with the given messages.
 * Now with: timeout protection, circuit breaker integration
 *
 * @param {Object} opts
 * @param {string} opts.provider - 'openai' | 'anthropic' | 'gemini'
 * @param {string} opts.model - The actual model ID
 * @param {string} opts.apiKey
 * @param {Array} opts.messages - OpenAI-format messages array
 * @param {string} opts.systemPrompt - For Anthropic/Gemini: the system prompt text
 * @param {string} opts.text - For Gemini: the raw user text
 * @param {string|null} opts.context - For Gemini: context/continuation text
 * @param {number} [opts.temperature=0.3]
 * @param {number} [opts.maxTokens=500]
 * @param {number} [opts.timeoutMs=10000]
 * @returns {{ translated: string, usage: { prompt_tokens: number, completion_tokens: number, total_tokens: number } }}
 */
export async function callLLM({
  provider, model, apiKey, messages, systemPrompt,
  text, context, temperature = 0.3, maxTokens = 500,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  const circuitKey = `llm:${provider}:${model}`;

  return apiCircuitBreaker.execute(circuitKey, () =>
    withTimeout(_callProvider({ provider, model, apiKey, messages, systemPrompt, text, context, temperature, maxTokens }), timeoutMs, `${provider}/${model}`)
  );
}

async function _callProvider({ provider, model, apiKey, messages, systemPrompt, text, context, temperature, maxTokens }) {
  let translated;
  let usage = null;

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey });
    const anthropicMsgs = messages.filter(m => m.role !== 'system');
    const msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: anthropicMsgs,
    });
    translated = msg.content[0]?.text?.trim() || '';
    usage = {
      prompt_tokens: msg.usage?.input_tokens || 0,
      completion_tokens: msg.usage?.output_tokens || 0,
      total_tokens: (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0)
    };
  } else if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use native systemInstruction for better quality (not concatenated to user text)
    const genModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
    });
    const userText = context
      ? `Previous translation for reference:\n${context}\n\nContinue translating:\n${text}`
      : text;
    const result = await genModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    });
    translated = result.response.text()?.trim() || '';
    const gUsage = result.response.usageMetadata;
    usage = {
      prompt_tokens: gUsage?.promptTokenCount || 0,
      completion_tokens: gUsage?.candidatesTokenCount || 0,
      total_tokens: gUsage?.totalTokenCount || 0
    };
  } else {
    // OpenAI (default)
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    });
    translated = completion.choices[0].message.content.trim();
    usage = completion.usage;
  }

  return { translated, usage };
}

/**
 * Call LLM with automatic fallback chain.
 * Tries primary provider, falls back to alternatives on failure.
 *
 * @param {Object} primaryOpts - Primary callLLM options
 * @param {Array<Object>} fallbacks - Array of fallback { provider, model, apiKey } overrides
 * @param {number} [timeoutMs=10000]
 * @returns {{ translated: string, usage: object, provider: string, model: string, wasFallback: boolean }}
 */
export async function callLLMWithFallback(primaryOpts, fallbacks = [], timeoutMs = DEFAULT_TIMEOUT_MS) {
  // Try primary
  try {
    const result = await callLLM({ ...primaryOpts, timeoutMs });
    return { ...result, provider: primaryOpts.provider, model: primaryOpts.model, wasFallback: false };
  } catch (primaryErr) {
    console.warn(`[LLM] Primary ${primaryOpts.provider}/${primaryOpts.model} failed: ${primaryErr.message}`);
  }

  // Try fallbacks in order
  for (let i = 0; i < fallbacks.length; i++) {
    const fb = fallbacks[i];
    try {
      const opts = { ...primaryOpts, ...fb, timeoutMs };
      const result = await callLLM(opts);
      console.log(`[LLM] Fallback ${i + 1} succeeded: ${fb.provider}/${fb.model}`);
      return { ...result, provider: fb.provider, model: fb.model, wasFallback: true };
    } catch (fbErr) {
      console.warn(`[LLM] Fallback ${i + 1} ${fb.provider}/${fb.model} failed: ${fbErr.message}`);
    }
  }

  // All failed
  throw new Error(`All LLM providers failed (primary + ${fallbacks.length} fallbacks)`);
}
