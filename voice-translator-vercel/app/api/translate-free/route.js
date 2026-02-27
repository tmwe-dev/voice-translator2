import { NextResponse } from 'next/server';
import { redis } from '../../lib/redis.js';
import { runProviderChain, validateTranslation } from '../../lib/providers.js';

// ═══════════════════════════════════════════════
// FREE Translation — Multi-provider with dynamic routing
//
// Uses providers.js registry for language-optimized provider chains:
// - CJK/Thai/Vietnamese → Google → Microsoft → MyMemory
// - Arabic/Hindi/Russian/Turkish → Microsoft → Google → MyMemory
// - European → Google → Microsoft → MyMemory
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req) {
  try {
    const { text, sourceLang, targetLang, userEmail, superfast, userProviderPrefs } = await req.json();
    if (!text?.trim()) return NextResponse.json({ translated: '', charsUsed: 0 }, { headers: CORS_HEADERS });

    const trimmed = text.trim();
    const charsUsed = trimmed.length;

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
          return NextResponse.json({ ...parsed, cached: true }, { headers: CORS_HEADERS });
        }
        try { await redis('DEL', cacheKey); } catch {}
      } else if (!parsed.fallback) {
        return NextResponse.json({ ...parsed, cached: true }, { headers: CORS_HEADERS });
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
      dailyLimit: FREE_DAILY_LIMIT,
      elapsed: result.elapsed,
    };

    // ── Cache successful results ──
    if (!result.fallback) {
      const cacheTtl = result.provider === 'mymemory' ? 3600 : 86400;
      try {
        await redis('SET', cacheKey, JSON.stringify(response), 'EX', cacheTtl);
      } catch (e) {
        console.error('Cache store error:', e);
      }
    } else {
      // Cache failures briefly to avoid hammering providers
      try {
        await redis('SET', cacheKey, JSON.stringify(response), 'EX', 1800);
      } catch {}
    }

    return NextResponse.json(response, { headers: CORS_HEADERS });
  } catch (e) {
    console.error('Free translate error:', e);
    return NextResponse.json(
      { translated: '', fallback: true, error: e.message, charsUsed: 0 },
      { headers: CORS_HEADERS }
    );
  }
}
