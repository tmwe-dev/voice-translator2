import { NextResponse } from 'next/server';
import { validateOutput, MODEL_MAP } from '../../lib/translateValidation.js';
import { buildSystemPrompt } from '../../lib/translatePrompt.js';
import { callLLM } from '../../lib/llmCaller.js';
import { safeCompare } from '../../lib/apiGuard.js';

// ═══════════════════════════════════════════════
// LLM Translation Test Endpoint — runs ALL paid models in parallel
// Used by the Test Center page to compare LLM translation quality
//
// Reuses shared modules:
// - buildSystemPrompt from translatePrompt.js (identical prompts to production)
// - callLLM from llmCaller.js (identical provider handling)
// - validateOutput from translateValidation.js
//
// Uses platform API keys from env — no user auth, no credit deduction
// Rate limited: 10 req/min per IP
// ═══════════════════════════════════════════════

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Clean up periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW * 2) rateLimitMap.delete(ip);
  }
}, 120000);

// Language names for prompt building
const LANG_NAMES = {
  'it': 'Italian', 'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
  'pt': 'Portuguese', 'zh': 'Chinese (Simplified)', 'ja': 'Japanese', 'ko': 'Korean',
  'ar': 'Arabic', 'hi': 'Hindi', 'ru': 'Russian', 'tr': 'Turkish', 'th': 'Thai',
  'vi': 'Vietnamese', 'nl': 'Dutch', 'pl': 'Polish', 'sv': 'Swedish', 'el': 'Greek',
  'id': 'Indonesian', 'ms': 'Malay', 'cs': 'Czech', 'ro': 'Romanian', 'hu': 'Hungarian', 'fi': 'Finnish',
};

// Provider API key mapping from environment
const PROVIDER_KEYS = {
  openai: () => process.env.OPENAI_API_KEY,
  anthropic: () => process.env.ANTHROPIC_API_KEY,
  gemini: () => process.env.GEMINI_API_KEY,
};

/**
 * Test a single LLM model — reuses the shared callLLM + buildSystemPrompt modules
 */
async function testModel(modelId, text, sourceLang, targetLang, systemPrompt, messages) {
  const modelInfo = MODEL_MAP[modelId];
  if (!modelInfo) return { model: modelId, text: null, elapsed: 0, valid: false, reason: 'unknown_model' };

  const getKey = PROVIDER_KEYS[modelInfo.provider];
  const apiKey = getKey ? getKey() : null;
  if (!apiKey) {
    return {
      model: modelId, provider: modelInfo.provider,
      text: null, elapsed: 0, valid: false,
      reason: `${modelInfo.provider.toUpperCase()}_API_KEY not configured`, tokens: null,
    };
  }

  const start = Date.now();

  try {
    // Reuse the shared callLLM module — same code path as production translation
    let { translated, usage } = await callLLM({
      provider: modelInfo.provider,
      model: modelInfo.actual,
      apiKey,
      messages,
      systemPrompt,
      text,
      context: null,
      temperature: 0.3,
      maxTokens: 500,
    });

    const elapsed = Date.now() - start;
    const validation = validateOutput(text, translated, targetLang);

    // Clean meta-text if needed
    if (!validation.valid && validation.reason === 'meta_text' && translated) {
      translated = translated.replace(/^(Translation:|Here is|Note:)\s*/i, '').trim();
    }

    const finalValidation = validateOutput(text, translated, targetLang);

    return {
      model: modelId,
      provider: modelInfo.provider,
      text: translated,
      elapsed,
      valid: finalValidation.valid,
      reason: finalValidation.valid ? 'ok' : finalValidation.reason,
      tokens: usage ? (usage.prompt_tokens + usage.completion_tokens) : null,
    };
  } catch (e) {
    return {
      model: modelId,
      provider: modelInfo.provider,
      text: null,
      elapsed: Date.now() - start,
      valid: false,
      reason: e.message || 'error',
      tokens: null,
    };
  }
}

export async function POST(req) {
  try {
    // Production guard: test endpoints disabled unless TESTING_MODE active
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_TESTING_MODE === 'false') {
      return NextResponse.json({ error: 'Test endpoint disabled in production' }, { status: 403 });
    }

    // Require admin pass in production to prevent abuse of platform API keys
    if (process.env.NODE_ENV === 'production' && process.env.ADMIN_PASS) {
      const { searchParams } = new URL(req.url);
      const pass = searchParams.get('key') || req.headers.get('x-admin-key');
      if (!safeCompare(pass, process.env.ADMIN_PASS)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    // Rate limit
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit: max 10 test/min' }, { status: 429 });
    }

    const { text, sourceLang, targetLang, models } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const trimmed = text.trim();
    const selectedModels = models || Object.keys(MODEL_MAP);

    const sourceLangName = LANG_NAMES[sourceLang] || sourceLang;
    const targetLangName = LANG_NAMES[targetLang] || targetLang;

    // Build system prompt using the shared module — identical to production
    const systemPrompt = buildSystemPrompt({
      sourceLang, targetLang, sourceLangName, targetLangName,
      roomMode: 'conversation',
    });

    // Build messages array for OpenAI/Anthropic format
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: trimmed },
    ];

    // Run all selected models in parallel
    const results = await Promise.allSettled(
      selectedModels.map(modelId => testModel(modelId, trimmed, sourceLang, targetLang, systemPrompt, messages))
    );

    const output = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        model: selectedModels[i],
        provider: MODEL_MAP[selectedModels[i]]?.provider || 'unknown',
        text: null,
        elapsed: 0,
        valid: false,
        reason: r.reason?.message || 'promise_rejected',
        tokens: null,
      };
    });

    return NextResponse.json({
      results: output,
      sourceText: trimmed,
      sourceLang,
      targetLang,
    });
  } catch (e) {
    console.error('LLM test error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
