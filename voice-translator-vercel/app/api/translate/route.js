import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { addCost } from '../../lib/store.js';
import { deductCredits, deductLendingTokens } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcGptCost, calcTtsCost, usdToEurCents, roundCost, roundEurCents } from '../../lib/config.js';
import { redis } from '../../lib/redis.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { trackUsage, saveTranslation as saveTranslationDB } from '../../lib/supabaseAPI.js';
import { validateOutput, MODEL_MAP, calcConfidence, getSimpleHash } from '../../lib/translateValidation.js';
import { buildSystemPrompt, buildMessages } from '../../lib/translatePrompt.js';
import { callLLM, callLLMWithFallback } from '../../lib/llmCaller.js';
import { routeProvider } from '../../lib/providerRouter.js';
import { validateTranslateInput } from '../../lib/schemas.js';
import { ErrorCode, apiError } from '../../lib/errors.js';
import { createLogger } from '../../lib/logger.js';
import { assertCloudProcessingAllowed, DirectModeError } from '../../lib/sessionGuard.js';
import { addebitaTesto } from '../../wallet/addebita.js';

const log = createLogger('translate');

async function handlePost(req) {
  try {
    // ── Direct mode guard ──
    try { assertCloudProcessingAllowed(req); } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    // ── b.106 · qui c'era un SECONDO limitatore sulla STESSA chiave ──
    // withApiGuard, in fondo al file, conta gia su "translate:IP" con
    // tetto 120. Questa riga contava di nuovo sulla stessa chiave con
    // tetto 30: ogni traduzione valeva due gettoni e il tetto vero era
    // 15 al minuto per indirizzo IP.
    //
    // In una stanza con due persone sulla stessa rete il traduttore si
    // spegneva da solo dopo poche frasi. Il freno sulla spesa resta
    // quello giornaliero, in apiAuth.

    // Validate and sanitize input
    const rawBody = await req.json();
    // b.90 — copia da parte: se qualcosa esplode più avanti, la rete di
    // sicurezza ha ancora il testo da tradurre (lo stream è già consumato).
    req._corpoBartalk = rawBody;
    const inputValidation = validateTranslateInput(rawBody);
    if (!inputValidation.valid) {
      return apiError(ErrorCode.INVALID_INPUT, inputValidation.error);
    }

    const { text, sourceLang, targetLang, sourceLangName, targetLangName,
            roomId, context, isReview, domainContext, description, userToken, aiModel, lendingCode,
            roomMode, nativeLang, conversationContext,
            glossario } = { ...rawBody, ...inputValidation.data }; // b.95

    if (!text) return apiError(ErrorCode.MISSING_FIELD, 'No text provided');

    // Check if this is a simple translation (no context/review/domain/description/conversationContext)
    // b.95 — se ci sono termini di glossario la traduzione NON e semplice:
    // usare la cache restituirebbe una versione senza i termini dell'utente,
    // cioe esattamente il contrario di quello che ha chiesto.
    const conGlossario = Array.isArray(glossario) && glossario.length > 0;
    const isSimpleTranslation = !context && !isReview && !domainContext && !description
      && !conversationContext && !conGlossario;

    // ── b.111 · le due domande si fanno insieme, non una dopo l'altra ──
    // Prima si aspettava la cache, poi (molto piu in basso, dopo
    // resolveAuth) si aspettava il glossario. Due viaggi a Upstash in
    // fila, 30-80ms l'uno, prima ancora di cominciare a tradurre.
    // Sono domande indipendenti: partono insieme.
    //
    // Il glossario si chiede anche se poi la cache risponde e non serve
    // piu: e una lettura, non costa niente, e chiederlo dopo
    // costerebbe un viaggio intero. Il `.catch` c'e perche una promessa
    // avviata e mai attesa, se fallisce, fa rumore.
    let cacheKey = null;
    if (isSimpleTranslation) {
      cacheKey = `tc:${sourceLang}:${targetLang}:${getSimpleHash(text)}`;
    }
    const chiestaCache = cacheKey
      ? redis('GET', cacheKey).catch((e) => { log.error('Cache lookup error:', e); return null; })
      : Promise.resolve(null);
    const chiestoGlossario = userToken
      ? redis('GET', `glossary:${sourceLang}:${targetLang}:${userToken.slice(-8)}`).catch(() => null)
      : Promise.resolve(null);

    const cachedTranslation = await chiestaCache;

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

    // ── b.123 · CHI PAGA SI DECIDE PRIMA DI SCEGLIERE IL FORNITORE ──
    //
    // Questo blocco stava PRIMA di resolveAuth e finiva con un `return`.
    // Quindi per le coppie instradate in Asia (cinese, giapponese,
    // coreano) la funzione usciva senza mai passare da:
    //
    //   autenticazione · controllo credito · addebito wallet ·
    //   costo della stanza · spesa giornaliera
    //
    // E dichiarava `costEurCents: 0`, cosi nemmeno il monitoraggio a
    // valle poteva accorgersene. Il fornitore ci fatturava, e da noi
    // non risultava niente: non per gli anonimi — per TUTTI, anche per
    // chi aveva pagato e si aspettava che i minuti scalassero.
    //
    // Nessun test lo aveva toccato: ogni pezzo, da solo, e corretto. E
    // l'ORDINE fra due cose giuste a produrre il percorso sbagliato.
    // (E io l'avevo mancato provando solo it→en, che passa dal Global.)
    //
    // Ora l'autorizzazione e sopra, e il risultato di Asia non esce piu
    // dalla porta di servizio: prosegue nello stesso percorso del
    // Global, dove la contabilita gia c'e ed e sola.
    const providerRoute = routeProvider(sourceLang, targetLang);
    let risultatoAsia = null;

    if (providerRoute.provider === 'asia' && providerRoute.confidence >= 0.85) {
      // Qwen-MT per le coppie CJK: piu veloce e meno caro.
      try {
        const { translateAsia } = await import('../../lib/translateAsia.js');
        const asiaResult = await translateAsia(text, sourceLang, targetLang, {});
        if (asiaResult?.translated && validateOutput(text, asiaResult.translated, targetLang).valid) {
          risultatoAsia = {
            translated: asiaResult.translated,
            provider: asiaResult.provider || 'qwen',
            cost: asiaResult.cost || 0,
          };
        }
      } catch (asiaErr) {
        log.warn('Asia provider failed, falling back to global:', asiaErr.message);
      }
    }


    // Build system prompt using extracted module
    let systemPrompt = buildSystemPrompt({
      sourceLang, targetLang, sourceLangName, targetLangName,
      roomMode, nativeLang, domainContext, description, isReview, conversationContext,
      glossario, // b.95 — i termini dell'utente pesano sulla traduzione
    });

    // Glossary injection — if user has active glossaries for this language pair
    // NOTE: This is a self-referencing fetch that adds 200-500ms latency.
    // Only do it if the user likely has glossaries (check Redis first).
    // b.111 — la richiesta e partita in cima, insieme a quella della
    // cache: qui c'e gia la risposta e non si aspetta piu niente.
    try {
      const glossaryCheck = await chiestoGlossario;
      if (glossaryCheck) systemPrompt += glossaryCheck;
    } catch { /* glossary injection is optional */ }

    // Build messages array
    const messages = buildMessages(systemPrompt, text, context);

    // Call LLM with fallback chain — if primary fails, try alternatives
    const primaryOpts = {
      provider: modelInfo.provider,
      model: modelInfo.actual,
      apiKey,
      messages,
      systemPrompt,
      text,
      context,
    };

    // Build fallback chain (only providers we have keys for)
    const fallbacks = [];
    if (modelInfo.provider !== 'openai' && process.env.OPENAI_API_KEY) {
      fallbacks.push({ provider: 'openai', model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY });
    }
    if (modelInfo.provider !== 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      fallbacks.push({ provider: 'anthropic', model: 'claude-3-haiku-20240307', apiKey: process.env.ANTHROPIC_API_KEY });
    }

    // Se Asia ha gia tradotto, il modello non si chiama: si sarebbe
    // pagata due volte la stessa frase.
    let translated, usage, wasFallback;
    if (risultatoAsia) {
      translated = risultatoAsia.translated;
      usage = null;
      wasFallback = false;
    } else {
      ({ translated, usage, wasFallback } = await callLLMWithFallback(primaryOpts, fallbacks, 10000));
    }

    // FASE 9: Validate LLM output — detect garbage, wrong script, meta-text
    const validation = validateOutput(text, translated, targetLang);
    if (!validation.valid) {
      log.warn(`Output validation failed: reason=${validation.reason}, target=${targetLang}, output="${translated?.substring(0, 60)}"`);
      // Strip common LLM meta-text prefixes and retry validation
      if (validation.reason === 'meta_text') {
        translated = translated.replace(/^(Translation:|Here is|Note:)\s*/i, '').trim();
      }
      // If still invalid after cleanup, retry with gpt-4o (better for Asian languages)
      const recheck = validateOutput(text, translated, targetLang);
      if (!recheck.valid) {
        if (modelInfo.actual !== 'gpt-4o') {
          try {
            log.info(`Retrying with gpt-4o for ${targetLang}`);
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
            log.error('Retry with gpt-4o failed:', retryErr.message);
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
    // Asia dichiara il proprio costo e non produce `usage`: senza questo
    // il conto risulterebbe zero e resterebbe solo l'addebito minimo.
    const gptCost = risultatoAsia
      ? risultatoAsia.cost
      : calcGptCost(usage || { prompt_tokens: 0, completion_tokens: 0 });
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
      } catch (e) { log.error('Credit deduct error:', e); }
    }

    // ── Wallet: addebito del messaggio (salvo fase 2 di un audio già pagato) ──
    //
    // b.107 — chi dice che l'audio e gia stato pagato NON e piu il client.
    // Prima bastava mandare `giaAddebitato: true` nel corpo per saltare
    // l'addebito: una riga nel browser e traduzioni gratis a vita.
    // Ora /api/transcribe lascia una ricevuta legata a chi paga e al testo
    // trascritto, e qui la si strappa: vale una volta sola.
    let giaPagatoDavvero = false;
    if (billingEmail && !isOwnKey && !isReview) {
      try {
        const { strappaRicevutaVoce } = await import('../../lib/ricevute.js');
        giaPagatoDavvero = await strappaRicevutaVoce(billingEmail, text);
      } catch (e) { log.warn('ricevuta non verificata:', e?.message); }
    }

    let creditoEsaurito = false;
    if (billingEmail && !isOwnKey && !isReview && !giaPagatoDavvero) {
      const esito = await addebitaTesto(billingEmail, text.length);
      creditoEsaurito = esito === 'esaurito';
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
    // b.154 — PRIMA il tracking (compreso il tetto di piattaforma dentro
    // trackDailySpend) partiva solo con billingEmail: le chiamate anonime
    // (nessun token, nessuna stanza) non venivano mai contate, quindi il
    // tetto di €100/giorno per la piattaforma non le vedeva mai. Ora si
    // traccia sempre (billingEmail null aggiorna solo il contatore
    // aggregato, vedi trackDailySpend in apiAuth.js).
    if (!isOwnKey && !isReview) {
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
    } catch (e) { log.warn('Supabase tracking setup failed:', e?.message); }
    // Fire all background tasks without awaiting
    if (bgTasks.length > 0) Promise.allSettled(bgTasks).catch(() => {});

    return NextResponse.json({
      translated,
      confidence,
      cost: roundCost(msgCostUsd),
      costEurCents: roundEurCents(msgCostEurCents),
      ...(remainingCredits !== undefined ? { remainingCredits } : {}),
      ...(creditoEsaurito && { creditoEsaurito: true })
    });
  } catch (e) {
    // resolveAuth throws NextResponse objects on auth failure
    if (e instanceof NextResponse) return e;
    log.error('Translate error:', e);
    // Report to Sentry
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'translate', source: 'api' } });
    }).catch(() => {});

    // ── INIZIO b.90 — RETE DI SICUREZZA: se l'IA cade, traduci lo stesso ──
    // Trovato dal vivo: con la chiave OpenAI scaduta ogni traduzione
    // rispondeva 502 e l'app restava MUTA, pur avendo un traduttore
    // gratuito (Google, senza chiave) che funzionava benissimo a fianco.
    // Ora quello diventa l'ultima rete: si traduce comunque, si dichiara
    // che è una traduzione di riserva, e NON si addebita nulla.
    try {
      const { text, sourceLang, targetLang } = await leggiCorpoPerRipiego(req);
      if (text && sourceLang && targetLang) {
        const { tryGoogleTranslate } = await import('../../lib/providers.js');
        const ripiego = await tryGoogleTranslate(text, sourceLang, targetLang);
        if (ripiego) {
          log.warn('Traduzione servita dalla rete di sicurezza (IA non disponibile)');
          return NextResponse.json({
            translated: ripiego,
            confidence: calcConfidence(text, ripiego, sourceLang, targetLang),
            cost: 0, costEurCents: 0,
            ripiego: true,           // la UI può dirlo all'utente
            motivo: 'ai_non_disponibile',
          });
        }
      }
    } catch (e2) {
      log.error('Anche la rete di sicurezza ha ceduto:', e2?.message);
    }
    // ── FINE b.90 ──

    return apiError(ErrorCode.TRANSLATION_FAILED, 'Translation service temporarily unavailable');
  }
}

// Rilegge il corpo della richiesta per il ripiego: a questo punto lo
// stream è già consumato, quindi si usa la copia messa da parte.
async function leggiCorpoPerRipiego(req) {
  try {
    if (req._corpoBartalk) return req._corpoBartalk;
    return await req.clone().json();
  } catch { return {}; }
}

export const POST = withApiGuard(handlePost, { maxRequests: 120, prefix: 'translate' });
