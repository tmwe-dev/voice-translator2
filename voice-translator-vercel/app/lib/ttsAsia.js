// ═══════════════════════════════════════════════
// Asia TTS — CosyVoice v2 via DashScope
// Primary for CJK languages, Edge TTS fallback
// ═══════════════════════════════════════════════

import { DASHSCOPE_BASE_URL, DASHSCOPE_API_KEY, COSYVOICE_VOICES } from './asiaConstants.js';
// b.363 — l'importazione di getEdgeVoice e stata tolta insieme a
// getAsiaTTSInfo, l'unica che la usava.

/**
 * Synthesize speech using CosyVoice v2
 * @param {string} text - Text to speak
 * @param {string} langCode - Language code
 * @param {object} [opts]
 * @param {string} [opts.gender] - 'female' or 'male'
 * @param {string} [opts.apiKey] - Override API key
 * @returns {{ audio: ArrayBuffer, format: string, cost: number }}
 */
export async function ttsCosyVoice(text, langCode, opts = {}) {
  const apiKey = opts.apiKey || DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY not configured for CosyVoice');

  const lang2 = langCode.replace(/-.*/, '');
  const gender = opts.gender || 'female';
  const voiceMap = COSYVOICE_VOICES[lang2];
  const voice = voiceMap?.[gender] || voiceMap?.female || 'longxiaochun';

  const response = await fetch(`${DASHSCOPE_BASE_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'cosyvoice-v2',
      input: text,
      voice,
      response_format: 'mp3',
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown');
    throw new Error(`CosyVoice TTS failed (${response.status}): ${err}`);
  }

  const audio = await response.arrayBuffer();
  const cost = (text.length / 1000) * 0.01; // ~$0.01 per 1000 chars estimate

  return { audio, format: 'mp3', cost };
}

/**
 * Check if CosyVoice is available for a language
 */
export function isCosyVoiceAvailable(langCode) {
  if (!DASHSCOPE_API_KEY && !process.env.DASHSCOPE_API_KEY) return false;
  const lang2 = langCode?.replace(/-.*/, '');
  return !!COSYVOICE_VOICES[lang2];
}

// b.363 — qui c'era getAsiaTTSInfo, che diceva quale voce e quale
// fornitore sarebbero stati scelti per una lingua asiatica. Nessuno lo
// chiedeva: la scelta vera la fa e la usa ttsRouter.js. Era una seconda
// versione della stessa decisione, libera di divergere senza che nessuno
// se ne accorgesse.
