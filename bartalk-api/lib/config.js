export const CORE_URL = (process.env.BARTALK_CORE_URL || 'https://voice-translator2.vercel.app').replace(/\/$/, '');
export const API_KEY_TTL_DAYS = Math.max(1, Math.min(365, Number(process.env.BARTALK_API_KEY_TTL_DAYS || 6)));
export const API_TIMEOUT_MS = 70_000;
export const MAX_JSON_BYTES = 512 * 1024;

export function signingSecret() {
  const value = process.env.BARTALK_API_SIGNING_SECRET || '';
  if (value.length < 32) throw new Error('BARTALK_API_SIGNING_SECRET deve avere almeno 32 caratteri');
  return value;
}
