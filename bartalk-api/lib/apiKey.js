import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { API_KEY_TTL_DAYS, signingSecret } from './config.js';

const PREFIX = 'bt_live_';
const ALGO = 'aes-256-gcm';
const VERSION = 1;

export const SCOPES = Object.freeze([
  'profile:read', 'profile:write',
  'wallet:read', 'wallet:write',
  'keys:read', 'keys:write',
  'translate', 'speech:stt', 'speech:tts', 'voice:clone',
  'companions:read', 'companions:write', 'companions:chat', 'companions:live', 'companions:podcast',
  'learning', 'topics:read',
  'rooms:read', 'rooms:write', 'messages:read', 'messages:write',
  'contacts:read', 'contacts:write', 'community:read', 'community:write',
  'peepoff', 'taxi', 'glossary:read', 'glossary:write', 'summary', 'moderation',
]);

// Least privilege: senza una lista esplicita non si emette piu una chiave con
// tutte le capacita di scrittura/finanziarie. Gli scope sensibili vanno chiesti.
export const DEFAULT_SCOPES = Object.freeze([
  'profile:read', 'wallet:read',
  'translate', 'speech:stt', 'speech:tts',
  'companions:read', 'companions:chat', 'companions:live', 'companions:podcast',
  'learning', 'topics:read',
  'rooms:read', 'messages:read',
  'contacts:read', 'community:read',
  'peepoff', 'taxi', 'glossary:read', 'summary',
]);

function key() {
  return createHash('sha256').update(signingSecret()).digest();
}

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }
function from64(s) { return Buffer.from(s, 'base64url'); }

export function normalizeScopes(input) {
  const requested = Array.isArray(input) && input.length ? input : DEFAULT_SCOPES;
  const unique = [...new Set(requested.map(String))];
  const invalid = unique.filter((s) => !SCOPES.includes(s));
  if (invalid.length) throw new Error(`Scope non validi: ${invalid.join(', ')}`);
  return unique;
}

export function issueApiKey({ sessionToken, subject, scopes, ttlDays = API_KEY_TTL_DAYS, now = Date.now() }) {
  if (!sessionToken || typeof sessionToken !== 'string') throw new Error('sessionToken mancante');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const payload = {
    v: VERSION,
    sub: subject || null,
    session: sessionToken,
    scopes: normalizeScopes(scopes),
    iat: now,
    exp: now + Math.max(1, Math.min(365, Number(ttlDays) || API_KEY_TTL_DAYS)) * 86400000,
  };
  const plaintext = Buffer.from(JSON.stringify(payload));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${b64url(Buffer.concat([iv, tag, encrypted]))}`;
}

export function readApiKey(token, { now = Date.now() } = {}) {
  if (typeof token !== 'string' || !token.startsWith(PREFIX)) throw new Error('API key non valida');
  const raw = from64(token.slice(PREFIX.length));
  if (raw.length < 29) throw new Error('API key non valida');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  try {
    const decipher = createDecipheriv(ALGO, key(), iv);
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
    if (payload?.v !== VERSION || !payload?.session || !Array.isArray(payload?.scopes)) throw new Error('payload');
    if (!Number.isFinite(payload.exp) || payload.exp <= now) throw new Error('API key scaduta');
    return payload;
  } catch (e) {
    if (e?.message === 'API key scaduta') throw e;
    throw new Error('API key non valida o alterata');
  }
}

export function bearer(req) {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

export function requireApiKey(req, scope) {
  const token = bearer(req);
  const payload = readApiKey(token);
  if (scope && !payload.scopes.includes(scope)) {
    const e = new Error(`Scope richiesto: ${scope}`);
    e.status = 403;
    throw e;
  }
  return { token, payload };
}
