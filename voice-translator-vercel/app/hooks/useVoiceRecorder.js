'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { traccia } from '../lib/monitorSviluppo.js';

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
      // b.275 — che cosa ci ha dato DAVVERO il telefono: il chiesto e il
      // ottenuto non coincidono sempre, e una frequenza diversa da quella
      // attesa e una causa classica di voce spezzata o non riconosciuta.
      try {
        const impostazioni = stream.getAudioTracks()[0]?.getSettings?.() || {};
        traccia('microfono-aperto', {
          frequenza: impostazioni.sampleRate ?? '?',
          canali: impostazioni.channelCount ?? '?',
          eco: impostazioni.echoCancellation ?? '?',
          rumore: impostazioni.noiseSuppression ?? '?',
        });
      } catch { /* il telefono non espone le impostazioni della traccia: si prosegue senza questa riga */ }

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

  // Reuse Float32Array across frames to avoid GC pressure
  const dataBufferRef = useRef(null);

  const updateLevels = useCallback(() => {
    if (!analyserRef.current) return;
    // Allocate once, reuse across frames
    if (!dataBufferRef.current || dataBufferRef.current.length !== analyserRef.current.fftSize) {
      dataBufferRef.current = new Float32Array(analyserRef.current.fftSize);
    }
    const data = dataBufferRef.current;
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

    let mediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });
    } catch (e) {
      // Stream leak on MediaRecorder error — stop all tracks immediately
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      throw e;
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      traccia('voce-registrata', { byte: blob.size, pezzi: chunksRef.current.length, tipo: mimeType });
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
    // Stop mic tracks to release the microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
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

  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  useEffect(() => {
    // Cleanup on unmount only — not on every segments change
    return () => {
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
      segmentsRef.current.forEach(seg => {
        if (seg.url) URL.revokeObjectURL(seg.url);
      });
    };
  }, []);

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);

  // Combine all segments into a single blob for upload
  const getCombinedBlob = useCallback(() => {
    if (segments.length === 0) return null;
    return new Blob(segments.map(s => s.blob), { type: 'audio/webm' });
  }, [segments]);

  // ── b.105 · questa funzione NON ESISTEVA ──
  // Era elencata qui sotto fra le cose restituite, ma non era mai stata
  // scritta. Alla riga `cleanup,` JavaScript cercava un nome che non c'e
  // e lanciava ReferenceError, quindi la pagina "La tua voce clonata"
  // moriva sempre, subito, con "Qualcosa e andato storto".
  //
  // Trovata con il collaudo pagina per pagina: da fermo il file sembrava
  // a posto, perche la riga incriminata e una parola sola.
  //
  // Serve davvero: senza, il microfono resta acceso dopo aver lasciato
  // la pagina e la spia della telecamera non si spegne piu.
  const cleanup = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const reg = mediaRecorderRef.current;
    if (reg && reg.state !== 'inactive') { try { reg.stop(); } catch { /* la registrazione era gia ferma */ } }
    mediaRecorderRef.current = null;

    // Il microfono si spegne per ultimo: se si chiude prima, il
    // registratore puo lamentarsi di una traccia sparita sotto i piedi.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* la registrazione era gia ferma */ } });
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataBufferRef.current = null;
    chunksRef.current = [];
  }, []);

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
