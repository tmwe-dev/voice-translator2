// ═══════════════════════════════════════════════
// Asia STT — Paraformer v2 via DashScope
// Optimized for CJK/SEA speech recognition
// Falls back to Whisper if Paraformer unavailable
// ═══════════════════════════════════════════════

import { DASHSCOPE_BASE_URL, DASHSCOPE_API_KEY } from './asiaConstants.js';

/**
 * Transcribe audio using Paraformer v2 (synchronous mode for audio <60s)
 * @param {Buffer|ArrayBuffer} audioBuffer - Audio data (webm, mp3, wav)
 * @param {string} langCode - Language code (zh, ja, ko, th, vi)
 * @param {object} [opts] - Options
 * @param {string} [opts.apiKey] - Override API key
 * @returns {{ text: string, duration: number, cost: number }}
 */
export async function transcribeParaformer(audioBuffer, langCode, opts = {}) {
  const apiKey = opts.apiKey || DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY not configured for Paraformer STT');
  }

  // Paraformer uses OpenAI-compatible audio transcription endpoint
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/webm' });
  formData.append('file', blob, 'audio.webm');
  formData.append('model', 'paraformer-v2');
  if (langCode) formData.append('language', langCode.replace(/-.*/, ''));

  const response = await fetch(`${DASHSCOPE_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error');
    throw new Error(`Paraformer STT failed (${response.status}): ${err}`);
  }

  const result = await response.json();
  const text = result.text?.trim() || '';

  // Estimate duration from buffer size (~16kbit/s for webm)
  const estimatedSeconds = (audioBuffer.byteLength || audioBuffer.length) / 2000;
  const cost = estimatedSeconds * (0.0036 / 60); // $0.0036/min

  return { text, duration: estimatedSeconds, cost };
}

/**
 * Check if Paraformer is available
 */
export function isParaformerAvailable() {
  return !!(DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY);
}
