import { checkRateLimit, getRateLimitKey } from './rateLimit.js';
import { NextResponse } from 'next/server';

const MAX_BODY_SIZE = 256 * 1024; // 256KB

/**
 * Extract user email from token in request body or Authorization header.
 * Used for per-user rate limiting (stricter/looser limits by tier).
 * Returns null if no user can be identified.
 */
function extractUserKey(req) {
  try {
    // Try Authorization header first (least invasive — doesn't consume body)
    const auth = req.headers.get('authorization');
    if (auth) {
      // Use a hash of the token as key (don't store raw tokens in Redis)
      const token = auth.replace('Bearer ', '');
      if (token && token.length > 10) {
        // Simple fast hash: take first 8 + last 4 chars as fingerprint
        return `usr:${token.substring(0, 8)}${token.substring(token.length - 4)}`;
      }
    }
  } catch {}
  return null;
}

/**
 * Universal API guard — dual rate limiting (IP + user) + body size check
 * Wraps a route handler with security checks
 *
 * Rate limiting strategy:
 *  - IP-based: catches abuse from a single IP (default: 60/min)
 *  - User-based: prevents token abuse across IPs (default: 120/min, more generous)
 *  - Both must pass for the request to proceed
 *
 * @param {Function} handler - async (req) => NextResponse
 * @param {Object} opts
 * @param {number} opts.maxRequests - max requests per minute per IP (default: 60)
 * @param {number} opts.maxUserRequests - max requests per minute per user (default: 120)
 * @param {string} opts.prefix - rate limit key prefix
 * @param {number} opts.maxBodySize - max body size in bytes (default: 256KB)
 * @param {boolean} opts.skipBodyCheck - skip body size check (e.g. for GET-only)
 */
export function withApiGuard(handler, opts = {}) {
  const {
    maxRequests = 60,
    maxUserRequests = 120,
    prefix = 'api',
    maxBodySize = MAX_BODY_SIZE,
    skipBodyCheck = false,
  } = opts;

  return async function guardedHandler(req) {
    // 1. IP-based rate limiting
    const ipKey = getRateLimitKey(req, prefix);
    const ipRl = await checkRateLimit(ipKey, maxRequests);

    if (!ipRl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(ipRl.retryAfterMs / 1000)),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // 2. Per-user rate limiting (if identifiable)
    const userKey = extractUserKey(req);
    let userRl = { allowed: true, remaining: maxUserRequests };
    if (userKey) {
      userRl = await checkRateLimit(`${prefix}:${userKey}`, maxUserRequests);
      if (!userRl.allowed) {
        return NextResponse.json(
          { error: 'User rate limit exceeded. Please slow down.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(userRl.retryAfterMs / 1000)),
              'X-RateLimit-Limit': String(maxUserRequests),
              'X-RateLimit-Remaining': '0',
            }
          }
        );
      }
    }

    // 3. Body size check (for POST/PUT/PATCH)
    if (!skipBodyCheck && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentLength = req.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > maxBodySize) {
        return NextResponse.json(
          { error: `Request body too large. Maximum size is ${Math.round(maxBodySize / 1024)}KB.` },
          { status: 413 }
        );
      }
    }

    // 4. Call the actual handler
    const response = await handler(req);

    // 5. Add rate limit headers to response (use the more restrictive remaining count)
    if (response?.headers) {
      const effectiveRemaining = Math.min(ipRl.remaining, userRl.remaining);
      response.headers.set('X-RateLimit-Limit', String(maxRequests));
      response.headers.set('X-RateLimit-Remaining', String(effectiveRemaining));
    }

    return response;
  };
}
