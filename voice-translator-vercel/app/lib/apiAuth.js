// Shared 3-tier API authentication middleware
// Pattern: userToken → roomId (bill host) → reject 401
//
// Returns: { apiKey, isOwnKey, billingEmail } or throws a Response

import { NextResponse } from 'next/server';
import { getSession, getUser, validateLending } from './users.js';
import { getRoom } from './store.js';
import { ERRORS, DAILY_LIMITS } from './config.js';
import { redis } from './redis.js';

/**
 * Resolve API key and billing for a paid API route.
 *
 * @param {Object} opts
 * @param {string} opts.userToken - session token (authenticated user)
 * @param {string} opts.roomId - room ID (guest billing to host)
 * @param {string} opts.provider - 'openai' or 'elevenlabs'
 * @param {number} opts.minCredits - minimum credits required (euro-cents)
 * @param {boolean} opts.skipCreditCheck - skip credit check (e.g. for review passes)
 * @param {string} opts.requiredHostTier - minimum host tier for guest access (default: any non-FREE)
 *
 * @returns {{ apiKey: string, isOwnKey: boolean, billingEmail: string|null }}
 * @throws {NextResponse} 401/402 on auth or credit failure
 */
export async function resolveAuth({
  userToken,
  roomId,
  lendingCode = null,
  provider = 'openai',
  minCredits = 0.1,
  skipCreditCheck = false,
  requiredHostTier = null, // null = any non-FREE tier
}) {
  const envKeys = {
    openai: process.env.OPENAI_API_KEY,
    elevenlabs: process.env.ELEVENLABS_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };
  const defaultKey = envKeys[provider] || process.env.OPENAI_API_KEY;

  // ── DEV_MODE: bypass ALL auth, use platform keys, no billing ──
  // Security: DEV_MODE is NOT allowed in production environments
  if (process.env.DEV_MODE === 'true') {
    if (process.env.VERCEL_ENV === 'production') {
      console.error('[SECURITY] DEV_MODE cannot be enabled in production!');
      // Don't bypass auth in production - proceed with normal auth checks
    } else {
      // DEV_MODE allowed in preview/development
      return {
        apiKey: defaultKey,
        isOwnKey: false,
        billingEmail: null,
        isLending: false,
        lendingCodeUsed: null,
      };
    }
  }

  let apiKey = defaultKey;
  let isOwnKey = false;
  let billingEmail = null;
  let isLending = false;
  let lendingCodeUsed = null;

  if (userToken) {
    // Path 1: Authenticated user (host or user with own account)
    const session = await getSession(userToken);
    if (session) {
      billingEmail = session.email;
      const user = await getUser(billingEmail);
      if (user) {
        const ownKey = user.useOwnKeys && user.apiKeys?.[provider];
        if (ownKey) {
          apiKey = ownKey;
          isOwnKey = true;
        } else {
          // Fallback: check encrypted key vault
          if (!ownKey && user.useOwnKeys) {
            try {
              const { getDecryptedKey } = await import('./keyVault.js');
              const vaultKey = await getDecryptedKey(billingEmail, provider);
              if (vaultKey) {
                apiKey = vaultKey;
                isOwnKey = true;
              }
            } catch (e) {
              console.error('[Auth] KeyVault fallback error:', e);
            }
          }
        }
        // Check credits for platform users
        if (!isOwnKey && !user.useOwnKeys && !skipCreditCheck && user.credits < minCredits) {
          throw NextResponse.json({ error: ERRORS.NO_CREDITS }, { status: 402 });
        }
      }
    }
  } else if (lendingCode) {
    // Path 2: Lending token — bill to lender, use their keys
    const lending = await validateLending(lendingCode);
    if (!lending) {
      throw NextResponse.json({ error: 'Invalid or expired lending token' }, { status: 401 });
    }
    billingEmail = lending.lenderEmail;
    isLending = true;
    lendingCodeUsed = lendingCode;
    const lenderUser = await getUser(lending.lenderEmail);
    if (lenderUser) {
      const ownKey = lenderUser.useOwnKeys && lenderUser.apiKeys?.[provider];
      if (ownKey) {
        apiKey = ownKey;
        isOwnKey = true;
      } else {
        // Fallback: check encrypted key vault
        if (!ownKey && lenderUser.useOwnKeys) {
          try {
            const { getDecryptedKey } = await import('./keyVault.js');
            const vaultKey = await getDecryptedKey(billingEmail, provider);
            if (vaultKey) {
              apiKey = vaultKey;
              isOwnKey = true;
            }
          } catch (e) {
            console.error('[Auth] KeyVault fallback error:', e);
          }
        }
      }
      // Check credits for lender
      if (!isOwnKey && !lenderUser.useOwnKeys && !skipCreditCheck && lenderUser.credits < minCredits) {
        throw NextResponse.json({ error: 'Lender has insufficient credits' }, { status: 402 });
      }
    }
  } else if (roomId) {
    // Path 3: Guest in a room - bill to host
    const room = await getRoom(roomId);
    if (!room) {
      throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    // Check host tier requirement
    if (requiredHostTier) {
      if (room.hostTier !== requiredHostTier) {
        throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
      }
    } else {
      // Require non-FREE tier for guest access
      if (room.hostTier === 'FREE') {
        throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
      }
    }

    if (room.hostEmail) {
      billingEmail = room.hostEmail;
      const hostUser = await getUser(billingEmail);
      if (hostUser) {
        const ownKey = hostUser.useOwnKeys && hostUser.apiKeys?.[provider];
        if (ownKey) {
          apiKey = ownKey;
          isOwnKey = true;
        } else {
          // Fallback: check encrypted key vault
          if (!ownKey && hostUser.useOwnKeys) {
            try {
              const { getDecryptedKey } = await import('./keyVault.js');
              const vaultKey = await getDecryptedKey(billingEmail, provider);
              if (vaultKey) {
                apiKey = vaultKey;
                isOwnKey = true;
              }
            } catch (e) {
              console.error('[Auth] KeyVault fallback error:', e);
            }
          }
        }
        // Check credits for host
        if (!isOwnKey && !hostUser.useOwnKeys && !skipCreditCheck && hostUser.credits < minCredits) {
          throw NextResponse.json({ error: ERRORS.HOST_NO_CREDITS }, { status: 402 });
        }
      }
    }
  } else {
    // Path 4: No token, no room — FREE ACCESS MODE
    // All features are free and open. Use platform keys, no billing.
    return {
      apiKey: defaultKey,
      isOwnKey: false,
      billingEmail: null,
      isLending: false,
      lendingCodeUsed: null,
    };
  }

  // For ElevenLabs, ensure we have a key
  if (provider === 'elevenlabs' && !apiKey) {
    throw NextResponse.json({ error: 'No ElevenLabs API key configured' }, { status: 400 });
  }

  // Check daily spending limits (only for platform credits, not own keys)
  if (billingEmail && !isOwnKey && !skipCreditCheck) {
    try {
      const todayUTC = new Date().toISOString().split('T')[0];
      const dailyKey = `daily:${billingEmail}:${todayUTC}`;
      const dailySpent = parseInt(await redis('GET', dailyKey) || '0');

      if (DAILY_LIMITS.PER_USER > 0 && dailySpent >= DAILY_LIMITS.PER_USER) {
        throw NextResponse.json({ error: ERRORS.DAILY_LIMIT }, { status: 429 });
      }

      // Check platform total daily spend
      const platformDailyKey = `daily:platform:${todayUTC}`;
      const platformSpent = parseInt(await redis('GET', platformDailyKey) || '0');
      if (DAILY_LIMITS.PLATFORM_TOTAL > 0 && platformSpent >= DAILY_LIMITS.PLATFORM_TOTAL) {
        throw NextResponse.json({ error: ERRORS.PLATFORM_LIMIT }, { status: 503 });
      }
    } catch (e) {
      // If it's a NextResponse (our own error), re-throw it
      if (e instanceof Response || e?.status) throw e;
      // Otherwise log and continue (fail-open for Redis errors)
      console.error('Daily limit check error:', e);
    }
  }

  return { apiKey, isOwnKey, billingEmail, isLending, lendingCodeUsed };
}

/**
 * Track daily spending after a successful API call
 * Call this after deducting credits
 */
export async function trackDailySpend(email, amountCents) {
  if (!email || amountCents <= 0) return;
  try {
    const todayUTC = new Date().toISOString().split('T')[0];

    // Track per-user daily spend
    const dailyKey = `daily:${email}:${todayUTC}`;
    const newAmount = await redis('INCRBY', dailyKey, Math.ceil(amountCents));
    if (newAmount === Math.ceil(amountCents)) {
      await redis('EXPIRE', dailyKey, 90000); // ~25 hours TTL
    }

    // Track platform total daily spend
    const platformKey = `daily:platform:${todayUTC}`;
    const platformAmount = await redis('INCRBY', platformKey, Math.ceil(amountCents));
    if (platformAmount === Math.ceil(amountCents)) {
      await redis('EXPIRE', platformKey, 90000);
    }
  } catch (e) {
    console.error('Daily spend tracking error:', e);
  }
}
