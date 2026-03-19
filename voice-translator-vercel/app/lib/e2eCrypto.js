// ═══════════════════════════════════════════════
// E2E Encryption — ECDH key exchange + AES-GCM
//
// Per-session ephemeral keys. Protects DataChannel messages from:
// - Man-in-the-middle (even if TURN relay is compromised)
// - Server-side snooping (signaling only carries public keys)
//
// Flow:
// 1. Each peer generates ECDH key pair on connection
// 2. Public keys exchanged via signaling channel
// 3. Both derive shared secret via ECDH
// 4. AES-GCM encrypts every DataChannel message
// 5. Keys are ephemeral — destroyed on disconnect
// ═══════════════════════════════════════════════

/**
 * Generate an ephemeral ECDH key pair for this session.
 * @returns {{ publicKey: CryptoKey, privateKey: CryptoKey }}
 */
export async function generateKeyPair() {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // not extractable (private key stays in WebCrypto)
    ['deriveKey']
  );
}

/**
 * Export public key to transmittable format (JWK JSON string).
 */
export async function exportPublicKey(publicKey) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return JSON.stringify(jwk);
}

/**
 * Import partner's public key from JWK JSON string.
 */
export async function importPublicKey(jwkString) {
  const jwk = JSON.parse(jwkString);
  return await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [] // public keys don't derive — that's done with our private key
  );
}

/**
 * Derive shared AES-GCM key from our private key + partner's public key.
 * Both sides derive the same key (ECDH magic).
 */
export async function deriveSharedKey(myPrivateKey, partnerPublicKey) {
  return await crypto.subtle.deriveKey(
    { name: 'ECDH', public: partnerPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a message string with AES-GCM.
 * Returns base64-encoded {iv, ciphertext}.
 */
export async function encryptMessage(sharedKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    encoded
  );
  // Pack iv + ciphertext as base64 for JSON transport
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

/**
 * Decrypt a message with AES-GCM.
 * @param {{ iv: string, ct: string }} encrypted - base64 iv + ciphertext
 * @returns {string} plaintext
 */
export async function decryptMessage(sharedKey, encrypted) {
  const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(encrypted.ct), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    ct
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Check if Web Crypto API is available (not in insecure context / old browsers).
 */
export function isE2EAvailable() {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
    && typeof crypto.subtle.generateKey === 'function';
}
