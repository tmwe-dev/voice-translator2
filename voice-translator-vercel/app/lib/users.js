// ═══════════════════════════════════════════════
// User Accounts — Core CRUD + Re-exports
//
// Architecture: users.js is the orchestration layer.
// Domain logic is split into focused modules:
//   encryption.js — AES-256-GCM for API keys
//   credits.js    — Purchase, deduct, query credits
//   referrals.js  — Referral codes + bonus system
//   gifting.js    — Escrow-based credit gifting
//   lending.js    — Temporary TOP PRO access tokens
// ═══════════════════════════════════════════════

import { redis } from './redis.js';
import crypto from 'crypto';
import { encryptKeys, decryptKeys } from './encryption.js';
import { createLogger } from './logger.js';
import { cancellaDatiPersistenti, revocaTutteLeSessioni } from './cancellazione.js';
const log = createLogger('users');

// Re-export all sub-modules for backward compatibility
export { encryptKeys, decryptKeys } from './encryption.js';
export { addCredits, deductCredits, getCredits } from './credits.js';
export { generateReferralCode, getReferralCode, applyReferral, getReferralStats } from './referrals.js';
export { createGiftInvite, acceptGiftInvite, getGiftInfo, refundExpiredGifts } from './gifting.js';
export { createLendingToken, validateLending, deductLendingTokens, revokeLending, getLendingTokens } from './lending.js';

// Credit packages (shared constant, also in constants.js for client)
export const CREDIT_PACKAGES = [
  { id: 'pack_starter', euros: 0.90, credits: 90, label: '€0.90', messages: '90 crediti', starter: true },
  { id: 'pack_2', euros: 2, credits: 200, label: '€2', messages: '200 crediti' },
  { id: 'pack_5', euros: 5, credits: 550, label: '€5', messages: '550 crediti', bonus: '+10%' },
  { id: 'pack_10', euros: 10, credits: 1200, label: '€10', messages: '1200 crediti', bonus: '+20%' },
  { id: 'pack_20', euros: 20, credits: 2600, label: '€20', messages: '2600 crediti', bonus: '+30%' },
];

// =============================================
// USER CRUD
// =============================================

export async function createUser(email, name, lang, avatar) {
  const key = `user:${email.toLowerCase()}`;
  const existing = await redis('GET', key);
  if (existing) { let u; try { u = JSON.parse(existing); } catch { u = null; } if (u) return u; }

  const user = {
    email: email.toLowerCase(),
    name: name || '',
    lang: lang || 'it',
    avatar: avatar || '/avatars/1.webp',
    credits: 0,
    totalSpent: 0,
    totalMessages: 0,
    apiKeys: {},
    useOwnKeys: false,
    created: Date.now(),
    lastLogin: Date.now()
  };
  await redis('SET', key, JSON.stringify(user));
  return user;
}

export async function getUser(email) {
  if (!email) return null;
  const data = await redis('GET', `user:${email.toLowerCase()}`);
  if (!data) return null;
  let user; try { user = JSON.parse(data); } catch { return null; }

  // Decrypt API keys if encrypted
  if (user.apiKeys && user.apiKeys.encrypted) {
    try {
      user.apiKeys = decryptKeys(user.apiKeys);
    } catch (error) {
      log.error('Failed to decrypt keys for', email, ':', error);
      user.apiKeys = {};
    }
  }
  return user;
}

export async function updateUser(email, updates) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  let parsed; try { parsed = JSON.parse(data); } catch { return null; }
  const user = { ...parsed, ...updates };
  await redis('SET', key, JSON.stringify(user));
  return user;
}

// =============================================
// API KEYS
// =============================================

export async function saveApiKeys(email, keys, useOwnKeys) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  let user; try { user = JSON.parse(data); } catch { return null; }
  user.apiKeys = (keys && Object.keys(keys).length > 0) ? encryptKeys(keys) : {};
  user.useOwnKeys = useOwnKeys;
  await redis('SET', key, JSON.stringify(user));
  return user;
}

