// ═══════════════════════════════════════════════
// User Accounts — Core CRUD + Re-exports
//
// Architecture: users.js is the orchestration layer.
// Domain logic is split into focused modules:
//   encryption.js — AES-256-GCM for API keys
//   credits.js    — Purchase, deduct, query credits
//   referrals.js  — Referral codes + bonus system
//   gifting.js    — Escrow-based credit gifting
//   lending.js    — Temporary TOP PRO access tokens
// ═══════════════════════════════════════════════

import { redis } from './redis.js';
import crypto from 'crypto';
import { encryptKeys, decryptKeys } from './encryption.js';

// Re-export all sub-modules for backward compatibility
export { encryptKeys, decryptKeys } from './encryption.js';
export { addCredits, deductCredits, getCredits } from './credits.js';
export { generateReferralCode, getReferralCode, applyReferral, getReferralStats } from './referrals.js';
export { createGiftInvite, acceptGiftInvite, getGiftInfo, refundExpiredGifts } from './gifting.js';
export { createLendingToken, validateLending, deductLendingTokens, revokeLending, getLendingTokens } from './lending.js';

// Credit packages (shared constant, also in constants.js for client)
export const CREDIT_PACKAGES = [
  { id: 'pack_starter', euros: 0.90, credits: 90, label: '€0.90', messages: '90 crediti', starter: true },
  { id: 'pack_2', euros: 2, credits: 200, label: '€2', messages: '200 crediti' },
  { id: 'pack_5', euros: 5, credits: 550, label: '€5', messages: '550 crediti', bonus: '+10%' },
  { id: 'pack_10', euros: 10, credits: 1200, label: '€10', messages: '1200 crediti', bonus: '+20%' },
  { id: 'pack_20', euros: 20, credits: 2600, label: '€20', messages: '2600 crediti', bonus: '+30%' },
];

// =============================================
// USER CRUD
// =============================================

export async function createUser(email, name, lang, avatar) {
  const key = `user:${email.toLowerCase()}`;
  const existing = await redis('GET', key);
  if (existing) return JSON.parse(existing);

  const user = {
    email: email.toLowerCase(),
    name: name || '',
    lang: lang || 'it',
    avatar: avatar || '/avatars/1.png',
    credits: 0,
    totalSpent: 0,
    totalMessages: 0,
    apiKeys: {},
    useOwnKeys: false,
    created: Date.now(),
    lastLogin: Date.now()
  };
  await redis('SET', key, JSON.stringify(user));
  return user;
}

export async function getUser(email) {
  if (!email) return null;
  const data = await redis('GET', `user:${email.toLowerCase()}`);
  if (!data) return null;
  const user = JSON.parse(data);

  // Decrypt API keys if encrypted
  if (user.apiKeys && user.apiKeys.encrypted) {
    try {
      user.apiKeys = decryptKeys(user.apiKeys);
    } catch (error) {
      console.error('Failed to decrypt keys for', email, ':', error);
      user.apiKeys = {};
    }
  }
  return user;
}

export async function updateUser(email, updates) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = { ...JSON.parse(data), ...updates };
  await redis('SET', key, JSON.stringify(user));
  return user;
}

// =============================================
// API KEYS
// =============================================

export async function saveApiKeys(email, keys, useOwnKeys) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = JSON.parse(data);
  user.apiKeys = (keys && Object.keys(keys).length > 0) ? encryptKeys(keys) : {};
  user.useOwnKeys = useOwnKeys;
  await redis('SET', key, JSON.stringify(user));
  return user;
}

export async function getUserApiKey(email, provider = 'openai') {
  const user = await getUser(email);
  if (!user || !user.useOwnKeys || !user.apiKeys) return null;
  return user.apiKeys[provider] || null;
}

// =============================================
// AUTH — Magic Code
// =============================================

export async function createAuthCode(email) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await redis('SET', `authcode:${email.toLowerCase()}`, JSON.stringify({ code, created: Date.now() }), 'EX', 600);
  return code;
}

export async function verifyAuthCode(email, code) {
  const key = `authcode:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return false;
  const stored = JSON.parse(data);
  if (stored.code !== code) return false;
  await redis('DEL', key);
  return true;
}

// =============================================
// SESSIONS
// =============================================

export async function createSession(email) {
  const token = crypto.randomUUID() + '-' + Date.now().toString(36);
  await redis('SET', `session:${token}`, JSON.stringify({ email: email.toLowerCase(), created: Date.now() }), 'EX', 604800);
  await updateUser(email, { lastLogin: Date.now() });
  return token;
}

export async function getSession(token) {
  if (!token) return null;
  const data = await redis('GET', `session:${token}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function deleteSession(token) {
  if (!token) return;
  await redis('DEL', `session:${token}`);
}

// =============================================
// PAYMENT HISTORY
// =============================================

export async function addPaymentRecord(email, payment) {
  const key = `payments:${email.toLowerCase()}`;
  await redis('RPUSH', key, JSON.stringify({ ...payment, timestamp: Date.now() }));
  await redis('LTRIM', key, -100, -1);
  return true;
}

export async function getPaymentHistory(email) {
  const entries = await redis('LRANGE', `payments:${email.toLowerCase()}`, 0, -1);
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map(e => JSON.parse(e)).reverse();
}

// =============================================
// GDPR — DELETE ALL USER DATA
// =============================================

export async function deleteUserData(email, sessionToken) {
  const lowerEmail = email.toLowerCase();
  const deleted = [];

  await redis('DEL', `user:${lowerEmail}`);
  deleted.push('profile');

  if (sessionToken) {
    await redis('DEL', `session:${sessionToken}`);
    deleted.push('session');
  }

  await redis('DEL', `payments:${lowerEmail}`);
  deleted.push('payments');

  await redis('DEL', `authcode:${lowerEmail}`);
  deleted.push('authcodes');

  const refCode = await redis('GET', `ref:email:${lowerEmail}`);
  if (refCode) {
    await redis('DEL', `ref:code:${refCode}`);
    await redis('DEL', `ref:email:${lowerEmail}`);
  }
  await redis('DEL', `ref:used:${lowerEmail}`);
  await redis('DEL', `ref:stats:${lowerEmail}`);
  deleted.push('referrals');

  const lendingCodes = await redis('SMEMBERS', `lender:active:${lowerEmail}`);
  if (lendingCodes && Array.isArray(lendingCodes)) {
    for (const code of lendingCodes) {
      const data = await redis('GET', `lending:${code}`);
      if (data) {
        const lending = JSON.parse(data);
        lending.status = 'revoked'; lending.revokedAt = Date.now();
        await redis('SET', `lending:${code}`, JSON.stringify(lending), 'EX', 86400);
      }
    }
    await redis('DEL', `lender:active:${lowerEmail}`);
    deleted.push('lending-tokens');
  }

  return { deleted };
}
