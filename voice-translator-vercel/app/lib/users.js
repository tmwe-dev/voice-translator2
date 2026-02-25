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
