// ═══════════════════════════════════════════════
// Provider Registry — centralized translation provider management
//
// Active free translation providers:
// - Google Translate (unofficial gtx API)
// - Microsoft Translate (unofficial via npm)
// - MyMemory API (per-user email quota)
//
// Per-language routing: each target language gets an optimized
// provider chain based on quality testing results.
// ═══════════════════════════════════════════════

// Unicode script ranges for output validation
const SCRIPT_RANGES = {
  'th': /[\u0E00-\u0E7F]/,
  'zh': /[\u4E00-\u9FFF]/,
  'ja': /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/,
  'ko': /[\uAC00-\uD7AF\u1100-\u11FF]/,
  'ar': /[\u0600-\u06FF]/,
  'hi': /[\u0900-\u097F]/,
  'ru': /[\u0400-\u04FF]/,
  'el': /[\u0370-\u03FF]/,
};

const LATIN_LANGS = new Set([
  'en','es','fr','de','it','pt','nl','pl','sv','tr','vi','id','ms','cs','ro','hu','fi'
]);

// ── Provider metadata ──
export const PROVIDERS = {
  google:    { name: 'Google Translate', quality: 4, latency: 400,  free: true },
  microsoft: { name: 'Microsoft',        quality: 4, latency: 500,  free: true },
  mymemory:  { name: 'MyMemory',         quality: 3, latency: 700,  free: true },
};

// Languages each provider supports well
const MICROSOFT_BEST = new Set(['ar', 'hi', 'ru', 'tr', 'ko', 'th', 'zh', 'ja']);

// ── Default provider chains per language target ──
// Order = priority (first tried first)
const PROVIDER_CHAINS = {
  // CJK + Thai + Vietnamese → Google fastest, Microsoft high quality
  'zh': ['google', 'microsoft', 'mymemory'],
  'ja': ['google', 'microsoft', 'mymemory'],
  'ko': ['google', 'microsoft', 'mymemory'],
  'th': ['google', 'microsoft', 'mymemory'],
  'vi': ['google', 'microsoft', 'mymemory'],
  // Arabic/Hindi/Russian/Turkish → Microsoft excels
  'ar': ['microsoft', 'google', 'mymemory'],
  'hi': ['microsoft', 'google', 'mymemory'],
  'ru': ['microsoft', 'google', 'mymemory'],
  'tr': ['microsoft', 'google', 'mymemory'],
  // European languages → Google is usually best
  '*': ['google', 'microsoft', 'mymemory'],
};

// Fastest provider per target language (for superfast mode)
export const FASTEST_PROVIDER = {
  'zh': 'google', 'ja': 'google', 'ko': 'google', 'th': 'google',
  'ar': 'microsoft', 'hi': 'microsoft', 'ru': 'microsoft', 'tr': 'microsoft',
  '*': 'google',
};

/**
 * Get the provider chain for a given target language, with optional user overrides.
 */
export function getProviderChain(targetLang, userOverrides) {
  const chain = PROVIDER_CHAINS[targetLang] || PROVIDER_CHAINS['*'];
  if (!userOverrides) return [...chain];

  // Apply user overrides: { primary, secondary, tertiary }
  const { primary, secondary, tertiary } = userOverrides;
  if (primary === 'auto' && secondary === 'auto' && tertiary === 'auto') return [...chain];

  const result = [];
  if (primary && primary !== 'auto') result.push(primary);
  if (secondary && secondary !== 'auto') result.push(secondary);
  if (tertiary && tertiary !== 'auto') result.push(tertiary);
  // Fill remaining from default chain (skip duplicates)
  for (const p of chain) {
    if (!result.includes(p)) result.push(p);
  }
  return result;
}

/**
 * Get available providers for a target language (for Settings UI)
 */
export function getAvailableProviders(targetLang) {
  const chain = PROVIDER_CHAINS[targetLang] || PROVIDER_CHAINS['*'];
  return chain.map(id => ({
    id,
    ...PROVIDERS[id],
    recommended: chain.indexOf(id) === 0,
    specializedFor: MICROSOFT_BEST.has(targetLang) && id === 'microsoft',
  }));
}

// ═══════════════════════════════════════════════
// Translation validation
// ═══════════════════════════════════════════════

