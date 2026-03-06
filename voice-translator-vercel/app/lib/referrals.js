// ═══════════════════════════════════════════════
// Referral System — Code Generation, Application, Stats
// ═══════════════════════════════════════════════

import { redis } from './redis.js';
import { addCredits } from './credits.js';

function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

  const alreadyUsed = await redis('GET', `ref:used:${lowerEmail}`);
  if (alreadyUsed) return { success: false, error: 'You have already used a referral code' };

  await redis('SET', `ref:used:${lowerEmail}`, referrerEmail);
  await addCredits(lowerEmail, 50);
  await addCredits(referrerEmail, 100);
  await redis('INCR', `ref:stats:${referrerEmail}`);

  return { success: true, referrerEmail };
}

export async function getReferralStats(email) {
  const count = await redis('GET', `ref:stats:${email.toLowerCase()}`);
  return parseInt(count || '0');
}
