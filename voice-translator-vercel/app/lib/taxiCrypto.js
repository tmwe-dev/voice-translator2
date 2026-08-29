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
  // BufferSource diretto: evita ArrayBuffer provenienti da un realm
  // diverso fra browser/jsdom/Node WebCrypto.
  return bytes;
}

export async function encryptDestination(destination) {
  const plaintext = new TextEncoder().encode(JSON.stringify(destination));

  const cryptoKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintext
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  const rawKey = await crypto.subtle.exportKey('raw', cryptoKey);

  return {
    ciphertext: toBase64url(combined.buffer),
    key: toBase64url(rawKey),
  };
}

export async function decryptDestination(ciphertextB64, keyB64) {
  const combined = fromBase64url(ciphertextB64);
  const rawKey = fromBase64url(keyB64);

  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  );

  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json);
}