export function validateTranslation(original, translated, sourceLang, targetLang) {
  if (!translated || !translated.trim()) return { valid: false, reason: 'empty' };
  const t = translated.trim();
  const o = original.trim();

  if (t === o.toUpperCase()) return { valid: false, reason: 'uppercase_echo' };
  if (t.includes('MYMEMORY WARNING')) return { valid: false, reason: 'mymemory_warning' };
  if (t.includes('PLEASE SELECT')) return { valid: false, reason: 'mymemory_error' };
  if (t.includes('NO QUERY SPECIFIED')) return { valid: false, reason: 'mymemory_error' };

  const ratio = t.length / Math.max(o.length, 1);
  if (ratio > 5 || ratio < 0.1) return { valid: false, reason: 'length_ratio' };

  if (!LATIN_LANGS.has(targetLang) && SCRIPT_RANGES[targetLang]) {
    if (!SCRIPT_RANGES[targetLang].test(t)) return { valid: false, reason: 'wrong_script' };
  }

  if (sourceLang === targetLang) return { valid: true, reason: 'same_lang' };
  if (t.toLowerCase() === o.toLowerCase() && sourceLang !== targetLang) {
    return { valid: false, reason: 'identical_to_original' };
  }

  return { valid: true, reason: 'ok' };
}

/**
 * Score a translation result (0-10) for quality ranking
 */
export function scoreTranslation(original, translated, sourceLang, targetLang, provider) {
  let score = 0;
  const validation = validateTranslation(original, translated, sourceLang, targetLang);

  // +3: valid script
  if (validation.valid) score += 3;
  else return { score: 0, reason: validation.reason };

  const t = translated.trim();
  const o = original.trim();
  const ratio = t.length / Math.max(o.length, 1);

  // +2: reasonable length ratio
  if (ratio >= 0.3 && ratio <= 3) score += 2;
  else if (ratio >= 0.15 && ratio <= 4) score += 1;

  // +2: not identical to original
  if (t.toLowerCase() !== o.toLowerCase()) score += 2;

  // +1: no meta-text
  if (!t.startsWith('Translation:') && !t.startsWith('Here is') && !t.startsWith('Note:')) score += 1;

  // +2: specialized provider for this language
  if (MICROSOFT_BEST.has(targetLang) && provider === 'microsoft') score += 2;
  else if (provider === 'google') score += 1; // Google is generally good

  return { score: Math.min(score, 10), reason: 'scored' };
}

// ═══════════════════════════════════════════════
// Provider implementations
// ═══════════════════════════════════════════════

/**
 * Google Translate (unofficial gtx API)
 */
export async function tryGoogleTranslate(text, sourceLang, targetLang) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map(seg => seg[0]).join('');
      return translated?.trim() || null;
    }
    return null;
  } catch (e) {
    console.error('[Google] Error:', e.message);
    return null;
  }
}

// Microsoft uses different language codes for some languages
const MS_LANG_MAP = {
  'zh': 'zh-Hans',  // Chinese simplified (Microsoft doesn't support bare 'zh')
  'pt': 'pt-pt',    // Portuguese (Portugal) — use 'pt-br' for Brazilian
};

/**
 * Microsoft Translate (unofficial via npm)
 * Best for: ar, hi, ru, tr, and generally good for all
 */
export async function tryMicrosoftTranslate(text, sourceLang, targetLang) {
  // Don't catch errors here — let them bubble up to tryProvider for error reporting
  const { translate } = await import('microsoft-translate-api');
  // Map our language codes to Microsoft's codes
  const msFrom = MS_LANG_MAP[sourceLang] || sourceLang;
  const msTo = MS_LANG_MAP[targetLang] || targetLang;
  // API signature: translate(text, from, to, options)
  // Returns: [{ translations: [{ text: "...", to: "xx" }] }]
  const result = await Promise.race([
    translate(text, msFrom, msTo),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 5s')), 5000))
  ]);
  // Extract translated text from Microsoft's response format
  if (Array.isArray(result) && result[0]?.translations?.[0]?.text) {
    return result[0].translations[0].text.trim();
  }
  // Fallback: try other possible response shapes
  if (result?.translation) return result.translation.trim();
  if (result?.text) return result.text.trim();
  throw new Error('MS: unexpected response: ' + JSON.stringify(result).slice(0, 200));
}

/**
 * MyMemory Translation Memory API
 * Uses per-user email for quota (10k words/day per email)
 */
