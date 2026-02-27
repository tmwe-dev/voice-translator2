import { NextResponse } from 'next/server';
import { redis } from '../../lib/redis.js';

// ═══════════════════════════════════════════════
// FREE Translation — Multi-provider with quality validation
//
// Strategy (in order of preference):
// 1. Redis cache → instant, best latency
// 2. Google Translate → best quality, especially for Asian languages
// 3. MyMemory API → good for European language pairs
// 4. LibreTranslate → fallback for when both above fail
//
// Quality gates:
// - Script validation (e.g., Thai output must contain Thai chars)
// - Match score threshold (MyMemory confidence)
// - Length ratio sanity check
// - Garbage detection (all caps, warnings, etc.)
// ═══════════════════════════════════════════════

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const FREE_DAILY_LIMIT = 50000;

// Unicode script ranges for validation
const SCRIPT_RANGES = {
  'th': /[\u0E00-\u0E7F]/,      // Thai
  'zh': /[\u4E00-\u9FFF]/,      // CJK Unified
  'ja': /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/, // Hiragana + Katakana + CJK
  'ko': /[\uAC00-\uD7AF\u1100-\u11FF]/, // Hangul
  'ar': /[\u0600-\u06FF]/,      // Arabic
  'hi': /[\u0900-\u097F]/,      // Devanagari
  'ru': /[\u0400-\u04FF]/,      // Cyrillic
  'el': /[\u0370-\u03FF]/,      // Greek
};

// Languages that use Latin script (don't need script validation)
const LATIN_LANGS = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'sv',
  'tr', 'vi', 'id', 'ms', 'cs', 'ro', 'hu', 'fi']);

function getSimpleHash(text) {
  const encoded = Buffer.from(text).toString('base64');
  return encoded.substring(0, 32);
}

// Validate that the translation is in the correct script/language
function validateTranslation(original, translated, sourceLang, targetLang) {
  if (!translated || !translated.trim()) return { valid: false, reason: 'empty' };

  const t = translated.trim();
  const o = original.trim();

  // Check for garbage responses
  if (t === o.toUpperCase()) return { valid: false, reason: 'uppercase_echo' };
  if (t.includes('MYMEMORY WARNING')) return { valid: false, reason: 'mymemory_warning' };
  if (t.includes('PLEASE SELECT')) return { valid: false, reason: 'mymemory_error' };
  if (t.includes('NO QUERY SPECIFIED')) return { valid: false, reason: 'mymemory_error' };

  // Length ratio sanity check — translations shouldn't be wildly different in length
  // Allow wider ratio for CJK/Thai (very different character density)
  const ratio = t.length / Math.max(o.length, 1);
  if (ratio > 5 || ratio < 0.1) return { valid: false, reason: 'length_ratio' };

  // Script validation: if target language has specific script, check output contains it
  if (!LATIN_LANGS.has(targetLang) && SCRIPT_RANGES[targetLang]) {
    const hasCorrectScript = SCRIPT_RANGES[targetLang].test(t);
    if (!hasCorrectScript) {
      // Translation doesn't contain any characters from the target script
      return { valid: false, reason: 'wrong_script' };
    }
  }

  // If source and target are the same language, that's suspicious
  // (unless it's a very short text that doesn't need translation)
  if (sourceLang === targetLang) return { valid: true, reason: 'same_lang' };

  // If translated text is identical to original (and they're different languages)
  // it might be a failed translation
  if (t.toLowerCase() === o.toLowerCase() && sourceLang !== targetLang) {
    return { valid: false, reason: 'identical_to_original' };
  }

  return { valid: true, reason: 'ok' };
}

// ═══════════════════════════════════════════════
// FASE 9: Google Translate (free, unofficial API)
// Much better quality than MyMemory for Asian languages
// ═══════════════════════════════════════════════
async function tryGoogleTranslate(text, sourceLang, targetLang) {
  try {
    // Google Translate unofficial API — no key needed, rate limited
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Response format: [[["translated text","original text",null,null,10]],null,"en"]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map(seg => seg[0]).join('');
      return translated?.trim() || null;
    }
    return null;
  } catch (e) {
    console.error('[GoogleTranslate] Error:', e.message);
    return null;
  }
}

