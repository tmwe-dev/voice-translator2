import { NextResponse } from 'next/server';
import { redis } from '../../lib/redis.js';
import { runProviderChain, validateTranslation } from '../../lib/providers.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';

// ═══════════════════════════════════════════════
// FREE Translation — Multi-provider with dynamic routing
//
// Uses providers.js registry for language-optimized provider chains:
// - ALL languages → Microsoft → Google (quality-tested)
//
// Security:
// - Rate limited: 30 req/min per IP (Redis-backed)
// - Daily char limit: 50K chars/day per IP (Redis-enforced)
// - CORS restricted to our domain
//
// Modes:
// - standard: try providers in chain order until one succeeds
// - superfast: single fastest provider, no fallback
// - guaranteed: handled by /api/translate-consensus instead
// ═══════════════════════════════════════════════

const FREE_DAILY_LIMIT = 50000;

function getSimpleHash(text) {
  const encoded = Buffer.from(text).toString('base64');
  return encoded.substring(0, 32);
}

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || process.env.NEXT_PUBLIC_URL || 'https://voice-translator2.vercel.app';

function getCorsHeaders(req) {
  const origin = req?.headers?.get?.('origin') || '';
  // Allow our domain + localhost for dev
  const allowed = origin === ALLOWED_ORIGIN
    || origin.startsWith('http://localhost')
    || origin.startsWith('https://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

export async function POST(req) {
  const cors = getCorsHeaders(req);

  try {
    // ── Rate limit: 30 req/min per IP ──
    const rlKey = getRateLimitKey(req, 'free-translate');
    const rl = await checkRateLimit(rlKey, 30, 60000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfterMs: rl.retryAfterMs },
        { status: 429, headers: { ...cors, 'Retry-After': Math.ceil(rl.retryAfterMs / 1000).toString() } }
      );
    }

    const body = await req.json();
    const text = typeof body.text === 'string' ? body.text : '';
    const sourceLang = typeof body.sourceLang === 'string' ? body.sourceLang.slice(0, 10) : '';
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang.slice(0, 10) : '';
    const { userEmail, superfast, userProviderPrefs } = body;
    if (!text?.trim()) return NextResponse.json({ translated: '', charsUsed: 0 }, { headers: cors });

    const trimmed = text.trim().slice(0, 10000); // Cap at 10K chars
    const charsUsed = trimmed.length;

    // ── Enforce daily character limit per IP (Redis-backed) ──
    const ipKey = getRateLimitKey(req, 'free-chars');
    let dailyUsed = 0;
    try {
      const todayKey = `daily:${ipKey}:${new Date().toISOString().split('T')[0]}`;
      const current = await redis('GET', todayKey);
      dailyUsed = parseInt(current || '0');
      if (dailyUsed + charsUsed > FREE_DAILY_LIMIT) {
        return NextResponse.json(
          { error: 'Daily character limit exceeded', dailyUsed, dailyLimit: FREE_DAILY_LIMIT },
          { status: 429, headers: cors }
        );
      }
      // Increment and set TTL to end of day (max 24h)
      await redis('INCRBY', todayKey, charsUsed);
      if (!current) await redis('EXPIRE', todayKey, 86400);
    } catch (e) {
      console.error('Daily limit check error:', e);
      // Fail-open: if Redis fails, allow the request
    }

    // ── Check Redis cache first ──
    const textHash = getSimpleHash(trimmed);
    const cacheKey = `tfc:${sourceLang}:${targetLang}:${textHash}`;
    let cachedResult = null;
    try {
      cachedResult = await redis('GET', cacheKey);
    } catch (e) {
      console.error('Cache lookup error:', e);
    }

    if (cachedResult) {
      const parsed = JSON.parse(cachedResult);
      if (parsed.translated && !parsed.fallback) {
        const validation = validateTranslation(trimmed, parsed.translated, sourceLang, targetLang);
        if (validation.valid) {
          return NextResponse.json({ ...parsed, cached: true, dailyUsed: dailyUsed + charsUsed, dailyLimit: FREE_DAILY_LIMIT }, { headers: cors });
        }
        try { await redis('DEL', cacheKey); } catch {}
      } else if (!parsed.fallback) {
        return NextResponse.json({ ...parsed, cached: true, dailyUsed: dailyUsed + charsUsed, dailyLimit: FREE_DAILY_LIMIT }, { headers: cors });
      }
      // Fallback cached results → retry fresh
    }

    // ── Run provider chain (dynamic, language-optimized) ──
    const result = await runProviderChain(trimmed, sourceLang, targetLang, {
      userEmail,
      superfast: !!superfast,
      userProviderPrefs,
    });

    // ── Build response ──
    const response = {
      translated: result.translated,
      provider: result.provider,
      match: result.match,
      fallback: result.fallback,
      charsUsed,
      dailyUsed: dailyUsed + charsUsed,
      dailyLimit: FREE_DAILY_LIMIT,
      elapsed: result.elapsed,
    };

    // ── Cache results (fire-and-forget — don't block the response) ──
    const cacheTTL = result.fallback ? 1800 : 86400;
    redis('SET', cacheKey, JSON.stringify(response), 'EX', cacheTTL).catch(() => {});

    return NextResponse.json(response, { headers: cors });
  } catch (e) {
    console.error('Free translate error:', e);
    return NextResponse.json(
      { translated: '', fallback: true, error: e.message, charsUsed: 0 },
      { headers: cors }
    );
  }
}
