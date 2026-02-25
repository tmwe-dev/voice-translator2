import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { addCost } from '../../lib/store.js';
import { deductCredits } from '../../lib/users.js';
import { resolveAuth } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcGptCost, calcTtsCost, usdToEurCents, roundCost, roundEurCents } from '../../lib/config.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';
import { redis } from '../../lib/redis.js';

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

    // Build system prompt
    const TONAL_LANGS = { 'th': 'Thai (tonal, no spaces between words)', 'zh': 'Chinese', 'ja': 'Japanese', 'vi': 'Vietnamese (tonal, diacritics critical)', 'ko': 'Korean' };
    const srcTonal = TONAL_LANGS[sourceLang];
    const tgtTonal = TONAL_LANGS[targetLang];
    let toneNote = '';
    if (tgtTonal) toneNote = ` The target language is ${tgtTonal}. Preserve all diacritics, tone marks, and native script exactly. Use natural ${targetLangName} phrasing.`;
    else if (srcTonal) toneNote = ` The source language is ${srcTonal}. Interpret tone marks and diacritics accurately.`;

    let systemPrompt = `Translate from ${sourceLangName} to ${targetLangName}. Output ONLY the translation. Keep it natural and conversational.${toneNote}`;
    if (domainContext) systemPrompt += `\n\n${domainContext}`;
    if (description) systemPrompt += `\nAdditional context about this conversation: ${description}`;
    if (context) systemPrompt += `\n\nPrevious translation context (for continuity): "${context}"`;
    if (isReview) systemPrompt += `\nThis is a review pass. Ensure the translation is coherent and contextually accurate as a whole.`;

    let translated;
    let usage = null;

    if (modelInfo.provider === 'anthropic') {
      // ── Anthropic Claude ──
      const anthropic = new Anthropic({ apiKey });
      const msg = await anthropic.messages.create({
        model: modelInfo.actual,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      });
      translated = msg.content[0]?.text?.trim() || '';
      usage = { prompt_tokens: msg.usage?.input_tokens || 0, completion_tokens: msg.usage?.output_tokens || 0,
        total_tokens: (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0) };
    } else if (modelInfo.provider === 'gemini') {
      // ── Google Gemini ──
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelInfo.actual });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nText to translate:\n${text}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
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
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 500
      });
      translated = completion.choices[0].message.content.trim();
      usage = completion.usage;
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
        const updatedUser = await deductCredits(billingEmail, Math.max(MIN_CHARGE.TRANSLATE, msgCostEurCents));
        if (updatedUser) remainingCredits = updatedUser.credits;
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
