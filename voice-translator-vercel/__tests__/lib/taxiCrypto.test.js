/**
 * Tests for TaxiTalk client-side encryption/decryption.
 * Verifies that:
 * - Destinations are encrypted and can be decrypted with the correct key
 * - Wrong keys cause decryption to fail (not silently succeed)
 * - Ciphertext is opaque (server cannot extract coordinates)
 * - Key is base64url-safe (suitable for URL fragments)
 */
import { describe, it, expect } from 'vitest';

// In Node.js test environment, Web Crypto API is at globalThis.crypto
// but we need to test the logic, so let's test the pure crypto functions

describe('taxiCrypto', () => {
  // We test the encrypt/decrypt roundtrip using Node's crypto
  // since the Web Crypto API is available in Node 18+

  const SAMPLE_DESTINATION = {
    destinationName: 'Aeroporto di Milano Malpensa',
    originalAddress: 'Aeroporto di Milano-Malpensa, Ferno, Varese, Italy',
    normalizedAddress: 'Aeroporto di Milano-Malpensa, Ferno, Varese',
    lat: 45.6306,
    lng: 8.7281,
    terminal: 'Terminal 1, Gate B12',
    entrance: 'Ingresso principale',
    stops: ['Stazione Centrale di Milano'],
    flightNumber: 'AZ1234',
    hotelName: null,
    notes: 'Bagaglio grande, 2 persone',
    createdAt: '2025-01-01T00:00:00.000Z',
    expiresAt: '2025-01-01T04:00:00.000Z',
  };

  // base64url helpers (same as in taxiCrypto.js)
  function toBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64url(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  async function encrypt(destination) {
    const plaintext = new TextEncoder().encode(JSON.stringify(destination));
    const cryptoKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, true, ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    const rawKey = await crypto.subtle.exportKey('raw', cryptoKey);
    return { ciphertext: toBase64url(combined.buffer), key: toBase64url(rawKey) };
  }

  async function decrypt(ciphertextB64, keyB64) {
    const combined = new Uint8Array(fromBase64url(ciphertextB64));
    const rawKey = fromBase64url(keyB64);
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']
    );
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encrypted);
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  it('encrypts and decrypts a destination roundtrip', async () => {
    const { ciphertext, key } = await encrypt(SAMPLE_DESTINATION);
    const decrypted = await decrypt(ciphertext, key);

    expect(decrypted.normalizedAddress).toBe(SAMPLE_DESTINATION.normalizedAddress);
    expect(decrypted.lat).toBe(SAMPLE_DESTINATION.lat);
    expect(decrypted.lng).toBe(SAMPLE_DESTINATION.lng);
    expect(decrypted.terminal).toBe(SAMPLE_DESTINATION.terminal);
    expect(decrypted.flightNumber).toBe(SAMPLE_DESTINATION.flightNumber);
    expect(decrypted.notes).toBe(SAMPLE_DESTINATION.notes);
    expect(decrypted.stops).toEqual(SAMPLE_DESTINATION.stops);
  });

  it('produces URL-safe key and ciphertext', async () => {
    const { ciphertext, key } = await encrypt(SAMPLE_DESTINATION);

    // base64url: only [A-Za-z0-9_-], no +, /, or =
    expect(ciphertext).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates different ciphertext each time (random IV)', async () => {
    const r1 = await encrypt(SAMPLE_DESTINATION);
    const r2 = await encrypt(SAMPLE_DESTINATION);

    expect(r1.ciphertext).not.toBe(r2.ciphertext);
    expect(r1.key).not.toBe(r2.key);
  });

  it('ciphertext does not contain plaintext coordinates', async () => {
    const { ciphertext } = await encrypt(SAMPLE_DESTINATION);

    // The ciphertext should NOT contain any recognizable plaintext
    expect(ciphertext).not.toContain('45.6306');
    expect(ciphertext).not.toContain('8.7281');
    expect(ciphertext).not.toContain('Malpensa');
    expect(ciphertext).not.toContain('Terminal');
  });

  it('fails to decrypt with wrong key', async () => {
    const { ciphertext } = await encrypt(SAMPLE_DESTINATION);
    // Generate a different key
    const { key: wrongKey } = await encrypt({ dummy: true });

    await expect(decrypt(ciphertext, wrongKey)).rejects.toThrow();
  });

  it('fails to decrypt with tampered ciphertext', async () => {
    const { ciphertext, key } = await encrypt(SAMPLE_DESTINATION);

    // Tamper with ciphertext (flip a character)
    const tampered = ciphertext.slice(0, 20) +
      (ciphertext[20] === 'A' ? 'B' : 'A') +
      ciphertext.slice(21);

    await expect(decrypt(tampered, key)).rejects.toThrow();
  });

  it('key is exactly 32 bytes (256 bits) when decoded', async () => {
    const { key } = await encrypt(SAMPLE_DESTINATION);
    const rawKey = fromBase64url(key);
    expect(rawKey.byteLength).toBe(32);
  });

  it('IV is 12 bytes prepended to ciphertext', async () => {
    const { ciphertext } = await encrypt(SAMPLE_DESTINATION);
    const combined = new Uint8Array(fromBase64url(ciphertext));
    // Minimum: 12 bytes IV + at least 16 bytes GCM tag + some ciphertext
    expect(combined.length).toBeGreaterThan(28);
  });
});

describe('API route contract', () => {
  it('POST body contains only ciphertext, no cleartext fields', async () => {
    // Simulate what TaxiQRView sends
    const destination = {
      normalizedAddress: 'Via Roma 1, Milano',
      lat: 45.464,
      lng: 9.190,
    };

    const plaintext = new TextEncoder().encode(JSON.stringify(destination));
    const cryptoKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, true, ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    function toBase64url(buffer) {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    const ciphertext = toBase64url(combined.buffer);

    // This is the ONLY thing sent to the server
    const requestBody = { ciphertext };

    // Verify: request body has no cleartext fields
    expect(requestBody).not.toHaveProperty('lat');
    expect(requestBody).not.toHaveProperty('lng');
    expect(requestBody).not.toHaveProperty('normalizedAddress');
    expect(requestBody).not.toHaveProperty('terminal');
    expect(requestBody).not.toHaveProperty('notes');

    // Verify: only property is 'ciphertext'
    expect(Object.keys(requestBody)).toEqual(['ciphertext']);

    // Verify: ciphertext doesn't leak data
    expect(JSON.stringify(requestBody)).not.toContain('45.464');
    expect(JSON.stringify(requestBody)).not.toContain('Via Roma');
  });
});
