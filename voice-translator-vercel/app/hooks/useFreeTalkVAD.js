'use client';
import { useState, useRef, useCallback } from 'react';
import { getLang, SILENCE_DELAY, VAD_THRESHOLD, VAD_PRESETS, isWhisperPrimaryLang } from '../lib/constants.js';

/**
 * FreeTalk VAD (Voice Activity Detection) hook.
 *
 * Manages the "always listening" mode where audio is monitored via Web Audio API
 * analyser. When voice is detected above the VAD threshold, recording starts.
 * After silence exceeds SILENCE_DELAY, the captured speech is finalized.
 *
 * Features:
 * - Noise gate: requires minVoiceDuration ms of continuous voice to trigger
 * - Adjustable sensitivity presets: quiet / normal / noisy / street
 * - Pending text is always sent (never discarded) when stopping FreeTalk
 *
 * Supports two STT backends:
 * - Browser SpeechRecognition (for supported languages)
 * - MediaRecorder + Whisper (fallback for unsupported/unreliable languages)
 *
 * Returns: { isListening, vadAudioLevel, vadSilenceCountdown, vadSensitivity,
 *            setVadSensitivity, startFreeTalk, stopFreeTalk, cleanupVAD }
 */
export default function useFreeTalkVAD({
  myLangRef,
  roomId,
  getMicStream,
  unlockAudio,
  setSpeakingState,
  getRecorderMime,
  // Speech recognition integration
  speechRecRef,
  allWordsRef,
  streamingModeRef,
  whisperOnlyRef,
  lowConfidenceCountRef,
  handleSpeechResult,
  setStreamingMsg,
  setRecording,
  // Translation + send
  translateAndSend,
  processAndSendAudio,
}) {
  const [isListening, setIsListening] = useState(false);
  const [vadAudioLevel, setVadAudioLevel] = useState(0);
  const [vadSilenceCountdown, setVadSilenceCountdown] = useState(null);
  const [vadSensitivity, setVadSensitivity] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vt-vad-sensitivity') || 'normal';
    }
    return 'normal';
  });
  const vadCountdownRef = useRef(null);

  // VAD resources
  const vadStreamRef = useRef(null);
  const vadRecRef = useRef(null);
  const vadTimerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const vadAnalyserRef = useRef(null);
  const vadAudioCtxRef = useRef(null);
  const freeTalkSendingRef = useRef(false);

  // Persist sensitivity preference
  const updateSensitivity = useCallback((val) => {
    setVadSensitivity(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vt-vad-sensitivity', val);
    }
  }, []);

  /**
   * Start FreeTalk mode: open mic, run VAD loop, auto-record on voice detection.
   */
  const startFreeTalk = useCallback(async () => {
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

      // Get threshold settings from sensitivity preset
      const preset = VAD_PRESETS[vadSensitivity] || VAD_PRESETS.normal;
      const threshold = preset.threshold;
      const silenceDelay = preset.silenceDelay;
      const minVoiceDuration = preset.minVoiceDuration;

      // Noise gate: track how long voice has been continuous above threshold
      let voiceStartTime = 0;
      let voiceDetected = false; // true once minVoiceDuration passed

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

        const aboveThreshold = avg > threshold;

        // ── Noise gate logic ──
        if (aboveThreshold && !isRec) {
          if (!voiceStartTime) {
            voiceStartTime = Date.now();
          }
          // Check if voice has been continuous for minVoiceDuration
          if (!voiceDetected && (Date.now() - voiceStartTime) >= minVoiceDuration) {
            voiceDetected = true;
            // ── Voice confirmed: start recording ──
            isRec = true;
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
            if (vadCountdownRef.current) { clearInterval(vadCountdownRef.current); vadCountdownRef.current = null; }
            setVadSilenceCountdown(null);
            if (canUseBrowserSTT) {
              setStreamingMsg({ original: '', translated: null, isStreaming: true });
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
          }
        } else if (!aboveThreshold && !isRec) {
          // Reset noise gate if sound dropped before minVoiceDuration
          voiceStartTime = 0;
          voiceDetected = false;
        } else if (!aboveThreshold && isRec) {
          // ── Silence detected while recording: start countdown to finalize ──
          voiceStartTime = 0;
          voiceDetected = false;
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
                  try {
                    await translateAndSend(allOriginal, { clearStreamingMsg: true });
                  } catch (e) {
                    console.error('[FreeTalk] Translation error:', e);
                  }
                  setStreamingMsg(null);
                  allWordsRef.current = '';
                  freeTalkSendingRef.current = false;
                } else {
                  // No text accumulated — just clear streaming msg (noise trigger)
                  setStreamingMsg(null);
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
        } else if (aboveThreshold && isRec && silenceTimerRef.current) {
          // ── Voice resumed during countdown: cancel silence timer ──
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
          if (vadCountdownRef.current) { clearInterval(vadCountdownRef.current); vadCountdownRef.current = null; }
          setVadSilenceCountdown(null);
        }
        vadTimerRef.current = requestAnimationFrame(check);
      }
      check();
    } catch {}
  }, [isListening, myLangRef, roomId, getMicStream, unlockAudio, setSpeakingState,
      getRecorderMime, speechRecRef, allWordsRef, streamingModeRef, whisperOnlyRef,
      lowConfidenceCountRef, handleSpeechResult, setStreamingMsg, setRecording,
      translateAndSend, processAndSendAudio, vadSensitivity]);

  /**
   * Stop FreeTalk mode: clean up all VAD resources.
   * IMPORTANT: any pending accumulated text is sent, never discarded.
   */
  const stopFreeTalk = useCallback(async () => {
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

      // ── Send any pending accumulated text before stopping ──
      const pendingText = allWordsRef.current?.trim();
      if (pendingText && !freeTalkSendingRef.current) {
        freeTalkSendingRef.current = true;
        try {
          await translateAndSend(pendingText, { clearStreamingMsg: true });
        } catch (e) {
          console.error('[FreeTalk] Error sending pending text on stop:', e);
        }
        allWordsRef.current = '';
        freeTalkSendingRef.current = false;
      }
      setStreamingMsg(null);
    }
    if (roomId) setSpeakingState(roomId, false);
  }, [setRecording, setStreamingMsg, streamingModeRef, speechRecRef,
      allWordsRef, translateAndSend, roomId, setSpeakingState]);

  /**
   * Cleanup function for use in parent's useEffect unmount.
   */
  const cleanupVAD = useCallback(() => {
    vadStreamRef.current = null;
    if (vadTimerRef.current) { cancelAnimationFrame(vadTimerRef.current); vadTimerRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    vadAnalyserRef.current = null;
    if (vadAudioCtxRef.current && vadAudioCtxRef.current.state !== 'closed') {
      try { vadAudioCtxRef.current.close(); } catch {}
      vadAudioCtxRef.current = null;
    }
  }, []);

  return {
    isListening,
    vadAudioLevel,
    vadSilenceCountdown,
    vadSensitivity,
    setVadSensitivity: updateSensitivity,
    startFreeTalk,
    stopFreeTalk,
    cleanupVAD,
    freeTalkSendingRef,
  };
}
