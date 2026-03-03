// User accounts, authentication, and credit system
// Uses shared Redis client from redis.js

import { redis } from './redis.js';
import crypto from 'crypto';

// =============================================
// ENCRYPTION HELPERS FOR API KEYS
// =============================================

/**
 * Derive encryption key from environment or fallback
 * Uses ENCRYPTION_KEY env var, or derives from UPSTASH_REDIS_REST_TOKEN if not set
 */
function getEncryptionKey() {
  if (process.env.ENCRYPTION_KEY) {
    // Should be a 32-byte hex string for AES-256
    return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }

  // Fallback: derive from UPSTASH token (should only be used for development)
  if (process.env.UPSTASH_REDIS_REST_TOKEN) {
    const hash = crypto.createHash('sha256');
    hash.update(process.env.UPSTASH_REDIS_REST_TOKEN);
    return hash.digest(); // 32 bytes
  }

  throw new Error('No encryption key available: set ENCRYPTION_KEY or UPSTASH_REDIS_REST_TOKEN');
}

/**
 * Encrypt API keys object using AES-256-GCM
 * @param {Object} apiKeys - { openai: 'sk-...', anthropic: 'sk-ant-...', etc. }
 * @returns {Object} { encrypted: <base64>, iv: <base64>, authTag: <base64> }
 */
export function encryptKeys(apiKeys) {
  try {
    const plaintext = JSON.stringify(apiKeys);
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

/**
 * Decrypt API keys object
 * @param {Object} encryptedData - { encrypted: <base64>, iv: <base64>, authTag: <base64> }
 * @returns {Object} plaintext API keys object
 */
export function decryptKeys(encryptedData) {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
}

// =============================================
// USERS
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
    credits: 0, // in euro-cents (e.g. 200 = €2.00)
    totalSpent: 0,
    totalMessages: 0,
    apiKeys: {}, // { openai: 'sk-...', anthropic: 'sk-ant-...', gemini: 'AIza...' }
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

  // Decrypt API keys if they exist and are encrypted
  if (user.apiKeys && user.apiKeys.encrypted) {
    try {
      user.apiKeys = decryptKeys(user.apiKeys);
    } catch (error) {
      console.error('Failed to decrypt keys for', email, ':', error);
      // Gradual migration: if decryption fails, treat as unencrypted (empty)
      user.apiKeys = {};
    }
  }
  // else: apiKeys is either empty or already plaintext (backward compatibility)

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
// CREDITS
// =============================================

// Credit packages: { id, euros, credits (in euro-cents), label }
export const CREDIT_PACKAGES = [
  { id: 'pack_starter', euros: 0.90, credits: 90, label: '€0.90', messages: '90 crediti', starter: true },
  { id: 'pack_2', euros: 2, credits: 200, label: '€2', messages: '200 crediti' },
  { id: 'pack_5', euros: 5, credits: 550, label: '€5', messages: '550 crediti', bonus: '+10%' },
  { id: 'pack_10', euros: 10, credits: 1200, label: '€10', messages: '1200 crediti', bonus: '+20%' },
  { id: 'pack_20', euros: 20, credits: 2600, label: '€20', messages: '2600 crediti', bonus: '+30%' },
];

export async function addCredits(email, amount) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = JSON.parse(data);
  user.credits = (user.credits || 0) + amount;
  await redis('SET', key, JSON.stringify(user));
  return user;
}

export async function deductCredits(email, amount) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = JSON.parse(data);
  if (user.useOwnKeys) return user; // no deduction if using own keys
  if (user.credits < amount) return null; // insufficient credits
  user.credits = Math.max(0, user.credits - amount);
  user.totalSpent = (user.totalSpent || 0) + amount;
  user.totalMessages = (user.totalMessages || 0) + 1;
  await redis('SET', key, JSON.stringify(user));
  return user;
}

export async function getCredits(email) {
  const user = await getUser(email);
  if (!user) return { credits: 0, useOwnKeys: false };
  return { credits: user.credits, useOwnKeys: user.useOwnKeys };
}

// =============================================
// API KEYS
// =============================================

export async function saveApiKeys(email, keys, useOwnKeys) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = JSON.parse(data);

  // Encrypt API keys before storing
  if (keys && Object.keys(keys).length > 0) {
    user.apiKeys = encryptKeys(keys);
  } else {
    user.apiKeys = {};
  }

  user.useOwnKeys = useOwnKeys;
  await redis('SET', key, JSON.stringify(user));
  return user;
}

