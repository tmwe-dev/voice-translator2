'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useVAD — Voice Activity Detection hook
 *
 * Adapted from TMWEngine BarVoiceRecorderV2_Hybrid patterns:
 * - Normalized audio level (0-1) via frequency analysis
 * - Adaptive noise floor (learns ambient noise in first 2 seconds)
 * - Silence countdown with visual feedback
 * - Stale closure fix via refs
 *
 * @param {Object} options
 * @param {number} options.silenceMs - Silence duration before trigger (default 1500ms)
 * @param {number} options.threshold - VAD threshold override (0-1, default auto-adaptive)
 * @param {number} options.fftSize - FFT bin size (default 2048)
 * @param {function} options.onSpeechStart - Called when voice detected
 * @param {function} options.onSpeechEnd - Called after silence timeout
 * @param {function} options.onLevelUpdate - Called every frame with normalizedLevel (0-1)
 */
export default function useVAD(options = {}) {
  const {
    silenceMs = 1500,
    threshold: fixedThreshold = null,
    fftSize = 2048,
    onSpeechStart,
    onSpeechEnd,
    onLevelUpdate,
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [silenceCountdown, setSilenceCountdown] = useState(null);

  // Refs for closure-safe access
  const isActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Adaptive noise floor
  const noiseFloorRef = useRef(0.02); // Initial conservative estimate
  const noiseSamplesRef = useRef([]);
  const calibratedRef = useRef(false);
  const CALIBRATION_FRAMES = 60; // ~1 second at 60fps
  const NOISE_MARGIN = 2.5; // Threshold = noiseFloor * margin

  // Callback refs to avoid stale closures
  const onSpeechStartRef = useRef(onSpeechStart);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const onLevelUpdateRef = useRef(onLevelUpdate);
  useEffect(() => { onSpeechStartRef.current = onSpeechStart; }, [onSpeechStart]);
  useEffect(() => { onSpeechEndRef.current = onSpeechEnd; }, [onSpeechEnd]);
  useEffect(() => { onLevelUpdateRef.current = onLevelUpdate; }, [onLevelUpdate]);

  /**
   * Get effective threshold — either fixed or adaptive
   */
  const getThreshold = useCallback(() => {
    if (fixedThreshold !== null) return fixedThreshold;
    // Adaptive: noise floor * margin, clamped between 0.03 and 0.25
    return Math.max(0.03, Math.min(0.25, noiseFloorRef.current * NOISE_MARGIN));
  }, [fixedThreshold]);

  /**
   * Monitor audio levels — runs every animation frame
   * Pattern from TMWEngine: getByteFrequencyData → normalized average
   */
  const monitorLoop = useCallback(() => {
    if (!analyserRef.current || !isActiveRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate normalized level (0-1) — TMWEngine pattern
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 128, 1);

    setAudioLevel(normalizedLevel);
    onLevelUpdateRef.current?.(normalizedLevel);

    // Adaptive calibration: collect noise floor samples
    if (!calibratedRef.current && noiseSamplesRef.current.length < CALIBRATION_FRAMES) {
      noiseSamplesRef.current.push(normalizedLevel);
      if (noiseSamplesRef.current.length >= CALIBRATION_FRAMES) {
        // Use median as noise floor (more robust than mean)
        const sorted = [...noiseSamplesRef.current].sort((a, b) => a - b);
        noiseFloorRef.current = sorted[Math.floor(sorted.length * 0.5)];
        calibratedRef.current = true;
      }
    }

    const effectiveThreshold = getThreshold();

    if (normalizedLevel > effectiveThreshold) {
      // Voice detected
      if (!isSpeakingRef.current) {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        onSpeechStartRef.current?.();
      }

      // Clear silence timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setSilenceCountdown(null);
    } else {
      // Silence detected — start countdown if speaking
      if (isSpeakingRef.current && !silenceTimerRef.current) {
        const startTime = Date.now();

        // Visual countdown (100ms interval) — TMWEngine pattern
        countdownIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, Math.ceil((silenceMs - elapsed) / 1000));
          setSilenceCountdown(remaining > 0 ? remaining : null);
        }, 100);

        // Actual silence trigger
        silenceTimerRef.current = setTimeout(() => {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          setSilenceCountdown(null);

          isSpeakingRef.current = false;
          setIsSpeaking(false);
          onSpeechEndRef.current?.();

          silenceTimerRef.current = null;
        }, silenceMs);
      }
    }

    animFrameRef.current = requestAnimationFrame(monitorLoop);
  }, [getThreshold, silenceMs]);

  /**
   * Start VAD monitoring on a MediaStream
   * Can accept an existing stream or create a new one
   */
  const start = useCallback(async (existingStream = null) => {
    if (isActiveRef.current) return;

    try {
      const stream = existingStream || await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });

      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      // Reset calibration
      noiseSamplesRef.current = [];
      calibratedRef.current = false;
      noiseFloorRef.current = 0.02;

      isActiveRef.current = true;
      setIsActive(true);

      monitorLoop();
    } catch (err) {
      console.error('[useVAD] Failed to start:', err);
    }
  }, [fftSize, monitorLoop]);

  /**
   * Stop VAD monitoring and cleanup
   */
  const stop = useCallback(() => {
    isActiveRef.current = false;
    setIsActive(false);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setAudioLevel(0);
    setSilenceCountdown(null);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    isActive,
    isSpeaking,
    audioLevel,        // 0-1 normalized
    silenceCountdown,  // seconds remaining or null
    start,
    stop,
    // Expose internals for advanced usage
    getThreshold,
    streamRef,
    analyserRef,
  };
}
