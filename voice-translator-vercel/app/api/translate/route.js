import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { addCost } from '../../lib/store.js';
import { deductCredits } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcGptCost, calcTtsCost, usdToEurCents, roundCost, roundEurCents } from '../../lib/config.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';
import { redis } from '../../lib/redis.js';

// ═══════════════════════════════════════════════
// FASE 9: Output validation — detect garbage/wrong-script LLM output
// ═══════════════════════════════════════════════
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
const LATIN_LANGS = new Set(['en','es','fr','de','it','pt','nl','pl','sv','tr','vi','id','ms','cs','ro','hu','fi']);

function validateOutput(original, translated, targetLang) {
  if (!translated || !translated.trim()) return { valid: false, reason: 'empty' };
  const t = translated.trim();
  // Check for LLM meta-text leaking through (common failure mode)
  if (t.startsWith('Translation:') || t.startsWith('Here is') || t.startsWith('Note:'))
    return { valid: false, reason: 'meta_text' };
  // Length ratio sanity (allow wider for CJK)
  const ratio = t.length / Math.max(original.trim().length, 1);
  if (ratio > 8 || ratio < 0.05) return { valid: false, reason: 'length_ratio' };
  // Script validation for non-Latin targets
  if (!LATIN_LANGS.has(targetLang) && SCRIPT_RANGES[targetLang]) {
    if (!SCRIPT_RANGES[targetLang].test(t)) return { valid: false, reason: 'wrong_script' };
  }
  return { valid: true };
}

