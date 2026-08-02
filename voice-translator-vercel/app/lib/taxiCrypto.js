'use client';

// ═══════════════════════════════════════════════════════════════
// taxiCrypto — Client-side encryption for TaxiTalk destinations
//
// The server NEVER sees the destination in cleartext.
// Flow:
//   1. Client generates AES-256-GCM key
//   2. Client encrypts destination JSON → ciphertext
//   3. ciphertext is sent to server (opaque blob)
//   4. Key is embedded in QR URL fragment (#k=...) — fragments
//      are never sent to the server by HTTP spec
//   5. Driver's browser extracts key from fragment, fetches
//      ciphertext from server, decrypts locally
//
// Crypto: AES-256-GCM with random 12-byte IV prepended to ciphertext
// Encoding: base64url (URL-safe, no padding)
// ═══════════════════════════════════════════════════════════════

// ── base64url helpers (no padding, URL-safe) ──
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

/**
 * Encrypt a destination object.
 * @param {Object} destination — the structured destination data
 * @returns {Promise<{ ciphertext: string, key: string }>}
 *   ciphertext: base64url(IV + encrypted_data + auth_tag)
 *   key: base64url(raw AES-256 key)
 */
export async function encryptDestination(destination) {
  const plaintext = new TextEncoder().encode(JSON.stringify(destination));

  // Generate a random 256-bit AES key
  const cryptoKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable — we need to export it for the QR
    ['encrypt']
  );

  // Random 12-byte IV (recommended for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintext
  );

  // Prepend IV to ciphertext: [12 bytes IV][ciphertext + GCM tag]
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Export key as raw bytes
  const rawKey = await crypto.subtle.exportKey('raw', cryptoKey);

  return {
    ciphertext: toBase64url(combined.buffer),
    key: toBase64url(rawKey),
  };
}

/**
 * Decrypt a destination ciphertext using the key from the URL fragment.
 * @param {string} ciphertextB64 — base64url(IV + encrypted_data)
 * @param {string} keyB64 — base64url(raw AES-256 key)
 * @returns {Promise<Object>} — the decrypted destination object
 * @throws {Error} if decryption fails (wrong key, tampered data, etc.)
 */
export async function decryptDestination(ciphertextB64, keyB64) {
  const combined = new Uint8Array(fromBase64url(ciphertextB64));
  const rawKey = fromBase64url(keyB64);

  // Extract IV (first 12 bytes) and ciphertext (rest)
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  // Import key
  const cryptoKey = await crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']
  );

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  );

  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json);
}
