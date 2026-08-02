import { NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';
import { redis } from '../../../lib/redis.js';
import crypto from 'crypto';

/**
 * Generate a CSRF state token for the OAuth redirect flow.
 * The token is stored in Redis with 10-min TTL AND a hash is set in an
 * HttpOnly cookie. The callback validates: cookie hash + callback param + Redis.
 * This binds the state to the specific browser that initiated the flow.
 */
export async function GET(req) {
  const rl = await checkRateLimit(getRateLimitKey(req, 'oauth-state'), 20);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  const state = crypto.randomBytes(32).toString('hex');
  // Hash the state for the cookie (so cookie value != URL param value)
  const stateHash = crypto.createHash('sha256').update(state).digest('hex');

  await redis('SET', `oauth_state:${state}`, '1', 'EX', 600); // 10 min TTL

  const res = NextResponse.json({ state });
  // Set HttpOnly cookie with the hash — browser sends it back on the callback
  res.cookies.set('oauth_state_hash', stateHash, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth/google-callback',
    maxAge: 600, // 10 min, matches Redis TTL
  });
  return res;
}
