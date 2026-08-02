import { NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';
import { redis } from '../../../lib/redis.js';
import crypto from 'crypto';

/**
 * Generate a CSRF state token for the OAuth redirect flow.
 * The token is stored in Redis with 10-min TTL and returned to the frontend,
 * which includes it in the Google OAuth URL. The callback route then validates it.
 */
export async function GET(req) {
  const rl = await checkRateLimit(getRateLimitKey(req, 'oauth-state'), 20);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  const state = crypto.randomBytes(32).toString('hex');
  await redis('SET', `oauth_state:${state}`, '1', 'EX', 600); // 10 min TTL
  return NextResponse.json({ state });
}