// b.166 — CONFERMATO (caccia al tesoro): getUser() decripta sempre le
// apiKeys prima di restituire l'oggetto utente. Ogni endpoint che
// rispondeva con `user` grezzo (login email/OTP, Google, Apple,
// test-login, il check "me" ad ogni apertura app) mandava le chiavi
// OpenAI/Anthropic/Gemini/ElevenLabs dell'utente IN CHIARO al client
// a ogni login — in contraddizione con l'intento dichiarato altrove
// (keyVault.js: "Keys NEVER return to the client after initial save").
// Solo /api/user (azione 'profile', mai chiamata dal client attuale)
// le mascherava, con questa stessa formula duplicata inline. Centralizzata
// qui: ogni endpoint di login/sessione DEVE passare `user` da questa
// funzione prima di rispondere al client.
export function maskApiKeys(user) {
  if (!user || !user.apiKeys) return user;
  const masked = {};
  for (const [provider, k] of Object.entries(user.apiKeys)) {
    masked[provider] = k ? k.substring(0, 8) + '...' + k.substring(k.length - 4) : '';
  }
  return { ...user, apiKeys: masked };
}

// =============================================
// AUTH — Magic Code
// =============================================

export async function createAuthCode(email) {
  // SECURITY: use cryptographically secure random instead of Math.random
  const code = crypto.randomInt(100000, 999999).toString();
  const emailKey = email.toLowerCase();
  await redis('SET', `authcode:${emailKey}`, JSON.stringify({ code, created: Date.now() }), 'EX', 600);
  // b.168 — CONFERMATO (audit esterno 15/8): il contatore tentativi viveva
  // dentro lo stesso JSON (GET → controlla → incrementa → SET, tre
  // round-trip separati). Richieste concorrenti (non in sequenza: piu
  // guess dello stesso codice sparati insieme) potevano leggere tutte lo
  // STESSO valore vecchio prima che una sola scrivesse l'incremento — il
  // tetto di 5 tentativi si aggirava aumentando il parallelismo. Ora il
  // contatore e una chiave separata, incrementata con INCR (atomico in
  // Redis per costruzione): un nuovo codice azzera anche questa.
  await redis('DEL', `authcode:attempts:${emailKey}`);
  return code;
}

export async function verifyAuthCode(email, code) {
  const emailKey = email.toLowerCase();
  const key = `authcode:${emailKey}`;
  const attemptsKey = `authcode:attempts:${emailKey}`;
  const data = await redis('GET', key);
  if (!data) return false;
  let stored; try { stored = JSON.parse(data); } catch { return false; }

  // SECURITY: brute-force protection — max 5 attempts per code.
  // L'incremento avviene PRIMA del confronto, sempre: e questo che rende
  // il conteggio corretto anche sotto richieste concorrenti (vedi nota
  // sopra in createAuthCode).
  const tentativi = await redis('INCR', attemptsKey);
  if (tentativi === 1) {
    const ttl = await redis('TTL', key);
    await redis('EXPIRE', attemptsKey, ttl > 0 ? ttl : 600);
  }
  if (tentativi > 5) {
    await redis('DEL', key);
    await redis('DEL', attemptsKey);
    return false;
  }

  if (stored.code !== code) {
    return false;
  }

  await redis('DEL', key);
  await redis('DEL', attemptsKey);
  return true;
}

// =============================================
// SESSIONS
// =============================================

export async function createSession(email) {
  const token = crypto.randomUUID() + '-' + Date.now().toString(36);
  const basso = email.toLowerCase();
  await redis('SET', `session:${token}`, JSON.stringify({ email: basso, created: Date.now() }), 'EX', 604800);
  // b.415 — L'ELENCO DELLE SESSIONI DI UNA PERSONA, che non esisteva.
  //
  // Senza, «cancella i miei dati» poteva chiudere solo la sessione da cui
  // stavi chiedendo: chi era entrato anche dal telefono restava dentro
  // fino alla scadenza naturale, sette giorni. Per un account che sta
  // venendo cancellato, sette giorni di accesso residuo sono un'eternita.
  //
  // L'insieme scade con la sessione piu lunga: se non ci si entra piu,
  // sparisce da solo e non lascia niente in giro.
  try {
    await redis('SADD', `sessioni:${basso}`, token);
    await redis('EXPIRE', `sessioni:${basso}`, 604800);
  } catch { /* il deposito non risponde: la sessione vale lo stesso, si perde solo l'elenco */ }
  await updateUser(email, { lastLogin: Date.now() });
  return token;
}

