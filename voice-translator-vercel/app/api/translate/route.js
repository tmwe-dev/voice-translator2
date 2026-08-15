import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { addCost } from '../../lib/store.js';
import { deductLendingTokens } from '../../lib/users.js';
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
import { creditoFinito, preventivoTesto } from '../../wallet/addebita.js';
import { riserva, commit, release } from '../../wallet/riserva.js';
import { costoProviderCent, CARATTERI_PER_SECONDO } from '../../wallet/provider-costi.js';

const log = createLogger('translate');

async function handlePost(req) {
  // b.161-bis (punto 5) — dichiarata fuori dal try: la rete di sicurezza
  // nel catch esterno deve poterla rilasciare per QUALUNQUE errore
  // imprevisto dopo la riserva, anche uno che scoppia prima ancora di
  // arrivare al blocco try interno piu sotto.
  let riservaId = null;
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
    // b.161 — non ancora nello schema (vedi schemas.js): stesso trattamento
    // gia riservato a `glossario` qui sopra, un gettone opaco non ha
    // bisogno di sanificazione testuale, solo del controllo tipo fatto
    // da resolveRoomIdentity in store.js.
    const roomSessionToken = typeof rawBody.roomSessionToken === 'string' ? rawBody.roomSessionToken : null;

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
    // b.159 — CONFERMATO (audit b.158, punto indipendente): `isReview` e'
    // un booleano che arriva intatto dal client (vedi schemas.js,
    // `isReview: !!body.isReview`) senza nessuna verifica lato server,
    // a differenza di `giaAddebitato` che da b.107 e' stato tolto dal
    // client proprio per questa ragione. Usarlo per saltare il controllo
    // credito voleva dire: basta mandare `isReview: true` per tradurre
    // gratis a vita, credito a zero compreso. Tolto da qui: resta solo
    // l'uso legittimo in translatePrompt.js (rifinisce il testo del
    // prompt, non tocca mai i soldi).
    let { apiKey, isOwnKey, billingEmail, isLending, lendingCodeUsed } = await resolveAuth({
      userToken,
      roomId,
      roomSessionToken,
      lendingCode: lendingCode || undefined,
      provider: authProvider,
      minCredits: MIN_CREDITS.TRANSLATE,
    });

    // ── b.161 · saldo positivo ma insufficiente: si blocca PRIMA, non dopo ──
    // CONFERMATO (quarto audit esterno, punto 1): resolveAuth chiede solo
    // "il saldo e a zero?" (creditoFinito). Con un saldo positivo ma sotto
    // il costo di QUESTA traduzione, il fornitore (Asia o Global, poco
    // sotto) veniva chiamato e la traduzione consegnata comunque: l'addebito
    // vero, piu in basso, arrivava DOPO il lavoro e la RPC wallet_usa lo
    // rifiuta senza scalare nulla (vedi migrazione 006) — quindi il saldo
    // non scende mai sotto la soglia che lo bloccherebbe. Risultato: traduzioni
    // gratis a ripetizione per chiunque tenesse il saldo appena sopra zero.
    // Il preventivo usa la stessa formula dell'addebito vero (preventivoTesto,
    // su text.length, gia noto qui), cosi non e un controllo separato che
    // puo disallinearsi da quello reale.
    //
    // b.161-bis — CONFERMATO (contestazione utente, punto 5 "Reserve →
    // Provider → Commit/Release non implementato"): questo preventivo
    // chiudeva il bypass RIPETIBILE ma non la finestra di CORSA fra due
    // richieste concorrenti dello stesso utente (leggono lo stesso saldo,
    // lo passano ENTRAMBE, solo l'addebito finale le distingue — la
    // seconda torna "esaurito" ma il fornitore, per lei, e gia stato
    // chiamato). Ora il saldo scende SUBITO con una riserva atomica,
    // PRIMA di chiamare Asia/Global: una seconda richiesta concorrente
    // vede gia il saldo ridotto. Testo di 300 caratteri, costo noto
    // per intero da text.length (non dipende dalla risposta del
    // fornitore): riserva e commit useranno sempre lo stesso numero.
    let costoPrevisto = 0;
    if (billingEmail && !isOwnKey) {
      costoPrevisto = preventivoTesto(text.length);
      const secondiParlatoPrev = Math.ceil(text.length / CARATTERI_PER_SECONDO);
      const r = await riserva(billingEmail, costoPrevisto, {
        tipo: 'testo',
        caratteri: text.length,
        costo_cent: costoProviderCent(secondiParlatoPrev, 'gpt-5.4-mini', 'edge-tts'),
      });
      if (!r.ok) {
        return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      }
      riservaId = r.riservaId;
    }

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
    // b.166 — CONFERMATO (caccia al tesoro): senza maxTokens esplicito,
    // callLLM() usa il default di 500 — con `text` accettato fino a 10.000
    // caratteri (schemas.js) e la modalita isReview pensata proprio per
    // passaggi lunghi, una traduzione poteva troncarsi silenziosamente
    // (il controllo lunghezza in validateOutput scatta solo sotto il 10%
    // di rapporto, non su un troncamento proporzionato). Scalato in base
    // alla lunghezza dell'input, con un tetto per non esplodere il costo
    // reale sui provider su testi anomali.
    const maxTokensStimati = Math.min(4096, Math.max(500, Math.ceil(text.length / 2)));
    const primaryOpts = {
      provider: modelInfo.provider,
      model: modelInfo.actual,
      apiKey,
      messages,
      systemPrompt,
      text,
      context,
      maxTokens: maxTokensStimati,
    };

    // Build fallback chain (only providers we have keys for)
    const fallbacks = [];
    if (modelInfo.provider !== 'openai' && process.env.OPENAI_API_KEY) {
      fallbacks.push({ provider: 'openai', model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY });
    }
    if (modelInfo.provider !== 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      fallbacks.push({ provider: 'anthropic', model: 'claude-3-haiku-20240307', apiKey: process.env.ANTHROPIC_API_KEY });
    }

    // b.160 — CONFERMATO (secondo audit esterno, punto 4): correggere
    // isOwnKey DOPO il fallback (b.159) chiude l'addebito mancante solo
    // per chi ha credito nel wallet. Per chi dichiara "uso la mia
    // chiave" con una chiave FALSA o rotta e wallet a ZERO, resolveAuth
    // salta il controllo credito in partenza (isOwnKey=true a quel
    // punto), la chiamata vera fallisce sempre, il fallback di
    // piattaforma la completa comunque, e l'addebito a valle fallisce
    // ('esaurito') ma la traduzione viene restituita lo stesso: un
    // trucco ripetibile all'infinito (nessun controllo credito su
    // NESSUna richiesta, perche isOwnKey resta true all'inizio di ogni
    // chiamata) — non una race isolata come per un utente normale che
    // esaurisce il credito a meta (li' resolveAuth blocca dalla
    // richiesta successiva). Se l'utente dichiarava una chiave propria
    // e il wallet e' gia a zero, il fallback di piattaforma NON si
    // tenta: niente chiave propria valida + niente credito = errore
    // esplicito, non un giro gratis pagato da BarTalk.
    if (isOwnKey && fallbacks.length && billingEmail) {
      const senzaCredito = await creditoFinito(billingEmail, { failClosed: true });
      if (senzaCredito) fallbacks.length = 0;
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

    // b.159 — CONFERMATO (audit b.158, punto 10): se il fornitore scelto
    // ha fallito ed e' scattato il fallback, la chiamata reale e' partita
    // con una chiave di PIATTAFORMA (vedi llmCaller.js: ogni fallback usa
    // process.env.*_API_KEY), non piu con la chiave dell'utente. `isOwnKey`
    // pero restava quello calcolato da resolveAuth prima del fallback: se
    // l'utente aveva la propria chiave, tutti i controlli di addebito piu
    // sotto (righe con `!isOwnKey`) vedevano isOwnKey=true e saltavano
    // l'addebito — una chiamata pagata dalla piattaforma, mai contata.
    if (wasFallback && isOwnKey) {
      isOwnKey = false;
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
              // b.161 — CONFERMATO (terzo audit esterno, punto 3): questa
              // seconda resolveAuth passava `skipCreditCheck:true` a
              // prescindere, e il suo `isOwnKey` non veniva mai riportato
              // sulla `isOwnKey` esterna. Se il provider originale era a
              // chiave propria (isOwnKey=true, es. Anthropic) e la
              // traduzione falliva la validazione, questo retry poteva
              // usare la chiave OpenAI di PIATTAFORMA (nessuna chiave
              // OpenAI propria salvata) senza ALCUN controllo credito e
              // senza che l'addebito piu sotto se ne accorgesse mai — la
              // stessa classe di difetto del fallback, corretta in b.159,
              // ma qui dimenticata. Ora il controllo credito e' quello
              // vero (skipCreditCheck tolto: se isOwnKey risulta true per
              // questo retry, il controllo si salta comunque da solo,
              // come sempre) e isOwnKey esterna si allinea al risultato.
              try {
                const retryAuth = await resolveAuth({
                  userToken, roomId, roomSessionToken, provider: 'openai',
                  minCredits: 0,
                });
                retryKey = retryAuth.apiKey;
                if (isOwnKey && !retryAuth.isOwnKey) {
                  isOwnKey = false;
                }
              } catch { /* wallet esaurito o chiave assente: niente retry pagato, si tiene il testo originale */ }
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
          // b.161-bis — mai un addebito per una traduzione respinta: la
          // riserva presa piu sopra (se c'era) torna intera nel wallet.
          if (riservaId) { await release(riservaId, 'validazione_fallita'); riservaId = null; }
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

    // b.157 — audit pagamenti: qui c'era ANCHE un addebito sul vecchio
    // user.credits (Redis), in parallelo a quello vero sul wallet subito
    // sotto. apiAuth.js dice da tempo che "l'UNICA verita e il wallet":
    // l'autorizzazione (resolveAuth/creditoFinito) legge gia solo il
    // wallet, quindi quel secondo addebito non decideva piu niente — solo
    // due scritture per ogni traduzione invece di una, e un numero
    // (remainingCredits, mai letto da nessun client) che non descriveva
    // il saldo vero mostrato in CreditsView. Tolto.

    // ── Wallet: addebito del messaggio (salvo fase 2 di un audio già pagato) ──
    //
    // b.107 — chi dice che l'audio e gia stato pagato NON e piu il client.
    // Prima bastava mandare `giaAddebitato: true` nel corpo per saltare
    // l'addebito: una riga nel browser e traduzioni gratis a vita.
    // Ora /api/transcribe lascia una ricevuta legata a chi paga e al testo
    // trascritto, e qui la si strappa: vale una volta sola.
    let giaPagatoDavvero = false;
    if (billingEmail && !isOwnKey) {
      try {
        const { strappaRicevutaVoce } = await import('../../lib/ricevute.js');
        giaPagatoDavvero = await strappaRicevutaVoce(billingEmail, text);
      } catch (e) { log.warn('ricevuta non verificata:', e?.message); }
    }

    // ── b.161-bis · CONFERMA (o rilascio) della riserva presa sopra ──
    //
    // Caso normale: la riserva presa PRIMA del fornitore (billingEmail
    // e isOwnKey ORIGINALI, prima di ogni fallback) si conferma qui
    // allo stesso costo (mai un rilascio parziale per questa rotta:
    // vedi commento sopra sulla riserva).
    //
    // Caso "gia pagato": la ricevuta della voce (strappaRicevutaVoce)
    // dice che questo testo e' gia stato addebitato da /api/transcribe.
    // La riserva presa sopra (se c'era) va restituita INTERA: non e'
    // un secondo addebito, e' lo stesso gesto.
    //
    // Caso b.159 (isOwnKey passato da true a false per un fallback su
    // chiave di piattaforma, righe 272-274 sopra): la riserva NON era
    // stata presa (billingEmail+isOwnKey ORIGINALI dicevano "chiave
    // propria, nessun controllo"), ma il fornitore vero e' stato
    // chiamato con la chiave di PIATTAFORMA e va fatturato. Qui non
    // c'e' piu finestra di corsa da chiudere (il fornitore e' gia
    // stato chiamato): riserva+commit valgono solo come l'addebito
    // atomico che c'era prima di questa migrazione (wallet_usa).
    let creditoEsaurito = false;
    if (billingEmail && !isOwnKey && !giaPagatoDavvero) {
      if (riservaId) {
        await commit(riservaId, costoPrevisto, { tipo: 'testo', caratteri: text.length });
        riservaId = null;
        creditoEsaurito = await creditoFinito(billingEmail);
      } else {
        const costoTardivo = preventivoTesto(text.length);
        const secondiParlatoTardivo = Math.ceil(text.length / CARATTERI_PER_SECONDO);
        const rTardiva = await riserva(billingEmail, costoTardivo, {
          tipo: 'testo',
          caratteri: text.length,
          costo_cent: costoProviderCent(secondiParlatoTardivo, 'gpt-5.4-mini', 'edge-tts'),
          nota: 'addebito_tardivo_dopo_fallback_b159',
        });
        if (rTardiva.ok) {
          await commit(rTardiva.riservaId, costoTardivo, { tipo: 'testo', caratteri: text.length });
        } else {
          creditoEsaurito = true;
        }
      }
    } else if (riservaId) {
      await release(riservaId, 'gia_pagato_o_non_dovuto');
      riservaId = null;
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
    if (!isOwnKey) {
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
      ...(creditoEsaurito && { creditoEsaurito: true })
    });
  } catch (e) {
    // b.161-bis — rete di sicurezza: qualunque errore imprevisto dopo la
    // riserva ma prima del commit deve restituire il credito, altrimenti
    // resta bloccato fino alla pulizia periodica (10 minuti). Coerente
    // con "NON si addebita nulla" gia dichiarato piu sotto per la rete
    // di sicurezza Google.
    if (riservaId) await release(riservaId, 'errore_imprevisto').catch(() => {});
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
