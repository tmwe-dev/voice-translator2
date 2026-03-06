// ═══════════════════════════════════════════════
// Credits System — Purchase, Deduct, Query
// ═══════════════════════════════════════════════

import { redis } from './redis.js';

/**
 * Add credits to a user account.
 * @param {string} email
 * @param {number} amount - credits in euro-cents
 * @returns {Object|null} updated user or null
 */
export async function addCredits(email, amount) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = JSON.parse(data);
  user.credits = (user.credits || 0) + amount;
  await redis('SET', key, JSON.stringify(user));
  return user;
}

/**
 * Deduct credits from a user account.
 * Skips deduction if user has own API keys.
 * @returns {Object|null} updated user, or null if insufficient credits
 */
export async function deductCredits(email, amount) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = JSON.parse(data);
  if (user.useOwnKeys) return user;
  if (user.credits < amount) return null;
  user.credits = Math.max(0, user.credits - amount);
  user.totalSpent = (user.totalSpent || 0) + amount;
  user.totalMessages = (user.totalMessages || 0) + 1;
  await redis('SET', key, JSON.stringify(user));
  return user;
}

/**
 * Get credits and key usage status for a user.
 */
export async function getCredits(email) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return { credits: 0, useOwnKeys: false };
  const user = JSON.parse(data);
  return { credits: user.credits, useOwnKeys: user.useOwnKeys };
}