// Try LibreTranslate as fallback
async function tryLibreTranslate(text, sourceLang, targetLang) {
  // Public LibreTranslate instances (community-maintained)
  const LIBRE_URLS = [
    'https://libretranslate.com/translate',
    'https://translate.terraprint.co/translate',
  ];

  for (const baseUrl of LIBRE_URLS) {
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text'
        }),
        signal: AbortSignal.timeout(5000) // 5s timeout
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translatedText && data.translatedText.trim()) {
          return data.translatedText.trim();
        }
      }
    } catch (e) {
      // Try next instance
      continue;
    }
  }
  return null;
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
    const { text, sourceLang, targetLang, userEmail } = await req.json();
    if (!text?.trim()) return NextResponse.json({ translated: '', charsUsed: 0 }, { headers: CORS_HEADERS });

    const trimmed = text.trim();
    const charsUsed = trimmed.length;

    const myMemoryEmail = (userEmail && userEmail.includes('@'))
      ? userEmail
      : 'voicetranslator@app.com';

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
      // Re-validate cached results (they might have been bad)
      if (parsed.translated && !parsed.fallback) {
        const validation = validateTranslation(trimmed, parsed.translated, sourceLang, targetLang);
        if (validation.valid) {
          return NextResponse.json({ ...parsed, cached: true }, { headers: CORS_HEADERS });
        }
        // Cached result is invalid — delete it and re-translate
        try { await redis('DEL', cacheKey); } catch {}
      } else if (parsed.fallback) {
        // Don't serve cached fallback results — retry
      } else {
        return NextResponse.json({ ...parsed, cached: true }, { headers: CORS_HEADERS });
      }
    }

    // ═══════════════════════════════════════════════
    // FASE 9: Provider chain (in priority order):
    // 1. Google Translate — best quality, especially for Asian languages
    // 2. MyMemory API — good for European pairs with high match score
    // 3. LibreTranslate — fallback for when both above fail
    // ═══════════════════════════════════════════════
    let finalTranslated = null;
    let provider = 'unknown';
    let myMemoryMatch = 0;

    // ── 1. Try Google Translate first (best quality for free) ──
    const googleResult = await tryGoogleTranslate(trimmed, sourceLang, targetLang);
    if (googleResult) {
      const validation = validateTranslation(trimmed, googleResult, sourceLang, targetLang);
      if (validation.valid) {
        finalTranslated = googleResult;
        provider = 'google';
      } else {
        console.log(`[GoogleTranslate] Rejected: reason=${validation.reason}, text="${trimmed.substring(0, 50)}"`);
      }
    }

    // ── 2. Try MyMemory if Google failed ──
    if (!finalTranslated) {
      try {
        const langpair = `${sourceLang}|${targetLang}`;
        const url = `${MYMEMORY_URL}?q=${encodeURIComponent(trimmed)}&langpair=${langpair}&de=${encodeURIComponent(myMemoryEmail)}`;

        const res = await fetch(url, {
          headers: { 'User-Agent': 'VoiceTranslator/2.0' },
          signal: AbortSignal.timeout(4000)
        });

        if (res.ok) {
          const data = await res.json();

          if (data.responseStatus === 429 ||
              (data.responseData?.translatedText || '').includes('MYMEMORY WARNING')) {
            // MyMemory rate limited — not a global limit, continue to LibreTranslate
          } else {
            const myMemoryResult = data.responseData?.translatedText || '';
            myMemoryMatch = data.responseData?.match || 0;

            if (myMemoryResult) {
              const validation = validateTranslation(trimmed, myMemoryResult, sourceLang, targetLang);
              if (validation.valid && myMemoryMatch >= 0.5) {
                finalTranslated = myMemoryResult.trim();
                provider = 'mymemory';
              } else if (validation.valid && myMemoryMatch >= 0.3) {
                finalTranslated = myMemoryResult.trim();
                provider = 'mymemory-low';
              } else {
                console.log(`[MyMemory] Rejected: match=${myMemoryMatch}, reason=${validation.reason}`);
              }
            }
          }
        }
      } catch (e) {
        console.error('[MyMemory] Error:', e.message);
      }
    }

    // ── 3. Fallback to LibreTranslate ──
    if (!finalTranslated) {
      const libreResult = await tryLibreTranslate(trimmed, sourceLang, targetLang);
      if (libreResult) {
        const validation = validateTranslation(trimmed, libreResult, sourceLang, targetLang);
        if (validation.valid) {
          finalTranslated = libreResult;
          provider = 'libretranslate';
        }
      }
    }

    // ── If all providers failed, return original with fallback flag ──
    if (!finalTranslated) {
      const result = { translated: trimmed, fallback: true, charsUsed, provider: 'none' };
      try {
        await redis('SET', cacheKey, JSON.stringify(result), 'EX', 1800); // 30min cache for failures
      } catch {}
      return NextResponse.json(result, { headers: CORS_HEADERS });
    }

    // ── Success — cache and return ──
    const result = {
      translated: finalTranslated,
      match: myMemoryMatch,
      fallback: false,
      charsUsed,
      dailyLimit: FREE_DAILY_LIMIT,
      provider
    };

    const cacheTtl = provider === 'mymemory-low' ? 3600 : 86400;
    try {
      await redis('SET', cacheKey, JSON.stringify(result), 'EX', cacheTtl);
    } catch (e) {
      console.error('Cache store error:', e);
    }

    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (e) {
    console.error('Free translate error:', e);
    return NextResponse.json({ translated: '', fallback: true, error: e.message, charsUsed: 0 }, { headers: CORS_HEADERS });
  }
}
