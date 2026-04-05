import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { redis } from '../../lib/redis.js';
import { tryProvider, getProviderChain, validateTranslation, scoreTranslation } from '../../lib/providers.js';
import { findConsensus } from '../../lib/consensus.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';

// ═══════════════════════════════════════════════
// Consensus Translation — "Guaranteed" mode
//
// Calls top providers for the target language in parallel,
// compares results using Levenshtein similarity.
// If 2 agree → "guaranteed" translation
//
// Security: rate limited 20 req/min, CORS restricted
// ═══════════════════════════════════════════════

function getSimpleHash(text) {
  const encoded = Buffer.from(text).toString('base64');
  return encoded.substring(0, 32);
}

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || process.env.NEXT_PUBLIC_URL || 'https://voice-translator2.vercel.app';

function getCorsHeaders(req) {
  const origin = req?.headers?.get?.('origin') || '';
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

async function handlePost(req) {
  const cors = getCorsHeaders(req);

  try {

    const { text, sourceLang, targetLang, userEmail, threshold } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ translated: '', guaranteed: false }, { headers: cors });
    }

    const trimmed = text.trim();
    const charsUsed = trimmed.length;

    // ── Check cache first ──
    const textHash = getSimpleHash(trimmed);
    const cacheKey = `tcc:${sourceLang}:${targetLang}:${textHash}`;
    try {
      const cached = await redis('GET', cacheKey);
      if (cached) {
        let parsed; try { parsed = JSON.parse(cached); } catch { parsed = null; }
        if (parsed && parsed.translated && parsed.guaranteed) {
          return NextResponse.json({ ...parsed, cached: true }, { headers: cors });
        }
      }
    } catch (e) { console.warn('[translate-consensus] Cache JSON parse error:', e?.message); }

    // ── Get top 3 providers for this language ──
    const chain = getProviderChain(targetLang);
    const top3 = chain.slice(0, 3);

    // ── Call all 3 in parallel ──
    const results = await Promise.allSettled(
      top3.map(id => tryProvider(id, trimmed, sourceLang, targetLang, userEmail))
    );

    // ── Validate and score results ──
    const validResults = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') {
        const r = results[i].value;
        if (r.text) {
          const validation = validateTranslation(trimmed, r.text, sourceLang, targetLang);
          const scoring = scoreTranslation(trimmed, r.text, sourceLang, targetLang, r.provider);
          if (validation.valid) {
            validResults.push({
              text: r.text,
              provider: r.provider,
              score: scoring.score,
              elapsed: r.elapsed,
            });
          }
        }
      }
    }

    // ── Find consensus ──
    const consensus = findConsensus(validResults, threshold || 0.75);

    const response = {
      translated: consensus.text || trimmed,
      guaranteed: consensus.guaranteed,
      confidence: consensus.confidence,
      providers: consensus.agreedProviders,
      provider: 'consensus',
      charsUsed,
      fallback: !consensus.text,
    };

    // ── Cache guaranteed results for 24h ──
    if (consensus.guaranteed) {
      try {
        await redis('SET', cacheKey, JSON.stringify(response), 'EX', 86400);
      } catch (e) { console.warn('[translate-consensus] Cache set failed:', e?.message); }
    }

    return NextResponse.json(response, { headers: cors });
  } catch (e) {
    console.error('Consensus translate error:', e);
    return NextResponse.json(
      { translated: '', guaranteed: false, error: e.message },
      { headers: cors }
    );
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'translate-consensus' });
