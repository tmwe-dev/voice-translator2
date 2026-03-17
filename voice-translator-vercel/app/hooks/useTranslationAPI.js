'use client';
import { useRef, useCallback } from 'react';
import { getLang, FREE_DAILY_LIMIT } from '../lib/constants.js';

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
  sendDirectMessage,  // WebRTC DataChannel: P2P instant delivery
  verifiedNameRef,
  addLocalMessage,    // Callback to add message to local messages[] immediately
}) {
  // ── Translation cache: avoid re-translating identical text ──
  // Key: `${text}|${srcLang}|${tgtLang}` → { translated, ts }
  const translationCacheRef = useRef(new Map());

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

    const senderName = verifiedNameRef?.current || prefsRef.current.name;
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

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
    };

    // ── Instant delivery: P2P + Realtime broadcast IMMEDIATELY (don't wait for server) ──
    // Priority 1: WebRTC DataChannel (P2P, ~50ms)
    if (sendDirectMessage) {
      try {
        sendDirectMessage({ type: 'chat-message', message: instantMsg });
      } catch {}
    }
    // Priority 2: Supabase Realtime broadcast (~100ms) — ALWAYS send, even if P2P worked
    // Other clients may not have P2P, and DataChannel can fail silently
    if (broadcastMessage) {
      broadcastMessage(instantMsg);
    }

    // Mark temp ID as sent by me immediately (before server save)
    if (sentByMeRef) {
      sentByMeRef.current.add(tempId);
    }

    // ── Add to LOCAL messages[] immediately so the sender sees their own message ──
    // Without this, the sender sees nothing until polling brings it back (2-10s)
    // because Supabase Realtime has self:false and P2P sends only to partner.
    if (addLocalMessage) {
      addLocalMessage(instantMsg);
    }

    // ── Server save: fire-and-forget (don't block the UI) ──
    // The message is already delivered via P2P + Realtime.
    // Server save is just for persistence and polling fallback.
    const serverSavePromise = fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        sender: roomSessionTokenRef?.current ? undefined : senderName,
        roomSessionToken: roomSessionTokenRef?.current || null,
        original,
        translated,
        sourceLang,
        targetLang,
        translations: translations || null,
      })
    }).then(res => {
      if (res.ok) {
        return res.json().then(data => {
          if (data.message?.id && sentByMeRef) {
            sentByMeRef.current.add(data.message.id);
          }
          return data;
        });
      }
      return null;
    }).catch(e => {
      console.error('[sendMessage] Server save error:', e);
      return null;
    });

    // Return immediately with the instant message — don't await server save
    // The promise is kept alive so it completes in background
    return { message: instantMsg, serverSave: serverSavePromise };
  }, [roomId, prefsRef, roomSessionTokenRef, sentByMeRef, broadcastMessage, sendDirectMessage, verifiedNameRef]);

  /**
   * Translate text using the appropriate endpoint (free/paid/consensus).
   * Includes in-memory cache with 5 min TTL and LRU eviction.
   */
  const translateUniversal = useCallback(async (text, sourceLang, targetLang, sourceLangName, targetLangName, options = {}) => {
    // ── Cache lookup: exact match avoids redundant API calls ──
    const cacheKey = `${text}|${sourceLang}|${targetLang}`;
    const cached = translationCacheRef.current.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < 300000) { // 5 min TTL
      return { translated: cached.translated, cached: true };
    }

    if (isTrialRef.current) {
      if (freeCharsRef.current >= FREE_DAILY_LIMIT) {
        return { translated: text, fallback: true, limitExceeded: true };
      }
      const translationMode = prefsRef.current?.translationMode || 'standard';
      const translationProviders = prefsRef.current?.translationProviders;

      // Guaranteed mode → use consensus endpoint (3 providers in parallel)
      if (translationMode === 'guaranteed') {
        const res = await fetch('/api/translate-consensus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, sourceLang, targetLang, userEmail: userEmail || undefined })
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
        })
      });
      if (!res.ok) return { translated: text };
      const data = await res.json();
      if (data.charsUsed > 0) trackFreeChars(data.charsUsed);
      return data;
    }

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
        aiModel: prefsRef.current?.aiModel || undefined,
        ...options,
        userToken: getEffectiveToken()
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(errData.error || 'No credits');
      throw new Error('Translation error');
    }
    const result = await res.json();

    // ── Cache the result ──
    if (result.translated) {
      const cache = translationCacheRef.current;
      cache.set(cacheKey, { translated: result.translated, ts: Date.now() });
      // LRU cap: keep max 200 entries
      if (cache.size > 200) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
      }
    }

    return result;
  }, [roomId, isTrialRef, freeCharsRef, prefsRef, getEffectiveToken, trackFreeChars, userEmail]);

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
    getTargetLangInfo,
    getAllTargetLangs,
    translateToAllTargets,
  };
}
