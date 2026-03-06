import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Call an LLM provider with the given messages.
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
 * @returns {{ translated: string, usage: { prompt_tokens: number, completion_tokens: number, total_tokens: number } }}
 */
export async function callLLM({
  provider, model, apiKey, messages, systemPrompt,
  text, context, temperature = 0.3, maxTokens = 500
}) {
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
    const genModel = genAI.getGenerativeModel({ model });
    const userText = context
      ? `${systemPrompt}\n\nPrevious translation for reference:\n${context}\n\nContinue translating:\n${text}`
      : `${systemPrompt}\n\nTranslate:\n${text}`;
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
