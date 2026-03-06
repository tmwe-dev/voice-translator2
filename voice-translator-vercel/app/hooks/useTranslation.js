'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang, FREE_DAILY_LIMIT, SILENCE_DELAY, VAD_THRESHOLD, isWhisperPrimaryLang, STT_CONFIDENCE_THRESHOLD, STT_LOW_CONFIDENCE_COUNT } from '../lib/constants.js';
import { t } from '../lib/i18n.js';
import useDeepgramSTT from './useDeepgramSTT.js';
import useTranslationAPI from './useTranslationAPI.js';

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
// Architecture:
// - useTranslationAPI: Translation calls, caching, multi-target
// - useDeepgramSTT: Deepgram WebSocket streaming STT
// - useTranslation: Orchestration, speech recognition, VAD
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
  roomSessionTokenRef
}) {
  const [recording, setRecording] = useState(false);
  const [streamingMsg, setStreamingMsg] = useState(null);
  const [sendingText, setSendingText] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isListening, setIsListening] = useState(false);

  // VAD enhanced feedback (from TMWEngine patterns)
  const [vadAudioLevel, setVadAudioLevel] = useState(0);       // 0-1 normalized
  const [vadSilenceCountdown, setVadSilenceCountdown] = useState(null); // seconds or null
  const vadCountdownRef = useRef(null);

  // Refs
  const speechRecRef = useRef(null);
  const allWordsRef = useRef('');
  const lastInterimRef = useRef('');
  const streamingModeRef = useRef(false);
  const stoppingRef = useRef(false);
  const freeTalkSendingRef = useRef(false);

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

  // FreeTalk VAD refs
  const vadStreamRef = useRef(null);
  const vadRecRef = useRef(null);
  const vadTimerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const vadAnalyserRef = useRef(null);
  const vadAudioCtxRef = useRef(null);

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
  });

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

  // =============================================
  // FASE 10: Simplified speech handler
  // Just accumulates text — no chunks, no live broadcast
  // =============================================
  function handleSpeechResult(event, processedFinals) {
    let interimTranscript = '';
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        let text = event.results[i][0].transcript.trim();
        const confidence = event.results[i][0].confidence;

        // ── FASE 7: Confidence monitoring ──
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
  // FASE 10: Start streaming — simplified
  // =============================================
  async function startStreamingTranslation() {
    const currentLang = myLangRef.current;

    // ── Deepgram streaming: highest priority when available ──
    if (deepgramAvailableRef.current && !isTrialRef.current) {
      try {
        const started = await startDeepgramStreaming(currentLang);
        if (started) return; // Deepgram took over
      } catch {}
    }

    // ── FASE 1b: Hybrid STT routing ──
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

    // Backup recording — capture audio in parallel in case STT fails
    try {
      const stream = await getMicStream();
      backupStreamRef.current = stream;
      backupChunksRef.current = [];
      backupRecRef.current = new MediaRecorder(stream, { mimeType: getRecorderMime() });
      backupRecRef.current.ondataavailable = e => {
        if (e.data.size > 0) backupChunksRef.current.push(e.data);
      };
      backupRecRef.current.start(100);
    } catch {}

    let processedFinals = new Set();
    let errorCount = 0;

    recognition.onresult = (event) => handleSpeechResult(event, processedFinals);

    // ── FASE 7: Error handling with backoff ──
    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      errorCount++;
      console.warn(`[STT] Error: ${event.error} (count=${errorCount})`);
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
  // FASE 10: Stop streaming — ONE translate call
  // =============================================
  async function stopStreamingTranslation() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

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

    // Collect accumulated text
    const allOriginal = allWordsRef.current.trim();

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
      setRecording(false);
      stoppingRef.current = false;
      if (roomId) setSpeakingState(roomId, false);
      setStreamingMsg(null);
      return;
    }

    // ── Multi-language translation — translate to ALL target languages ──
    setStreamingMsg({ original: allOriginal, translated: '...', isStreaming: false });
    setRecording(false);
    if (roomId) setSpeakingState(roomId, false);

    try {
      const { myL, targetLangs } = getAllTargetLangs();
      const translateOpts = {
        domainContext: roomContextRef.current.contextPrompt || undefined,
        description: roomContextRef.current.description || undefined,
        roomMode: roomInfoRef.current?.mode || undefined,
        nativeLang: myLangRef.current?.code || undefined,
      };

      let translations = {};
      let primaryTranslated = '';
      let primaryTargetLang = targetLangs[0]?.code || 'en';

      if (targetLangs.length === 1) {
        const data = await translateUniversal(allOriginal, myL.code, targetLangs[0].code, myL.name, targetLangs[0].name, translateOpts);
        if (data.translated) {
          primaryTranslated = data.translated;
          primaryTargetLang = targetLangs[0].code;
          translations[targetLangs[0].code] = data.translated;
        }
        if (data.limitExceeded) {
          setStreamingMsg(null);
          stoppingRef.current = false;
          return;
        }
      } else {
        const result = await translateToAllTargets(allOriginal, myL, targetLangs, translateOpts);
        translations = result.translations;
        primaryTranslated = result.primaryTranslated;
        primaryTargetLang = result.primaryTargetLang;
      }

      setStreamingMsg(null);
      allWordsRef.current = '';

      if (primaryTranslated && roomId) {
        await sendMessage(allOriginal, primaryTranslated, myL.code, primaryTargetLang, translations);
        if (!isTrialRef.current && !useOwnKeys) refreshBalance();
      }
    } catch (e) {
      console.error('[stopStreaming] Translation error:', e);
      setStreamingMsg(null);
    }

    stoppingRef.current = false;
  }

  // =============================================
  // Classic Recording (fallback for no SpeechRecognition)
  // =============================================
  async function startClassicRecording() {
    unlockAudio();
    setRecording(true);
    if (roomId) setSpeakingState(roomId, true);
    chunksRef.current = [];
    try {
      const stream = await getMicStream();
      recRef.current = new MediaRecorder(stream, { mimeType: getRecorderMime() });
      recRef.current.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recRef.current.mimeType });
        if (blob.size < 1000) { setRecording(false); return; }
        try { await processAndSendAudio(blob); } catch {}
        setRecording(false);
        if (!isTrialRef.current && !useOwnKeys) refreshBalance();
      };
      recRef.current.start(100);
    } catch (err) {
      setRecording(false);
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
  // Process audio blob (Whisper STT + translate)
  // =============================================
  async function processAndSendAudio(blob) {
    const { myL, targetLangs } = getAllTargetLangs();
    const primaryTarget = targetLangs[0];
    const form = new FormData();
    form.append('audio', blob, 'audio.webm');
    form.append('sourceLang', myL.code);
    form.append('targetLang', primaryTarget.code);
    form.append('sourceLangName', myL.name);
    form.append('targetLangName', primaryTarget.name);
    if (roomId) form.append('roomId', roomId);
    if (roomContextRef.current.contextPrompt) form.append('domainContext', roomContextRef.current.contextPrompt);
    if (roomContextRef.current.description) form.append('description', roomContextRef.current.description);
    const effectiveToken = getEffectiveToken();
    if (effectiveToken) form.append('userToken', effectiveToken);
    if (prefsRef.current?.aiModel) form.append('aiModel', prefsRef.current.aiModel);

    const res = await fetch('/api/process', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Server error');
    const { original, translated } = await res.json();
    if (original && roomId) {
      let translations = { [primaryTarget.code]: translated || '' };
      if (targetLangs.length > 1 && original) {
        const otherTargets = targetLangs.slice(1);
        const otherResults = await Promise.allSettled(
          otherTargets.map(tL =>
            translateUniversal(original, myL.code, tL.code, myL.name, tL.name, {
              domainContext: roomContextRef.current.contextPrompt || undefined,
              roomMode: roomInfoRef.current?.mode || undefined,
              nativeLang: myLangRef.current?.code || undefined,
            }).then(d => ({ langCode: tL.code, translated: d.translated || '' }))
              .catch(() => ({ langCode: tL.code, translated: '' }))
          )
        );
        for (const r of otherResults) {
          if (r.status === 'fulfilled' && r.value.translated) {
            translations[r.value.langCode] = r.value.translated;
          }
        }
      }
      await sendMessage(original, translated, myL.code, primaryTarget.code, translations);
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
  // Text Message
  // =============================================
  async function sendTextMessage() {
    if (!textInput.trim() || sendingText || !roomId) return;
    setSendingText(true);
    try {
      const { myL, targetLangs } = getAllTargetLangs();
      const translateOpts = {
        domainContext: roomContextRef.current.contextPrompt || undefined,
        description: roomContextRef.current.description || undefined,
        roomMode: roomInfoRef.current?.mode || undefined,
        nativeLang: myLangRef.current?.code || undefined,
      };
      const trimText = textInput.trim();
      let translations = {};
      let primaryTranslated = '';
      let primaryTargetLang = targetLangs[0]?.code || 'en';

      if (targetLangs.length === 1) {
        const data = await translateUniversal(trimText, myL.code, targetLangs[0].code, myL.name, targetLangs[0].name, translateOpts);
        if (data.translated) {
          primaryTranslated = data.translated;
          primaryTargetLang = targetLangs[0].code;
          translations[targetLangs[0].code] = data.translated;
        }
      } else {
        const result = await translateToAllTargets(trimText, myL, targetLangs, translateOpts);
        translations = result.translations;
        primaryTranslated = result.primaryTranslated;
        primaryTargetLang = result.primaryTargetLang;
      }

      if (primaryTranslated) {
        await sendMessage(trimText, primaryTranslated, myL.code, primaryTargetLang, translations);
        setTextInput('');
        if (!isTrialRef.current && !useOwnKeys) refreshBalance();
      }
    } catch {}
    setSendingText(false);
  }

  // =============================================
  // FASE 10: Free Talk Mode — simplified
  // =============================================
  async function startFreeTalk() {
    if (isListening) return;
    unlockAudio();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const currentLang = myLangRef.current;

    const useWhisperOnly = isWhisperPrimaryLang(currentLang) || whisperOnlyRef.current;
    const canUseBrowserSTT = SpeechRecognition && !useWhisperOnly;

    try {
      const stream = await getMicStream();
      vadStreamRef.current = stream;
      if (vadAudioCtxRef.current && vadAudioCtxRef.current.state !== 'closed') {
        try { vadAudioCtxRef.current.close(); } catch {}
      }
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      vadAudioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      vadAnalyserRef.current = analyser;
      setIsListening(true);
      freeTalkSendingRef.current = false;

      let isRec = false;
      const threshold = VAD_THRESHOLD;
      const silenceDelay = SILENCE_DELAY;

      if (canUseBrowserSTT) {
        allWordsRef.current = '';
        streamingModeRef.current = true;
        lowConfidenceCountRef.current = 0;

        const recognition = new SpeechRecognition();
        recognition.lang = getLang(currentLang).speech;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;
        speechRecRef.current = recognition;

        let ftProcessedFinals = new Set();
        let ftErrorCount = 0;
        recognition.onresult = (event) => handleSpeechResult(event, ftProcessedFinals);

        recognition.onerror = (event) => {
          if (event.error === 'no-speech') return;
          ftErrorCount++;
          console.warn(`[STT-FreeTalk] Error: ${event.error} (count=${ftErrorCount})`);
          if (ftErrorCount >= 3 && !whisperOnlyRef.current) {
            console.warn('[STT-FreeTalk] Too many errors — enabling Whisper-only mode');
            whisperOnlyRef.current = true;
          }
        };

        recognition.onend = () => {
          if (streamingModeRef.current && isListening) {
            ftProcessedFinals = new Set();
            try { recognition.start(); } catch {}
          }
        };
        recognition.start();
      } else if (useWhisperOnly) {
        console.log(`[STT-FreeTalk] Whisper-only mode for lang=${currentLang}`);
      }

      function check() {
        if (!vadAnalyserRef.current) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;

        const normalizedLevel = Math.min(avg / 128, 1);
        setVadAudioLevel(normalizedLevel);

        if (avg > threshold && !isRec) {
          isRec = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (vadCountdownRef.current) { clearInterval(vadCountdownRef.current); vadCountdownRef.current = null; }
          setVadSilenceCountdown(null);
          if (canUseBrowserSTT) {
            if (!streamingMsg) setStreamingMsg({ original: '', translated: null, isStreaming: true });
            setRecording(true);
            if (roomId) setSpeakingState(roomId, true);
          } else {
            const ch = [];
            const r = new MediaRecorder(stream, { mimeType: getRecorderMime() });
            r.ondataavailable = e => { if (e.data.size > 0) ch.push(e.data); };
            r.onstop = async () => {
              const blob = new Blob(ch, { type: r.mimeType });
              if (blob.size > 1000) await processAndSendAudio(blob).catch(console.error);
            };
            vadRecRef.current = r;
            r.start(100);
            setRecording(true);
            if (roomId) setSpeakingState(roomId, true);
          }
        } else if (avg <= threshold && isRec) {
          if (!silenceTimerRef.current) {
            const countdownStart = Date.now();
            vadCountdownRef.current = setInterval(() => {
              const elapsed = Date.now() - countdownStart;
              const remaining = Math.max(0, Math.ceil((silenceDelay - elapsed) / 1000));
              setVadSilenceCountdown(remaining > 0 ? remaining : null);
            }, 100);

            silenceTimerRef.current = setTimeout(async () => {
              if (vadCountdownRef.current) { clearInterval(vadCountdownRef.current); vadCountdownRef.current = null; }
              setVadSilenceCountdown(null);
              if (canUseBrowserSTT) {
                isRec = false;
                setRecording(false);
                if (roomId) setSpeakingState(roomId, false);

                const allOriginal = allWordsRef.current.trim();
                if (allOriginal) {
                  freeTalkSendingRef.current = true;
                  const { myL, targetLangs } = getAllTargetLangs();
                  const ftOpts = {
                    domainContext: roomContextRef.current.contextPrompt || undefined,
                    description: roomContextRef.current.description || undefined,
                    roomMode: roomInfoRef.current?.mode || undefined,
                    nativeLang: myLangRef.current?.code || undefined,
                  };

                  let translations = {};
                  let primaryTranslated = '';
                  let primaryTargetLang = targetLangs[0]?.code || 'en';
                  try {
                    if (targetLangs.length === 1) {
                      const data = await translateUniversal(allOriginal, myL.code, targetLangs[0].code, myL.name, targetLangs[0].name, ftOpts);
                      if (data.translated) {
                        primaryTranslated = data.translated;
                        primaryTargetLang = targetLangs[0].code;
                        translations[targetLangs[0].code] = data.translated;
                      }
                    } else {
                      const result = await translateToAllTargets(allOriginal, myL, targetLangs, ftOpts);
                      translations = result.translations;
                      primaryTranslated = result.primaryTranslated;
                      primaryTargetLang = result.primaryTargetLang;
                    }
                  } catch (e) {
                    console.error('[FreeTalk] Translation error:', e);
                  }

                  setStreamingMsg(null);
                  if (primaryTranslated) {
                    sendMessage(allOriginal, primaryTranslated, myL.code, primaryTargetLang, translations).catch(() => {});
                  }
                  allWordsRef.current = '';
                  freeTalkSendingRef.current = false;
                }
              } else {
                if (vadRecRef.current?.state === 'recording') vadRecRef.current.stop();
                isRec = false;
                setRecording(false);
                if (roomId) setSpeakingState(roomId, false);
              }
              silenceTimerRef.current = null;
            }, silenceDelay);
          }
        } else if (avg > threshold && isRec && silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        vadTimerRef.current = requestAnimationFrame(check);
      }
      check();
    } catch {}
  }

  function stopFreeTalk() {
    setIsListening(false);
    setRecording(false);
    setVadAudioLevel(0);
    setVadSilenceCountdown(null);
    if (vadCountdownRef.current) { clearInterval(vadCountdownRef.current); vadCountdownRef.current = null; }
    if (vadTimerRef.current) { cancelAnimationFrame(vadTimerRef.current); vadTimerRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (vadRecRef.current?.state === 'recording') vadRecRef.current.stop();
    vadStreamRef.current = null;
    vadAnalyserRef.current = null;
    if (vadAudioCtxRef.current && vadAudioCtxRef.current.state !== 'closed') {
      try { vadAudioCtxRef.current.close(); } catch {}
      vadAudioCtxRef.current = null;
    }
    if (streamingModeRef.current) {
      streamingModeRef.current = false;
      if (speechRecRef.current) {
        try { speechRecRef.current.stop(); } catch {}
        speechRecRef.current = null;
      }
      if (!freeTalkSendingRef.current) setStreamingMsg(null);
    }
  }

  // =============================================
  // Cleanup on unmount
  // =============================================
  useEffect(() => {
    return () => {
      stopFreeTalk();
      stopDeepgramStreaming();
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
      vadStreamRef.current = null;
      if (vadTimerRef.current) { cancelAnimationFrame(vadTimerRef.current); vadTimerRef.current = null; }
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      vadAnalyserRef.current = null;
      if (vadAudioCtxRef.current && vadAudioCtxRef.current.state !== 'closed') {
        try { vadAudioCtxRef.current.close(); } catch {}
        vadAudioCtxRef.current = null;
      }
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
