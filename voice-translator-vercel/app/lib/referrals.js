// ═══════════════════════════════════════════════
// Referral System — Code Generation, Application, Stats
// ═══════════════════════════════════════════════

import { redis } from './redis.js';
import { addCredits } from './credits.js';
import { randomBytes } from 'crypto';

function generateRandomCode() {
  return randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

export async function generateReferralCode(email) {
  const lowerEmail = email.toLowerCase();
  const existingKey = `ref:email:${lowerEmail}`;
  const existing = await redis('GET', existingKey);
  if (existing) return existing;

  let code = generateRandomCode();
  let attempts = 0;
  while (attempts < 10) {
    const codeKey = `ref:code:${code}`;
    const codeExists = await redis('GET', codeKey);
    if (!codeExists) break;
    code = generateRandomCode();
    attempts++;
  }

  await redis('SET', `ref:code:${code}`, lowerEmail);
  await redis('SET', existingKey, code);
  return code;
}

export async function getReferralCode(email) {
  const lowerEmail = email.toLowerCase();
  const existing = await redis('GET', `ref:email:${lowerEmail}`);
  if (existing) return existing;
  return await generateReferralCode(email);
}

export async function applyReferral(newUserEmail, referralCode) {
  const lowerEmail = newUserEmail.toLowerCase();
  const referrerEmail = await redis('GET', `ref:code:${referralCode}`);
  if (!referrerEmail) return { success: false, error: 'Invalid referral code' };
  if (referrerEmail === lowerEmail) return { success: false, error: 'Cannot use your own referral code' };

  // SECURITY: use SETNX (SET if Not eXists) to prevent double-apply race condition
  const lockKey = `ref:used:${lowerEmail}`;
  const wasSet = await redis('SET', lockKey, referrerEmail, 'NX');
  if (!wasSet || wasSet === null) {
    return { success: false, error: 'You have already used a referral code' };
  }

  await addCredits(lowerEmail, 50);
  await addCredits(referrerEmail, 100);
  await redis('INCR', `ref:stats:${referrerEmail}`);

  return { success: true, referrerEmail };
}

export async function getReferralStats(email) {
  const count = await redis('GET', `ref:stats:${email.toLowerCase()}`);
  return parseInt(count || '0');
}
