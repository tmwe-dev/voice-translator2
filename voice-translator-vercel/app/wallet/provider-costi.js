// ═══════════════════════════════════════════════════════════════
// PROVIDER-COSTI — Quanto ci costano DAVVERO i fornitori AI.
// Fonte: studio costi 3 agosto 2026 (prezzi ufficiali USD).
// Si aggiorna QUI quando i listini cambiano. Unità: USD per 1M caratteri.
//
// Serve per: calcolare l'utile reale (crediti venduti − costi provider)
// e per scegliere il motore attivo dal monitor admin.
// ═══════════════════════════════════════════════════════════════

// ── Traduzione: USD per 1M caratteri ──
export const COSTI_TRADUZIONE = {
  'gemini-flash-lite': { usd_per_1m: 0.13, qualita: 'buona', nota: 'il più economico Google' },
  'gpt-5.6-luna':      { usd_per_1m: 0.18, qualita: 'buona', nota: 'economicissimo OpenAI' },
  'deepseek-v4-flash': { usd_per_1m: 0.11, qualita: 'buona', nota: 'alto volume · 2x ore di punta Pechino' },
  'gpt-5.4-mini':      { usd_per_1m: 0.66, qualita: 'ottima', nota: 'classe 4o-mini' },
  'claude-haiku-4.5':  { usd_per_1m: 1.50, qualita: 'ottima', nota: 'miglior economico per stile' },
  'claude-sonnet-4.6': { usd_per_1m: 4.50, qualita: 'top', nota: 'tono professionale' },
  'azure-translator':  { usd_per_1m: 10.00, qualita: 'buona', nota: 'MT deterministico · 2M/mese gratis' },
};

// ── TTS: USD per 1M caratteri ──
export const COSTI_TTS = {
  'edge-tts':          { usd_per_1m: 0, qualita: 'standard', nota: 'gratis' },
  'azure-neural':      { usd_per_1m: 15, qualita: 'buona', nota: '500K/mese gratis' },
  'openai-tts':        { usd_per_1m: 15, qualita: 'buona', nota: 'steerable' },
  'elevenlabs-flash':  { usd_per_1m: 50, qualita: 'premium', nota: '75ms · riferimento qualità' },
  'elevenlabs-v3':     { usd_per_1m: 100, qualita: 'top', nota: 'massima espressività' },
};

// ── STT: USD per minuto di audio ──
export const COSTI_STT = {
  'deepgram-nova': { usd_per_min: 0.0059, nota: 'streaming' },
  'whisper-api':   { usd_per_min: 0.006, nota: 'batch' },
};

// Caratteri medi per 1 secondo di parlato (per convertire secondi → caratteri)
export const CARATTERI_PER_SECONDO = 17;
export const CAMBIO_EUR_USD = 1.08; // aggiorna ogni tanto

/**
 * Costo provider stimato di UN uso, in centesimi di EURO.
 * @param {number} secondi - secondi di conversazione
 * @param {string} motoreTraduzione - chiave di COSTI_TRADUZIONE
 * @param {string} motoreTTS - chiave di COSTI_TTS
 */
export function costoProviderCent(secondi, motoreTraduzione, motoreTTS) {
  const caratteri = secondi * CARATTERI_PER_SECONDO;
  const trad = (COSTI_TRADUZIONE[motoreTraduzione]?.usd_per_1m || 0) * caratteri / 1e6;
  const tts = (COSTI_TTS[motoreTTS]?.usd_per_1m || 0) * caratteri / 1e6;
  const stt = (COSTI_STT['deepgram-nova'].usd_per_min) * (secondi / 60);
  const usd = trad + tts + stt;
  return Math.round((usd / CAMBIO_EUR_USD) * 100 * 100) / 100; // centesimi €, 2 decimali
}
