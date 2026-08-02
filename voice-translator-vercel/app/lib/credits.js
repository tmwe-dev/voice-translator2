// ═══════════════════════════════════════════════
// Credits System — Purchase, Deduct, Query
// Truly atomic operations via Redis Lua scripts.
// ═══════════════════════════════════════════════

import { redis } from './redis.js';
import { CREDIT_ADD, CREDIT_DEDUCT } from './redisLua.js';

/**
 * Add credits to a user account (atomic via Lua).
 * @param {string} email
 * @param {number} amount - credits to add
 * @returns {Object|null} updated user or null if user doesn't exist
 */
export async function addCredits(email, amount) {
  const key = `user:${email.toLowerCase()}`;
  const result = await redis('EVAL', CREDIT_ADD, 1, key, amount.toString(), Date.now().toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch { return null; }
}

/**
 * Deduct credits from a user account (atomic via Lua).
 * Skips deduction if user has own API keys.
 * @returns {Object|null} updated user, or null if insufficient credits or user not found
 */
export async function deductCredits(email, amount) {
  const key = `user:${email.toLowerCase()}`;
  const result = await redis('EVAL', CREDIT_DEDUCT, 1, key, amount.toString(), Date.now().toString());
  if (!result) return null;
  if (result === 'INSUFFICIENT') return null;
  if (result === 'OWN_KEYS') {
    // User has own keys — return current user without deduction
    const data = await redis('GET', key);
    if (!data) return null;
    try { return JSON.parse(data); } catch { return null; }
  }
  try { return JSON.parse(result); } catch { return null; }
}

/**
 * Get credits and key usage status for a user.
 */
export async function getCredits(email) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return { credits: 0, useOwnKeys: false };
  let user; try { user = JSON.parse(data); } catch { return { credits: 0, useOwnKeys: false }; }
  return { credits: user.credits || 0, useOwnKeys: !!user.useOwnKeys };
}
