'use client';
import { glossarioPerTesto } from '../lib/glossario.js';
import { tracciaConsumo } from '../lib/consumo.js';
import { useRef, useCallback } from 'react';
import { getLang, FREE_DAILY_LIMIT } from '../lib/constants.js';
// b.139 — la regola su quali strade puo prendere un messaggio era scritta a
// mano in tre punti di questo file, sotto forma di `!isDirect` sparsi. Bastava
// dimenticarne uno perche in modalita Diretta un pezzo di conversazione uscisse
// da Realtime. Ora la si chiede una volta a `trasportiAmmessi()`.
import { isDirectMode } from '../lib/sessionGuard.js';
import { trasportiAmmessi, TRASPORTO } from '../lib/decisioni.js';
import { createLogger } from '../lib/logger.js';
import { puoPartire } from '../lib/reati.js';
import { toast } from '../lib/avvisi.js';
import { cronometro } from '../lib/monitorSviluppo.js';
const dbg = createLogger('translation-api');

// b.247 — lo stesso formato che accetta /api/messages (POST e PATCH).
// Un identificativo che il server rifiuterebbe non deve nemmeno partire:
// altrimenti la fase 2 andrebbe a cercare per contenuto senza dirlo a
// nessuno, che e esattamente il difetto che questo giro elimina.
const FORMATO_ID_SPEDIZIONE = /^tmp_[\w-]{1,60}$/;

/**
 * Translation API hook — handles all translation calls with caching and multi-target support.
 *
 * Responsibilities:
 * - Call appropriate translation endpoint (free/paid/consensus)
 * - In-memory LRU translation cache (5 min TTL, max 200 entries)
 * - Resolve target language(s) from room members
 * - Parallel translation to all target languages
 * - Send translated message to room
 *
 * Returns: { translateUniversal, sendMessage, getTargetLangInfo, getAllTargetLangs, translateToAllTargets }
 */
