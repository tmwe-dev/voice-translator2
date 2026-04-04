// Redis-backed rate limiter for API routes
// Uses Redis with fixed-window counters for distributed rate limiting
// Works across Vercel serverless instances

import { redis } from './redis.js';

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
      const retryAfterMs = ttl > 0 ? ttl * 1000 : windowMs;
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    return { allowed: true, remaining, retryAfterMs: 0 };
  } catch (error) {
    // Fail-closed: if Redis fails, DENY the request for security
    // This prevents abuse if rate limiter is unavailable
    console.error('Rate limiter error:', error);
    return { allowed: false, remaining: 0, retryAfterMs: 5000 };
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
