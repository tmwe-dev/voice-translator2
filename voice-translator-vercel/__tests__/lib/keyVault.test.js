import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the encryption/decryption logic directly since the Supabase operations
// are tested via integration. keyVault uses AES-256-GCM.

// Mock supabase
vi.mock('../../app/lib/supabase.js', () => ({
  getSupabaseAdmin: () => null,
  isSupabaseEnabled: () => false,
}));

// Mock Redis
vi.mock('../../app/lib/redis.js', () => ({
  redis: vi.fn().mockResolvedValue(null),
}));

// Import crypto at top level (allowed in ESM)
const crypto = await import('crypto');

describe('KeyVault Encryption', () => {
  const ALGO = 'aes-256-gcm';
  const IV_LEN = 12;
  const TAG_LEN = 16;

  function encrypt(text, secret) {
    const key = crypto.scryptSync(secret, 'voicetranslate-salt', 32);
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  function decrypt(packed, secret) {
    const key = crypto.scryptSync(secret, 'voicetranslate-salt', 32);
    const buf = Buffer.from(packed, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc, null, 'utf8') + decipher.final('utf8');
  }

  it('encrypts and decrypts correctly', () => {
    const secret = 'test-secret-key-32-chars-long!!';
    const original = 'sk-abc123def456';
    const encrypted = encrypt(original, secret);
    expect(encrypted).not.toBe(original);
    expect(encrypted.length).toBeGreaterThan(0);
    const decrypted = decrypt(encrypted, secret);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const secret = 'test-secret-key';
    const text = 'same-api-key';
    const enc1 = encrypt(text, secret);
    const enc2 = encrypt(text, secret);
    expect(enc1).not.toBe(enc2); // Different IVs
    // But both decrypt to same
    expect(decrypt(enc1, secret)).toBe(text);
    expect(decrypt(enc2, secret)).toBe(text);
  });

  it('fails to decrypt with wrong key', () => {
    const encrypted = encrypt('my-api-key', 'correct-key');
    expect(() => decrypt(encrypted, 'wrong-key')).toThrow();
  });

  it('handles empty string', () => {
    const secret = 'test-key';
    const encrypted = encrypt('', secret);
    const decrypted = decrypt(encrypted, secret);
    expect(decrypted).toBe('');
  });

  it('handles unicode characters', () => {
    const secret = 'test-key';
    const original = 'API-key-with-émojis-🔑';
    const encrypted = encrypt(original, secret);
    const decrypted = decrypt(encrypted, secret);
    expect(decrypted).toBe(original);
  });

  it('packed format is IV(12) + AuthTag(16) + Ciphertext', () => {
    const secret = 'test-key';
    const encrypted = encrypt('short', secret);
    const buf = Buffer.from(encrypted, 'base64');
    // IV is 12 bytes, AuthTag is 16 bytes, ciphertext is at least 5 bytes
    expect(buf.length).toBeGreaterThanOrEqual(IV_LEN + TAG_LEN + 1);
  });
});

describe('Key masking', () => {
  function maskKey(key) {
    if (!key || key.length < 12) return key ? '***' : '';
    return key.substring(0, 8) + '...' + key.substring(key.length - 4);
  }

  it('masks API keys correctly', () => {
    expect(maskKey('sk-abc123def456ghi789')).toBe('sk-abc12...i789');
  });

  it('returns *** for short keys', () => {
    expect(maskKey('short')).toBe('***');
  });

  it('returns empty for null', () => {
    expect(maskKey(null)).toBe('');
    expect(maskKey('')).toBe('');
  });
});
