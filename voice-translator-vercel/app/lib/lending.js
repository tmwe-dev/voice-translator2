// ═══════════════════════════════════════════════
// API Key Lending — Temporary TOP PRO Access
// ═══════════════════════════════════════════════

import { redis } from './redis.js';

const LENDING_MIN_DURATION = 3600000;       // 1 hour
const LENDING_MAX_DURATION = 30 * 86400000; // 30 days

function generateLendingCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = 'VT-LEND-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a lending token — allows borrower to use lender's TOP PRO tier temporarily
 */
export async function createLendingToken(lenderEmail, opts = {}, user) {
  if (!user) throw new Error('User not found');
  if (!user.useOwnKeys || !user.apiKeys?.elevenlabs) {
    throw new Error('Only TOP PRO users (with ElevenLabs key) can create lending tokens');
  }

  const { type = 'time', duration = 86400000, tokenBudget = null } = opts;
  if (!['time', 'tokens', 'combined'].includes(type)) {
    throw new Error('Invalid lending type. Use: time, tokens, or combined');
  }

  const effectiveDuration = (type === 'tokens') ? LENDING_MAX_DURATION : duration;
  if (effectiveDuration < LENDING_MIN_DURATION) throw new Error('Minimum duration is 1 hour');
  if (effectiveDuration > LENDING_MAX_DURATION) throw new Error('Maximum duration is 30 days');

  if ((type === 'tokens' || type === 'combined') && (!tokenBudget || tokenBudget <= 0)) {
    throw new Error('Token budget must be positive for token-based lending');
  }

  const code = generateLendingCode();
  const now = Date.now();
  const expiresAt = now + effectiveDuration;
  const ttlSeconds = Math.ceil(effectiveDuration / 1000) + 86400;

  const lending = {
    lenderEmail: lenderEmail.toLowerCase(),
    lenderName: user.name || '',
    type, duration: effectiveDuration,
    tokenBudget: tokenBudget || null, tokensUsed: 0,
    expiresAt, status: 'active',
    sessionsCreated: 0, lastUsed: null, revokedAt: null, created: now
  };

  await redis('SET', `lending:${code}`, JSON.stringify(lending), 'EX', ttlSeconds);
  await redis('SADD', `lender:active:${lenderEmail.toLowerCase()}`, code);

  return { lendingCode: code };
}

/**
 * Validate a lending code — returns details if valid, null if not
 */
export async function validateLending(lendingCode) {
  const lendingKey = `lending:${lendingCode}`;
  const data = await redis('GET', lendingKey);
  if (!data) return null;

  const lending = JSON.parse(data);
  if (lending.status === 'revoked' || lending.status === 'exhausted') return null;

  if (Date.now() > lending.expiresAt) {
    lending.status = 'expired';
    await redis('SET', lendingKey, JSON.stringify(lending), 'EX', 86400);
    await redis('SREM', `lender:active:${lending.lenderEmail}`, lendingCode);
    return null;
  }

  const tokensRemaining = lending.tokenBudget ? Math.max(0, lending.tokenBudget - lending.tokensUsed) : null;
  if (tokensRemaining !== null && tokensRemaining <= 0) {
    lending.status = 'exhausted';
    await redis('SET', lendingKey, JSON.stringify(lending), 'EX', 86400);
    await redis('SREM', `lender:active:${lending.lenderEmail}`, lendingCode);
    return null;
  }

  return {
    lenderEmail: lending.lenderEmail, lenderName: lending.lenderName,
    type: lending.type, tokensRemaining, expiresAt: lending.expiresAt,
    status: lending.status, tokensUsed: lending.tokensUsed
  };
}

/**
 * Track token usage during a lending session
 */
export async function deductLendingTokens(lendingCode, tokensUsed) {
  const lendingKey = `lending:${lendingCode}`;
  const data = await redis('GET', lendingKey);
  if (!data) return null;

  const lending = JSON.parse(data);
  lending.tokensUsed = (lending.tokensUsed || 0) + tokensUsed;
  lending.sessionsCreated = (lending.sessionsCreated || 0) + 1;
  lending.lastUsed = Date.now();

  if (lending.tokenBudget && lending.tokensUsed >= lending.tokenBudget) {
    lending.status = 'exhausted';
    await redis('SREM', `lender:active:${lending.lenderEmail}`, lendingCode);
  }

  const ttl = await redis('TTL', lendingKey);
  await redis('SET', lendingKey, JSON.stringify(lending), 'EX', Math.max(ttl, 86400));
  return { tokensRemaining: lending.tokenBudget ? Math.max(0, lending.tokenBudget - lending.tokensUsed) : null };
}

/**
 * Revoke a lending token
 */
export async function revokeLending(lendingCode, lenderEmail) {
  const lendingKey = `lending:${lendingCode}`;
  const data = await redis('GET', lendingKey);
  if (!data) throw new Error('Lending token not found');

  const lending = JSON.parse(data);
  if (lending.lenderEmail !== lenderEmail.toLowerCase()) {
    throw new Error('Not authorized to revoke this token');
  }

  lending.status = 'revoked'; lending.revokedAt = Date.now();
  await redis('SET', lendingKey, JSON.stringify(lending), 'EX', 86400);
  await redis('SREM', `lender:active:${lending.lenderEmail}`, lendingCode);
  return { ok: true };
}

/**
 * Get all lending tokens for a lender
 */
export async function getLendingTokens(lenderEmail) {
  const lowerEmail = lenderEmail.toLowerCase();
  const codes = await redis('SMEMBERS', `lender:active:${lowerEmail}`);
  if (!codes || !Array.isArray(codes)) return [];

  const tokens = [];
  for (const code of codes) {
    const data = await redis('GET', `lending:${code}`);
    if (!data) { await redis('SREM', `lender:active:${lowerEmail}`, code); continue; }
    tokens.push({ code, ...JSON.parse(data) });
  }
  return tokens;
}
