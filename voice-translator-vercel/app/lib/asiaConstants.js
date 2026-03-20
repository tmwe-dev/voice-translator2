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

// ── Pricing (USD per 1M tokens) ──
export const QWEN_PRICING = {
  [QWEN_MODELS.flash]: { input: 0.30,  output: 0.60  },
  [QWEN_MODELS.plus]:  { input: 0.80,  output: 2.00  },
  [QWEN_MODELS.max]:   { input: 2.40,  output: 9.60  },
};

// ── Qwen-MT (Machine Translation) ──
export const QWEN_MT_MODEL = 'qwen-mt-turbo';
export const QWEN_MT_PRICING = 0.02; // USD per 1000 characters

// ── Paraformer ASR (Speech-to-Text) ──
export const PARAFORMER_MODEL = 'paraformer-v2';
export const PARAFORMER_PRICING = 0.0036; // USD per minute

// ── CosyVoice TTS ──
export const COSYVOICE_MODEL = 'cosyvoice-v2';
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
export const SOUTH_ASIAN_LANGS = new Set(['hi', 'bn', 'ta']);
export const MIDDLE_EAST_LANGS = new Set(['ar', 'ar-EG', 'he', 'tr']);
export const EUROPEAN_LANGS = new Set([
  'en', 'en-GB', 'es', 'es-MX', 'fr', 'fr-CA', 'de', 'it', 'pt', 'pt-PT',
  'nl', 'pl', 'sv', 'el', 'cs', 'ro', 'hu', 'fi', 'ru', 'uk', 'da', 'nb',
  'bg', 'hr', 'sk', 'ca', 'af',
]);
export const AFRICAN_LANGS = new Set(['sw', 'af']);

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
