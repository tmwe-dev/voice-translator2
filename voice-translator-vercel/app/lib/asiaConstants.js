// ═══════════════════════════════════════════════
// Asia Provider Constants — Alibaba DashScope (Qwen)
// Pricing, models, endpoints for CJK/SEA language optimization
// ═══════════════════════════════════════════════

// DashScope international endpoint (OpenAI-compatible)
export const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

// API key from environment
export const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';

// ── Model IDs ──
export const QWEN_MODELS = {
  flash:  'qwen-turbo-latest',      // Fast, cheap — maps to gpt-4o-mini
  plus:   'qwen-plus-latest',       // Balanced — maps to gpt-4o
  max:    'qwen-max-latest',        // Best quality — maps to claude-sonnet
};

// ── Model remapping: global → asia ──
export const MODEL_REMAP = {
  'gpt-4o-mini':    QWEN_MODELS.flash,
  'gpt-4o':         QWEN_MODELS.plus,
  'claude-sonnet':  QWEN_MODELS.max,
  'claude-haiku':   QWEN_MODELS.flash,
  'gemini-flash':   QWEN_MODELS.flash,
  'gemini-pro':     QWEN_MODELS.plus,
};

// b.363 — SETTE LISTINI E NOMI DI MODELLO CHE NON LEGGEVA NESSUNO:
// i prezzi Qwen, il modello e il prezzo della traduzione automatica, il
// modello e il prezzo del riconoscimento vocale e il nome del modello di
// sintesi vocale erano dichiarati qui ma non comparivano in nessun'altra
// riga del programma. Il conto di quanto costa una traduzione lo fa
// altrove chi chiama davvero i fornitori: questi numeri erano un secondo
// listino, mai aggiornato e mai usato, che chiunque poteva scambiare per
// quello vero. Tolti.

// ── CosyVoice TTS ──
export const COSYVOICE_VOICES = {
  'zh':  { female: 'longxiaochun', male: 'longcheng' },
  'ja':  { female: 'longxiaochun', male: 'longcheng' },
  'ko':  { female: 'longxiaochun', male: 'longcheng' },
  'th':  { female: 'longxiaochun', male: 'longcheng' },
  'vi':  { female: 'longxiaochun', male: 'longcheng' },
};

// ── CJK Language Set ──
export const CJK_LANGS = new Set(['zh', 'zh-TW', 'ja', 'ko']);
export const SEA_LANGS = new Set(['th', 'vi', 'id', 'ms', 'fil']);
// b.363 — questi tre insiemi li usa solo getLangFamily, qui sotto: erano
// offerti a tutto il progetto senza che nessuno li chiedesse. Non sono
// piu esportati, cosi si vede che vivono e muoiono dentro questo file.
const SOUTH_ASIAN_LANGS = new Set(['hi', 'bn', 'ta']);
const MIDDLE_EAST_LANGS = new Set(['ar', 'ar-EG', 'he', 'tr']);
const AFRICAN_LANGS = new Set(['sw', 'af']);
// b.363 — l'elenco delle lingue europee e stato tolto: getLangFamily non
// lo consultava mai, perche 'EUROPEAN' e gia la risposta di ripiego
// quando nessun'altra famiglia corrisponde. Chi lo leggeva credeva che
// aggiungere una lingua li dentro cambiasse qualcosa: non cambiava nulla.

/**
 * Get the base 2-letter language code
 */
export function baseLang(code) {
  return code?.replace(/-.*/, '') || 'en';
}

/**
 * Detect language family
 */
export function getLangFamily(code) {
  if (CJK_LANGS.has(code) || CJK_LANGS.has(baseLang(code))) return 'CJK';
  if (SEA_LANGS.has(code) || SEA_LANGS.has(baseLang(code))) return 'SEA';
  if (SOUTH_ASIAN_LANGS.has(code) || SOUTH_ASIAN_LANGS.has(baseLang(code))) return 'SOUTH_ASIAN';
  if (MIDDLE_EAST_LANGS.has(code) || MIDDLE_EAST_LANGS.has(baseLang(code))) return 'MIDDLE_EAST';
  if (AFRICAN_LANGS.has(code) || AFRICAN_LANGS.has(baseLang(code))) return 'AFRICAN';
  return 'EUROPEAN';
}
