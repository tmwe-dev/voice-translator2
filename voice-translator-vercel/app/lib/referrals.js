// ═══════════════════════════════════════════════
// Referral System — Code Generation, Application, Stats
// ═══════════════════════════════════════════════

import { redis } from './redis.js';
import { addCredits } from './credits.js';
import { REFERRAL_BONUS_NEW, REFERRAL_BONUS_REFERRER } from './constants.js';
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

  // b.363 — I DUE BONUS ERANO SCRITTI A MANO QUI: 50 e 100 comparivano
  // come numeri nudi, mentre l'elenco ufficiale dei valori (constants.js)
  // teneva gli stessi due importi senza che nessuno li leggesse. Chi
  // avesse cambiato il valore nell'elenco, credendo di aver cambiato il
  // bonus, non avrebbe cambiato niente: l'invito avrebbe continuato a
  // regalare i vecchi crediti. Ora c'e una sola fonte.
  await addCredits(lowerEmail, REFERRAL_BONUS_NEW);
  await addCredits(referrerEmail, REFERRAL_BONUS_REFERRER);
  await redis('INCR', `ref:stats:${referrerEmail}`);

  return { success: true, referrerEmail };
}

export async function getReferralStats(email) {
  const count = await redis('GET', `ref:stats:${email.toLowerCase()}`);
  return parseInt(count || '0');
}
