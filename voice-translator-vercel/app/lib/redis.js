// Shared Upstash Redis REST client
// Single source of truth - used by store.js and users.js
// Now with: circuit breaker, timeout, in-memory fallback

import { apiCircuitBreaker } from './circuitBreaker.js';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — Redis calls will use fallback cache only');
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
  const circuitKey = 'redis:upstash';

  try {
    return await apiCircuitBreaker.execute(circuitKey, async () => {
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
    // Fallback: for GET commands, try in-memory cache
    if (command === 'GET' && args[0]) {
      const cached = fallbackGet(args[0]);
      if (cached !== undefined) {
        console.warn(`[Redis] Using fallback cache for ${args[0]}`);
        return cached;
      }
    }
    // For SET commands, cache locally so subsequent GETs work
    if (command === 'SET' && args[0] && args[1]) {
      fallbackSet(args[0], args[1]);
    }
    // For INCR (rate limiting), fail-closed to prevent abuse
    if (command === 'INCR') {
      console.warn(`[Redis] Fail-closed for INCR ${args[0]}`);
      return 9999; // Return high count to trigger rate limit check failure
    }

    throw err;
  }
}
