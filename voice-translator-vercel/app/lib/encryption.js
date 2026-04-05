// ═══════════════════════════════════════════════
// AES-256-GCM Encryption for API Keys
// ═══════════════════════════════════════════════

import crypto from 'crypto';

/**
 * Derive encryption key from environment or fallback.
 * Uses ENCRYPTION_KEY env var (32-byte hex), or derives from UPSTASH token.
 */
// Key derivation cache (derive once per cold start)
let _derivedKey = null;

function getEncryptionKey() {
  if (_derivedKey) return _derivedKey;

  if (process.env.ENCRYPTION_KEY) {
    _derivedKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    return _derivedKey;
  }
  if (process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Warn in production — dedicated ENCRYPTION_KEY is strongly recommended
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ [Encryption] Using UPSTASH token fallback for encryption key. Set ENCRYPTION_KEY env var for production!');
    }
    // PBKDF2 instead of raw SHA256 — proper key derivation
    const salt = 'barchat-v2-encryption-salt'; // static salt (rotated with key)
    _derivedKey = crypto.pbkdf2Sync(
      process.env.UPSTASH_REDIS_REST_TOKEN,
      salt,
      100000, // 100k iterations — OWASP recommended minimum
      32,     // 256-bit key
      'sha512'
    );
    return _derivedKey;
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
  if (!encryptedData?.iv || !encryptedData?.authTag || !encryptedData?.encrypted) {
    throw new Error('Invalid encrypted data format');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    const parsed = JSON.parse(decrypted);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
    console.warn('[Encryption] Decrypted data is not an object, returning empty');
    return {};
  } catch {
    console.warn('[Encryption] Failed to parse decrypted data as JSON');
    return {};
  }
}
