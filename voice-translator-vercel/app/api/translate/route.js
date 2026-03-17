import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { addCost } from '../../lib/store.js';
import { deductCredits, deductLendingTokens } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcGptCost, calcTtsCost, usdToEurCents, roundCost, roundEurCents } from '../../lib/config.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';
import { redis } from '../../lib/redis.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { trackUsage, saveTranslation as saveTranslationDB } from '../../lib/supabaseAPI.js';
import { validateOutput, MODEL_MAP, calcConfidence, getSimpleHash } from '../../lib/translateValidation.js';
import { buildSystemPrompt, buildMessages } from '../../lib/translatePrompt.js';
import { callLLM } from '../../lib/llmCaller.js';

export async function POST(req) {
  try {
    // Rate limit: 30 requests/minute per IP
    const rl = await checkRateLimit(getRateLimitKey(req, 'translate'), 30);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429,
        headers: { 'Retry-After': Math.ceil(rl.retryAfterMs / 1000).toString() } });
    }

    const { text, sourceLang, targetLang, sourceLangName, targetLangName,
            roomId, context, isReview, domainContext, description, userToken, aiModel, lendingCode,
            roomMode, nativeLang, conversationContext } = await req.json();

    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Check if this is a simple translation (no context/review/domain/description/conversationContext)
    const isSimpleTranslation = !context && !isReview && !domainContext && !description && !conversationContext;

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
      const cachedConfidence = calcConfidence(text, cachedTranslation, sourceLang, targetLang);
      return NextResponse.json({
        translated: cachedTranslation,
        confidence: cachedConfidence,
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

    // 3-tier auth: userToken → lendingCode → roomId → reject
    const { apiKey, isOwnKey, billingEmail, isLending, lendingCodeUsed } = await resolveAuth({
      userToken,
      roomId,
      lendingCode: lendingCode || undefined,
      provider: authProvider,
      minCredits: MIN_CREDITS.TRANSLATE,
      skipCreditCheck: !!isReview,
    });

    // Build system prompt using extracted module
    let systemPrompt = buildSystemPrompt({
      sourceLang, targetLang, sourceLangName, targetLangName,
      roomMode, nativeLang, domainContext, description, isReview, conversationContext
    });

    // Glossary injection — if user has active glossaries for this language pair
    // NOTE: This is a self-referencing fetch that adds 200-500ms latency.
    // Only do it if the user likely has glossaries (check Redis first).
    if (userToken) {
      try {
        const glossaryCheck = await redis('GET', `glossary:${sourceLang}:${targetLang}:${userToken.slice(-8)}`).catch(() => null);
        if (glossaryCheck) {
          systemPrompt += glossaryCheck;
        }
      } catch (e) { /* glossary injection is optional */ }
    }

    // Build messages array
    const messages = buildMessages(systemPrompt, text, context);

    // Call LLM using extracted multi-provider caller
    let { translated, usage } = await callLLM({
      provider: modelInfo.provider,
      model: modelInfo.actual,
      apiKey,
      messages,
      systemPrompt,
      text,
      context,
    });

    // FASE 9: Validate LLM output — detect garbage, wrong script, meta-text
    const validation = validateOutput(text, translated, targetLang);
    if (!validation.valid) {
      console.warn(`[Translate] Output validation failed: reason=${validation.reason}, target=${targetLang}, output="${translated?.substring(0, 60)}"`);
      // Strip common LLM meta-text prefixes and retry validation
      if (validation.reason === 'meta_text') {
        translated = translated.replace(/^(Translation:|Here is|Note:)\s*/i, '').trim();
      }
      // If still invalid after cleanup, retry with gpt-4o (better for Asian languages)
      const recheck = validateOutput(text, translated, targetLang);
      if (!recheck.valid) {
        if (modelInfo.actual !== 'gpt-4o') {
          try {
            console.log(`[Translate] Retrying with gpt-4o for ${targetLang}`);
            // Need OpenAI key for retry — resolve if using different provider
            let retryKey = apiKey;
            if (modelInfo.provider !== 'openai') {
              try {
                const retryAuth = await resolveAuth({
                  userToken, roomId, provider: 'openai',
                  minCredits: 0, skipCreditCheck: true,
                });
                retryKey = retryAuth.apiKey;
              } catch { /* use existing key */ }
            }
            const retryOpenai = new OpenAI({ apiKey: retryKey });
            const retryCompletion = await retryOpenai.chat.completions.create({
              model: 'gpt-4o',
              messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
              temperature: 0.3,
              max_tokens: 500
            });
            const retryTranslated = retryCompletion.choices[0].message.content.trim();
            const retryValidation = validateOutput(text, retryTranslated, targetLang);
            if (retryValidation.valid) {
              translated = retryTranslated;
              usage = retryCompletion.usage;
            }
          } catch (retryErr) {
            console.error('[Translate] Retry with gpt-4o failed:', retryErr.message);
          }
        }
        // Final check — if still invalid, return original
        const finalCheck = validateOutput(text, translated, targetLang);
        if (!finalCheck.valid) {
          const failureConfidence = calcConfidence(text, text, sourceLang, targetLang);
          return NextResponse.json({
            translated: text,
            confidence: failureConfidence,
            cost: roundCost(calcGptCost(usage || { prompt_tokens: 0, completion_tokens: 0 })),
            costEurCents: 0,
            validationFailed: true
          });
        }
      }
    }

    // Calculate cost (approximate — uses OpenAI pricing as baseline)
    const gptCost = calcGptCost(usage || { prompt_tokens: 0, completion_tokens: 0 });
    const ttsCost = calcTtsCost(translated.length);
    const msgCostUsd = gptCost + ttsCost;
    const msgCostEurCents = usdToEurCents(msgCostUsd);

    // Deduct credits (must await — affects billing)
    let remainingCredits = undefined;
    if (billingEmail && !isOwnKey && !isReview) {
      try {
        const charge = Math.max(MIN_CHARGE.TRANSLATE, msgCostEurCents);
        const updatedUser = await deductCredits(billingEmail, charge);
        if (updatedUser) remainingCredits = updatedUser.credits;
      } catch (e) { console.error('Credit deduct error:', e); }
    }

    // Calculate confidence score
    const confidence = calcConfidence(text, translated, sourceLang, targetLang);

    // ── Fire-and-forget: cache, cost tracking, Supabase logging ──
    // These don't affect the response, so don't block the user
    const bgTasks = [];
    if (isSimpleTranslation && cacheKey) {
      bgTasks.push(redis('SET', cacheKey, translated, 'EX', 86400).catch(() => {}));
    }
    if (roomId) {
      bgTasks.push(addCost(roomId, msgCostUsd).catch(() => {}));
    }
    if (billingEmail && !isOwnKey && !isReview) {
      bgTasks.push(trackDailySpend(billingEmail, Math.max(MIN_CHARGE.TRANSLATE, msgCostEurCents)).catch(() => {}));
    }
    if (isLending && lendingCodeUsed) {
      const tokenEstimate = Math.ceil((text.length + (translated?.length || 0)) / 4);
      bgTasks.push(deductLendingTokens(lendingCodeUsed, tokenEstimate).catch(() => {}));
    }
    // Supabase tracking (fully non-blocking)
    try {
      const sb = getSupabaseAdmin();
      if (sb && billingEmail) {
        bgTasks.push(
          sb.from('profiles').select('id').eq('email', billingEmail).single()
            .then(({ data: profile }) => {
              if (!profile) return;
              saveTranslationDB({
                user_id: profile.id, room_id: roomId || null,
                source_lang: sourceLang, target_lang: targetLang,
                source_text: text.substring(0, 500),
                translated_text: (translated || '').substring(0, 500),
                provider: modelInfo.provider, ai_model: modelInfo.actual,
                tokens_in: usage?.prompt_tokens || 0, tokens_out: usage?.completion_tokens || 0,
                duration_ms: 0, cost_usd: roundCost(msgCostUsd),
                cost_eur_cents: roundEurCents(msgCostEurCents),
                is_cached: false, context_type: domainContext || 'general',
              }).catch(() => {});
              trackUsage(profile.id, {
                translations: 1, costCents: Math.round(msgCostEurCents),
                tokens: (usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0),
              }).catch(() => {});
            }).catch(() => {})
        );
      }
    } catch {}
    // Fire all background tasks without awaiting
    if (bgTasks.length > 0) Promise.allSettled(bgTasks).catch(() => {});

    return NextResponse.json({
      translated,
      confidence,
      cost: roundCost(msgCostUsd),
      costEurCents: roundEurCents(msgCostEurCents),
      ...(remainingCredits !== undefined ? { remainingCredits } : {})
    });
  } catch (e) {
    // resolveAuth throws NextResponse objects on auth failure
    if (e instanceof NextResponse) return e;
    console.error('Translate error:', e);
    // Report to Sentry
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'translate', source: 'api' } });
    }).catch(() => {});
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
