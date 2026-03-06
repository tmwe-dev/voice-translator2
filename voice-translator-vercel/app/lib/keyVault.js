// ═══════════════════════════════════════════════
// API Key Vault — AES-256-GCM server-side encryption
// Uses Supabase `api_keys_vault` table (row-per-provider)
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
 * Resolve email → Supabase profiles.id (UUID)
 * Cached per-request via closure (no global cache to avoid stale data)
 */
async function resolveUserId(supabase, email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (error || !data?.id) return null;
  return data.id;
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
 * Uses UPSERT on api_keys_vault (one row per provider)
 * @param {string} email - user email
 * @param {Object} keys - { openai: 'sk-...', elevenlabs: '...', anthropic: '...', gemini: '...' }
 */
export async function saveApiKeys(email, keys) {
  if (!email || !keys) return false;

  const supabase = getSupabaseAdmin();
  const userId = await resolveUserId(supabase, email);
  if (!userId) {
    console.error('[KeyVault] No profile found for email:', email);
    return false;
  }

  for (const [provider, plainKey] of Object.entries(keys)) {
    if (plainKey && typeof plainKey === 'string' && plainKey.trim()) {
      const encrypted = encryptKey(plainKey.trim());
      const { error } = await supabase
        .from('api_keys_vault')
        .upsert({
          user_id: userId,
          provider,
          encrypted_key: encrypted,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' });

      if (error) {
        console.error(`[KeyVault] Save error for ${provider}:`, error);
        return false;
      }
    }
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
  const userId = await resolveUserId(supabase, email);
  if (!userId) return null;

  const { data, error } = await supabase
    .from('api_keys_vault')
    .select('encrypted_key')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (error || !data?.encrypted_key) return null;

  try {
    return decryptKey(data.encrypted_key);
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
  const userId = await resolveUserId(supabase, email);
  if (!userId) return {};

  const { data, error } = await supabase
    .from('api_keys_vault')
    .select('provider')
    .eq('user_id', userId);

  if (error || !data) return {};

  const status = {};
  const allProviders = ['openai', 'anthropic', 'gemini', 'elevenlabs'];
  for (const p of allProviders) {
    status[p] = data.some(row => row.provider === p);
  }
  return status;
}

/**
 * Delete a specific provider key
 */
export async function deleteApiKey(email, provider) {
  if (!email || !provider) return false;

  const supabase = getSupabaseAdmin();
  const userId = await resolveUserId(supabase, email);
  if (!userId) return false;

  const { error } = await supabase
    .from('api_keys_vault')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  return !error;
}
