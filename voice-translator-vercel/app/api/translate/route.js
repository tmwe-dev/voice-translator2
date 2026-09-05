import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { proteggiEmoji, ripristinaEmoji } from '../../lib/emojiScudo.js';
import { withApiGuard } from '../../lib/apiGuard.js';
import { addCost } from '../../lib/store.js';
import { deductLendingTokens } from '../../lib/users.js';
import { resolveAuth, trackDailySpend, rilasciaRiservaGiornaliera } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcGptCost, calcTtsCost, usdToEurCents, roundCost, roundEurCents } from '../../lib/config.js';
import { redis } from '../../lib/redis.js';
// b.422 — getSupabaseAdmin non serve piu qui: serviva solo alla
// ricerca in `profiles` (tabella inesistente) che apriva il blocco di
// registrazione dello storico. Ora l'unico contatto col database passa
// da saveTranslation, che il client se lo prende da se.
import { saveTranslation as saveTranslationDB } from '../../lib/supabaseAPI.js';
import { validateOutput, MODEL_MAP, calcConfidence, getSimpleHash } from '../../lib/translateValidation.js';
import { buildSystemPrompt, buildMessages } from '../../lib/translatePrompt.js';
import { callLLM, callLLMWithFallback } from '../../lib/llmCaller.js';
import { routeProvider } from '../../lib/providerRouter.js';
import { validateTranslateInput } from '../../lib/schemas.js';
import { ErrorCode, apiError } from '../../lib/errors.js';
import { createLogger } from '../../lib/logger.js';
import { assertElaborazioneConsentita, DirectModeError } from '../../lib/sessionGuard.js';
import { creditoFinito, preventivoTesto } from '../../wallet/addebita.js';
import { riserva, commit, release } from '../../wallet/riserva.js';
import { costoProviderCent, CARATTERI_PER_SECONDO } from '../../wallet/provider-costi.js';

const log = createLogger('translate');