export async function tryMyMemoryTranslate(text, sourceLang, targetLang, userEmail) {
  try {
    // Use the actual user's email for per-user quota (10k words/day per email)
    // No fallback to shared email — protects other users from hitting shared limits
    if (!userEmail || !userEmail.includes('@')) {
      return { text: null, match: 0 };
    }
    const email = userEmail;
    const langpair = `${sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}&de=${encodeURIComponent(email)}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'VoiceTranslator/2.0' },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return { text: null, match: 0 };
    const data = await res.json();

    if (data.responseStatus === 429 ||
        (data.responseData?.translatedText || '').includes('MYMEMORY WARNING')) {
      return { text: null, match: 0 };
    }

    const translated = data.responseData?.translatedText || '';
    const match = data.responseData?.match || 0;
    return { text: translated?.trim() || null, match };
  } catch (e) {
    console.error('[MyMemory] Error:', e.message);
    return { text: null, match: 0 };
  }
}

// ═══════════════════════════════════════════════
// Unified translation runner
// ═══════════════════════════════════════════════

// Provider failure tracking (skip provider if failing repeatedly)
const providerFailures = {};
const FAILURE_THRESHOLD = 3;
const FAILURE_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function isProviderAvailable(providerId) {
  const entry = providerFailures[providerId];
  if (!entry) return true;
  if (entry.count >= FAILURE_THRESHOLD) {
    if (Date.now() - entry.lastFailure > FAILURE_COOLDOWN) {
      // Cooldown expired, reset
      delete providerFailures[providerId];
      return true;
    }
    return false; // Still in cooldown
  }
  return true;
}

function recordFailure(providerId) {
  if (!providerFailures[providerId]) {
    providerFailures[providerId] = { count: 0, lastFailure: 0 };
  }
  providerFailures[providerId].count++;
  providerFailures[providerId].lastFailure = Date.now();
}

function recordSuccess(providerId) {
  delete providerFailures[providerId];
}

/**
 * Try a single provider and return result with timing
 */
export async function tryProvider(providerId, text, sourceLang, targetLang, userEmail) {
  const start = Date.now();
  let result = null;
  let match = 0;
  let errorDetail = null;

  try {
    switch (providerId) {
      case 'google':
        result = await tryGoogleTranslate(text, sourceLang, targetLang);
        break;
      case 'microsoft':
        result = await tryMicrosoftTranslate(text, sourceLang, targetLang);
        break;
      case 'mymemory': {
        const mm = await tryMyMemoryTranslate(text, sourceLang, targetLang, userEmail);
        result = mm.text;
        match = mm.match;
        break;
      }
    }
  } catch (e) {
    errorDetail = e.message || 'Unknown error';
    console.error(`[${providerId}] tryProvider error:`, e.message);
  }

  const elapsed = Date.now() - start;
  return { provider: providerId, text: result, match, elapsed, errorDetail };
}

/**
 * Run the full provider chain — tries providers in order until one succeeds
 * Returns: { translated, provider, elapsed, match, fallback }
 */
export async function runProviderChain(text, sourceLang, targetLang, opts = {}) {
  const { userEmail, superfast = false, userProviderPrefs } = opts;

  // Get chain (with user overrides if set)
  let chain;
  if (superfast) {
    // Superfast: single provider, no fallback
    const fastest = FASTEST_PROVIDER[targetLang] || FASTEST_PROVIDER['*'];
    chain = [fastest];
  } else {
    chain = getProviderChain(targetLang, userProviderPrefs);
  }

  // Filter out unavailable providers
  chain = chain.filter(isProviderAvailable);
  if (chain.length === 0) chain = ['google']; // Always have at least one

  for (const providerId of chain) {
    const result = await tryProvider(providerId, text, sourceLang, targetLang, userEmail);

    if (result.text) {
      const validation = validateTranslation(text, result.text, sourceLang, targetLang);

      // MyMemory needs minimum match score
      if (providerId === 'mymemory' && result.match < 0.3) {
        recordFailure(providerId);
        continue;
      }

      if (validation.valid) {
        recordSuccess(providerId);
        return {
          translated: result.text,
          provider: providerId,
          elapsed: result.elapsed,
          match: result.match,
          fallback: false,
        };
      } else {
        console.log(`[${providerId}] Rejected: reason=${validation.reason}`);
      }
    }

    recordFailure(providerId);
  }

  // All providers failed
  return {
    translated: text,
    provider: 'none',
    elapsed: 0,
    match: 0,
    fallback: true,
  };
}

/**
 * Run ALL providers in parallel (for test center + consensus)
 * Returns array of results
 */
export async function runAllProviders(text, sourceLang, targetLang, userEmail) {
  const providerIds = ['google', 'microsoft', 'mymemory'];

  const results = await Promise.allSettled(
    providerIds.map(id => tryProvider(id, text, sourceLang, targetLang, userEmail))
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled' && r.value.text) {
      const validation = validateTranslation(text, r.value.text, sourceLang, targetLang);
      const scoring = scoreTranslation(text, r.value.text, sourceLang, targetLang, r.value.provider);
      return {
        ...r.value,
        valid: validation.valid,
        validationReason: validation.reason,
        score: scoring.score,
      };
    }
    const errorMsg = r.status === 'rejected'
      ? r.reason?.message
      : (r.value?.errorDetail || 'no_result');
    return {
      provider: providerIds[i],
      text: null,
      match: 0,
      elapsed: r.status === 'fulfilled' ? r.value?.elapsed || 0 : 0,
      valid: false,
      validationReason: errorMsg,
      score: 0,
    };
  });
}
