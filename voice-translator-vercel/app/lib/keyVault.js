// ═══════════════════════════════════════════════
// API Key Vault — AES-256-GCM server-side encryption
// Keys are encrypted before storage and decrypted only server-side
// Keys NEVER return to the client after initial save
// ═══════════════════════════════════════════════

import { getSupabaseAdmin } from './supabase.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // 96 bits (recommended for GCM)
const TAG_LENGTH = 16; // 128 bits

/**
 * Get the encryption key from environment variable
 * Must be a 64-char hex string (32 bytes)
 */
function getEncryptionKey() {
  const key = process.env.KEY_VAULT_SECRET;
  if (!key || key.length !== 64) {
    throw new Error('KEY_VAULT_SECRET must be a 64-character hex string');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext API key
 * Returns: base64 string of IV + AuthTag + Ciphertext
 */
export function encryptKey(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return null;

  const crypto = require('crypto');
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: IV (12) + AuthTag (16) + Ciphertext (variable)
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt an encrypted API key
 * Input: base64 string of IV + AuthTag + Ciphertext
 * Returns: plaintext string
 */
export function decryptKey(encryptedBase64) {
  if (!encryptedBase64 || typeof encryptedBase64 !== 'string') return null;

  const crypto = require('crypto');
  const key = getEncryptionKey();
  const packed = Buffer.from(encryptedBase64, 'base64');

  if (packed.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted key format');
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Save encrypted API keys for a user
 * Keys are encrypted before storage
 * @param {string} email - user email
 * @param {Object} keys - { openai: 'sk-...', elevenlabs: '...', anthropic: '...', gemini: '...' }
 */
export async function saveApiKeys(email, keys) {
  if (!email || !keys) return false;

  const encryptedKeys = {};
  for (const [provider, plainKey] of Object.entries(keys)) {
    if (plainKey && typeof plainKey === 'string' && plainKey.trim()) {
      encryptedKeys[provider] = encryptKey(plainKey.trim());
    }
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('users')
    .update({ api_keys_encrypted: encryptedKeys })
    .eq('email', email);

  if (error) {
    console.error('[KeyVault] Save error:', error);
    return false;
  }
  return true;
}

/**
 * Get a decrypted API key for a specific provider (server-side only)
 * @param {string} email - user email
 * @param {string} provider - 'openai', 'elevenlabs', 'anthropic', 'gemini'
 * @returns {string|null} - decrypted key or null
 */
export async function getDecryptedKey(email, provider) {
  if (!email || !provider) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('api_keys_encrypted')
    .eq('email', email)
    .single();

  if (error || !data?.api_keys_encrypted?.[provider]) return null;

  try {
    return decryptKey(data.api_keys_encrypted[provider]);
  } catch (e) {
    console.error('[KeyVault] Decrypt error:', e);
    return null;
  }
}

/**
 * Check which providers have keys saved (without decrypting)
 * Safe to send to client — returns only provider names, not key values
 * @param {string} email
 * @returns {Object} { openai: true, elevenlabs: false, ... }
 */
export async function getKeyStatus(email) {
  if (!email) return {};

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('api_keys_encrypted')
    .eq('email', email)
    .single();

  if (error || !data?.api_keys_encrypted) return {};

  const status = {};
  for (const [provider, val] of Object.entries(data.api_keys_encrypted)) {
    status[provider] = !!val;
  }
  return status;
}

/**
 * Delete a specific provider key
 */
export async function deleteApiKey(email, provider) {
  if (!email || !provider) return false;

  const supabase = getSupabaseAdmin();

  // Get current keys
  const { data } = await supabase
    .from('users')
    .select('api_keys_encrypted')
    .eq('email', email)
    .single();

  if (!data?.api_keys_encrypted) return true;

  const updated = { ...data.api_keys_encrypted };
  delete updated[provider];

  const { error } = await supabase
    .from('users')
    .update({ api_keys_encrypted: updated })
    .eq('email', email);

  return !error;
}
