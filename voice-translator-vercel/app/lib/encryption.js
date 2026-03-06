// ═══════════════════════════════════════════════
// AES-256-GCM Encryption for API Keys
// ═══════════════════════════════════════════════

import crypto from 'crypto';

/**
 * Derive encryption key from environment or fallback.
 * Uses ENCRYPTION_KEY env var (32-byte hex), or derives from UPSTASH token.
 */
function getEncryptionKey() {
  if (process.env.ENCRYPTION_KEY) {
    return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }
  if (process.env.UPSTASH_REDIS_REST_TOKEN) {
    const hash = crypto.createHash('sha256');
    hash.update(process.env.UPSTASH_REDIS_REST_TOKEN);
    return hash.digest();
  }
  throw new Error('No encryption key available: set ENCRYPTION_KEY or UPSTASH_REDIS_REST_TOKEN');
}

/**
 * Encrypt API keys object using AES-256-GCM
 * @param {Object} apiKeys - { openai: 'sk-...', anthropic: 'sk-ant-...', etc. }
 * @returns {Object} { encrypted, iv, authTag } (all base64)
 */
export function encryptKeys(apiKeys) {
  const plaintext = JSON.stringify(apiKeys);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

/**
 * Decrypt API keys object
 * @param {Object} encryptedData - { encrypted, iv, authTag } (all base64)
 * @returns {Object} plaintext API keys object
 */
export function decryptKeys(encryptedData) {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}
