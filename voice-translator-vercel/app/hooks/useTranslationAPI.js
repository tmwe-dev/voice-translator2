'use client';
import { glossarioPerTesto } from '../lib/glossario.js';
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
const dbg = createLogger('translation-api');

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
  const lastSentTextRef = useRef({ testo: '', quando: 0 });
  // ── b.126 · quale spedizione portava questo testo ──
  // `sendMessage` assegna a ogni invio un `tempId` (`tmp_...`) e il
  // server lo salva sul messaggio. La fase 2 avviene in un'altra
  // funzione, che quel valore non lo riceve: invece di cambiare tutte le
  // firme fino a chi chiama, lo si tiene qui — le due funzioni vivono
  // nello stesso hook, e distano meno di un secondo.
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
  const sendMessage = useCallback(async (original, translated, sourceLang, targetLang, translations) => {
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

    // ── Freno anti doppio invio ──
    // Parlando, l'auto-invio del VAD (silenzio) e il tocco sul tasto possono
    // scattare quasi insieme: due invii VERI dello stesso testo → messaggio
    // raddoppiato. Stesso testo entro 2,5s = un solo invio.
    const ora = Date.now();
    if (original === lastSentTextRef.current.testo && ora - lastSentTextRef.current.quando < 2500) {
      dbg.debug('[sendMessage] Doppio invio bloccato:', original.slice(0, 30));
      return null;
    }
    lastSentTextRef.current = { testo: original, quando: ora };

    const senderName = verifiedNameRef?.current || prefsRef.current.name;
    const tempId = `tmp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    // b.126 — si annota quale spedizione porta questo testo, cosi la
    // fase 2 puo dire QUALE messaggio aggiornare invece di cercarlo per
    // contenuto. Si tiene corta: oltre 50 voci si butta la piu vecchia,
    // perche una mappa che cresce all'infinito e una perdita di memoria
    // con un altro nome (stessa regola della posta in uscita, b.111).
    if (idSpedizioneRef.current.size > 50) {
      idSpedizioneRef.current.delete(idSpedizioneRef.current.keys().next().value);
    }
    idSpedizioneRef.current.set(original, tempId);

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
    const segnaStato = (stato) => {
      if (!updateLocalMessage) return;
      updateLocalMessage(original, senderName, { _status: stato });
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
      return { message: instantMsg, serverSave: Promise.resolve(null) };
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
    return { message: instantMsg, serverSave: serverSavePromise };
  }, [roomId, prefsRef, roomSessionTokenRef, sentByMeRef, broadcastMessage, sendDirectMessage, spedisciContenuto, verifiedNameRef, addLocalMessage, updateLocalMessage]);

  /**
   * Phase 2: Send translation update for an already-sent message.
   * Updates local display, broadcasts to partner via P2P + Realtime,
   * and updates the server-saved message.
   */
    const sendTranslationUpdate = useCallback((original, translated, sourceLang, targetLang, translations) => {
    if (!roomId) return;
    const senderName = verifiedNameRef?.current || prefsRef.current.name;
    const updatePayload = { sender: senderName, original, translated, sourceLang, targetLang, translations, timestamp: Date.now() };

    // Update local message immediately (sender sees translation)
    if (updateLocalMessage) {
      updateLocalMessage(original, senderName, { translated, targetLang, translations });
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
            // b.126 — si dice QUALE messaggio, non lo si fa indovinare
            // dal contenuto. `original` e `sender` restano per i server
            // che non hanno ancora il nuovo percorso.
            // b.126 — si dice QUALE messaggio aggiornare, invece di
            // farlo indovinare dal contenuto: due "si" di fila dello
            // stesso utente sono indistinguibili, e la traduzione del
            // primo, arrivando tardi, finiva sul secondo.
            clientId: idSpedizioneRef.current.get(original) || '',
            original,
            sender: senderName,
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
            text, sourceLang, targetLang, userEmail: userEmail || undefined,
            roomId,
            roomSessionToken: roomSessionTokenRef?.current || undefined,
          })
        });
        if (!res.ok) return { translated: text };
        const data = await res.json();
        if (data.charsUsed > 0) trackFreeChars(data.charsUsed);
        return data;
      }

      // Standard or Superfast → use translate-free
      const res = await fetch('/api/translate-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, sourceLang, targetLang,
          userEmail: userEmail || undefined,
          superfast: translationMode === 'superfast' ? true : undefined,
          userProviderPrefs: translationProviders,
          // b.167 — senza questi il server non puo chiedere alla stanza se
          // e Diretta: vedi la nota su roomSessionToken piu sotto, stesso
          // punto dell'audit del 14/8, stessa correzione.
          roomId,
          roomSessionToken: roomSessionTokenRef?.current || undefined,
        })
      });
      if (!res.ok) return { translated: text };
      const data = await res.json();
      if (data.charsUsed > 0) trackFreeChars(data.charsUsed);
      return data;
    }

    let result;
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
        throw new Error('Translation error');
      }
      result = await res.json();
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
  }, [roomId, roomSessionTokenRef, isTrialRef, freeCharsRef, prefsRef, getEffectiveToken, trackFreeChars, userEmail]);

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
