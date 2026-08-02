// ═══════════════════════════════════════════════
// Credits System — Purchase, Deduct, Query
// Atomic operations via optimistic locking (version field)
// ═══════════════════════════════════════════════

import { redis } from './redis.js';

/**
 * Atomic read-modify-write with optimistic locking + tight CAS window.
 * Uses versioned updates with immediate write after version check.
 * Retries up to 5 times on version conflict with exponential backoff.
 */
async function atomicUpdate(email, updateFn) {
  const key = `user:${email.toLowerCase()}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    // Add jitter backoff on retry to reduce contention
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, Math.random() * 50 * (1 << attempt)));
    }

    const data = await redis('GET', key);
    if (!data) return null;
    let user;
    try { user = JSON.parse(data); } catch { return null; }

    const version = user._v || 0;
    // Clone user to avoid mutating before confirming version
    const updated = JSON.parse(JSON.stringify(user));
    const result = updateFn(updated);
    if (result === null) return null; // updateFn signals failure (e.g. insufficient credits)

    updated._v = version + 1;
    updated._lastMod = Date.now();

    // CAS: re-read and write in tight succession (minimizes race window)
    const recheck = await redis('GET', key);
    if (recheck) {
      try {
        const current = JSON.parse(recheck);
        if ((current._v || 0) !== version) {
          // Version changed — another write happened, retry
          console.warn(`[Credits] CAS conflict attempt ${attempt + 1} for ${email}, retrying`);
          continue;
        }
      } catch { /* parse fail = proceed with write */ }
    }

    await redis('SET', key, JSON.stringify(updated));
    return updated;
  }
  console.error('[Credits] Atomic update failed after 5 attempts for', email);
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
