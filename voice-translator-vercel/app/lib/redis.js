// Shared Upstash Redis REST client
// Single source of truth - used by store.js and users.js
// Now with: circuit breaker, timeout, in-memory fallback

import { createLogger } from './logger.js';
import { redisCircuitBreaker } from './circuitBreaker.js';

const log = createLogger('redis');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  log.error('UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — Redis calls will use fallback cache only');
}

const REDIS_TIMEOUT_MS = 3000; // 3s max for Redis calls

// In-memory fallback cache when Redis is down (LRU, max 500 entries, 60s TTL)
const _fallbackCache = new Map();
const FALLBACK_MAX = 500;
const FALLBACK_TTL = 60000;

function fallbackGet(key) {
  const entry = _fallbackCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > FALLBACK_TTL) {
    _fallbackCache.delete(key);
    return undefined;
  }
  // Re-insert to move to end (true LRU — oldest = first)
  _fallbackCache.delete(key);
  _fallbackCache.set(key, entry);
  return entry.val;
}

function fallbackSet(key, val) {
  if (_fallbackCache.size >= FALLBACK_MAX) {
    // Delete oldest entry
    const first = _fallbackCache.keys().next().value;
    _fallbackCache.delete(first);
  }
  _fallbackCache.set(key, { val, ts: Date.now() });
}

/**
 * Execute a Redis command with circuit breaker and timeout.
 * Falls back to in-memory cache for GET/SET when Redis is unavailable.
 */
export async function redis(command, ...args) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    // No Redis configured — use fallback cache only
    if (command === 'GET' && args[0]) return fallbackGet(args[0]);
    if (command === 'SET' && args[0]) { fallbackSet(args[0], args[1]); return 'OK'; }
    return null;
  }
  // b.566 — quali comandi sono letture, e cosa vale «niente» per ognuno.
// Una lista vuota non e' un errore; `undefined` invece si propaga e
// rompe piu in la, dove nessuno se lo aspetta.
const LETTURE = new Set(['LRANGE', 'HGETALL', 'HGET', 'HMGET', 'MGET', 'ZRANGE', 'ZREVRANGE',
  'SMEMBERS', 'KEYS', 'SCAN', 'EXISTS', 'LLEN', 'ZCARD', 'SCARD', 'ZSCORE', 'HKEYS', 'HLEN']);
const VUOTO = {
  LRANGE: [], ZRANGE: [], ZREVRANGE: [], SMEMBERS: [], KEYS: [], HKEYS: [], MGET: [], HMGET: [],
  HGETALL: {}, EXISTS: 0, LLEN: 0, ZCARD: 0, SCARD: 0, HLEN: 0,
};

const circuitKey = 'redis:upstash';

  try {
    return await redisCircuitBreaker.execute(circuitKey, async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS);

      try {
        const res = await fetch(`${UPSTASH_URL}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([command, ...args]),
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Cache successful GET results for fallback
        if (command === 'GET' && args[0]) {
          fallbackSet(args[0], data.result);
        }

        return data.result;
      } finally {
        clearTimeout(timer);
      }
    });
  } catch (err) {
    // Fallback: for GET commands, try in-memory cache; return null if not found (don't crash)
    if (command === 'GET') {
      if (args[0]) {
        const cached = fallbackGet(args[0]);
        if (cached !== undefined) {
          log.warn(`Using fallback cache for ${args[0]}`);
          return cached;
        }
      }
      log.warn(`Fail-open for GET ${args[0]} (no cache)`);
      return null;
    }
    // For SET commands, cache locally and return OK so app keeps working
    if (command === 'SET' && args[0] && args[1]) {
      log.warn(`Fail-open for SET ${args[0]}`);
      fallbackSet(args[0], args[1]);
      return 'OK';
    }
    // For INCR (rate limiting), fail-open so app keeps working
    if (command === 'INCR') {
      log.warn(`Fail-open for INCR ${args[0]}`);
      return 1; // Return low count so rate limit passes
    }
    // For EXPIRE and TTL, fail-open with safe defaults
    if (command === 'EXPIRE') return 1;
    if (command === 'TTL') return -1;

    // ═══ b.566 — LE LETTURE NON DEVONO MAI FAR CADERE UNA PAGINA ═══
    // Il fail-open c'era per GET, SET, INCR, EXPIRE e TTL — ma le
    // stanze e i messaggi vivono su LISTE e HASH, e per quelle si
    // rilanciava. Risultato, dai registri: tutti i 500 di /api/room,
    // /api/messages e /api/reazioni erano questo. Un rallentamento di
    // Upstash diventava una schermata rotta.
    // Adesso una lettura che non riesce torna VUOTA nel tipo giusto:
    // «adesso non ho niente da darti» e' una risposta, «errore del
    // server» no. Chi chiama mostra cio che ha e riprova fra un attimo.
    if (LETTURE.has(command)) {
      log.warn(`Fail-open in lettura per ${command} ${args[0] || ''}`);
      return VUOTO[command] !== undefined ? VUOTO[command] : null;
    }

    // Le SCRITTURE no: fingere che un messaggio sia stato salvato
    // quando non lo e' e' peggio di un errore. Si rilancia, ma
    // l'errore porta con se il suo motivo (`CIRCUIT_OPEN`), cosi
    // apiGuard risponde «riprova fra poco» (503) invece di «guasto del
    // server» (500) — vedi apiGuard.js.
    throw err;
  }
}
