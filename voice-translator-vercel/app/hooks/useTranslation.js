'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang, FREE_DAILY_LIMIT, SILENCE_DELAY, VAD_THRESHOLD, isWhisperPrimaryLang, STT_CONFIDENCE_THRESHOLD, STT_LOW_CONFIDENCE_COUNT } from '../lib/constants.js';
import { t } from '../lib/i18n.js';
import useDeepgramSTT from './useDeepgramSTT.js';
import useTranslationAPI from './useTranslationAPI.js';
import useFreeTalkVAD from './useFreeTalkVAD.js';
import { getPerf, PERF } from '../lib/perfTelemetry.js';

// ═══════════════════════════════════════════════════════════════
// FASE 10: Simplified Translation Pipeline
//
// OLD: Speech → chunks → translate each → review → re-translate → send
//      (5-7 API calls per message, live text visible to partner)
//
// NEW: Speech → accumulate → ONE translate at end → send
//      (1 API call per message, text private until sent)
//
// Benefits:
// - 5-7x fewer API calls = much lower latency
// - Partner doesn't see incomplete/wrong text (privacy)
// - No chunk context errors, no review overhead
// - Simpler, more reliable code
//
// Architecture (4 focused hooks):
// - useTranslationAPI: Translation calls, caching, multi-target
// - useDeepgramSTT: Deepgram WebSocket streaming STT
// - useFreeTalkVAD: Voice Activity Detection for hands-free mode
// - useTranslation: Orchestration, speech recognition, recording
// ═══════════════════════════════════════════════════════════════

