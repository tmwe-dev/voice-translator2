'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

const SILENCE_THRESHOLD = 0.01;
const CLIPPING_THRESHOLD = 0.95;

export default function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [isClipping, setIsClipping] = useState(false);
  const [isSilent, setIsSilent] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [segments, setSegments] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      setHasPermission(true);
      return true;
    } catch {
      setHasPermission(false);
      return false;
    }
  }, []);

  const updateLevels = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(data);

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
      peak = Math.max(peak, Math.abs(data[i]));
    }
    const rms = Math.sqrt(sum / data.length);

    setAudioLevel(Math.min(rms * 3, 1));
    setPeakLevel(peak);
    setIsClipping(peak > CLIPPING_THRESHOLD);
    setIsSilent(rms < SILENCE_THRESHOLD);

    animFrameRef.current = requestAnimationFrame(updateLevels);
  }, []);

  const startRecording = useCallback(async () => {
    if (!streamRef.current) {
      const ok = await requestPermission();
      if (!ok) return;
    }

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const dur = durationRef.current;
      if (dur > 0.5) { // Skip very short accidental recordings
        setSegments(s => [...s, { blob, duration: dur, timestamp: Date.now(), url }]);
      }
    };

    mediaRecorder.start(1000);
    mediaRecorderRef.current = mediaRecorder;
    startTimeRef.current = Date.now();
    durationRef.current = 0;

    setIsRecording(true);
    setIsPaused(false);
    setDuration(0);

    timerRef.current = setInterval(() => {
      const dur = (Date.now() - startTimeRef.current) / 1000;
      durationRef.current = dur;
      setDuration(dur);
    }, 100);

    updateLevels();
  }, [requestPermission, updateLevels]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsRecording(false);
    setIsPaused(false);
    setAudioLevel(0);
    setPeakLevel(0);
  }, []);

  const deleteSegment = useCallback((index) => {
    setSegments(s => {
      const seg = s[index];
      if (seg) URL.revokeObjectURL(seg.url);
      return s.filter((_, i) => i !== index);
    });
  }, []);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);

  // Combine all segments into a single blob for upload
  const getCombinedBlob = useCallback(() => {
    if (segments.length === 0) return null;
    return new Blob(segments.map(s => s.blob), { type: 'audio/webm' });
  }, [segments]);

  return {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    peakLevel,
    isClipping,
    isSilent,
    hasPermission,
    segments,
    totalDuration,
    requestPermission,
    startRecording,
    stopRecording,
    deleteSegment,
    cleanup,
    getCombinedBlob,
  };
}
