// ═══════════════════════════════════════════════
// Credits System — Purchase, Deduct, Query
// Atomic operations via optimistic locking (version field)
// ═══════════════════════════════════════════════

import { redis } from './redis.js';

/**
 * Atomic read-modify-write with optimistic locking.
 * Retries up to 3 times on version conflict.
 */
async function atomicUpdate(email, updateFn) {
  const key = `user:${email.toLowerCase()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const data = await redis('GET', key);
    if (!data) return null;
    let user;
    try { user = JSON.parse(data); } catch { return null; }
    const version = user._v || 0;
    const result = updateFn(user);
    if (result === null) return null; // updateFn signals failure
    user._v = version + 1;
    // Re-read and check version hasn't changed
    const recheck = await redis('GET', key);
    if (recheck) {
      try {
        const current = JSON.parse(recheck);
        if ((current._v || 0) !== version) {
          // Another write happened — retry
          continue;
        }
      } catch { /* proceed */ }
    }
    await redis('SET', key, JSON.stringify(user));
    return user;
  }
  console.warn('[Credits] Optimistic lock failed after 3 attempts for', email);
  return null;
}

/**
 * Add credits to a user account.
 * @param {string} email
 * @param {number} amount - credits in euro-cents
 * @returns {Object|null} updated user or null
 */
export async function addCredits(email, amount) {
  return atomicUpdate(email, (user) => {
    user.credits = (user.credits || 0) + amount;
    return user;
  });
}

/**
 * Deduct credits from a user account.
 * Skips deduction if user has own API keys.
 * @returns {Object|null} updated user, or null if insufficient credits
 */
export async function deductCredits(email, amount) {
  return atomicUpdate(email, (user) => {
    if (user.useOwnKeys) return user;
    if ((user.credits || 0) < amount) return null; // insufficient
    user.credits = Math.max(0, (user.credits || 0) - amount);
    user.totalSpent = (user.totalSpent || 0) + amount;
    user.totalMessages = (user.totalMessages || 0) + 1;
    return user;
  });
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