export default function useTranslation({
  myLangRef,
  roomInfoRef,
  prefsRef,
  roomId,
  roomContextRef,
  isTrialRef,
  isTopProRef,
  freeCharsRef,
  useOwnKeys,
  getMicStream,
  unlockAudio,
  broadcastLiveText,  // kept in signature but NOT called (privacy)
  setSpeakingState,
  getEffectiveToken,
  refreshBalance,
  trackFreeChars,
  userEmail,
  sentByMeRef,
  roomSessionTokenRef,
  broadcastMessage,
  broadcastMessageUpdate, // Phase 2: broadcast translation update
  sendDirectMessage,  // WebRTC DataChannel for P2P instant delivery
  verifiedNameRef,
  addLocalMessage,    // Add sender's own message to local list immediately
  updateLocalMessage, // Update existing message (add translation)
  conversationContext, // { addMessage, getContext } from useConversationContext
}) {
  const [recording, setRecording] = useState(false);
  const [streamingMsg, setStreamingMsg] = useState(null);
  const [sendingText, setSendingText] = useState(false);
  const [textInput, setTextInput] = useState('');

  // ── Callback ref for conversationContext (avoids unstable deps) ──
  // conversationContext is a new object every render; using a ref prevents
  // translateAndSend from being recreated on every render, which would break
  // recording and video connections.
  const convContextRef = useRef(conversationContext);
  convContextRef.current = conversationContext;

  // Refs
  const speechRecRef = useRef(null);
  const allWordsRef = useRef('');
  const lastInterimRef = useRef('');
  const streamingModeRef = useRef(false);
  const stoppingRef = useRef(false);

  // Whisper-only mode ref (for languages where browser STT is unreliable)
  const whisperOnlyRef = useRef(false);
  // Confidence monitoring refs (auto-switch to Whisper if STT quality drops)
  const lowConfidenceCountRef = useRef(0);

  // Backup recording refs (for audio fallback when speech recognition fails)
  const backupRecRef = useRef(null);
  const backupChunksRef = useRef([]);
  const backupStreamRef = useRef(null);
  const cachedMimeRef = useRef(null);

  // Classic recording refs
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  // Speaking state keepalive ref (refresh every 15s so partner sees dots)
  const speakingKeepAliveRef = useRef(null);

  // Legacy refs kept for export compatibility
  const wordBufferRef = useRef('');
  const translatedChunksRef = useRef([]);
  const reviewTimerRef = useRef(null);

  // ── Extracted hooks ──

  const { deepgramAvailableRef, startDeepgramStreaming, stopDeepgramStreaming } = useDeepgramSTT({
    allWordsRef,
    streamingModeRef,
    setStreamingMsg,
    setRecording,
    setSpeakingState,
    roomId,
    unlockAudio,
    speakingKeepAliveRef,
  });

  const {
    translateUniversal,
    sendMessage,
    sendTranslationUpdate,
    getTargetLangInfo,
    getAllTargetLangs,
    translateToAllTargets,
  } = useTranslationAPI({
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
    broadcastMessageUpdate,
    sendDirectMessage,
    verifiedNameRef,
    addLocalMessage,
    updateLocalMessage,
  });

  // ── Shared helpers ──

  // Cached mime type detection — avoid recalculating on every recording
  function getRecorderMime() {
    if (cachedMimeRef.current) return cachedMimeRef.current;
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
    cachedMimeRef.current = mime;
    return mime;
  }

  /**
   * Build translation options from current room context.
   * Shared by all translate-and-send paths.
   * Includes conversation memory for context-aware translation.
   */
  function buildTranslateOpts() {
    return {
      domainContext: roomContextRef.current.contextPrompt || undefined,
      description: roomContextRef.current.description || undefined,
      roomMode: roomInfoRef.current?.mode || undefined,
      nativeLang: myLangRef.current || undefined,
      conversationContext: convContextRef.current?.getContext() || undefined,
    };
  }

  /**
   * TWO-PHASE send: original text first, translation update second.
   *
   * Phase 1 (instant): Send original text → visible to sender + receiver immediately
   * Phase 2 (async):   Translate → update message on both sides → TTS on receiver
   *
   * This eliminates the "message disappears" gap and shows text ASAP.
   */
  const translateAndSend = useCallback(async (text, opts = {}) => {
    const { myL, targetLangs } = getAllTargetLangs();
    const primaryTargetLang = targetLangs[0]?.code || 'en';

    // ── PHASE 1: Send original immediately (no translation yet) ──
    getPerf().mark(PERF.PHASE1_SEND);
    if (roomId) {
      sendMessage(text, null, myL.code, primaryTargetLang, null);
    }
    getPerf().measure(PERF.PHASE1_SEND);

    // ── PHASE 2: Translate in background, then update ──
    getPerf().mark(PERF.TRANSLATE_LATENCY);
    const translateOpts = buildTranslateOpts();
    let translations = {};
    let primaryTranslated = '';
    let finalTargetLang = primaryTargetLang;

    // ── Phase 2 translation with retry ──
    // If translation fails on first attempt, retry once. Without retry,
    // Phase 1 message is already visible but receiver never gets translation or TTS.
    const doTranslate = async () => {
      if (targetLangs.length === 1) {
        const data = await translateUniversal(text, myL.code, targetLangs[0].code, myL.name, targetLangs[0].name, translateOpts);
        if (data.translated) {
          primaryTranslated = data.translated;
          finalTargetLang = targetLangs[0].code;
          translations[targetLangs[0].code] = data.translated;
        }
        if (data.limitExceeded) return { limitExceeded: true };
      } else {
        const result = await translateToAllTargets(text, myL, targetLangs, translateOpts);
        translations = result.translations;
        primaryTranslated = result.primaryTranslated;
        finalTargetLang = result.primaryTargetLang;
      }
      return { ok: true };
    };

    try {
      let result;
      try {
        result = await doTranslate();
      } catch (firstErr) {
        console.warn('[translateAndSend] Phase 2 attempt 1 failed, retrying in 1s:', firstErr.message);
        await new Promise(r => setTimeout(r, 1000));
        result = await doTranslate(); // retry once — will throw if it fails again
      }
      if (result?.limitExceeded) return { limitExceeded: true };

      getPerf().measure(PERF.TRANSLATE_LATENCY);
      // Send translation update to everyone (sender local + partner broadcast)
      getPerf().mark(PERF.PHASE2_SEND);
      if (primaryTranslated && roomId) {
        sendTranslationUpdate(text, primaryTranslated, myL.code, finalTargetLang, translations);
        if (!opts.skipRefresh && !isTrialRef.current && !useOwnKeys) refreshBalance();
      }
      getPerf().measure(PERF.PHASE2_SEND);

      // ── Feed message into conversation context for knowledge base ──
      if (convContextRef.current?.addMessage) {
        const senderName = verifiedNameRef?.current || prefsRef.current.name;
        convContextRef.current.addMessage({
          sender: senderName,
          original: text,
          translated: primaryTranslated || null,
          sourceLang: myL.code,
          targetLang: finalTargetLang,
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      console.error('[translateAndSend] Phase 2 translation failed after retry:', e);
      // Update local message with error indicator so user knows translation failed
      if (updateLocalMessage) {
        const senderName = verifiedNameRef?.current || prefsRef.current.name;
        updateLocalMessage(text, senderName, { _translationError: true });
      }
    }

    return { translations, primaryTranslated, primaryTargetLang: finalTargetLang };
  }, [getAllTargetLangs, translateUniversal, translateToAllTargets, sendMessage, sendTranslationUpdate, updateLocalMessage, roomId, isTrialRef, useOwnKeys, refreshBalance]);

  // =============================================
  // Speech result handler
  // =============================================
  function handleSpeechResult(event, processedFinals) {
    let interimTranscript = '';
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        let text = event.results[i][0].transcript.trim();
        const confidence = event.results[i][0].confidence;

        // ── Confidence monitoring ──
        if (typeof confidence === 'number' && confidence > 0) {
          if (confidence < STT_CONFIDENCE_THRESHOLD) {
            lowConfidenceCountRef.current++;
            console.log(`[STT] Low confidence: ${confidence.toFixed(2)} (${lowConfidenceCountRef.current}/${STT_LOW_CONFIDENCE_COUNT})`);
            if (lowConfidenceCountRef.current >= STT_LOW_CONFIDENCE_COUNT) {
              console.warn(`[STT] Auto-switching to Whisper-only mode — ${STT_LOW_CONFIDENCE_COUNT} consecutive low-confidence results`);
              whisperOnlyRef.current = true;
            }
          } else {
            lowConfidenceCountRef.current = 0;
          }
        }

        if (!text || processedFinals.has(i)) continue;
        processedFinals.add(i);
        allWordsRef.current += (allWordsRef.current ? ' ' : '') + text;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    // Show interim preview
    const preview = allWordsRef.current + (interimTranscript ? ' ' + interimTranscript : '');
    if (preview) setStreamingMsg(prev => prev ? { ...prev, original: preview } : null);
    lastInterimRef.current = interimTranscript;
  }

  // =============================================
  // Process audio blob — TWO-PHASE (like streaming path)
  //
  // OLD: /api/process does STT+Translate → sendMessage (partner waits ~2s)
  // NEW: /api/transcribe does STT only → Phase 1 sends original (~700ms)
  //      → Phase 2 translates in parallel → sendTranslationUpdate
  //      Partner sees original ~800ms EARLIER than before!
  // =============================================
  async function processAndSendAudio(blob) {
    const { myL, targetLangs } = getAllTargetLangs();
    const primaryTarget = targetLangs[0];

    // ── Step 1: Transcribe audio (STT only — no translation) ──
    getPerf().mark(PERF.STT_LATENCY);
    const form = new FormData();
    form.append('audio', blob, 'audio.webm');
    form.append('sourceLang', myL.code);
    if (roomId) form.append('roomId', roomId);
    const effectiveToken = getEffectiveToken();
    if (effectiveToken) form.append('userToken', effectiveToken);

    const res = await fetch('/api/transcribe', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Transcribe error');
    const { original } = await res.json();
    getPerf().measure(PERF.STT_LATENCY);
    if (!original?.trim() || !roomId) return;

    // ── Step 2 (Phase 1): Send original text IMMEDIATELY ──
    // Partner sees the original text RIGHT NOW — no waiting for translation
    sendMessage(original, null, myL.code, primaryTarget.code, null);

    // Show streaming indicator while translating
    setStreamingMsg({ original, translated: '...', isStreaming: false });

    // ── Step 3 (Phase 2): Translate in background, then update ──
    try {
      const result = await translateAndSend_phase2Only(original, myL, targetLangs, primaryTarget);

      // Feed into conversation context
      if (convContextRef.current?.addMessage) {
        const senderName = verifiedNameRef?.current || prefsRef.current.name;
        convContextRef.current.addMessage({
          sender: senderName,
          original,
          translated: result?.primaryTranslated || null,
          sourceLang: myL.code,
          targetLang: primaryTarget.code,
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      console.error('[processAndSendAudio] Phase 2 failed:', e);
      if (updateLocalMessage) {
        const senderName = verifiedNameRef?.current || prefsRef.current.name;
        updateLocalMessage(original, senderName, { _translationError: true });
      }
    }
    setStreamingMsg(null);
  }

  /**
   * Phase 2 only: translate and send update (reused by processAndSendAudio).
   * Similar to translateAndSend but WITHOUT Phase 1 send (already done).
   */
  async function translateAndSend_phase2Only(text, myL, targetLangs, primaryTarget) {
    const translateOpts = buildTranslateOpts();
    let translations = {};
    let primaryTranslated = '';
    let finalTargetLang = primaryTarget.code;

    const doTranslate = async () => {
      if (targetLangs.length === 1) {
        const data = await translateUniversal(text, myL.code, targetLangs[0].code, myL.name, targetLangs[0].name, translateOpts);
        if (data.translated) {
          primaryTranslated = data.translated;
          finalTargetLang = targetLangs[0].code;
          translations[targetLangs[0].code] = data.translated;
        }
        if (data.limitExceeded) return { limitExceeded: true };
      } else {
        const result = await translateToAllTargets(text, myL, targetLangs, translateOpts);
        translations = result.translations;
        primaryTranslated = result.primaryTranslated;
        finalTargetLang = result.primaryTargetLang;
      }
      return { ok: true };
    };

    let result;
    try {
      result = await doTranslate();
    } catch (firstErr) {
      console.warn('[Phase2] Attempt 1 failed, retrying:', firstErr.message);
      await new Promise(r => setTimeout(r, 800));
      result = await doTranslate();
    }
    if (result?.limitExceeded) return { limitExceeded: true };

    if (primaryTranslated && roomId) {
      sendTranslationUpdate(text, primaryTranslated, myL.code, finalTargetLang, translations);
      if (!isTrialRef.current && !useOwnKeys) refreshBalance();
    }

    return { translations, primaryTranslated, primaryTargetLang: finalTargetLang };
  }

  // ── FreeTalk VAD hook ──

  const {
    isListening,
    vadAudioLevel,
    vadSilenceCountdown,
    vadSensitivity,
    setVadSensitivity,
    startFreeTalk,
    stopFreeTalk,
    cleanupVAD,
    freeTalkSendingRef,
  } = useFreeTalkVAD({
    myLangRef,
    roomId,
    getMicStream,
    unlockAudio,
    setSpeakingState,
    getRecorderMime,
    speechRecRef,
    allWordsRef,
    lastInterimRef,
    streamingModeRef,
    whisperOnlyRef,
    lowConfidenceCountRef,
    handleSpeechResult,
    setStreamingMsg,
    setRecording,
    translateAndSend,
    processAndSendAudio,
  });

  // =============================================
  // Start streaming translation
  // =============================================
  async function startStreamingTranslation() {
    // Reset stoppingRef in case previous stop is still awaiting async translate
    stoppingRef.current = false;
    const currentLang = myLangRef.current;

    // ── Deepgram streaming: highest priority when available ──
    // SKIP Deepgram for WHISPER_PRIMARY_LANGS (Thai, Chinese, Japanese, etc.)
    // These tonal/complex-script languages get much better results with gpt-4o-mini-transcribe
    if (deepgramAvailableRef.current && !isTrialRef.current && !isWhisperPrimaryLang(currentLang)) {
      try {
        const started = await startDeepgramStreaming(currentLang);
        if (started) return;
      } catch {}
    }

    // ── Hybrid STT routing ──
    // Reset whisper-only mode on each new recording attempt — give browser STT another chance
    // (the flag was set because of previous bad results, but conditions may have improved)
    if (whisperOnlyRef.current && !isWhisperPrimaryLang(currentLang)) {
      console.log('[STT] Resetting whisper-only mode for new recording attempt');
      whisperOnlyRef.current = false;
      lowConfidenceCountRef.current = 0;
    }
    const useWhisperOnly = isWhisperPrimaryLang(currentLang) || whisperOnlyRef.current;
    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

    if (!SpeechRecognition || useWhisperOnly) {
      startClassicRecording();
      return;
    }

    unlockAudio();
    setRecording(true);
    if (roomId) setSpeakingState(roomId, true);

    allWordsRef.current = '';
    lastInterimRef.current = '';
    streamingModeRef.current = true;
    lowConfidenceCountRef.current = 0;
    setStreamingMsg({ original: '', translated: null, isStreaming: true });

    const recognition = new SpeechRecognition();
    const langObj = getLang(currentLang);
    recognition.lang = langObj?.speech || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    speechRecRef.current = recognition;

    // Backup recording — LAZY START: only activate after 2s if no STT results received
    // This saves CPU/battery in the 95% case where browser STT works fine
    let backupTimer = null;
    const startBackupIfNeeded = async () => {
      if (backupRecRef.current) return; // already started
      try {
        const stream = await getMicStream();
        backupStreamRef.current = stream;
        backupChunksRef.current = [];
        backupRecRef.current = new MediaRecorder(stream, { mimeType: getRecorderMime() });
        backupRecRef.current.ondataavailable = e => {
          if (e.data.size > 0) backupChunksRef.current.push(e.data);
        };
        backupRecRef.current.start(100);
        console.log('[STT] Backup recording started (STT fallback)');
      } catch {}
    };
    backupTimer = setTimeout(() => {
      // If no final results after 2s, start backup recording as safety net
      if (allWordsRef.current === '' && streamingModeRef.current) {
        startBackupIfNeeded();
      }
    }, 2000);

    let processedFinals = new Set();
    let errorCount = 0;

    recognition.onresult = (event) => {
      handleSpeechResult(event, processedFinals);
      // Cancel backup timer if we got results — STT is working
      if (backupTimer && allWordsRef.current) {
        clearTimeout(backupTimer);
        backupTimer = null;
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      errorCount++;
      console.warn(`[STT] Error: ${event.error} (count=${errorCount})`);
      // Start backup immediately on error
      if (!backupRecRef.current) startBackupIfNeeded();
      if (errorCount >= 3 && !whisperOnlyRef.current) {
        console.warn('[STT] Too many errors — enabling Whisper-only for this session');
        whisperOnlyRef.current = true;
      }
    };

    recognition.onend = () => {
      if (streamingModeRef.current && !stoppingRef.current) {
        processedFinals = new Set();
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();

    // Keepalive
    if (speakingKeepAliveRef.current) clearInterval(speakingKeepAliveRef.current);
    speakingKeepAliveRef.current = setInterval(() => {
      if (roomId && streamingModeRef.current) setSpeakingState(roomId, true);
    }, 15000);
  }

  // =============================================
  // Stop streaming — ONE translate call via DRY helper
  // =============================================
  async function stopStreamingTranslation() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    getPerf().mark(PERF.E2E_LATENCY); // Start measuring end-to-end

    // Stop keepalive
    if (speakingKeepAliveRef.current) { clearInterval(speakingKeepAliveRef.current); speakingKeepAliveRef.current = null; }

    // Stop speech recognition
    streamingModeRef.current = false;
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch {}
      speechRecRef.current = null;
    }

    // Stop Deepgram if active
    stopDeepgramStreaming();

    // ── CRITICAL: Include BOTH finalized AND interim text ──
    // allWordsRef only contains finalized STT results. But lastInterimRef contains
    // text the user SEES in the preview bubble that hasn't been finalized yet.
    // recognition.stop() is async — the browser may NOT finalize interim text
    // before we read allWordsRef. Without this, partial speech is silently lost.
    // Rule: every piece of recognized text MUST be sent, never discarded.
    const interimText = lastInterimRef.current?.trim() || '';
    const allOriginal = (allWordsRef.current + (interimText ? ' ' + interimText : '')).trim();

    // If no text accumulated but backup recording exists → fallback to Whisper
    if (!allOriginal && backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      const r = backupRecRef.current;
      return new Promise(resolve => {
        r.onstop = async () => {
          const blob = new Blob(backupChunksRef.current, { type: r.mimeType });
          backupRecRef.current = null;
          backupChunksRef.current = [];
          backupStreamRef.current = null;
          setRecording(false);
          stoppingRef.current = false;
          if (roomId) setSpeakingState(roomId, false);
          setStreamingMsg(null);
          if (blob.size > 1000) {
            try { await processAndSendAudio(blob); } catch {}
          }
          resolve();
        };
        try { r.stop(); } catch {
          setRecording(false); stoppingRef.current = false;
          if (roomId) setSpeakingState(roomId, false);
          setStreamingMsg(null);
          resolve();
        }
      });
    }

    // Stop backup recording (discard — we have STT text)
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      backupRecRef.current.onstop = () => {};
      try { backupRecRef.current.stop(); } catch {}
    }
    backupRecRef.current = null;
    backupChunksRef.current = [];
    backupStreamRef.current = null;

    if (!allOriginal) {
      console.log('[stopStreaming] No text accumulated (finals + interims), nothing to send');
      setRecording(false);
      stoppingRef.current = false;
      if (roomId) setSpeakingState(roomId, false);
      setStreamingMsg(null);
      return;
    }

    console.log(`[stopStreaming] Sending text: "${allOriginal}" (interim included: ${interimText ? 'yes' : 'no'})`);

    // ── Translate and send using DRY helper ──
    setStreamingMsg({ original: allOriginal, translated: '...', isStreaming: false });
    setRecording(false);
    if (roomId) setSpeakingState(roomId, false);

    // CRITICAL: Reset stoppingRef BEFORE the async translateAndSend call.
    // Previously, stoppingRef stayed true during the entire API call (~1-2s).
    // If the user started + stopped a second recording during that time,
    // stopStreamingTranslation would return immediately (line 446 guard),
    // silently discarding the second message.
    stoppingRef.current = false;

    try {
      const result = await translateAndSend(allOriginal);
      if (result.limitExceeded) {
        setStreamingMsg(null);
        return;
      }
      setStreamingMsg(null);
      allWordsRef.current = '';
    } catch (e) {
      console.error('[stopStreaming] Translation error:', e);
      setStreamingMsg(null);
    }
  }

  // =============================================
  // Classic Recording (fallback for no SpeechRecognition)
  // =============================================
  async function startClassicRecording() {
    stoppingRef.current = false; // Reset in case previous stop still awaiting async translate
    unlockAudio();
    setRecording(true);
    if (roomId) setSpeakingState(roomId, true);
    chunksRef.current = [];
    // ── Show "listening" indicator for Whisper-only languages (no live STT preview) ──
    setStreamingMsg({ original: '', translated: null, isStreaming: true, _whisperListening: true });
    try {
      const stream = await getMicStream();
      recRef.current = new MediaRecorder(stream, { mimeType: getRecorderMime() });
      recRef.current.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recRef.current.mimeType });
        if (blob.size < 1000) { setRecording(false); setStreamingMsg(null); return; }
        setStreamingMsg({ original: '', translated: null, isStreaming: false, _whisperProcessing: true });
        try { await processAndSendAudio(blob); } catch {}
        setRecording(false);
        setStreamingMsg(null);
        if (!isTrialRef.current && !useOwnKeys) refreshBalance();
      };
      recRef.current.start(100);
    } catch (err) {
      setRecording(false);
      setStreamingMsg(null);
      if (roomId) setSpeakingState(roomId, false);
    }
  }

  function stopClassicRecording() {
    if (recRef.current && recRef.current.state === 'recording') {
      if (roomId) setSpeakingState(roomId, false);
      recRef.current.stop();
    }
  }

  // =============================================
  // Cancel Recording — discard without sending
  // =============================================
  function cancelRecording() {
    if (speakingKeepAliveRef.current) { clearInterval(speakingKeepAliveRef.current); speakingKeepAliveRef.current = null; }
    streamingModeRef.current = false;
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch {}
      speechRecRef.current = null;
    }
    stopDeepgramStreaming();
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      backupRecRef.current.onstop = () => {};
      try { backupRecRef.current.stop(); } catch {}
    }
    backupRecRef.current = null;
    backupStreamRef.current = null;
    backupChunksRef.current = [];
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.onstop = () => {};
      try { recRef.current.stop(); } catch {}
    }
    recRef.current = null;
    chunksRef.current = [];
    allWordsRef.current = '';
    lastInterimRef.current = '';
    stoppingRef.current = false;
    setRecording(false);
    setStreamingMsg(null);
    if (roomId) setSpeakingState(roomId, false);
  }

  // =============================================
  // Toggle Recording
  // =============================================
  async function toggleRecording() {
    if (recording) {
      if (streamingModeRef.current) stopStreamingTranslation();
      else stopClassicRecording();
    } else {
      startStreamingTranslation();
    }
  }

  // =============================================
  // Text Message — uses DRY translateAndSend
  // =============================================
  async function sendTextMessage() {
    if (!textInput.trim() || sendingText || !roomId) return;
    const trimText = textInput.trim();
    setTextInput(''); // Clear immediately — Phase 1 sends the original text right away
    setSendingText(true);
    try {
      await translateAndSend(trimText);
    } catch (e) {
      console.error('[sendTextMessage] Error:', e);
    }
    setSendingText(false);
  }

  // =============================================
  // Cleanup on unmount
  // =============================================
  useEffect(() => {
    return () => {
      stopFreeTalk();
      stopDeepgramStreaming();
      cleanupVAD();
      streamingModeRef.current = false;
      if (speakingKeepAliveRef.current) { clearInterval(speakingKeepAliveRef.current); speakingKeepAliveRef.current = null; }
      if (speechRecRef.current) {
        try { speechRecRef.current.stop(); } catch {}
        speechRecRef.current = null;
      }
      if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
        try { backupRecRef.current.stop(); } catch {}
        backupRecRef.current = null;
      }
      backupStreamRef.current = null;
      backupChunksRef.current = [];
      if (recRef.current && recRef.current.state !== 'inactive') {
        try { recRef.current.stop(); } catch {}
        recRef.current = null;
      }
      chunksRef.current = [];
      allWordsRef.current = '';
      lastInterimRef.current = '';
    };
  }, []);

  return {
    recording,
    streamingMsg,
    sendingText,
    textInput,
    setTextInput,
    toggleRecording,
    cancelRecording,
    sendTextMessage,
    startFreeTalk,
    stopFreeTalk,
    startStreamingTranslation,
    stopStreamingTranslation,
    translateUniversal,
    startClassicRecording,
    stopClassicRecording,
    processAndSendAudio,
    isListening,
    // VAD enhanced feedback (TMWEngine patterns)
    vadAudioLevel,          // 0-1 normalized mic level
    vadSilenceCountdown,    // seconds remaining before auto-send, or null
    vadSensitivity,         // 'quiet' | 'normal' | 'noisy' | 'street'
    setVadSensitivity,      // change sensitivity preset
    streamingModeRef,
    speechRecRef,
    reviewTimerRef,
    backupRecRef,
    backupStreamRef,
    wordBufferRef,
    allWordsRef,
    translatedChunksRef
  };
}
