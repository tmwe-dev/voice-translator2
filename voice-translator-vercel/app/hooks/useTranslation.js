'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang, FREE_DAILY_LIMIT, SILENCE_DELAY, VAD_THRESHOLD, isWhisperPrimaryLang, STT_CONFIDENCE_THRESHOLD, STT_LOW_CONFIDENCE_COUNT } from '../lib/constants.js';
import { t } from '../lib/i18n.js';

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
  sentByMeRef
}) {
  const [recording, setRecording] = useState(false);
  const [streamingMsg, setStreamingMsg] = useState(null);
  const [sendingText, setSendingText] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isListening, setIsListening] = useState(false);

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

  // =============================================
  // Send Message
  // =============================================
  async function sendMessage(original, translated, sourceLang, targetLang) {
    if (!roomId) return null;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          sender: prefsRef.current.name,
          original,
          translated,
          sourceLang,
          targetLang
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message?.id && sentByMeRef) {
          sentByMeRef.current.add(data.message.id);
        }
        return data;
      }
    } catch (e) {
      console.error('[sendMessage] Error:', e);
    }
    return null;
  }

  // =============================================
  // Translation API — single call
  // =============================================
  async function translateUniversal(text, sourceLang, targetLang, sourceLangName, targetLangName, options = {}) {
    if (isTrialRef.current) {
      if (freeCharsRef.current >= FREE_DAILY_LIMIT) {
        return { translated: text, fallback: true, limitExceeded: true };
      }
      // Check translation mode from prefs
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

      // Standard or Superfast → use translate-free with mode flags
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
    return await res.json();
  }

  // =============================================
  // Get target language info
  // =============================================
  function getTargetLangInfo() {
    const currentMyLang = myLangRef.current;
    const currentRoomInfo = roomInfoRef.current;
    const currentPrefs = prefsRef.current;
    const myL = getLang(currentMyLang);
    let otherLangCode = null;
    if (currentRoomInfo && currentRoomInfo.members) {
      const other = currentRoomInfo.members.find(m => m.name !== currentPrefs.name);
      if (other) otherLangCode = other.lang;
    }
    if (!otherLangCode) otherLangCode = currentMyLang === 'en' ? 'it' : 'en';
    return { myL, otherL: getLang(otherLangCode) };
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
        // Track low-confidence results — if too many consecutive, the session
        // will auto-fallback to Whisper on next recording via whisperOnlyRef
        if (typeof confidence === 'number' && confidence > 0) {
          if (confidence < STT_CONFIDENCE_THRESHOLD) {
            lowConfidenceCountRef.current++;
            console.log(`[STT] Low confidence: ${confidence.toFixed(2)} (${lowConfidenceCountRef.current}/${STT_LOW_CONFIDENCE_COUNT})`);
            if (lowConfidenceCountRef.current >= STT_LOW_CONFIDENCE_COUNT) {
              console.warn(`[STT] Auto-switching to Whisper-only mode — ${STT_LOW_CONFIDENCE_COUNT} consecutive low-confidence results`);
              whisperOnlyRef.current = true;
            }
          } else {
            // Reset counter on good confidence
            lowConfidenceCountRef.current = 0;
          }
        }

        // Chrome sends duplicates at the same index — skip those
        const key = i + ':' + text;
        if (text && !processedFinals.has(key)) {
          processedFinals.add(key);
          const existing = allWordsRef.current.trim();

          // MINIMAL dedup: only catch Chrome's re-send of the FULL accumulated
          // text (Chrome sometimes sends the entire transcript as a new final).
          // Do NOT remove intentional repetitions like "Come state? Come state?"
          if (existing.length > 10 && text.length > existing.length * 0.8 && text.startsWith(existing)) {
            // Chrome re-sent the full accumulated text + new content
            text = text.slice(existing.length).trim();
            if (!text) continue;
          }

          // Only dedup overlaps of 4+ words (Chrome restart re-sends last few words)
          if (existing.length > 0) {
            const existingWords = existing.split(/\s+/);
            const textWords = text.split(/\s+/);
            // Only check overlap if there are enough words to be meaningful
            if (existingWords.length >= 4 && textWords.length >= 4) {
              const maxOverlap = Math.min(existingWords.length, textWords.length, 6);
              let overlapFound = 0;
              for (let ol = maxOverlap; ol >= 4; ol--) {
                const suffix = existingWords.slice(-ol).join(' ').toLowerCase();
                const prefix = textWords.slice(0, ol).join(' ').toLowerCase();
                if (suffix === prefix) { overlapFound = ol; break; }
              }
              if (overlapFound > 0) {
                text = textWords.slice(overlapFound).join(' ').trim();
                if (!text) continue;
              }
            }
          }

          lastInterimRef.current = '';
          allWordsRef.current = (allWordsRef.current + ' ' + text).trim();
          setStreamingMsg(prev => (prev ? { ...prev, original: allWordsRef.current } : null));
        }
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    if (interimTranscript) {
      lastInterimRef.current = interimTranscript.trim();
      const preview = allWordsRef.current + ' ' + interimTranscript.trim();
      setStreamingMsg(prev => (prev ? { ...prev, original: preview } : null));
    }
  }

  // =============================================
  // FASE 10: Start streaming — simplified
  // =============================================
  async function startStreamingTranslation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const currentLang = myLangRef.current;

    // ── FASE 1b: Hybrid STT routing ──
    // For Asian/tonal languages where browser SpeechRecognition is unreliable,
    // OR if auto-switched to Whisper due to low confidence,
    // skip SpeechRecognition entirely — use only MediaRecorder → Whisper
    const useWhisperOnly = isWhisperPrimaryLang(currentLang) || whisperOnlyRef.current;

    if (!SpeechRecognition || useWhisperOnly) {
      if (useWhisperOnly && !isTrialRef.current) {
        console.log(`[STT] Whisper-only mode for lang=${currentLang} (whisperPrimary=${isWhisperPrimaryLang(currentLang)}, autoSwitch=${whisperOnlyRef.current})`);
      }
      startClassicRecording();
      return;
    }

    unlockAudio();
    setRecording(true);
    if (roomId) setSpeakingState(roomId, true);

    allWordsRef.current = '';
    lastInterimRef.current = '';
    streamingModeRef.current = true;
    backupChunksRef.current = [];
    lowConfidenceCountRef.current = 0;
    // Only show original (what user is saying) — no translation preview
    setStreamingMsg({ original: '', translated: null, isStreaming: true });

    // Backup audio recording (fallback if speech recognition captures nothing)
    if (!isTrialRef.current) {
      try {
        const stream = await getMicStream();
        backupStreamRef.current = stream;
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4';
        const backup = new MediaRecorder(stream, { mimeType: mime });
        backup.ondataavailable = e => {
          if (e.data.size > 0) backupChunksRef.current.push(e.data);
        };
        backupRecRef.current = backup;
        backup.start(250);
      } catch (e) {
        setRecording(false);
        streamingModeRef.current = false;
        setStreamingMsg(null);
        return;
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getLang(currentLang).speech;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    speechRecRef.current = recognition;

    let processedFinals = new Set();
    let errorCount = 0;
    recognition.onresult = (event) => handleSpeechResult(event, processedFinals);

    // ── FASE 7: Error handling ──
    recognition.onerror = (event) => {
      const err = event.error;
      // 'no-speech' is normal (user paused) — don't count
      if (err === 'no-speech') return;
      errorCount++;
      console.warn(`[STT] SpeechRecognition error: ${err} (count=${errorCount})`);

      // After 3 non-trivial errors, auto-switch to Whisper for this session
      if (errorCount >= 3 && !whisperOnlyRef.current) {
        console.warn('[STT] Too many errors — enabling Whisper-only mode for this session');
        whisperOnlyRef.current = true;
      }

      // 'not-allowed' or 'service-not-available' are fatal — stop trying
      if (err === 'not-allowed' || err === 'service-not-available') {
        streamingModeRef.current = false;
      }
    };

    recognition.onend = () => {
      if (streamingModeRef.current) {
        processedFinals = new Set();
        try { recognition.start(); } catch {}
      }
    };
    try { recognition.start(); } catch {}
    // Keepalive: refresh speaking state every 15s so partner keeps seeing dots
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
    streamingModeRef.current = false;
    setRecording(false);
    if (speakingKeepAliveRef.current) { clearInterval(speakingKeepAliveRef.current); speakingKeepAliveRef.current = null; }
    if (roomId) setSpeakingState(roomId, false);

    // Stop speech recognition
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch {}
      speechRecRef.current = null;
    }

    // Stop backup audio recording
    let backupBlob = null;
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      await new Promise(resolve => {
        backupRecRef.current.onstop = () => resolve();
        backupRecRef.current.stop();
      });
      if (backupChunksRef.current.length > 0)
        backupBlob = new Blob(backupChunksRef.current, { type: backupRecRef.current.mimeType });
    }
    backupRecRef.current = null;
    backupStreamRef.current = null;

    // Capture any pending interim text
    if (lastInterimRef.current) {
      const pending = lastInterimRef.current.trim();
      const existing = allWordsRef.current.trim();
      if (pending && !existing.endsWith(pending) && !existing.includes(pending)) {
        allWordsRef.current = (existing + ' ' + pending).trim();
      }
      lastInterimRef.current = '';
    }

    const allOriginal = allWordsRef.current.trim();

    // If no text captured, try audio fallback
    if (!allOriginal && backupBlob && backupBlob.size > 1000 && !isTrialRef.current) {
      setStreamingMsg(null);
      allWordsRef.current = '';
      stoppingRef.current = false;
      try { await processAndSendAudio(backupBlob); } catch {}
      return;
    }

    if (!allOriginal) {
      setStreamingMsg(null);
      allWordsRef.current = '';
      stoppingRef.current = false;
      return;
    }

    // ── ONE single translation call ──
    const { myL, otherL } = getTargetLangInfo();
    let finalTranslation = '';

    try {
      const data = await translateUniversal(allOriginal, myL.code, otherL.code, myL.name, otherL.name, {
        domainContext: roomContextRef.current.contextPrompt || undefined,
        description: roomContextRef.current.description || undefined
      });
      if (data.translated) finalTranslation = data.translated;
    } catch (e) {
      console.error('[Translate] Error:', e);
    }

    // If translation failed entirely, try audio fallback
    if (!finalTranslation && backupBlob && backupBlob.size > 1000 && !isTrialRef.current) {
      setStreamingMsg(null);
      allWordsRef.current = '';
      stoppingRef.current = false;
      try { await processAndSendAudio(backupBlob); } catch {}
      return;
    }

    // Clear streaming bubble BEFORE sending
    setStreamingMsg(null);

    // Send message (fire-and-forget for speed)
    if (finalTranslation && roomId) {
      sendMessage(allOriginal, finalTranslation, myL.code, otherL.code).catch(() => {});
    }

    allWordsRef.current = '';
    if (!isTrialRef.current && !useOwnKeys) refreshBalance();
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
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      recRef.current = new MediaRecorder(stream, { mimeType: mime });
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
    const { myL, otherL } = getTargetLangInfo();
    const form = new FormData();
    form.append('audio', blob, 'audio.webm');
    form.append('sourceLang', myL.code);
    form.append('targetLang', otherL.code);
    form.append('sourceLangName', myL.name);
    form.append('targetLangName', otherL.name);
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
      await sendMessage(original, translated, myL.code, otherL.code);
    }
  }

  // =============================================
  // Cancel Recording — discard without sending
  // =============================================
  function cancelRecording() {
    // Stop keepalive
    if (speakingKeepAliveRef.current) { clearInterval(speakingKeepAliveRef.current); speakingKeepAliveRef.current = null; }
    // Stop speech recognition
    streamingModeRef.current = false;
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch {}
      speechRecRef.current = null;
    }
    // Stop backup audio recording
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      backupRecRef.current.onstop = () => {}; // prevent sending
      try { backupRecRef.current.stop(); } catch {}
    }
    backupRecRef.current = null;
    backupStreamRef.current = null;
    backupChunksRef.current = [];
    // Stop classic recording
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.onstop = () => {}; // prevent sending
      try { recRef.current.stop(); } catch {}
    }
    recRef.current = null;
    chunksRef.current = [];
    // Clear all state
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
      const { myL, otherL } = getTargetLangInfo();
      const data = await translateUniversal(
        textInput.trim(), myL.code, otherL.code, myL.name, otherL.name,
        {
          domainContext: roomContextRef.current.contextPrompt || undefined,
          description: roomContextRef.current.description || undefined
        }
      );
      if (data.translated) {
        await sendMessage(textInput.trim(), data.translated, myL.code, otherL.code);
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

    // ── FASE 1b: Hybrid STT for FreeTalk ──
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

        // ── FASE 7: Error handling for FreeTalk ──
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
        // In Whisper-only mode, FreeTalk still uses VAD but records with MediaRecorder
        // and sends chunks to Whisper on silence detection (handled in the check() loop below)
      }

      function check() {
        if (!vadAnalyserRef.current) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;

        if (avg > threshold && !isRec) {
          isRec = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (canUseBrowserSTT) {
            // Browser STT mode: SpeechRecognition is already running
            if (!streamingMsg) setStreamingMsg({ original: '', translated: null, isStreaming: true });
            setRecording(true);
            if (roomId) setSpeakingState(roomId, true);
          } else {
            // Whisper-only / no-SpeechRecognition mode: record with MediaRecorder
            const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';
            const ch = [];
            const r = new MediaRecorder(stream, { mimeType: mime });
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
            silenceTimerRef.current = setTimeout(async () => {
              if (canUseBrowserSTT) {
                // Browser STT mode: translate accumulated text
                isRec = false;
                setRecording(false);
                if (roomId) setSpeakingState(roomId, false);

                const allOriginal = allWordsRef.current.trim();
                if (allOriginal) {
                  freeTalkSendingRef.current = true;
                  const { myL, otherL } = getTargetLangInfo();

                  // ONE single translation call
                  let finalTranslation = '';
                  try {
                    const data = await translateUniversal(
                      allOriginal, myL.code, otherL.code, myL.name, otherL.name,
                      {
                        domainContext: roomContextRef.current.contextPrompt || undefined,
                        description: roomContextRef.current.description || undefined
                      }
                    );
                    if (data.translated) finalTranslation = data.translated;
                  } catch (e) {
                    console.error('[FreeTalk] Translation error:', e);
                  }

                  setStreamingMsg(null);
                  if (finalTranslation) {
                    sendMessage(allOriginal, finalTranslation, myL.code, otherL.code).catch(() => {});
                  }
                  allWordsRef.current = '';
                  freeTalkSendingRef.current = false;
                }
              } else {
                // Whisper-only mode: stop recording, blob goes to processAndSendAudio via onstop
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
