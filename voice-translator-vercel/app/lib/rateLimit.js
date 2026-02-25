// Simple in-memory rate limiter for API routes
// Uses a Map with automatic cleanup via TTL
// Note: On Vercel serverless, each instance has its own Map,
// so this is per-instance rate limiting (still effective for burst protection)

const rateLimitMap = new Map();

const WINDOW_MS = 60 * 1000; // 1 minute window
const CLEANUP_INTERVAL = 5 * 60 * 1000; // cleanup every 5 min

// Auto-cleanup old entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > WINDOW_MS * 2) {
      rateLimitMap.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Check rate limit for a given key (IP or email)
 * @param {string} key - identifier (IP, email, etc.)
 * @param {number} maxRequests - max requests per window
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function checkRateLimit(key, maxRequests = 30) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.start > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, start: now });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);

  if (entry.count > maxRequests) {
    const retryAfterMs = WINDOW_MS - (now - entry.start);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining, retryAfterMs: 0 };
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