export async function getUserApiKey(email, provider = 'openai') {
  const user = await getUser(email);
  // getUser already handles decryption, so apiKeys is plaintext
  if (!user || !user.useOwnKeys || !user.apiKeys) return null;
  return user.apiKeys[provider] || null;
}

// =============================================
// AUTH - Magic Code
// =============================================

export async function createAuthCode(email) {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  const key = `authcode:${email.toLowerCase()}`;
  await redis('SET', key, JSON.stringify({ code, created: Date.now() }), 'EX', 600); // 10 min TTL
  return code;
}

export async function verifyAuthCode(email, code) {
  const key = `authcode:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return false;
  const stored = JSON.parse(data);
  if (stored.code !== code) return false;
  // Delete code after successful verification
  await redis('DEL', key);
  return true;
}

// =============================================
// SESSIONS
// =============================================

export async function createSession(email) {
  const token = crypto.randomUUID() + '-' + Date.now().toString(36);
  const key = `session:${token}`;
  await redis('SET', key, JSON.stringify({ email: email.toLowerCase(), created: Date.now() }), 'EX', 604800); // 7 days
  // Update user last login
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
  const record = JSON.stringify({
    ...payment,
    timestamp: Date.now()
  });
  await redis('RPUSH', key, record);
  await redis('LTRIM', key, -100, -1); // keep last 100
  return true;
}

export async function getPaymentHistory(email) {
  const key = `payments:${email.toLowerCase()}`;
  const entries = await redis('LRANGE', key, 0, -1);
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map(e => JSON.parse(e)).reverse();
}

// =============================================
// REFERRAL SYSTEM
// =============================================

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

  const codeKey = `ref:code:${code}`;
  await redis('SET', codeKey, lowerEmail);
  await redis('SET', existingKey, code);
  return code;
}

export async function getReferralCode(email) {
  const lowerEmail = email.toLowerCase();
  const existingKey = `ref:email:${lowerEmail}`;
  let code = await redis('GET', existingKey);
  if (code) return code;
  return await generateReferralCode(email);
}

export async function applyReferral(newUserEmail, referralCode) {
  const lowerEmail = newUserEmail.toLowerCase();
  const codeKey = `ref:code:${referralCode}`;
  const referrerEmail = await redis('GET', codeKey);

  if (!referrerEmail) {
    return { success: false, error: 'Invalid referral code' };
  }

  if (referrerEmail === lowerEmail) {
    return { success: false, error: 'Cannot use your own referral code' };
  }

  const usedKey = `ref:used:${lowerEmail}`;
  const alreadyUsed = await redis('GET', usedKey);
  if (alreadyUsed) {
    return { success: false, error: 'You have already used a referral code' };
  }

  // Mark this email as having used a referral code
  await redis('SET', usedKey, referrerEmail);

  // Add bonus credits to new user (50 credits)
  await addCredits(lowerEmail, 50);

  // Add bonus credits to referrer (100 credits)
  await addCredits(referrerEmail, 100);

  // Increment referral count for referrer
  const statsKey = `ref:stats:${referrerEmail}`;
  await redis('INCR', statsKey);

  return { success: true, referrerEmail };
}

export async function getReferralStats(email) {
  const lowerEmail = email.toLowerCase();
  const statsKey = `ref:stats:${lowerEmail}`;
  const count = await redis('GET', statsKey);
  return parseInt(count || '0');
}

// =============================================
// CREDIT GIFTING
// =============================================

const GIFT_MIN = 50;        // min 50 credits (€0.50)
const GIFT_INVITE_TTL = 604800; // 7 days

function generateGiftCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = 'VT-GIFT-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a gift invite — deducts credits from sender IMMEDIATELY (escrow)
 * @param {string} senderEmail
 * @param {string} senderName
 * @param {number} giftAmount - credits to gift (euro-cents)
 * @returns {{ inviteCode: string, newBalance: number }}
 */
export async function createGiftInvite(senderEmail, senderName, giftAmount) {
  const lowerEmail = senderEmail.toLowerCase();
  const user = await getUser(lowerEmail);
  if (!user) throw new Error('User not found');

  // Validate gift
  if (giftAmount < GIFT_MIN) throw new Error(`Minimum gift is ${GIFT_MIN} credits`);
  const maxGift = Math.floor(user.credits * 0.5);
  if (giftAmount > maxGift) throw new Error(`Maximum gift is 50% of your balance (${maxGift})`);
  if (giftAmount > user.credits) throw new Error('Insufficient credits');

  // Deduct immediately (escrow)
  const updated = await deductCredits(lowerEmail, giftAmount);
  if (!updated) throw new Error('Insufficient credits');

  // Generate unique code
  const code = generateGiftCode();
  const now = Date.now();
  const expires = now + GIFT_INVITE_TTL * 1000;

  // Store invite with gift info
  const inviteKey = `invite:${code}`;
  await redis('SET', inviteKey, JSON.stringify({
    from: lowerEmail,
    fromName: senderName || user.name || '',
    giftAmount,
    giftStatus: 'pending', // pending → accepted | refunded
    created: now,
    expires
  }), 'EX', GIFT_INVITE_TTL);

  // Store escrow record (separate for tracking)
  const escrowKey = `gift-escrow:${code}`;
  await redis('SET', escrowKey, JSON.stringify({
    senderEmail: lowerEmail,
    amount: giftAmount,
    status: 'pending',
    createdAt: now
  }), 'EX', GIFT_INVITE_TTL + 86400); // +1 day for cleanup window

  // Add to expiring gifts SET for refund cleanup
  await redis('SADD', 'expiring-gifts', code);

  return { inviteCode: code, newBalance: updated.credits };
}

/**
 * Accept a gift invite — transfer credits to recipient
 * @param {string} recipientEmail
 * @param {string} inviteCode
 * @returns {{ giftAmount: number, senderName: string }} or null
 */
export async function acceptGiftInvite(recipientEmail, inviteCode) {
  const inviteKey = `invite:${inviteCode}`;
  const data = await redis('GET', inviteKey);
  if (!data) return null;

  const invite = JSON.parse(data);
  if (!invite.giftAmount || invite.giftAmount <= 0) return null;
  if (invite.giftStatus !== 'pending') return null;

  // Check not expired
  if (invite.expires && Date.now() > invite.expires) {
    // Auto-refund
    await refundGift(inviteCode, invite);
    return null;
  }

  // Transfer credits to recipient
  await addCredits(recipientEmail.toLowerCase(), invite.giftAmount);

  // Mark as accepted
  invite.giftStatus = 'accepted';
  invite.acceptedBy = recipientEmail.toLowerCase();
  invite.acceptedAt = Date.now();
  const ttlRemaining = Math.max(60, Math.floor((invite.expires - Date.now()) / 1000));
  await redis('SET', inviteKey, JSON.stringify(invite), 'EX', ttlRemaining);

  // Update escrow
  const escrowKey = `gift-escrow:${inviteCode}`;
  const escrowData = await redis('GET', escrowKey);
  if (escrowData) {
    const escrow = JSON.parse(escrowData);
    escrow.status = 'accepted';
    escrow.acceptedBy = recipientEmail.toLowerCase();
    escrow.acceptedAt = Date.now();
    await redis('SET', escrowKey, JSON.stringify(escrow), 'EX', 86400);
  }

  // Remove from expiring set
  await redis('SREM', 'expiring-gifts', inviteCode);

  return { giftAmount: invite.giftAmount, senderName: invite.fromName || '' };
}

/**
 * Get gift info for display before acceptance
 */
export async function getGiftInfo(inviteCode) {
  const inviteKey = `invite:${inviteCode}`;
  const data = await redis('GET', inviteKey);
  if (!data) return null;

  const invite = JSON.parse(data);
  if (!invite.giftAmount || invite.giftStatus !== 'pending') return null;

  const sender = await getUser(invite.from);
  return {
    senderName: sender?.name || invite.fromName || '',
    senderAvatar: sender?.avatar || '/avatars/1.png',
    giftAmount: invite.giftAmount,
    expiresAt: invite.expires
  };
}

/**
 * Refund a single expired gift
 */
async function refundGift(code, invite) {
  if (!invite || invite.giftStatus !== 'pending') return false;
  await addCredits(invite.from, invite.giftAmount);

  // Update invite status
  invite.giftStatus = 'refunded';
  invite.refundedAt = Date.now();
  const inviteKey = `invite:${code}`;
  await redis('SET', inviteKey, JSON.stringify(invite), 'EX', 86400); // keep 1 day for reference

  // Update escrow
  const escrowKey = `gift-escrow:${code}`;
  const escrowData = await redis('GET', escrowKey);
  if (escrowData) {
    const escrow = JSON.parse(escrowData);
    escrow.status = 'refunded';
    escrow.refundedAt = Date.now();
    await redis('SET', escrowKey, JSON.stringify(escrow), 'EX', 86400);
  }

  await redis('SREM', 'expiring-gifts', code);
  return true;
}

/**
 * Refund all expired gifts (run periodically)
 */
export async function refundExpiredGifts() {
  const codes = await redis('SMEMBERS', 'expiring-gifts');
  if (!codes || !Array.isArray(codes) || codes.length === 0) return { refunded: 0, totalAmount: 0 };

  let refunded = 0;
  let totalAmount = 0;

  for (const code of codes) {
    const inviteKey = `invite:${code}`;
    const data = await redis('GET', inviteKey);

    if (!data) {
      // Invite expired from Redis (TTL), refund from escrow
      const escrowKey = `gift-escrow:${code}`;
      const escrowData = await redis('GET', escrowKey);
      if (escrowData) {
        const escrow = JSON.parse(escrowData);
        if (escrow.status === 'pending') {
          await addCredits(escrow.senderEmail, escrow.amount);
          escrow.status = 'refunded';
          escrow.refundedAt = Date.now();
          await redis('SET', escrowKey, JSON.stringify(escrow), 'EX', 86400);
          refunded++;
          totalAmount += escrow.amount;
        }
      }
      await redis('SREM', 'expiring-gifts', code);
      continue;
    }

    const invite = JSON.parse(data);
    if (invite.giftStatus === 'pending' && invite.expires && Date.now() > invite.expires) {
      await refundGift(code, invite);
      refunded++;
      totalAmount += invite.giftAmount;
    }
  }

  return { refunded, totalAmount };
}

// =============================================
// GDPR — DELETE ALL USER DATA
// =============================================

/**
 * Delete all user data from Redis (GDPR Art. 17 — Right to Erasure)
 * Removes: profile, sessions, payments, referrals, lending tokens, gift escrows
 * @param {string} email
 * @param {string} sessionToken - current session token to invalidate
 * @returns {{ deleted: string[] }} list of deleted key types
 */
export async function deleteUserData(email, sessionToken) {
  const lowerEmail = email.toLowerCase();
  const deleted = [];

  // 1. Delete user profile
  const userKey = `user:${lowerEmail}`;
  await redis('DEL', userKey);
  deleted.push('profile');

  // 2. Delete current session
  if (sessionToken) {
    await redis('DEL', `session:${sessionToken}`);
    deleted.push('session');
  }

  // 3. Delete payment history
  const paymentsKey = `payments:${lowerEmail}`;
  await redis('DEL', paymentsKey);
  deleted.push('payments');

  // 4. Delete auth codes
  await redis('DEL', `authcode:${lowerEmail}`);
  deleted.push('authcodes');

  // 5. Delete referral data
  const refEmailKey = `ref:email:${lowerEmail}`;
  const refCode = await redis('GET', refEmailKey);
  if (refCode) {
    await redis('DEL', `ref:code:${refCode}`);
    await redis('DEL', refEmailKey);
  }
  await redis('DEL', `ref:used:${lowerEmail}`);
  await redis('DEL', `ref:stats:${lowerEmail}`);
  deleted.push('referrals');

  // 6. Revoke all active lending tokens
  const lendingCodes = await redis('SMEMBERS', `lender:active:${lowerEmail}`);
  if (lendingCodes && Array.isArray(lendingCodes)) {
    for (const code of lendingCodes) {
      const lendingKey = `lending:${code}`;
      const data = await redis('GET', lendingKey);
      if (data) {
        const lending = JSON.parse(data);
        lending.status = 'revoked';
        lending.revokedAt = Date.now();
        await redis('SET', lendingKey, JSON.stringify(lending), 'EX', 86400);
      }
    }
    await redis('DEL', `lender:active:${lowerEmail}`);
    deleted.push('lending-tokens');
  }

  return { deleted };
}

// =============================================
// API KEY LENDING (Temporary TOP PRO Access)
// =============================================

const LENDING_MIN_DURATION = 3600000;        // 1 hour
const LENDING_MAX_DURATION = 30 * 86400000;  // 30 days

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
 * @param {string} lenderEmail
 * @param {Object} opts - { type: "time"|"tokens"|"combined", duration?, tokenBudget? }
 * @returns {{ lendingCode: string }}
 */
export async function createLendingToken(lenderEmail, opts = {}) {
  const lowerEmail = lenderEmail.toLowerCase();
  const user = await getUser(lowerEmail);
  if (!user) throw new Error('User not found');
  if (!user.useOwnKeys || !user.apiKeys?.elevenlabs) {
    throw new Error('Only TOP PRO users (with ElevenLabs key) can create lending tokens');
  }

  const { type = 'time', duration = 86400000, tokenBudget = null } = opts;

  // Validate type
  if (!['time', 'tokens', 'combined'].includes(type)) {
    throw new Error('Invalid lending type. Use: time, tokens, or combined');
  }

  // Validate duration
  const effectiveDuration = (type === 'tokens') ? LENDING_MAX_DURATION : duration;
  if (effectiveDuration < LENDING_MIN_DURATION) throw new Error('Minimum duration is 1 hour');
  if (effectiveDuration > LENDING_MAX_DURATION) throw new Error('Maximum duration is 30 days');

  // Validate token budget
  if ((type === 'tokens' || type === 'combined') && (!tokenBudget || tokenBudget <= 0)) {
    throw new Error('Token budget must be positive for token-based lending');
  }

  const code = generateLendingCode();
  const now = Date.now();
  const expiresAt = now + effectiveDuration;
  const ttlSeconds = Math.ceil(effectiveDuration / 1000) + 86400; // +1 day buffer

  const lending = {
    lenderEmail: lowerEmail,
    lenderName: user.name || '',
    type,
    duration: effectiveDuration,
    tokenBudget: tokenBudget || null,
    tokensUsed: 0,
    expiresAt,
    status: 'active', // active | exhausted | revoked | expired
    sessionsCreated: 0,
    lastUsed: null,
    revokedAt: null,
    created: now
  };

  const lendingKey = `lending:${code}`;
  await redis('SET', lendingKey, JSON.stringify(lending), 'EX', ttlSeconds);

  // Track lender's active tokens
  await redis('SADD', `lender:active:${lowerEmail}`, code);

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

  // Check status
  if (lending.status === 'revoked') return null;
  if (lending.status === 'exhausted') return null;

  // Check expiry
  if (Date.now() > lending.expiresAt) {
    lending.status = 'expired';
    await redis('SET', lendingKey, JSON.stringify(lending), 'EX', 86400);
    await redis('SREM', `lender:active:${lending.lenderEmail}`, lendingCode);
    return null;
  }

  // Check token budget
  const tokensRemaining = lending.tokenBudget ? Math.max(0, lending.tokenBudget - lending.tokensUsed) : null;
  if (tokensRemaining !== null && tokensRemaining <= 0) {
    lending.status = 'exhausted';
    await redis('SET', lendingKey, JSON.stringify(lending), 'EX', 86400);
    await redis('SREM', `lender:active:${lending.lenderEmail}`, lendingCode);
    return null;
  }

  return {
    lenderEmail: lending.lenderEmail,
    lenderName: lending.lenderName,
    type: lending.type,
    tokensRemaining,
    expiresAt: lending.expiresAt,
    status: lending.status,
    tokensUsed: lending.tokensUsed
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

  // Check if exhausted
  if (lending.tokenBudget && lending.tokensUsed >= lending.tokenBudget) {
    lending.status = 'exhausted';
    await redis('SREM', `lender:active:${lending.lenderEmail}`, lendingCode);
  }

  const ttl = await redis('TTL', lendingKey);
  await redis('SET', lendingKey, JSON.stringify(lending), 'EX', Math.max(ttl, 86400));

  return {
    tokensRemaining: lending.tokenBudget ? Math.max(0, lending.tokenBudget - lending.tokensUsed) : null
  };
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

  lending.status = 'revoked';
  lending.revokedAt = Date.now();
  await redis('SET', lendingKey, JSON.stringify(lending), 'EX', 86400); // keep 1 day
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
    const lendingKey = `lending:${code}`;
    const data = await redis('GET', lendingKey);
    if (!data) {
      await redis('SREM', `lender:active:${lowerEmail}`, code);
      continue;
    }
    const lending = JSON.parse(data);
    tokens.push({ code, ...lending });
  }

  return tokens;
}
