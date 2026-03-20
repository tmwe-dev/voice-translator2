'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { createNoiseGate } from '../lib/noiseGate.js';

// ═══════════════════════════════════════
// useInterpreterMode — Bidirectional real-time STT → Translate → TTS
//
// Captures 3-second audio chunks, transcribes, translates, and sends
// translated audio + subtitles to the remote peer via DataChannel.
// Works on both voice and video calls.
// ═══════════════════════════════════════

const CHUNK_DURATION = 3000; // 3 seconds

export default function useInterpreterMode({
  webrtc, myLang, partnerLang, roomId, userToken, useOwnKeys,
}) {
  const [active, setActive] = useState(false);
  const [mySubtitles, setMySubtitles] = useState([]);
  const [partnerSubtitles, setPartnerSubtitles] = useState([]);
  const [lastSubtitle, setLastSubtitle] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const noiseGateRef = useRef(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { activeRef.current = active; }, [active]);

  // Listen for interpreter messages from partner via DataChannel
  useEffect(() => {
    if (!webrtc?.sendDirectMessage) return;

    const origHandler = webrtc._onDirectMessageRef?.current;

    // We patch in via a wrapper — partner subtitles come as DC messages
    // The RoomView should pass interpreter DC messages to us
  }, [webrtc]);

  // Process incoming interpreter data from partner
  const handleInterpreterMessage = useCallback((msg) => {
    if (!msg) return;

    if (msg.type === 'interpreter-subtitle') {
      const sub = { text: msg.text, lang: msg.lang, ts: Date.now() };
      setPartnerSubtitles(prev => [...prev.slice(-20), sub]);
      setLastSubtitle(msg.text);
      // Auto-clear after 8s
      setTimeout(() => {
        setLastSubtitle(prev => prev === msg.text ? null : prev);
      }, 8000);
    }

    if (msg.type === 'interpreter-audio' && msg.data) {
      // Play translated audio from partner
      try {
        const audioBytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
        const blob = new Blob([audioBytes], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = 0.9;
        audio.play().catch(() => {});
        audio.onended = () => URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('[Interpreter] Failed to play partner audio:', e);
      }
    }
  }, []);

  // Process a single audio chunk: STT → Translate → TTS → Send
  const processChunk = useCallback(async (blob) => {
    if (!activeRef.current || processingRef.current) return;
    if (blob.size < 1000) return; // Skip tiny/silent chunks

    processingRef.current = true;
    try {
      const authHeaders = {
        'Authorization': `Bearer ${userToken}`,
      };

      // 1. STT — Transcribe audio
      const formData = new FormData();
      formData.append('audio', blob, 'chunk.webm');
      formData.append('lang', myLang);
      if (roomId) formData.append('roomId', roomId);

      const sttRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      if (!sttRes.ok) { processingRef.current = false; return; }
      const { text: transcript } = await sttRes.json();
      if (!transcript || transcript.trim().length < 2) { processingRef.current = false; return; }

      // Add to my subtitles
      const mySub = { text: transcript, lang: myLang, ts: Date.now() };
      setMySubtitles(prev => [...prev.slice(-20), mySub]);

      // 2. Translate
      const translateRes = await fetch('/api/translate', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          from: myLang,
          to: partnerLang,
          roomId,
        }),
      });

      if (!translateRes.ok) { processingRef.current = false; return; }
      const { translation } = await translateRes.json();
      if (!translation) { processingRef.current = false; return; }

      // 3. TTS — Generate audio of translation
      const ttsRes = await fetch('/api/tts-edge', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: translation,
          lang: partnerLang,
          roomId,
        }),
      });

      if (!ttsRes.ok) { processingRef.current = false; return; }
      const ttsBlob = await ttsRes.blob();
      const ttsBuffer = await ttsBlob.arrayBuffer();
      const ttsBase64 = btoa(String.fromCharCode(...new Uint8Array(ttsBuffer)));

      // 4. Send via DataChannel to partner
      if (webrtc?.sendDirectMessage) {
        // Send subtitle
        webrtc.sendDirectMessage(JSON.stringify({
          type: 'interpreter-subtitle',
          text: translation,
          lang: partnerLang,
          originalText: transcript,
          originalLang: myLang,
        }));

        // Send audio (split into chunks if too large for DC)
        const MAX_DC_SIZE = 64000; // 64KB safe limit
        if (ttsBase64.length <= MAX_DC_SIZE) {
          webrtc.sendDirectMessage(JSON.stringify({
            type: 'interpreter-audio',
            data: ttsBase64,
          }));
        } else {
          // Split into parts
          const parts = Math.ceil(ttsBase64.length / MAX_DC_SIZE);
          const id = Date.now().toString(36);
          for (let i = 0; i < parts; i++) {
            webrtc.sendDirectMessage(JSON.stringify({
              type: 'interpreter-audio-part',
              id,
              part: i,
              total: parts,
              data: ttsBase64.slice(i * MAX_DC_SIZE, (i + 1) * MAX_DC_SIZE),
            }));
          }
        }
      }
    } catch (e) {
      console.warn('[Interpreter] Process chunk error:', e);
    } finally {
      processingRef.current = false;
    }
  }, [myLang, partnerLang, roomId, userToken, webrtc]);

  // Start recording + processing loop
  const startInterpreter = useCallback(async () => {
    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = rawStream;

      // Apply noise gate for cleaner STT in noisy environments
      let recordStream = rawStream;
      try {
        const ng = createNoiseGate(rawStream, { threshold: -45 });
        noiseGateRef.current = ng;
        recordStream = ng.cleanStream;
      } catch (e) {
        console.warn('[Interpreter] Noise gate unavailable, using raw stream:', e);
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(recordStream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0 && activeRef.current) {
          processChunk(e.data);
        }
      };

      recorder.start(CHUNK_DURATION);
      setActive(true);
      console.log('[Interpreter] Started');
    } catch (e) {
      console.error('[Interpreter] Failed to start:', e);
      setActive(false);
    }
  }, [processChunk]);

  // Stop recording
  const stopInterpreter = useCallback(() => {
    setActive(false);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    recorderRef.current = null;
    if (noiseGateRef.current) {
      try { noiseGateRef.current.destroy(); } catch {}
      noiseGateRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      streamRef.current = null;
    }
    console.log('[Interpreter] Stopped');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      }
    };
  }, []);

  // Auto-stop when webrtc disconnects
  useEffect(() => {
    if (webrtc?.webrtcState !== 'connected' && active) {
      stopInterpreter();
    }
  }, [webrtc?.webrtcState, active, stopInterpreter]);

  return {
    active,
    setActive,
    mySubtitles,
    partnerSubtitles,
    lastSubtitle,
    start: startInterpreter,
    stop: stopInterpreter,
    handleInterpreterMessage,
  };
}