export async function getSession(token) {
  if (!token) return null;
  const data = await redis('GET', `session:${token}`);
  if (!data) return null;
  let session; try { session = JSON.parse(data); } catch { return null; }

  // b.110 — la sessione conserva solo { email, created }, ma mezzo
  // programma le chiede il NOME: l'archivio delle conversazioni e
  // scritto sotto `convlist:{nome}` e il controllo "eri fra i
  // partecipanti?" confronta i nomi dei membri. Chi leggeva
  // `session.name` trovava undefined, ripiegava sull'email e cercava
  // una chiave che non esiste: archivio vuoto, e aprire una vecchia
  // conversazione rispondeva "non sei un partecipante".
  //
  // Il nome sta nel profilo. Lo si aggiunge qui, in un posto solo,
  // invece di lasciare che ogni rotta si inventi un ripiego: un
  // ripiego per rotta e anche un buco per rotta, perche il nome
  // arriverebbe dal client e chiunque potrebbe dichiararsi un altro.
  if (session.email && !session.name) {
    try {
      const user = await getUser(session.email);
      if (user?.name) session.name = user.name;
    } catch { /* il nome resta assente: si prosegue con l'email */ }
  }
  return session;
}

export async function deleteSession(token) {
  if (!token) return;
  await redis('DEL', `session:${token}`);
}

// =============================================
// PAYMENT HISTORY
// =============================================

export async function addPaymentRecord(email, payment) {
  const key = `payments:${email.toLowerCase()}`;
  await redis('RPUSH', key, JSON.stringify({ ...payment, timestamp: Date.now() }));
  await redis('LTRIM', key, -100, -1);
  return true;
}

export async function getPaymentHistory(email) {
  const entries = await redis('LRANGE', `payments:${email.toLowerCase()}`, 0, -1);
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map(e => { try { return JSON.parse(e); } catch { return null; } }).filter(Boolean).reverse();
}

// =============================================
// GDPR — DELETE ALL USER DATA
// =============================================

export async function deleteUserData(email, sessionToken) {
  const lowerEmail = email.toLowerCase();
  const deleted = [];

  await redis('DEL', `user:${lowerEmail}`);
  deleted.push('profile');

  if (sessionToken) {
    await redis('DEL', `session:${sessionToken}`);
    deleted.push('session');
  }

  // b.415 — E TUTTE LE ALTRE, non solo quella da cui stai chiedendo.
  const revocate = await revocaTutteLeSessioni(lowerEmail);
  if (revocate) deleted.push(`sessioni-revocate:${revocate}`);

  // b.415 — E CIO CHE STA SU SUPABASE, che prima non veniva toccato:
  // i Compagni, i loro ricordi, i corsi, i compiti, il profilo studente,
  // gli errori di pronuncia, i dispositivi PeepOff. La cancellazione
  // stava tutta in Redis e si fermava li.
  const persistenti = await cancellaDatiPersistenti(lowerEmail);
  deleted.push(...persistenti.cancellati);
  if (persistenti.mancati.length) {
    // Non si dice «cancellato» di cio che non si e riusciti a cancellare.
    deleted.push(`NON-CANCELLATI:${persistenti.mancati.join(',')}`);
  }

  await redis('DEL', `payments:${lowerEmail}`);
  deleted.push('payments');

  await redis('DEL', `authcode:${lowerEmail}`);
  deleted.push('authcodes');

  const refCode = await redis('GET', `ref:email:${lowerEmail}`);
  if (refCode) {
    await redis('DEL', `ref:code:${refCode}`);
    await redis('DEL', `ref:email:${lowerEmail}`);
  }
  await redis('DEL', `ref:used:${lowerEmail}`);
  await redis('DEL', `ref:stats:${lowerEmail}`);
  deleted.push('referrals');

  const lendingCodes = await redis('SMEMBERS', `lender:active:${lowerEmail}`);
  if (lendingCodes && Array.isArray(lendingCodes)) {
    for (const code of lendingCodes) {
      const data = await redis('GET', `lending:${code}`);
      if (data) {
        let lending; try { lending = JSON.parse(data); } catch { continue; }
        lending.status = 'revoked'; lending.revokedAt = Date.now();
        await redis('SET', `lending:${code}`, JSON.stringify(lending), 'EX', 86400);
      }
    }
    await redis('DEL', `lender:active:${lowerEmail}`);
    deleted.push('lending-tokens');
  }

  return { deleted };
}
