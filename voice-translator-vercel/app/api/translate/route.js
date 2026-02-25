import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { addCost } from '../../lib/store.js';
import { deductCredits } from '../../lib/users.js';
import { resolveAuth } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcGptCost, calcTtsCost, usdToEurCents, roundCost, roundEurCents } from '../../lib/config.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';
import { redis } from '../../lib/redis.js';

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
            roomId, context, isReview, domainContext, description, userToken } = await req.json();

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

    // 3-tier auth: userToken → roomId → reject
    const { apiKey, isOwnKey, billingEmail } = await resolveAuth({
      userToken,
      roomId,
      provider: 'openai',
      minCredits: MIN_CREDITS.TRANSLATE,
      skipCreditCheck: !!isReview,
    });

    const openai = new OpenAI({ apiKey });

    // Build system prompt
    // Tonal/special script languages need extra guidance
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const translated = completion.choices[0].message.content.trim();

    // Cache simple translations in Redis with 24h TTL
    if (isSimpleTranslation && cacheKey) {
      try {
        await redis('SET', cacheKey, translated, 'EX', 86400);
      } catch (e) {
        console.error('Cache store error:', e);
        // Continue even if cache write fails
      }
    }

    // Calculate cost
    const gptCost = calcGptCost(completion.usage);
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
