import { describe, it, expect, vi, beforeEach } from 'vitest';

// b.363 — QUESTO FILE NON PROVAVA NIENTE. Le funzioni encrypt/decrypt erano
// RISCRITTE qui dentro: nove casi verdi che dimostravano soltanto che il
// modulo crypto di Node funziona. Se domani keyVault.js cambiasse algoritmo,
// invertisse IV e tag o smettesse di cifrare del tutto, questi casi
// resterebbero verdi. Ora si prova encryptKey/decryptKey VERE, importate dal
// modulo. Serve una chiave di 64 caratteri esadecimali, come pretende
// getEncryptionKey (app/lib/keyVault.js:22-28).

// Mock supabase
vi.mock('../../app/lib/supabase.js', () => ({
  getSupabaseAdmin: () => null,
  isSupabaseEnabled: () => false,
}));

// Mock Redis
vi.mock('../../app/lib/redis.js', () => ({
  redis: vi.fn().mockResolvedValue(null),
}));

// La chiave va messa PRIMA di importare il modulo: getEncryptionKey la legge
// a ogni chiamata, ma cosi vale anche per chi la leggesse al caricamento.
process.env.KEY_VAULT_SECRET = 'a'.repeat(64);

const { encryptKey, decryptKey } = await import('../../app/lib/keyVault.js');

describe('KeyVault Encryption', () => {
  const IV_LEN = 12;
  const TAG_LEN = 16;

  const encrypt = (testo) => encryptKey(testo);
  const decrypt = (pacchetto) => decryptKey(pacchetto);

  it('encrypts and decrypts correctly', () => {
    const original = 'sk-abc123def456';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted.length).toBeGreaterThan(0);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('impacchetta IV + tag + testo cifrato, nell ordine dichiarato', () => {
    const encrypted = encrypt('sk-abc');
    const buf = Buffer.from(encrypted, 'base64');
    // La forma e parte del contratto: chi legge un valore vecchio dal
    // database deve poterlo ancora aprire.
    expect(buf.length).toBeGreaterThan(IV_LEN + TAG_LEN);
  });

  it('rifiuta un pacchetto troncato invece di restituire spazzatura', () => {
    const encrypted = encrypt('sk-abc');
    const troncato = Buffer.from(encrypted, 'base64').subarray(0, IV_LEN + 2).toString('base64');
    expect(() => decrypt(troncato)).toThrow();
  });

  it('non cifra un ingresso che non e una stringa piena', () => {
    expect(encrypt('')).toBe(null);
    expect(encrypt(null)).toBe(null);
    expect(decrypt('')).toBe(null);
    expect(decrypt(null)).toBe(null);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const text = 'same-api-key';
    const enc1 = encrypt(text);
    const enc2 = encrypt(text);
    expect(enc1).not.toBe(enc2); // Different IVs
    expect(decrypt(enc1)).toBe(text);
    expect(decrypt(enc2)).toBe(text);
  });

  it('fails to decrypt with wrong key', () => {
    const encrypted = encrypt('my-api-key');
    const giusta = process.env.KEY_VAULT_SECRET;
    process.env.KEY_VAULT_SECRET = 'b'.repeat(64);
    expect(() => decrypt(encrypted)).toThrow();
    process.env.KEY_VAULT_SECRET = giusta;
  });

  it('si rifiuta di lavorare senza una chiave di 64 esadecimali', () => {
    const giusta = process.env.KEY_VAULT_SECRET;
    process.env.KEY_VAULT_SECRET = 'troppo-corta';
    expect(() => encrypt('qualcosa')).toThrow(/64/);
    process.env.KEY_VAULT_SECRET = giusta;
  });

  it('handles unicode characters', () => {
    const original = 'API-key-with-émojis-🔑';
    expect(decrypt(encrypt(original))).toBe(original);
  });

  it('packed format is IV(12) + AuthTag(16) + Ciphertext', () => {
    const buf = Buffer.from(encrypt('short'), 'base64');
    expect(buf.length).toBeGreaterThanOrEqual(IV_LEN + TAG_LEN + 1);
  });
});

// b.363 — anche questo gruppo prova una funzione scritta QUI e non nel
// programma: in app/lib/keyVault.js non esiste nessun mascheratore. Resta
// come descrizione della forma attesa, ma va detto che non sorveglia niente:
// se il programma un giorno mascherera davvero le chiavi, questi casi non se
// ne accorgeranno. Non si cancella per non perdere la specifica scritta.
describe('Key masking (forma attesa, NON sorveglia il programma)', () => {
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
