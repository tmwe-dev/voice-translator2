// Redis-backed rate limiter for API routes
// Uses Redis with fixed-window counters for distributed rate limiting
// Works across Vercel serverless instances

import { redis } from './redis.js';
import { createLogger } from './logger.js';
const log = createLogger('rateLimit');

const WINDOW_MS = 60 * 1000; // 1 minute window (default)

/**
 * Check rate limit for a given key using Redis
 * Uses a fixed-window counter approach with INCR and EXPIRE
 * @param {string} key - identifier (IP, email, etc.)
 * @param {number} maxRequests - max requests per window (default: 30)
 * @param {number} windowMs - window duration in milliseconds (default: 60000)
 * @returns {Promise<{ allowed: boolean, remaining: number, retryAfterMs: number }>}
 */
export async function checkRateLimit(key, maxRequests = 30, windowMs = WINDOW_MS) {
  try {
    const redisKey = `rl:${key}`;

    // Increment counter (returns the new count)
    const count = await redis('INCR', redisKey);

    // Set TTL on first request in the window
    if (count === 1) {
      await redis('EXPIRE', redisKey, Math.ceil(windowMs / 1000));
    }

    const remaining = Math.max(0, maxRequests - count);

    if (count > maxRequests) {
      // Get TTL to calculate retry-after
      const ttl = await redis('TTL', redisKey);

      // b.590 — autoguarigione contatore senza scadenza.
      //
      // Trovato dal vivo il 1/9: /api/mondo/avvisi restava al 100% di
      // 429 anche con UN solo utente al minuto contro un limite di 120,
      // e anche da un IP mai visto prima (curl da un Mac che non aveva
      // mai chiamato questa rotta). Con un tetto cosi alto e cosi poco
      // traffico, un fixed-window che funziona non puo mai bloccare.
      //
      // La causa: `count === 1` e' l'unico punto che imposta EXPIRE. Se
      // quella singola scrittura non arriva a segno (il processo
      // serverless viene tagliato fra INCR e EXPIRE, un timeout verso
      // Upstash, o una chiave nata prima che questo controllo esistesse)
      // la chiave resta SENZA scadenza: continua a salire per sempre e
      // ogni richiesta successiva, di chiunque arrivi con la stessa
      // chiave, trova il tetto gia' superato. Non e' un problema di
      // troppe chiamate: e' un contatore rotto che non si azzera piu'.
      //
      // Qui non aspetto un altro giro di finestra: se la trovo senza
      // scadenza (ttl < 0), gliene do una adesso e lascio passare QUESTA
      // richiesta — non e' colpa sua se il contatore era gia' rotto.
      if (ttl < 0) {
        await redis('EXPIRE', redisKey, Math.ceil(windowMs / 1000));
        log.warn('Contatore senza scadenza riparato', { key: redisKey });
        return { allowed: true, remaining: 0, retryAfterMs: 0 };
      }

      const retryAfterMs = ttl > 0 ? ttl * 1000 : windowMs;
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    return { allowed: true, remaining, retryAfterMs: 0 };
  } catch (error) {
    // Fail-open: if Redis fails, ALLOW the request
    // Better to serve users than block everyone when Redis is down
    log.warn('Redis error, fail-open:', error?.message);
    return { allowed: true, remaining: maxRequests, retryAfterMs: 0 };
  }
}

/**
 * Get a rate limit key from the request
 * Uses X-Forwarded-For header (Vercel) or falls back to a generic key
 */
export function getRateLimitKey(req, prefix = '') {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `${prefix}:${ip}`;
}
