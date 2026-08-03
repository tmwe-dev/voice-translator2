// ═══════════════════════════════════════════════
// Provider Factory — Unified interface for all providers
//
// Single entry point to get the right provider for any operation.
// Routes to Asia (Qwen/DashScope) or Global (OpenAI/Anthropic/Gemini)
// based on language pair via providerRouter.
// ═══════════════════════════════════════════════

import { routeProvider } from './providerRouter.js';
import { routeTTS } from './ttsRouter.js';

/**
 * Get LLM caller for a language pair.
 * Returns the appropriate callLLM function (global or asia).
 *
 * @param {string} sourceLang
 * @param {string} targetLang
 * @param {object} [opts] - Routing options
 * @returns {{ call: Function, provider: string, route: object }}
 */
export async function getLLMProvider(sourceLang, targetLang, opts = {}) {
  const route = routeProvider(sourceLang, targetLang, opts);

  if (route.provider === 'asia') {
    const { callQwen } = await import('./llmAsia.js');
    return { call: callQwen, provider: 'qwen', route };
  }

  const { callLLM } = await import('./llmCaller.js');
  return { call: callLLM, provider: 'global', route };
}

/**
 * Get translation function for a language pair.
 * Returns Asia (Qwen-MT) or Global (provider chain).
 *
 * @param {string} sourceLang
 * @param {string} targetLang
 * @param {object} [opts]
 * @returns {{ translate: Function, provider: string, route: object }}
 */
export async function getTranslationProvider(sourceLang, targetLang, opts = {}) {
  const route = routeProvider(sourceLang, targetLang, opts);

  if (route.provider === 'asia') {
    const { translateAsia } = await import('./translateAsia.js');
    return {
      translate: (text, sOpts) => translateAsia(text, sourceLang, targetLang, { ...opts, ...sOpts }),
      provider: 'qwen',
      route,
    };
  }

  // Global: use existing runProviderChain from providers.js
  const { runProviderChain, getProviderChain } = await import('./providers.js');
  return {
    translate: (text, sOpts) => {
      const chain = getProviderChain(targetLang, sOpts?.userOverrides);
      return runProviderChain(text, sourceLang, targetLang, chain, sOpts);
    },
    provider: 'global',
    route,
  };
}

/**
 * Get STT provider for a language.
 *
 * @param {string} langCode - Language to transcribe
 * @param {object} [opts]
 * @returns {{ transcribe: Function, provider: string }}
 */
export async function getSTTProvider(langCode, opts = {}) {
  const route = routeProvider(langCode, 'en', opts); // STT only needs source lang

  if (route.provider === 'asia') {
    const { transcribeParaformer, isParaformerAvailable } = await import('./sttAsia.js');
    if (isParaformerAvailable()) {
      return { transcribe: transcribeParaformer, provider: 'paraformer' };
    }
  }

  // Global: Whisper (via /api/transcribe endpoint — client-side)
  return {
    transcribe: null, // Handled by API route, not direct call
    provider: 'whisper',
  };
}

/**
 * Get TTS provider for a language.
 *
 * @param {string} langCode
 * @param {object} [opts] - { hasElevenLabs, hasOpenAI, tier, gender }
 * @returns {{ engine: string, voice: string, score: number, fallback: string }}
 */
export function getTTSProvider(langCode, opts = {}) {
  return routeTTS(langCode, opts);
}

/**
 * Get a summary of all available providers for the current config.
 * Useful for admin/debug panel.
 */
export async function getProviderSummary() {
  const { isDashScopeAvailable } = await import('./llmAsia.js');
  return {
    asia: {
      available: isDashScopeAvailable(),
      llm: 'Qwen (DashScope)',
      stt: 'Paraformer v2',
      tts: 'CosyVoice v2',
      translate: 'Qwen-MT Turbo',
    },
    global: {
      available: true,
      llm: 'OpenAI / Anthropic / Gemini',
      stt: 'Whisper',
      tts: 'ElevenLabs / OpenAI / Edge',
      translate: 'Microsoft / Google / MyMemory',
    },
  };
}
