// Shared configuration and pricing constants
// Single source of truth for all API routes

// =============================================
// OpenAI Pricing (USD)
// =============================================
export const PRICING = {
  GPT4OMINI_INPUT_PER_TOKEN: 0.00000015,
  GPT4OMINI_OUTPUT_PER_TOKEN: 0.0000006,
  WHISPER_PER_MINUTE: 0.006,
  TTS_PER_CHAR: 0.000015,
  ELEVENLABS_PER_CHAR: 0.0003, // ~$0.30 per 1K chars (Creator plan)
  USD_TO_EUR_CENTS: 92,        // ~$1 = 92 euro cents
};

// =============================================
// Minimum credit requirements (euro-cents)
// =============================================
export const MIN_CREDITS = {
  TRANSLATE: 0.1,    // text translation
  PROCESS: 0.5,      // whisper + GPT pipeline
  TTS_OPENAI: 0.3,   // OpenAI TTS
  TTS_ELEVENLABS: 6,  // ElevenLabs TTS (premium, ~4x cost → priced for 75% margin)
  SUMMARY: 0.5,      // conversation summary
};

// =============================================
// Minimum charge per operation (euro-cents)
// Margin target: ~75% on all operations
// =============================================
export const MIN_CHARGE = {
  TRANSLATE: 0.1,
  PROCESS: 0.2,
  TTS_OPENAI: 0.3,
  TTS_ELEVENLABS: 5,  // ElevenLabs: real cost ~1.4¢/msg → charge 5¢ for 75% margin
  SUMMARY: 0.5,
};

// =============================================
// Error messages (standardized, English)
// =============================================
export const ERRORS = {
  NO_CREDITS: 'Insufficient credits. Please top up to continue.',
  HOST_NO_CREDITS: 'Host credits exhausted.',
  AUTH_REQUIRED: 'Authentication required.',
  UNAUTHORIZED: 'Unauthorized.',
  INVALID_SESSION: 'Invalid session.',
};

// =============================================
// Cost calculation helpers
// =============================================

export function calcGptCost(usage) {
  const u = usage || {};
  return (u.prompt_tokens || 0) * PRICING.GPT4OMINI_INPUT_PER_TOKEN
       + (u.completion_tokens || 0) * PRICING.GPT4OMINI_OUTPUT_PER_TOKEN;
}

export function calcTtsCost(charCount) {
  return charCount * PRICING.TTS_PER_CHAR;
}

export function calcWhisperCost(bufferSize) {
  const estimatedSeconds = Math.max(1, bufferSize / 16000);
  return (estimatedSeconds / 60) * PRICING.WHISPER_PER_MINUTE;
}

export function calcElevenLabsCost(charCount) {
  return charCount * PRICING.ELEVENLABS_PER_CHAR;
}

export function usdToEurCents(usd) {
  return usd * PRICING.USD_TO_EUR_CENTS;
}

export function roundCost(usd) {
  return Math.round(usd * 1000000) / 1000000;
}

export function roundEurCents(cents) {
  return Math.round(cents * 100) / 100;
}
