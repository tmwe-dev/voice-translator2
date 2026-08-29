'use client';
// ═══════════════════════════════════════════════════════════════
// b.349 — PEEPOFF · LA BUSTA. Il cuore della segretezza, nel modo
// piu semplice che regge la promessa:
//
// - CIFRATURA per destinatario: una chiave EFFIMERA del mittente fa
//   l'accordo (ECDH P-256) con la chiave pubblica del destinatario;
//   dall'accordo nasce la chiave AES-GCM 256 che sigilla il contenuto.
//   La chiave effimera muore col messaggio: compromettere domani il
//   mittente non riapre le buste di ieri.
// - FIRMA del mittente (ECDSA P-256) sul cifrato: chi riceve sa CHI
//   ha scritto e che nessuno ha toccato la busta.
// - RICEVUTA: il destinatario firma l'impronta della busta ricevuta;
//   il mittente la verifica -> solo allora "consegnato".
//
// Tutto WebCrypto nativo del browser: zero dipendenze.
// ═══════════════════════════════════════════════════════════════

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
const FIRMA = { name: 'ECDSA', hash: 'SHA-256' };

// Le JWK esportate portano key_ops/ext che l'importazione poi rifiuta
// ("Key operations and usage mismatch"): ai confini viaggiano SOLO i
// quattro campi che contano. Trovato dal test, non in produzione.
const pulisciJwk = (j) => ({ kty: j.kty, crv: j.crv, x: j.x, y: j.y });

const versoBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
// Manteniamo un Uint8Array, non il suo `.buffer`: e' un BufferSource
// accettato in modo coerente sia dal WebCrypto del browser sia da quello
// di Node/Vitest, evitando mismatch fra realm diversi (jsdom/Node).
const daBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const codifica = (s) => new TextEncoder().encode(s);
const decodifica = (b) => new TextDecoder().decode(b);

/** L'impronta di una chiave pubblica (JWK): SHA-256 esadecimale dei punti. */
export async function improntaChiave(jwk) {
  const canonico = `${jwk.crv}|${jwk.x}|${jwk.y}`;
  const h = await crypto.subtle.digest('SHA-256', codifica(canonico));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Impronta leggibile a gruppi di 4, per il confronto a voce fra persone. */
export function improntaLeggibile(hex, gruppi = 8) {
  return String(hex || '').slice(0, gruppi * 4).toUpperCase().match(/.{1,4}/g)?.join(' ') || '';
}

/** Genera l'identità del dispositivo: coppia di scambio + coppia di firma. */
export async function generaIdentita() {
  const scambio = await crypto.subtle.generateKey(ECDH, false, ['deriveKey']);
  const firma = await crypto.subtle.generateKey(ECDSA, false, ['sign']);
  const scambioPub = pulisciJwk(await crypto.subtle.exportKey('jwk', scambio.publicKey));
  const firmaPub = pulisciJwk(await crypto.subtle.exportKey('jwk', firma.publicKey));
  return { scambio, firma, scambioPub, firmaPub, impronta: await improntaChiave(firmaPub) };
}

async function chiaveAccordo(privatoECDH, pubblicoJwk) {
  const loro = await crypto.subtle.importKey('jwk', pulisciJwk(pubblicoJwk), ECDH, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: loro }, privatoECDH, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sigilla(messaggio, scambioPubDestinatario, firmaPrivataMittente) {
  const effimera = await crypto.subtle.generateKey(ECDH, false, ['deriveKey']);
  const effimeraPub = pulisciJwk(await crypto.subtle.exportKey('jwk', effimera.publicKey));
  const aes = await chiaveAccordo(effimera.privateKey, scambioPubDestinatario);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrato = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, codifica(JSON.stringify(messaggio)));
  const firma = await crypto.subtle.sign(FIRMA, firmaPrivataMittente, cifrato);
  return {
    v: 1,
    effimera: effimeraPub,
    iv: versoBase64(iv.buffer),
    cifrato: versoBase64(cifrato),
    firma: versoBase64(firma),
  };
}

export async function apri(busta, scambioPrivatoDestinatario, firmaPubMittenteJwk) {
  const cifrato = daBase64(busta.cifrato);
  let firmaValida = false;
  try {
    const pubFirma = await crypto.subtle.importKey('jwk', pulisciJwk(firmaPubMittenteJwk), ECDSA, false, ['verify']);
    firmaValida = await crypto.subtle.verify(FIRMA, pubFirma, daBase64(busta.firma), cifrato);
  } catch { /* firma non verificabile: la busta si apre comunque, ma il mittente non e provato */ }
  const aes = await chiaveAccordo(scambioPrivatoDestinatario, busta.effimera);
  const chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daBase64(busta.iv) }, aes, cifrato);
  const h = await crypto.subtle.digest('SHA-256', cifrato);
  return { messaggio: JSON.parse(decodifica(chiaro)), firmaValida, improntaBusta: versoBase64(h) };
}

export async function firmaRicevuta(improntaBusta, firmaPrivataDestinatario) {
  const firma = await crypto.subtle.sign(FIRMA, firmaPrivataDestinatario, daBase64(improntaBusta));
  return { v: 1, impronta: improntaBusta, firma: versoBase64(firma), quando: Date.now() };
}

export async function verificaRicevuta(ricevuta, bustaSpedita, firmaPubDestinatarioJwk) {
  try {
    const cifrato = daBase64(bustaSpedita.cifrato);
    const h = await crypto.subtle.digest('SHA-256', cifrato);
    if (versoBase64(h) !== ricevuta.impronta) return false;
    const pub = await crypto.subtle.importKey('jwk', pulisciJwk(firmaPubDestinatarioJwk), ECDSA, false, ['verify']);
    return await crypto.subtle.verify(FIRMA, pub, daBase64(ricevuta.firma), daBase64(ricevuta.impronta));
  } catch { return false; }
}