async function handlePost(req) {
  const _t0 = Date.now(); // b.235 — timer per le metriche di latenza per coppia
  // b.161-bis (punto 5) — dichiarata fuori dal try: la rete di sicurezza
  // nel catch esterno deve poterla rilasciare per QUALUNQUE errore
  // imprevisto dopo la riserva, anche uno che scoppia prima ancora di
  // arrivare al blocco try interno piu sotto.
  let riservaId = null;
  // b.632 — le riserve di budget prese da resolveAuth (qui puo esserne
  // presa una SECONDA: il riscatto con gpt-4o piu sotto richiama
  // resolveAuth). Si sommano: sono increment sulle stesse due chiavi.
  // Quel che resta all'uscita si rende — vedi il finally in fondo.
  let riservaGiornoUtente = 0;
  let riservaGiornoPiattaforma = 0;
  let riservaGiornoEmail = null;
  try {
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

    const { text: testoOriginale, sourceLang, targetLang, sourceLangName, targetLangName,
            roomId, context, isReview, domainContext, description, userToken, aiModel, lendingCode,
            roomMode, nativeLang, conversationContext,
            glossario } = { ...rawBody, ...inputValidation.data }; // b.95
    // b.353 — LE EMOTICON NON SI TRADUCONO MAI (collaudo di Luca): ogni
    // gruppo emoji diventa un segnaposto prima che il testo veda un
    // modello, e torna identico al suo posto in ogni risposta. La cache
    // resta coerente: chiave e valore viaggiano entrambi protetti qui e
    // ripristinati la, in modo deterministico.
    const { protetto: text, mappa: mappaEmoji } = proteggiEmoji(testoOriginale);
    const conEmoji = (t) => ripristinaEmoji(t, mappaEmoji);
    // b.161 — non ancora nello schema (vedi schemas.js): stesso trattamento
    // gia riservato a `glossario` qui sopra, un gettone opaco non ha
    // bisogno di sanificazione testuale, solo del controllo tipo fatto
    // da resolveRoomIdentity in store.js.
    const roomSessionToken = typeof rawBody.roomSessionToken === 'string' ? rawBody.roomSessionToken : null;

    // ── Direct mode guard ──
    // b.167 — spostata dopo aver letto roomId/roomSessionToken: prima
    // chiedeva solo all'intestazione x-session-mode (mandata dal client),
    // ora chiede anche alla stanza vera, come /api/reazioni gia faceva.
    try {
      await assertElaborazioneConsentita(req, { roomId, roomSessionToken });
    } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    if (!text) return apiError(ErrorCode.MISSING_FIELD, 'No text provided');

    // ═══ INIZIO b.518 — UN MESSAGGIO DI SOLE EMOTICON NON E UNA DOMANDA ═══
    // TROVATO DAL VIVO in produzione (#805), Home, italiano -> inglese:
    // si scrive «🎉🎉🎉» e sotto compare, come se fosse la traduzione,
    //   «I'm sorry, I can't assist with that.»
    // e la risposta arriva con `cached: true`, cioe il RIFIUTO DEL
    // MODELLO era gia stato salvato in cache e veniva riservito a
    // chiunque scrivesse quella stessa faccina.
    //
    // La causa e il rovescio di b.353: li ogni gruppo di emoticon
    // diventa un segnaposto ⟦n⟧ prima che il testo veda un modello,
    // proprio perche le emoticon non si traducono. Quando pero il
    // messaggio e FATTO SOLO di emoticon, quello che resta e un testo
    // di soli segnaposti — «⟦0⟧» — e al modello si finisce per
    // chiedere di tradurre una stringa senza lingua: risponde che non
    // puo aiutare, e quella frase diventa la "traduzione".
    //
    // Qui si chiude il caso alla radice: se dopo la protezione non
    // resta NIENTE da tradurre (solo segnaposti e spazi), la
    // traduzione e il testo di partenza, identico. Nessun modello,
    // nessun addebito, e — cosa che conta di piu — si passa PRIMA
    // della lettura della cache, quindi la voce avvelenata gia in
    // produzione non viene piu nemmeno guardata.
    const senzaSegnaposti = text.replace(/⟦\d+⟧/g, '').trim();
    if (mappaEmoji.length > 0 && senzaSegnaposti === '') {
      return NextResponse.json({
        translated: testoOriginale,
        confidence: 1,
        cost: 0,
        costEurCents: 0,
        soloEmoji: true
      });
    }
    // ═══ FINE b.518 ═══

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
        translated: conEmoji(cachedTranslation),
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
    let { apiKey, isOwnKey, billingEmail, isLending, lendingCodeUsed, riservatoUtenteCents, riservatoPiattaformaCents } = await resolveAuth({
      userToken,
      roomId,
      roomSessionToken,
      lendingCode: lendingCode || undefined,
      provider: authProvider,
      minCredits: MIN_CREDITS.TRANSLATE,
    });
    riservaGiornoEmail = billingEmail;
    riservaGiornoUtente += riservatoUtenteCents || 0;
    riservaGiornoPiattaforma += riservatoPiattaformaCents || 0;

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
    // b.235 — CONTRATTO DI TRADUZIONE UNICO. Il system prompt (glossario,
    // dominio, contesto della conversazione, modalità) va costruito PRIMA del
    // routing, così Asia e Global usano lo STESSO contratto pur con modelli
    // diversi. Prima Asia girava con opts {} vuoto → niente glossario né
    // dominio: due livelli di qualità. Il Global lo usa come prima (stesso
    // prompt, stesso punto di chiamata: nessun cambio di comportamento).
    // b.563 — con «auto» non sappiamo da che lingua si parte, e va bene:
    // si chiede al modello di riconoscerla. Senza questa riga il prompt
    // direbbe «traduci da auto a italiano», che non vuol dire niente.
    const nomePartenza = sourceLang === 'auto'
      ? (sourceLangName || 'the original language (detect it yourself)')
      : sourceLangName;
    let systemPrompt = buildSystemPrompt({
      sourceLang, targetLang, sourceLangName: nomePartenza, targetLangName,
      roomMode, nativeLang, domainContext, description, isReview, conversationContext,
      glossario, // b.95 — i termini dell'utente pesano sulla traduzione
    });
    // Glossary injection — la richiesta è partita in cima (chiestoGlossario);
    // qui c'è già la risposta. Vale sia per Asia sia per Global.
    let glossaryInjected = false;
    try {
      const glossaryCheck = await chiestoGlossario;
      if (glossaryCheck) { systemPrompt += glossaryCheck; glossaryInjected = true; }
    } catch { /* glossary injection is optional */ }

    // b.235 — CONTESTO RICCO: se c'è anche solo un elemento fra glossario,
    // dominio, contesto conversazione, descrizione, review o modalità aula, la
    // traduzione NON è semplice → niente Qwen-MT secco (ignorerebbe tutto): si
    // usa il contratto completo (Qwen LLM per Asia, oppure Global). Qwen-MT
    // resta il fast path SOLO per il semplice (testo + coppia lingue).
    const contestoRicco = glossaryInjected || !!domainContext || !!conversationContext
      || !!description || !!isReview || roomMode === 'classroom';

    // b.235 — P0 ECONOMIA + scelta utente: se l'utente usa la PROPRIA chiave
    // (isOwnKey) il router NON deve andare in Asia — userebbe la chiave
    // DashScope della PIATTAFORMA mentre il sistema crede sia la chiave utente,
    // e BarTalk pagherebbe senza addebito al wallet. E la scelta di provider
    // dell'utente vince. Quindi: chiave propria → Global.
    const providerRoute = routeProvider(sourceLang, targetLang, {
      userPreference: isOwnKey ? 'global' : undefined,
      model: aiModel,
    });
    let risultatoAsia = null;
    let fallbackDaAsia = false;

    if (providerRoute.provider === 'asia' && providerRoute.confidence >= 0.85) {
      try {
        const { translateAsia } = await import('../../lib/translateAsia.js');
        // Ricco → contratto completo (Qwen LLM). Semplice → Qwen-MT veloce.
        const asiaResult = await translateAsia(text, sourceLang, targetLang,
          contestoRicco ? { systemPrompt, context: domainContext } : {});
        if (asiaResult?.translated && validateOutput(text, asiaResult.translated, targetLang).valid) {
          risultatoAsia = {
            translated: asiaResult.translated,
            provider: asiaResult.provider || 'qwen',
            cost: asiaResult.cost || 0,
          };
        } else {
          fallbackDaAsia = true; // Asia ha risposto ma non valido → si prova il Global
        }
      } catch (asiaErr) {
        fallbackDaAsia = true;
        log.warn('Asia provider failed, falling back to global:', asiaErr.message);
      }
    }


    // b.235 — il system prompt (con glossario) è già stato costruito sopra,
    // PRIMA del routing, così Asia e Global condividono lo stesso contratto.

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

    // b.234 — OSSERVABILITÀ del motore: quale provider ha DAVVERO tradotto.
    // Prima non era esposto, così il fallback Asia→Global (quando translateAsia
    // era assente) avveniva in totale silenzio. Ora è visibile in risposta.
    const motoreUsato = risultatoAsia
      ? (risultatoAsia.provider || 'asia')
      : (wasFallback ? 'global-fallback' : modelInfo.provider);

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
                // b.632 — questa e una SECONDA riserva sul tetto
                // giornaliero, e nessuno la nettava: trackDailySpend piu
                // sotto passa solo quella della prima resolveAuth. Ogni
                // riscatto lasciava appesi 5+5 centesimi per ~25 ore.
                riservaGiornoUtente += retryAuth.riservatoUtenteCents || 0;
                riservaGiornoPiattaforma += retryAuth.riservatoPiattaformaCents || 0;
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
            translated: conEmoji(text),
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
    //
    // b.633 — E QUANDO LA RICEVUTA NON SI PUO NEMMENO LEGGERE?
    // Prima: `false`, cioe «non risulta pagato», cioe si addebitava il
    // testo SOPRA la voce gia addebitata da /api/transcribe. Con Redis
    // irraggiungibile — e le scritture si rilanciano apposta, vedi
    // redis.js b.566 — ogni messaggio vocale si pagava DUE VOLTE, in
    // silenzio, per tutta la durata del guasto.
    // Adesso «non lo so» non e piu «non pagato»: in quel caso non si
    // addebita. Si sbaglia dalla parte dell'utente, come gia fa il tetto
    // giornaliero quando Redis cade (apiAuth.js, fail-open) — e come
    // impone il fatto che l'errore non e suo.
    // COSTO DICHIARATO: durante un guasto Redis anche le traduzioni di
    // solo testo (che una ricevuta non ce l'hanno mai avuta) passano
    // senza addebito. E il prezzo, limitato al guasto, per non
    // addebitare due volte chi ha parlato.
    let giaPagatoDavvero = false;
    if (billingEmail && !isOwnKey) {
      try {
        const { strappaRicevutaVoce } = await import('../../lib/ricevute.js');
        const esito = await strappaRicevutaVoce(billingEmail, text);
        giaPagatoDavvero = esito.pagata || esito.sistemaGiu;
        if (esito.sistemaGiu) log.error('ricevute non raggiungibili: non addebito per non addebitare due volte:', esito.motivo);
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
      // b.170 — si netta la riserva fatta da resolveAuth prima della
      // chiamata (vedi la nota in apiAuth.js): senza, il contatore
      // conterebbe due volte per ogni traduzione.
      bgTasks.push(trackDailySpend(billingEmail, Math.max(MIN_CHARGE.TRANSLATE, msgCostEurCents), riservaGiornoUtente, riservaGiornoPiattaforma).catch(() => {}));
      // b.632 — nettate qui (tutte, compresa quella del riscatto): il
      // finally non deve renderle una seconda volta.
      riservaGiornoUtente = 0;
      riservaGiornoPiattaforma = 0;
    }
    if (isLending && lendingCodeUsed) {
      const tokenEstimate = Math.ceil((text.length + (translated?.length || 0)) / 4);
      bgTasks.push(deductLendingTokens(lendingCodeUsed, tokenEstimate).catch(() => {}));
    }
    // ═══════════════════════════════════════════════════════════════
    // b.422 — LO STORICO DELLE TRADUZIONI NON PASSA PIU DA `profiles`.
    //
    // Qui c'era, prima di ogni cosa, una `sb.from('profiles').select('id')
    // .eq('email', billingEmail).single()`. Verificato sul database vivo
    // di produzione: la tabella `public.profiles` NON ESISTE. Quella
    // select falliva sempre, `profile` restava vuoto, e il `if (!profile)
    // return` subito sotto buttava via TUTTO il blocco.
    //
    // E' questa la ragione per cui `translations` — che invece esiste — e
    // rimasta a ZERO RIGHE: non era l'insert a fallire, era che l'insert
    // non veniva mai nemmeno tentato. Il commento di b.246 diceva «la
    // tabella translations NON ESISTEVA»: non era vero, e per mesi ha
    // fatto guardare nel posto sbagliato.
    //
    // Adesso si scrive direttamente. `user_id` resta vuoto perche non
    // esiste piu nessun posto da cui ricavare un UUID di persona: la
    // colonna nasceva come chiave esterna verso `profiles`, che non c'e.
    // Cio che serve al rapporto costi per fornitore (fornitore, modello,
    // costo, coppia di lingue — vedi app/wallet/costi-fornitori.js) c'e
    // tutto. Se l'insert dovesse comunque fallire, adesso si vede nel
    // registro invece di sparire (b.246).
    //
    // Tolta anche la chiamata a trackUsage: scriveva in `usage_daily`
    // tramite la funzione `increment_usage`, e nemmeno quella tabella
    // esiste. La spesa vera la contano il wallet e trackDailySpend.
    // ═══════════════════════════════════════════════════════════════
    try {
      bgTasks.push(
        saveTranslationDB({
          user_id: null, room_id: roomId || null,
          source_lang: sourceLang, target_lang: targetLang,
          // b.422-bis — IL TESTO NON SI SCRIVE PIU, ne l'originale ne la
          // traduzione. Prima ne finivano 500 caratteri per parte in ogni
          // riga; finche l'insert non partiva mai la cosa era teorica, ma
          // riaccendendolo diventava vera — e con `user_id` vuoto sarebbe
          // stato CIO CHE DI PEGGIO C'E: contenuto di persone vere che
          // nessuna cancellazione account puo piu raggiungere, perche non
          // si sa piu di chi sia. Sarebbe l'esatto contrario di b.419.
          // Cio per cui questa tabella serve davvero — il rapporto costi
          // per fornitore (app/wallet/costi-fornitori.js): fornitore,
          // modello, gettoni, costo, coppia di lingue — non ha bisogno di
          // sapere cosa si sono detti.
          // b.235 — provider/model REALI (motore effettivo), non il
          // modello Global selezionato: prima una traduzione Qwen veniva
          // registrata come openai/gpt-4o-mini, falsando le statistiche.
          provider: motoreUsato,
          ai_model: risultatoAsia ? (risultatoAsia.provider || 'qwen') : modelInfo.actual,
          tokens_in: usage?.prompt_tokens || 0, tokens_out: usage?.completion_tokens || 0,
          duration_ms: Date.now() - _t0, cost_usd: roundCost(msgCostUsd),
          cost_eur_cents: roundEurCents(msgCostEurCents),
          is_cached: false, context_type: domainContext || 'general',
        }).catch((e) => {
          // b.246 — prima era `.catch(() => {})`: registrare i consumi e
          // poi buttare l'errore e' peggio che non registrarli, perche si
          // crede di avere uno storico e non si ha niente.
          log.warn('storico traduzione non salvato:', e?.message);
        })
      );
    } catch (e) { log.warn('Supabase tracking setup failed:', e?.message); }
    // Fire all background tasks without awaiting
    if (bgTasks.length > 0) Promise.allSettled(bgTasks).catch(() => {});

    // b.235 — METRICHE PER COPPIA LINGUISTICA (audit #3): provider scelto →
    // fallback → latenza → validation → qualità. Emesse in produzione (warn,
    // che in prod è attivo) SOLO sugli eventi notevoli — fallback, validation
    // fallita, latenza alta, uso di Asia/Qwen — così i log restano
    // interrogabili (group_by per route/coppia) senza rumore a ogni frase.
    const _lat = Date.now() - _t0;
    const _notevole = !!wasFallback || fallbackDaAsia || validation?.valid === false || _lat > 4000
      || String(motoreUsato).startsWith('qwen') || motoreUsato === 'asia' || motoreUsato === 'global-fallback';
    if (_notevole) {
      log.warn('translate_metrics', {
        pair: `${sourceLang}>${targetLang}`,
        route: providerRoute.provider,        // dove il router voleva mandare
        provider: motoreUsato,                 // chi ha DAVVERO tradotto
        fallback: !!wasFallback || fallbackDaAsia,
        fallbackFrom: fallbackDaAsia ? 'qwen' : (wasFallback ? modelInfo.provider : null),
        validationOk: validation?.valid !== false,
        latencyMs: _lat,
        confidence,
        chars: text.length,
      });
    }

    return NextResponse.json({
      translated: conEmoji(translated),
      confidence,
      provider: motoreUsato, // b.234 — motore reale (asia/qwen-mt / global-fallback / openai…)
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
        // b.353 — anche qui le emoticon restano intatte (scudo locale).
        const scudo = proteggiEmoji(text);
        const ripiegoGrezzo = await tryGoogleTranslate(scudo.protetto, sourceLang, targetLang);
        const ripiego = ripiegoGrezzo ? ripristinaEmoji(ripiegoGrezzo, scudo.mappa) : ripiegoGrezzo;
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
  } finally {
    // b.632 — uscita anticipata (400, 402, fornitore caduto, ripiego
    // Google che non addebita nulla): nessun costo vero, quindi la
    // riserva sul tetto giornaliero torna indietro. Fuoco-e-dimentica:
    // restituire un credito non deve poter allungare la risposta.
    if (riservaGiornoUtente > 0 || riservaGiornoPiattaforma > 0) {
      rilasciaRiservaGiornaliera(riservaGiornoEmail, riservaGiornoUtente, riservaGiornoPiattaforma).catch(() => {});
      riservaGiornoUtente = 0;
      riservaGiornoPiattaforma = 0;
    }
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