// Model mapping: our model IDs → actual API model strings + provider
const MODEL_MAP = {
  'gpt-4o-mini':    { actual: 'gpt-4o-mini', provider: 'openai' },
  'gpt-4o':         { actual: 'gpt-4o', provider: 'openai' },
  'claude-sonnet':  { actual: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
  'claude-haiku':   { actual: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
  'gemini-flash':   { actual: 'gemini-2.0-flash', provider: 'gemini' },
  'gemini-pro':     { actual: 'gemini-2.5-pro-preview-05-06', provider: 'gemini' },
};

// Simple hash for cache key (first 32 chars of base64-encoded text)
function getSimpleHash(text) {
  const encoded = Buffer.from(text).toString('base64');
  return encoded.substring(0, 32);
}

export async function POST(req) {
  try {
    // Rate limit: 30 requests/minute per IP
    const rl = await checkRateLimit(getRateLimitKey(req, 'translate'), 30);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429,
        headers: { 'Retry-After': Math.ceil(rl.retryAfterMs / 1000).toString() } });
    }

    const { text, sourceLang, targetLang, sourceLangName, targetLangName,
            roomId, context, isReview, domainContext, description, userToken, aiModel } = await req.json();

    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Check if this is a simple translation (no context/review/domain/description)
    const isSimpleTranslation = !context && !isReview && !domainContext && !description;

    // Build cache key for simple translations only
    let cacheKey = null;
    let cachedTranslation = null;
    if (isSimpleTranslation) {
      const textHash = getSimpleHash(text);
      cacheKey = `tc:${sourceLang}:${targetLang}:${textHash}`;
      try {
        cachedTranslation = await redis('GET', cacheKey);
      } catch (e) {
        console.error('Cache lookup error:', e);
        // Continue without cache on error
      }
    }

    // If we have a cached translation, return it immediately
    if (cachedTranslation) {
      return NextResponse.json({
        translated: cachedTranslation,
        cost: 0,
        costEurCents: 0,
        cached: true
      });
    }

    // Resolve model selection
    const modelInfo = MODEL_MAP[aiModel] || MODEL_MAP['gpt-4o-mini'];
    const authProvider = modelInfo.provider === 'openai' ? 'openai'
      : modelInfo.provider === 'anthropic' ? 'anthropic'
      : modelInfo.provider === 'gemini' ? 'gemini' : 'openai';

    // 3-tier auth: userToken → roomId → reject
    const { apiKey, isOwnKey, billingEmail } = await resolveAuth({
      userToken,
      roomId,
      provider: authProvider,
      minCredits: MIN_CREDITS.TRANSLATE,
      skipCreditCheck: !!isReview,
    });

    // Build system prompt — strict: output ONLY the translation, nothing else
    const TONAL_LANGS = {
      'th': 'Thai (tonal, no spaces between words, use Thai script ภาษาไทย)',
      'zh': 'Chinese (Simplified, use 简体中文)',
      'ja': 'Japanese (use appropriate kanji/hiragana/katakana)',
      'vi': 'Vietnamese (tonal, ALL diacritics critical — never omit dấu)',
      'ko': 'Korean (use Hangul 한국어)'
    };
    const srcTonal = TONAL_LANGS[sourceLang];
    const tgtTonal = TONAL_LANGS[targetLang];
    let toneNote = '';
    if (tgtTonal) toneNote = ` The target language is ${tgtTonal}. Preserve all diacritics, tone marks, and native script exactly. Use natural ${targetLangName} phrasing — NOT transliteration.`;
    else if (srcTonal) toneNote = ` The source language is ${srcTonal}. Interpret tone marks and diacritics accurately.`;

    let systemPrompt = `You are a real-time voice translator. Translate from ${sourceLangName} to ${targetLangName}.${toneNote}

RULES:
- Output ONLY the translated text in ${targetLangName}
- Do NOT add notes, explanations, labels, context, or commentary
- Do NOT repeat or reference any previous translations
- Do NOT include transliterations or romanizations
- Keep the translation natural and conversational
- If the text is unclear, translate it as best you can — never explain`;
    if (domainContext) systemPrompt += `\n\nDomain: ${domainContext}`;
    if (description) systemPrompt += `\nTopic: ${description}`;
    if (isReview) systemPrompt += `\nRefine the translation for coherence and accuracy as a complete passage.`;

    // Build messages array — context goes as a prior assistant turn, NOT in system prompt
    const messages = [{ role: 'system', content: systemPrompt }];
    if (context) {
      // FASE 9: Improved chunk context — give both the original fragment info
      // and the previous translation to help the LLM maintain coherence.
      // The "Continue translating" prefix tells the LLM this is a fragment.
      messages.push({ role: 'assistant', content: context });
      messages.push({ role: 'user', content: `[This is a continuation fragment from ongoing speech] ${text}` });
    } else {
      messages.push({ role: 'user', content: text });
    }

    let translated;
    let usage = null;

    if (modelInfo.provider === 'anthropic') {
      // ── Anthropic Claude ──
      const anthropic = new Anthropic({ apiKey });
      // Convert messages to Anthropic format (system separate, user/assistant messages)
      const anthropicMsgs = messages.filter(m => m.role !== 'system');
      const msg = await anthropic.messages.create({
        model: modelInfo.actual,
        max_tokens: 400,
        system: systemPrompt,
        messages: anthropicMsgs,
      });
      translated = msg.content[0]?.text?.trim() || '';
      usage = { prompt_tokens: msg.usage?.input_tokens || 0, completion_tokens: msg.usage?.output_tokens || 0,
        total_tokens: (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0) };
    } else if (modelInfo.provider === 'gemini') {
      // ── Google Gemini ──
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelInfo.actual });
      // Gemini: flatten system + context + text into a single user prompt
      const userText = context
        ? `${systemPrompt}\n\nPrevious translation for reference:\n${context}\n\nContinue translating:\n${text}`
        : `${systemPrompt}\n\nTranslate:\n${text}`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
      });
      translated = result.response.text()?.trim() || '';
      const gUsage = result.response.usageMetadata;
      usage = { prompt_tokens: gUsage?.promptTokenCount || 0, completion_tokens: gUsage?.candidatesTokenCount || 0,
        total_tokens: gUsage?.totalTokenCount || 0 };
    } else {
      // ── OpenAI (default) ──
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: modelInfo.actual,
        messages,
        temperature: 0.2,
        max_tokens: 400
      });
      translated = completion.choices[0].message.content.trim();
      usage = completion.usage;
    }

    // FASE 9: Validate LLM output — detect garbage, wrong script, meta-text
    const validation = validateOutput(text, translated, targetLang);
    if (!validation.valid) {
      console.warn(`[Translate] Output validation failed: reason=${validation.reason}, target=${targetLang}, output="${translated?.substring(0, 60)}"`);
      // Strip common LLM meta-text prefixes and retry validation
      if (validation.reason === 'meta_text') {
        translated = translated.replace(/^(Translation:|Here is|Note:)\s*/i, '').trim();
      }
      // If still invalid after cleanup, return original text as fallback
      const recheck = validateOutput(text, translated, targetLang);
      if (!recheck.valid) {
        return NextResponse.json({
          translated: text, // Return original — better than garbage
          cost: roundCost(calcGptCost(usage || { prompt_tokens: 0, completion_tokens: 0 })),
          costEurCents: 0,
          validationFailed: true
        });
      }
    }

    // Cache simple translations in Redis with 24h TTL
    if (isSimpleTranslation && cacheKey) {
      try {
        await redis('SET', cacheKey, translated, 'EX', 86400);
      } catch (e) {
        console.error('Cache store error:', e);
      }
    }

    // Calculate cost (approximate — uses OpenAI pricing as baseline)
    const gptCost = calcGptCost(usage || { prompt_tokens: 0, completion_tokens: 0 });
    const ttsCost = calcTtsCost(translated.length);
    const msgCostUsd = gptCost + ttsCost;
    const msgCostEurCents = usdToEurCents(msgCostUsd);

    // Track cost in room
    if (roomId) {
      try { await addCost(roomId, msgCostUsd); } catch (e) { console.error('Cost tracking error:', e); }
    }

    // Deduct credits
    let remainingCredits = undefined;
    if (billingEmail && !isOwnKey && !isReview) {
      try {
        const charge = Math.max(MIN_CHARGE.TRANSLATE, msgCostEurCents);
        const updatedUser = await deductCredits(billingEmail, charge);
        if (updatedUser) remainingCredits = updatedUser.credits;
        await trackDailySpend(billingEmail, charge);
      } catch (e) { console.error('Credit deduct error:', e); }
    }

    return NextResponse.json({
      translated,
      cost: roundCost(msgCostUsd),
      costEurCents: roundEurCents(msgCostEurCents),
      ...(remainingCredits !== undefined ? { remainingCredits } : {})
    });
  } catch (e) {
    // resolveAuth throws NextResponse objects on auth failure
    if (e instanceof NextResponse) return e;
    console.error('Translate error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
