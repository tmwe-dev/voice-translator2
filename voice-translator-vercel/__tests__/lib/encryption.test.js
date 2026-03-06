import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set env var before import
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes

const { encryptKeys, decryptKeys } = await import('../../app/lib/encryption.js');

describe('encryptKeys / decryptKeys', () => {
  it('roundtrips a simple API keys object', () => {
    const keys = { openai: 'sk-test-123', anthropic: 'sk-ant-456' };
    const encrypted = encryptKeys(keys);
    expect(encrypted).toHaveProperty('encrypted');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('authTag');
    expect(encrypted.encrypted).not.toContain('sk-test');

    const decrypted = decryptKeys(encrypted);
    expect(decrypted).toEqual(keys);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const keys = { openai: 'sk-test-same' };
    const enc1 = encryptKeys(keys);
    const enc2 = encryptKeys(keys);
    expect(enc1.encrypted).not.toBe(enc2.encrypted);
    expect(enc1.iv).not.toBe(enc2.iv);
  });

  it('fails to decrypt with tampered ciphertext', () => {
    const keys = { openai: 'sk-test-tamper' };
    const encrypted = encryptKeys(keys);
    encrypted.encrypted = encrypted.encrypted.slice(0, -4) + 'AAAA';
    expect(() => decryptKeys(encrypted)).toThrow();
  });

  it('fails to decrypt with tampered auth tag', () => {
    const keys = { openai: 'sk-test-auth' };
    const encrypted = encryptKeys(keys);
    encrypted.authTag = Buffer.from('0000000000000000').toString('base64');
    expect(() => decryptKeys(encrypted)).toThrow();
  });

  it('handles empty keys object', () => {
    const keys = {};
    const encrypted = encryptKeys(keys);
    const decrypted = decryptKeys(encrypted);
    expect(decrypted).toEqual({});
  });

  it('handles keys with special characters', () => {
    const keys = { openai: 'sk-test-àéîöü-日本語', gemini: 'AI-key_with.dots/slashes' };
    const encrypted = encryptKeys(keys);
    const decrypted = decryptKeys(encrypted);
    expect(decrypted).toEqual(keys);
  });
});
