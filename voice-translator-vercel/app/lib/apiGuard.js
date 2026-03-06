import { checkRateLimit, getRateLimitKey } from './rateLimit.js';
import { NextResponse } from 'next/server';

const MAX_BODY_SIZE = 256 * 1024; // 256KB

/**
 * Universal API guard — rate limiting + body size check
 * Wraps a route handler with security checks
 *
 * @param {Function} handler - async (req) => NextResponse
 * @param {Object} opts
 * @param {number} opts.maxRequests - max requests per minute (default: 60)
 * @param {string} opts.prefix - rate limit key prefix
 * @param {number} opts.maxBodySize - max body size in bytes (default: 256KB)
 * @param {boolean} opts.skipBodyCheck - skip body size check (e.g. for GET-only)
 */
export function withApiGuard(handler, opts = {}) {
  const {
    maxRequests = 60,
    prefix = 'api',
    maxBodySize = MAX_BODY_SIZE,
    skipBodyCheck = false,
  } = opts;

  return async function guardedHandler(req) {
    // 1. Rate limiting
    const key = getRateLimitKey(req, prefix);
    const rl = await checkRateLimit(key, maxRequests);

    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // 2. Body size check (for POST/PUT/PATCH)
    if (!skipBodyCheck && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentLength = req.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > maxBodySize) {
        return NextResponse.json(
          { error: `Request body too large. Maximum size is ${Math.round(maxBodySize / 1024)}KB.` },
          { status: 413 }
        );
      }
    }

    // 3. Call the actual handler
    const response = await handler(req);

    // 4. Add rate limit headers to response
    if (response?.headers) {
      response.headers.set('X-RateLimit-Limit', String(maxRequests));
      response.headers.set('X-RateLimit-Remaining', String(rl.remaining));
    }

    return response;
  };
}