export default function useTranslationAPI({
  myLangRef,
  roomInfoRef,
  prefsRef,
  roomId,
  roomContextRef,
  isTrialRef,
  freeCharsRef,
  useOwnKeys,
  getEffectiveToken,
  refreshBalance,
  trackFreeChars,
  userEmail,
  sentByMeRef,
  roomSessionTokenRef,
  broadcastMessage,
  broadcastMessageUpdate, // Phase 2: broadcast translation to partner
  sendDirectMessage,  // WebRTC DataChannel: P2P instant delivery
  spedisciContenuto,  // b.111 — come sopra, ma se non parte lo tiene da parte
  verifiedNameRef,
  addLocalMessage,    // Callback to add message to local messages[] immediately
  updateLocalMessage, // Callback to update existing message (add translation)
  sessionModeRef,     // 'direct' | 'translate' — controls server-side processing
}) {
  // ── Translation cache: avoid re-translating identical text ──
  // Key: `${text}|${srcLang}|${tgtLang}` → { translated, ts }
  const translationCacheRef = useRef(new Map());

  // ── Track the last server save promise so Phase 2 PATCH can wait for Phase 1 POST ──
  // Without this, the PATCH arrives before the POST completes → server can't find the message
  const lastServerSaveRef = useRef(null);

  // ── Ultimo testo inviato (freno anti doppio invio VAD+tasto) ──
  // b.247 — resta SOLO come ripiego per chi non dichiara l'origine
  // dell'invio: vedi la nota lunga dentro `sendMessage`.
  const lastSentTextRef = useRef({ testo: '', quando: 0 });
  // ── b.247 · il registro delle spedizioni: la chiave e l'IDENTITA ──
  //
  // Da b.126 a b.246 questa mappa era TESTO → id (`set(original, tempId)`).
  // Era sbagliata nel verso: se una persona scriveva "ok" due volte, la
  // seconda voce SOVRASCRIVEVA la chiave della prima. L'identita del
  // primo messaggio spariva, e quando le traduzioni tornavano fuori
  // ordine la PATCH del PRIMO messaggio portava l'identificativo del
  // SECONDO: la traduzione finiva sul messaggio sbagliato. E' lo stesso
  // difetto gia corretto sul server in b.126, rimasto qui sul client
  // perche la mappa lo reintroduceva un attimo prima di parlare.
  //
  // Ora la chiave e l'identificativo della spedizione (`tmp_...`, lo
  // stesso che viaggia fino al server come `clientId`) e il valore dice
  // a quale messaggio appartiene. Il contenuto non identifica piu niente:
  // il testo non e l'identita di un evento.
  //
  // Lo stesso registro fa da memoria per l'anti doppio invio: una
  // spedizione gia partita si riconosce dal SUO identificativo.
  const idSpedizioneRef = useRef(new Map());

  /**
   * Send a translated message to the room.
   *
   * Priority order for instant delivery:
   * 1. WebRTC DataChannel (P2P, ~50ms) — if connected
   * 2. Supabase Realtime broadcast (~100ms) — if connected
   * 3. HTTP polling fallback (2-10s) — always works
   *
   * Server save always happens in parallel for persistence.
   */
  // b.247 — `opzioni.idCattura` e l'identificativo dell'EVENTO di cattura,
  // generato all'origine (la dettatura, il blocco audio, il tocco sul
  // tasto) da chi quel testo lo ha raccolto. Da qui in poi accompagna il
  // messaggio fino al server come `clientId` e torna nella fase 2: non
  // viene mai ricostruito dal contenuto.
  const sendMessage = useCallback(async (original, translated, sourceLang, targetLang, translations, opzioni = {}) => {
    if (!roomId) return null;

    // ── b.111 · il confine, prima di tutto il resto ──
    // Nelle stanze hot si puo litigare: il velo grigio non scende. Ma
    // minacce, ricatti, istigazione e qualsiasi cosa riguardi minori
    // non partono da NESSUNA stanza, hot comprese.
    //
    // Il controllo sta qui e non piu in la per una ragione precisa:
    // qui e prima di ogni invio, e quindi vale anche in modalita
    // Direct, dove il server non vede niente e non potrebbe fermare
    // nulla. Il controllo sul server (in /api/messages) resta comunque,
    // perche un client si puo modificare.
    const confine = puoPartire(original);
    if (!confine.ok) {
      dbg.warn('[sendMessage] fermato al confine:', confine.categoria);
      // Si dice PERCHE. Un messaggio che sparisce senza spiegazione fa
      // pensare a un guasto, e chi ha scritto lo riscrive uguale.
      toast.error(confine.motivo);
      return { bloccato: true, categoria: confine.categoria, motivo: confine.motivo };
    }

    // ── b.247 · il freno anti doppio invio guarda l'EVENTO, non il testo ──
    //
    // Prima era: "stesso testo entro 2,5 s = blocca". Era nato per il
    // doppio scatto — parlando, l'auto-invio del VAD (silenzio) e il
    // tocco sul tasto partono quasi insieme e mandano DUE VOLTE la
    // stessa cattura — ma non sapeva distinguerlo da una persona che
    // dice davvero "si" due volte di fila. Il secondo "si" spariva:
    // niente errore, niente messaggio, nessun modo di capirlo. E'
    // esattamente il difetto corretto sul server in b.126, che qui sul
    // client era rimasto in piedi.
    //
    // Ora chi cattura la voce assegna un identificativo all'EVENTO e lo
    // dichiara: due invii dello stesso evento hanno lo stesso
    // identificativo — e sono un doppione — mentre due frasi uguali dette
    // in due momenti diversi hanno identificativi diversi e passano
    // entrambe.
    const ora = Date.now();
    const idDichiarato = typeof opzioni.idCattura === 'string' && FORMATO_ID_SPEDIZIONE.test(opzioni.idCattura)
      ? opzioni.idCattura
      : null;
    if (idDichiarato) {
      if (idSpedizioneRef.current.has(idDichiarato)) {
        dbg.debug('[sendMessage] doppio scatto della stessa cattura, bloccato:', idDichiarato);
        return null;
      }
    } else if (original === lastSentTextRef.current.testo && ora - lastSentTextRef.current.quando < 2500) {
      // Ripiego per chi NON dichiara l'origine: senza un identificativo
      // non c'e proprio altro modo di riconoscere il doppio scatto, e
      // toglierlo qui vorrebbe dire peggiorare la protezione. Resta la
      // vecchia regola sul testo, ma vale SOLO su questa strada — chi
      // l'origine la dichiara non ci passa mai.
      dbg.debug('[sendMessage] Doppio invio bloccato (origine non dichiarata):', original.slice(0, 30));
      return null;
    }
    lastSentTextRef.current = { testo: original, quando: ora };

    const senderName = verifiedNameRef?.current || prefsRef.current.name;
    // b.247 — l'identificativo della spedizione E quello della cattura,
    // quando c'e: una cattura produce un messaggio, e avere due nomi per
    // la stessa cosa e il modo piu rapido per farli divergere.
    const tempId = idDichiarato || `tmp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    // b.247 — la voce si annota sotto l'identificativo, non sotto il
    // testo (vedi la nota su `idSpedizioneRef`): cosi due messaggi con
    // lo stesso contenuto restano due messaggi distinti. Si tiene corta:
    // oltre 50 voci si butta la piu vecchia, perche una mappa che cresce
    // all'infinito e una perdita di memoria con un altro nome (stessa
    // regola della posta in uscita, b.111).
    if (idSpedizioneRef.current.size > 50) {
      idSpedizioneRef.current.delete(idSpedizioneRef.current.keys().next().value);
    }
    idSpedizioneRef.current.set(tempId, { original, sender: senderName, quando: ora });

    // Build a message object for instant delivery
    const instantMsg = {
      id: tempId,
      roomId,
      sender: senderName,
      original,
      translated,
      sourceLang,
      targetLang,
      translations: translations || null,
      timestamp: Date.now(),
      // ── b.120 · "in coda" non e "consegnato" ──
      // Fino a ieri qui c'era `_status: 'sent'`, messo PRIMA che
      // qualunque cosa fosse partita. Un messaggio parcheggiato nella
      // posta in uscita — perche il canale era chiuso, perche la rete
      // era caduta — mostrava la stessa identica spunta di uno arrivato
      // dall'altra parte.
      //
      // E un difetto che ho introdotto io in b.111: la posta in uscita
      // ha smesso di PERDERE i messaggi, ma ha cominciato a far credere
      // che fossero partiti. Meglio del prima, ma disonesto.
      //
      // Ora si parte dal vero: e in coda. Diventa "inviato" solo quando
      // qualcuno lo ha davvero preso in carico.
      _status: 'in-coda',
    };

    const vie = trasportiAmmessi(sessionModeRef?.current);
    const isDirect = !vie[TRASPORTO.SERVER];

    // ── Instant delivery: P2P (always) + Realtime broadcast (only in Translate mode) ──
    // Priority 1: WebRTC DataChannel (P2P, ~50ms) — ALWAYS, in both modes
    // b.111 — prima era `try { sendDirectMessage(...) } catch { /* via di riserva: il canale diretto si e chiuso, il messaggio viaggia comunque per il server */ }`:
    // se il canale non era aperto la funzione restituiva `false` e
    // nessuno lo guardava; se le chiavi non erano ancora pronte
    // SOLLEVAVA e il catch vuoto se lo mangiava. In modalita Direct non
    // c'e copia sul server: quel messaggio era perso per sempre, e
    // intanto compariva nella propria chat come inviato.
    // La chiave con cui questo messaggio si riconosce dopo, per
    // aggiornarne lo stato: la stessa che usa la posta in uscita.
    const chiaveMsg = instantMsg.id || tempId;
    // b.247 — lo stato si segna sul messaggio NOMINATO col suo
    // identificativo: prima `updateLocalMessage` lo cercava per
    // `sender + original`, e con due messaggi identici la spunta del
    // secondo finiva sul primo. Testo e mittente restano come ripiego,
    // per i messaggi che un identificativo non ce l'hanno.
    const segnaStato = (stato) => {
      if (!updateLocalMessage) return;
      updateLocalMessage(original, senderName, { _status: stato }, tempId);
    };

    if (spedisciContenuto) {
      // b.120 — il risultato NON si butta piu: dice se e partito davvero
      // o se e rimasto sullo scrittoio.
      Promise.resolve(spedisciContenuto(chiaveMsg, { type: 'chat-message', message: instantMsg }))
        .then((partito) => { if (partito) segnaStato('inviato'); })
        .catch(() => { /* resta "in coda": la posta riprovera da sola */ });
    } else if (sendDirectMessage) {
      try { sendDirectMessage({ type: 'chat-message', message: instantMsg }); } catch { /* via di riserva, usata solo se la posta in uscita non c e: chi ascolta se ne accorge dallo stato del canale */ }
    }
    // Priority 2: Supabase Realtime broadcast (~100ms)
    // BLOCKED in Direct mode — no message content through Supabase
    if (broadcastMessage && vie[TRASPORTO.REALTIME]) {
      broadcastMessage(instantMsg);
    }

    // Mark temp ID as sent by me immediately (before server save)
    if (sentByMeRef) {
      sentByMeRef.current.add(tempId);
      // LRU cap to prevent unbounded growth
      if (sentByMeRef.current.size > 500) {
        const first = sentByMeRef.current.values().next().value;
        sentByMeRef.current.delete(first);
      }
    }

    // ── Add to LOCAL messages[] immediately so the sender sees their own message ──
    // Without this, the sender sees nothing until polling brings it back (2-10s)
    // because Supabase Realtime has self:false and P2P sends only to partner.
    if (addLocalMessage) {
      addLocalMessage(instantMsg);
    }

    // ── Server save: BLOCKED in Direct mode (no server persistence) ──
    // In Translate mode: fire-and-forget for persistence and polling fallback.
    if (isDirect) {
      lastServerSaveRef.current = Promise.resolve(null);
      // b.247 — si restituisce anche l'identificativo: chi ha chiamato
      // deve poterlo passare alla fase 2 senza andarselo a ricostruire.
      return { message: instantMsg, serverSave: Promise.resolve(null), clientId: tempId };
    }

    // IMPORTANT: Store the promise so Phase 2 PATCH can await it before updating.
    const serverSavePromise = fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        sender: senderName,
        roomSessionToken: roomSessionTokenRef?.current || null,
        original,
        translated,
        sourceLang,
        targetLang,
        translations: translations || null,
        clientId: tempId, // per il dedup lato ricevente (stesso messaggio, canali diversi)
      })
    }).then(res => {
      if (res.ok) {
        // b.120 — il server lo ha preso in carico: da qui in poi non e
        // piu "in coda". Non e ancora "consegnato": quello lo dira
        // l'altro telefono con la sua conferma.
        segnaStato('inviato');
        return res.json().then(data => {
          if (data.message?.id && sentByMeRef) {
            sentByMeRef.current.add(data.message.id);
          }
          return data;
        });
      }
      // b.120 — il server ha risposto male. Prima non lo sapeva nessuno
      // e il messaggio restava li con la sua bella spunta.
      segnaStato('fallito');
      return null;
    }).catch(e => {
      console.error('[sendMessage] Server save error:', e);
      segnaStato('fallito');
      return null;
    });

    // Store promise so Phase 2 PATCH can await it
    lastServerSaveRef.current = serverSavePromise;

    // Return immediately with the instant message — don't await server save
    // The promise is kept alive so it completes in background
    // b.247 — vedi sopra: l'identificativo esce insieme al messaggio.
    return { message: instantMsg, serverSave: serverSavePromise, clientId: tempId };
  }, [roomId, prefsRef, roomSessionTokenRef, sentByMeRef, broadcastMessage, sendDirectMessage, spedisciContenuto, verifiedNameRef, addLocalMessage, updateLocalMessage]);

  /**
   * Phase 2: Send translation update for an already-sent message.
   * Updates local display, broadcasts to partner via P2P + Realtime,
   * and updates the server-saved message.
   */
  // b.247 — `opzioni.clientId` e l'identificativo che la fase 1 ha dato a
  // QUESTA spedizione. Arriva da chi chiama, che lo ha ricevuto (o
  // generato) all'origine: e' l'unico modo perche la traduzione sappia su
  // quale messaggio posarsi. Prima veniva ripescato da una mappa
  // TESTO → id, e con due messaggi uguali indicava sempre l'ultimo.
    const sendTranslationUpdate = useCallback((original, translated, sourceLang, targetLang, translations, opzioni = {}) => {
    if (!roomId) return;
    const senderName = verifiedNameRef?.current || prefsRef.current.name;

    // b.247 — l'identificativo non si cerca piu per contenuto: o viaggia
    // con la chiamata, o non c'e.
    const clientId = typeof opzioni.clientId === 'string' && FORMATO_ID_SPEDIZIONE.test(opzioni.clientId)
      ? opzioni.clientId
      : '';
    // b.247 — dal registro si prendono il testo e il mittente ESATTI con
    // cui la spedizione e partita. I campi `original` e `sender` della
    // PATCH restano solo come ripiego per i server che non conoscono
    // ancora l'identificativo: se non combaciassero con quelli salvati,
    // quel ripiego mancherebbe il bersaglio in silenzio.
    const spedizione = clientId ? idSpedizioneRef.current.get(clientId) : null;
    const testoInviato = spedizione ? spedizione.original : original;
    const mittente = spedizione ? spedizione.sender : senderName;

    // b.247 — `tempId` viaggia anche verso l'altro telefono. Non e un
    // campo nuovo: `handleMessageUpdate` (useRoomPolling.js) lo legge gia
    // per non applicare due volte lo stesso aggiornamento arrivato da due
    // canali — solo che NESSUNO glielo mandava, e ripiegava su
    // `sender|original`. Con due messaggi uguali quella chiave era la
    // stessa: il secondo aggiornamento veniva scartato come doppione.
    const updatePayload = { sender: mittente, original: testoInviato, translated, sourceLang, targetLang, translations, timestamp: Date.now(), ...(clientId && { tempId: clientId }) };

    // Update local message immediately (sender sees translation)
    // b.247 — anche qui si NOMINA il messaggio: senza l'identificativo,
    // con due messaggi uguali la traduzione del secondo si posava sul
    // primo anche sullo schermo di chi l'aveva scritta.
    if (updateLocalMessage) {
      updateLocalMessage(testoInviato, mittente, { translated, targetLang, translations }, clientId || undefined);
    }

    const vie = trasportiAmmessi(sessionModeRef?.current);

    // Broadcast to partner via P2P (fastest) — always
    if (sendDirectMessage) {
      try { sendDirectMessage({ type: 'message-update', ...updatePayload }); } catch { /* la traduzione viaggia anche per Realtime e per il server: se il canale diretto e chiuso arriva lo stesso */ }
    }
    // Broadcast to partner via Realtime — BLOCKED in Direct mode
    if (broadcastMessageUpdate && vie[TRASPORTO.REALTIME]) {
      broadcastMessageUpdate(updatePayload);
    }

    // ── Server update: BLOCKED in Direct mode ──
    if (!vie[TRASPORTO.SERVER]) return;

    // ── Server update: PATCH with smart retry ──
    // Strategy: Try PATCH immediately (Phase 1 POST is usually done by now).
    // If it fails with 404 (POST not yet persisted), retry up to 2 times after 300ms delay.
    // This gives the POST more time to persist (300ms + 600ms = up to 900ms total wait).
    const doPatch = async (retryCount = 0) => {
      try {
        const res = await fetch('/api/messages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            roomSessionToken: roomSessionTokenRef?.current || null,
            // b.126 — si dice QUALE messaggio aggiornare, invece di
            // farlo indovinare dal contenuto: due "si" di fila dello
            // stesso utente sono indistinguibili, e la traduzione del
            // primo, arrivando tardi, finiva sul secondo.
            // b.247 — e ora l'identificativo arriva davvero dalla fase 1,
            // invece di essere ripescato da una mappa TESTO → id che con
            // due messaggi uguali restituiva sempre l'ULTIMO: la PATCH
            // del primo messaggio finiva sul secondo. `original` e
            // `sender` restano per i server senza il nuovo percorso.
            clientId,
            original: testoInviato,
            sender: mittente,
            translated,
            targetLang,
            translations,
          })
        });
        if (!res.ok && res.status === 404 && retryCount < 2) {
          // Phase 1 POST not yet persisted — retry after delay to give it time to persist
          await new Promise(r => setTimeout(r, 300));
          return doPatch(retryCount + 1);
        }
      } catch (e) {
        console.error('[sendTranslationUpdate] Server PATCH error:', e);
      }
    };

    // Fire PATCH immediately — no more waiting for Phase 1 promise
    doPatch();
  }, [roomId, prefsRef, verifiedNameRef, roomSessionTokenRef, sendDirectMessage, broadcastMessageUpdate, updateLocalMessage]);

  /**
   * Translate text using the appropriate endpoint (free/paid/consensus).
   * Includes in-memory cache with 5 min TTL and LRU eviction.
   */
  const translateUniversal = useCallback(async (text, sourceLang, targetLang, sourceLangName, targetLangName, options = {}) => {
    // ── Direct mode: NO translation — messages stay in original language ──
    if (isDirectMode(sessionModeRef?.current)) {
      return { translated: text, cached: false, directMode: true };
    }

    // ── Cache lookup: exact match avoids redundant API calls ──
    const cacheKey = `${text}|${sourceLang}|${targetLang}`;
    const cached = translationCacheRef.current.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < 900000) { // 15 min TTL (was 5min)
      return { translated: cached.translated, cached: true };
    }

    if (isTrialRef.current) {
      // FREE FOR ALL: no daily limit check
      const translationMode = prefsRef.current?.translationMode || 'standard';
      const translationProviders = prefsRef.current?.translationProviders;

      // Guaranteed mode → use consensus endpoint (3 providers in parallel)
      if (translationMode === 'guaranteed') {
        const res = await fetch('/api/translate-consensus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text, sourceLang, targetLang,
            roomId,
            roomSessionToken: roomSessionTokenRef?.current || undefined,
            // b.168 — l'email non si dichiara piu: il server la ricava da
            // un token di sessione verificato (se presente). Senza account
            // (il caso normale qui, e' il percorso "prova gratis") resta
            // semplicemente assente, come sempre.
            userToken: getEffectiveToken(),
          })
        });
        if (!res.ok) return { translated: text };
        const data = await res.json();
        if (data.charsUsed > 0) { trackFreeChars(data.charsUsed); tracciaConsumo(roomId, data.charsUsed); }
        return data;
      }

      // Standard or Superfast → use translate-free
      const res = await fetch('/api/translate-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, sourceLang, targetLang,
          superfast: translationMode === 'superfast' ? true : undefined,
          userProviderPrefs: translationProviders,
          // b.167 — senza questi il server non puo chiedere alla stanza se
          // e Diretta: vedi la nota su roomSessionToken piu sotto, stesso
          // punto dell'audit del 14/8, stessa correzione.
          roomId,
          roomSessionToken: roomSessionTokenRef?.current || undefined,
          // b.168 — vedi la nota sopra sulla chiamata a translate-consensus.
          userToken: getEffectiveToken(),
        })
      });
      if (!res.ok) return { translated: text };
      const data = await res.json();
      if (data.charsUsed > 0) { trackFreeChars(data.charsUsed); tracciaConsumo(roomId, data.charsUsed); }
      return data;
    }

    let result;
    // b.275 — la traduzione: da che lingua a che lingua, quanto ci mette,
    // e se e finita bene. Si registrano SOLO misure, mai il testo.
    const fineTraduzione = cronometro('traduzione', {
      da: sourceLang, a: targetLang, caratteri: (text || '').length,
    });
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sourceLang,
          targetLang,
          sourceLangName,
          targetLangName,
          roomId,
          // b.161 — senza questo, resolveAuth rifiuta con 401 il percorso
          // roomId (vedi apiAuth.js, punto 2 quarto audit): il roomId da
          // solo non basta piu a fatturare all'host della stanza.
          roomSessionToken: roomSessionTokenRef?.current || undefined,
          aiModel: prefsRef.current?.aiModel || undefined,
          ...options,
          userToken: getEffectiveToken(),
          glossario: glossarioPerTesto(text) // b.95 — i termini dell'utente
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 402) {
          console.warn('[translateUniversal] No credits (402), falling back to free translation');
          throw new Error('no-credits');
        }
        console.warn('[translateUniversal] Paid translate failed:', res.status, errData.error);
        fineTraduzione({ stato: res.status, esito: 'errore' });
        throw new Error('Translation error');
      }
      result = await res.json();
      fineTraduzione({ stato: res.status, fornitore: result?.provider || result?.model || '?', esito: 'ok' });
      // Wallet: era l'ultimo messaggio col credito — avvisa la batteria
      if (result.creditoEsaurito) window.dispatchEvent(new CustomEvent('wallet:esaurito'));
    } catch (paidErr) {
      // ── Fallback to free translation when paid fails ──
      // This ensures translation ALWAYS works even if credits are exhausted,
      // auth is broken, or the paid API has issues. Quality may be lower
      // (Microsoft/Google vs LLM) but the message gets translated.
      dbg.debug('[translateUniversal] Falling back to free translation:', paidErr.message);
      try {
        const freeRes = await fetch('/api/translate-free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text, sourceLang, targetLang,
            roomId,
            roomSessionToken: roomSessionTokenRef?.current || undefined,
          })
        });
        if (freeRes.ok) {
          result = await freeRes.json();
        } else {
          // Both paid and free failed — return original text
          console.error('[translateUniversal] Free fallback also failed:', freeRes.status);
          return { translated: text, fallback: true };
        }
      } catch (freeErr) {
        console.error('[translateUniversal] Free fallback error:', freeErr);
        return { translated: text, fallback: true };
      }
    }

    // ── Cache the result ──
    if (result.translated) {
      const cache = translationCacheRef.current;
      cache.set(cacheKey, { translated: result.translated, ts: Date.now() });
      // LRU cap: keep max 500 entries (increased for longer conversations)
      if (cache.size > 500) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
      }
    }

    return result;
  // b.168 — userEmail non e piu usato qui dentro (l'email va verificata
  // dal server via userToken, non dichiarata): tolto dalle dipendenze,
  // il parametro resta nella firma per compatibilita con chi la chiama.
  }, [roomId, roomSessionTokenRef, isTrialRef, freeCharsRef, prefsRef, getEffectiveToken, trackFreeChars]);

  /**
   * Get primary target language info (2-person chat shortcut).
   */
  const getTargetLangInfo = useCallback(() => {
    const currentMyLang = myLangRef.current;
    const currentRoomInfo = roomInfoRef.current;
    const myName = verifiedNameRef?.current || prefsRef.current.name;
    const myL = getLang(currentMyLang);
    let otherLangCode = null;
    if (currentRoomInfo && currentRoomInfo.members) {
      const other = currentRoomInfo.members.find(m => m.name !== myName);
      if (other) otherLangCode = other.lang;
    }
    if (!otherLangCode) otherLangCode = currentMyLang === 'en' ? 'it' : 'en';
    return { myL, otherL: getLang(otherLangCode) };
  }, [myLangRef, roomInfoRef, prefsRef, verifiedNameRef]);

  /**
   * Get ALL unique target languages from room members (excluding sender's lang).
   * For multi-language group chat: translate once per unique target language.
   */
  const getAllTargetLangs = useCallback(() => {
    const currentMyLang = myLangRef.current;
    const currentRoomInfo = roomInfoRef.current;
    const myName = verifiedNameRef?.current || prefsRef.current.name;
    const myL = getLang(currentMyLang);

    if (!currentRoomInfo?.members) {
      const fallbackCode = currentMyLang === 'en' ? 'it' : 'en';
      return { myL, targetLangs: [getLang(fallbackCode)] };
    }

    const uniqueLangCodes = new Set();
    for (const m of currentRoomInfo.members) {
      if (m.name !== myName && m.lang && m.lang !== currentMyLang) {
        uniqueLangCodes.add(m.lang);
      }
    }

    if (uniqueLangCodes.size === 0) {
      const fallbackCode = currentMyLang === 'en' ? 'it' : 'en';
      return { myL, targetLangs: [getLang(fallbackCode)] };
    }

    const targetLangs = [...uniqueLangCodes].map(code => getLang(code));
    return { myL, targetLangs };
  }, [myLangRef, roomInfoRef, prefsRef, verifiedNameRef]);

  /**
   * Translate text to ALL target languages in parallel.
   * Returns { translations: { "en": "Hello", "th": "สวัสดี" }, primaryTranslated, primaryTargetLang }
   */
  const translateToAllTargets = useCallback(async (text, myL, targetLangs, options = {}) => {
    const results = await Promise.allSettled(
      targetLangs.map(tL =>
        translateUniversal(text, myL.code, tL.code, myL.name, tL.name, options)
          .then(data => ({ langCode: tL.code, translated: data.translated || '' }))
          .catch(() => ({ langCode: tL.code, translated: '' }))
      )
    );

    const translations = {};
    let primaryTranslated = '';
    let primaryTargetLang = targetLangs[0]?.code || 'en';

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.translated) {
        translations[r.value.langCode] = r.value.translated;
        if (!primaryTranslated) {
          primaryTranslated = r.value.translated;
          primaryTargetLang = r.value.langCode;
        }
      }
    }

    return { translations, primaryTranslated, primaryTargetLang };
  }, [translateUniversal]);

  return {
    translateUniversal,
    sendMessage,
    sendTranslationUpdate,
    getTargetLangInfo,
    getAllTargetLangs,
    translateToAllTargets,
  };
}
