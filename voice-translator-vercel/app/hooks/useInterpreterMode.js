'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { createNoiseGate } from '../lib/noiseGate.js';
import { apiCircuitBreaker } from '../lib/circuitBreaker.js';
import useStreamingInterpreter from './useStreamingInterpreter.js';

// ═══════════════════════════════════════
// useInterpreterMode — Bidirectional real-time STT → Translate → TTS
//
// TWO MODES:
// A) STREAMING (Deepgram available): subtitle-first pipeline
//    - Real-time STT via WebSocket
//    - Incremental translation with conversation context
//    - Subtitles appear instantly, TTS per completed sentence
//
// B) LEGACY (Deepgram unavailable): 3-second chunk pipeline
//    - Capture 3s audio chunks via MediaRecorder
//    - STT → Translate → TTS per chunk (sequenziale)
//
// Works on both voice and video calls.
// ═══════════════════════════════════════

const CHUNK_DURATION = 3000; // 3 seconds (legacy mode)

export default function useInterpreterMode({
  webrtc, myLang, partnerLang, roomId, userToken, useOwnKeys,
  startDucking, stopDucking,
  conversationContext,  // NEW: { getContext, addMessage } from useConversationContext
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
  const processChunkRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { activeRef.current = active; }, [active]);

  // Dedup: track recently processed message fingerprints to prevent duplicate audio/subtitles
  const seenMsgsRef = useRef(new Set());
  // Track subtitle timeout IDs for cleanup on unmount
  const subtitleTimersRef = useRef([]);

  // Buffer for reassembling chunked audio parts
  const audioPartsRef = useRef({}); // { [id]: { parts: {}, total: number, ts: number } }

  // Cleanup stale incomplete audio buffers every 30s (prevents memory leaks)
  useEffect(() => {
    const interval = setInterval(() => {
      const buf = audioPartsRef.current;
      const now = Date.now();
      for (const id of Object.keys(buf)) {
        if (now - (buf[id].ts || 0) > 30000) {
          console.warn('[Interpreter] Dropping stale audio buffer:', id);
          delete buf[id];
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Play base64 audio helper — activates ducking while playing
  const playBase64Audio = useCallback((base64Data) => {
    try {
      const audioBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 0.9;
      // Duck partner audio while interpreter speaks
      startDucking?.();
      audio.play().catch(() => {});
      audio.onended = () => {
        URL.revokeObjectURL(url);
        stopDucking?.();
      };
      audio.onerror = () => { stopDucking?.(); };
    } catch (e) {
      console.warn('[Interpreter] Failed to play audio:', e);
      stopDucking?.();
    }
  }, [startDucking, stopDucking]);

  // Process incoming interpreter data from partner
  const handleInterpreterMessage = useCallback((msg) => {
    if (!msg) return;

    if (msg.type === 'interpreter-subtitle') {
      // Dedup: skip if we already showed this exact subtitle recently
      const fingerprint = `sub:${msg.text}:${msg.lang}`;
      if (seenMsgsRef.current.has(fingerprint)) return;
      seenMsgsRef.current.add(fingerprint);
      // LRU: cap at 50 entries
      if (seenMsgsRef.current.size > 50) {
        seenMsgsRef.current.delete(seenMsgsRef.current.values().next().value);
      }

      const sub = { text: msg.text, lang: msg.lang, ts: Date.now() };
      setPartnerSubtitles(prev => [...prev.slice(-20), sub]);
      setLastSubtitle(msg.text);
      // Auto-clear after 8s — track timer for cleanup on unmount
      const timerId = setTimeout(() => {
        setLastSubtitle(prev => prev === msg.text ? null : prev);
        subtitleTimersRef.current = subtitleTimersRef.current.filter(id => id !== timerId);
      }, 8000);
      subtitleTimersRef.current.push(timerId);
    }

    // Single audio message (fits in one DC frame)
    if (msg.type === 'interpreter-audio' && msg.data) {
      // Dedup: skip if we already played this audio (first 40 chars as fingerprint)
      const audioFp = `audio:${msg.data.substring(0, 40)}`;
      if (seenMsgsRef.current.has(audioFp)) return;
      seenMsgsRef.current.add(audioFp);
      if (seenMsgsRef.current.size > 50) {
        seenMsgsRef.current.delete(seenMsgsRef.current.values().next().value);
      }
      playBase64Audio(msg.data);
    }

    // Chunked audio message (split across multiple DC frames)
    if (msg.type === 'interpreter-audio-part' && msg.id && msg.data != null) {
      const buf = audioPartsRef.current;
      if (!buf[msg.id]) buf[msg.id] = { parts: {}, total: msg.total, ts: Date.now() };
      buf[msg.id].parts[msg.part] = msg.data;
      // Check if all parts received
      const entry = buf[msg.id];
      if (Object.keys(entry.parts).length === entry.total) {
        // Reassemble in order
        let fullBase64 = '';
        for (let i = 0; i < entry.total; i++) {
          fullBase64 += entry.parts[i] || '';
        }
        delete buf[msg.id];
        playBase64Audio(fullBase64);
      }
    }
  }, [playBase64Audio]);

  // Process a single audio chunk: STT → Translate → TTS → Send
  const processChunk = useCallback(async (blob) => {
    if (!activeRef.current || processingRef.current) return;
    if (blob.size < 1000) return; // Skip tiny/silent chunks

    processingRef.current = true;
    try {
      // 1. STT — Transcribe audio
      // /api/transcribe reads userToken + sourceLang from formData (NOT headers)
      const formData = new FormData();
      formData.append('audio', blob, 'chunk.webm');
      formData.append('sourceLang', myLang);
      if (userToken) formData.append('userToken', userToken);
      if (roomId) formData.append('roomId', roomId);

      const sttRes = await apiCircuitBreaker.execute('interpreter-stt', () =>
        fetch('/api/transcribe', { method: 'POST', body: formData })
      );

      if (!sttRes.ok) { processingRef.current = false; return; }
      const { original: transcript } = await sttRes.json();
      if (!transcript || transcript.trim().length < 2) { processingRef.current = false; return; }

      // Add to my subtitles
      const mySub = { text: transcript, lang: myLang, ts: Date.now() };
      setMySubtitles(prev => [...prev.slice(-20), mySub]);

      // 2. Translate — /api/translate expects sourceLang/targetLang/userToken in JSON body
      const translateRes = await apiCircuitBreaker.execute('interpreter-translate', () =>
        fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: transcript,
            sourceLang: myLang,
            targetLang: partnerLang,
            userToken: userToken || '',
            roomId,
          }),
        })
      );

      if (!translateRes.ok) { processingRef.current = false; return; }
      const { translated } = await translateRes.json();
      if (!translated) { processingRef.current = false; return; }

      // 3. TTS — Generate audio of translation
      // /api/tts-edge expects langCode (not lang)
      const ttsRes = await apiCircuitBreaker.execute('interpreter-tts', () =>
        fetch('/api/tts-edge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: translated,
            langCode: partnerLang,
          }),
        })
      );

      if (!ttsRes.ok) { processingRef.current = false; return; }
      const ttsBlob = await ttsRes.blob();
      const ttsBuffer = await ttsBlob.arrayBuffer();
      // Convert to base64 in chunks to avoid "Maximum call stack size exceeded"
      // (String.fromCharCode(...spread) crashes when array > ~64K elements)
      const bytes = new Uint8Array(ttsBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const ttsBase64 = btoa(binary);

      // 4. Send via DataChannel to partner
      // IMPORTANT: pass objects (not strings) — sendDirectMessage handles JSON.stringify + E2E
      if (webrtc?.sendDirectMessage) {
        // Send subtitle
        webrtc.sendDirectMessage({
          type: 'interpreter-subtitle',
          text: translated,
          lang: partnerLang,
          originalText: transcript,
          originalLang: myLang,
        });

        // Send audio (split into chunks if too large for DC)
        // Browser RTCDataChannel limit is ~16KB per message.
        // After JSON.stringify + E2E encryption overhead (~200 bytes),
        // 10KB base64 chunks stay safely under the 16KB browser limit.
        const MAX_DC_SIZE = 10000; // 10KB safe for 16KB browser limit + encryption overhead
        if (ttsBase64.length <= MAX_DC_SIZE) {
          webrtc.sendDirectMessage({
            type: 'interpreter-audio',
            data: ttsBase64,
          });
        } else {
          // Split into parts
          const parts = Math.ceil(ttsBase64.length / MAX_DC_SIZE);
          const id = Date.now().toString(36);
          for (let i = 0; i < parts; i++) {
            webrtc.sendDirectMessage({
              type: 'interpreter-audio-part',
              id,
              part: i,
              total: parts,
              data: ttsBase64.slice(i * MAX_DC_SIZE, (i + 1) * MAX_DC_SIZE),
            });
          }
        }
      }
    } catch (e) {
      console.warn('[Interpreter] Process chunk error:', e);
    } finally {
      processingRef.current = false;
    }
  }, [myLang, partnerLang, roomId, userToken, webrtc]);

  // Keep processChunkRef in sync so recorder.ondataavailable always calls latest version
  // (avoids stale closure if myLang/partnerLang/userToken change mid-recording)
  useEffect(() => { processChunkRef.current = processChunk; }, [processChunk]);

  // Start recording + processing loop
  const startInterpreter = useCallback(async () => {
    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = rawStream;

      // Apply noise gate for cleaner STT in noisy environments
      let recordStream = rawStream;
      try {
        const ng = createNoiseGate(rawStream, { threshold: -45 });
        if (ng?.cleanStream) {
          noiseGateRef.current = ng;
          recordStream = ng.cleanStream;
        }
      } catch (e) {
        console.warn('[Interpreter] Noise gate unavailable, using raw stream:', e);
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(recordStream, { mimeType });
      recorderRef.current = recorder;

      // Use ref to always call latest processChunk (avoids stale closure)
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0 && activeRef.current) {
          processChunkRef.current?.(e.data);
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
      // Clear all pending subtitle timers
      subtitleTimersRef.current.forEach(id => clearTimeout(id));
      subtitleTimersRef.current = [];
    };
  }, []);

  // Auto-stop when webrtc disconnects
  useEffect(() => {
    if (webrtc?.webrtcState !== 'connected' && active) {
      stopInterpreter();
    }
  }, [webrtc?.webrtcState, active, stopInterpreter]);

  // ═══ STREAMING INTERPRETER (subtitle-first pipeline) ═══
  const streaming = useStreamingInterpreter({
    webrtc, myLang, partnerLang, roomId, userToken,
    conversationContext,
    startDucking, stopDucking,
  });

  // ═══ UNIFIED API ═══
  // Try streaming first; if Deepgram unavailable, fall back to legacy chunks
  const startUnified = useCallback(async () => {
    const streamingOk = await streaming.start();
    if (streamingOk) {
      console.log('[Interpreter] Using streaming pipeline (subtitle-first)');
      return;
    }
    // Fallback to legacy chunk-based pipeline
    console.log('[Interpreter] Streaming unavailable, using legacy 3s chunks');
    startInterpreter();
  }, [streaming.start, startInterpreter]);

  const stopUnified = useCallback(() => {
    if (streaming.active) streaming.stop();
    else stopInterpreter();
  }, [streaming.active, streaming.stop, stopInterpreter]);

  const unifiedActive = active || streaming.active;
  const isStreaming = streaming.active;

  // Route incoming messages to the right handler
  const handleUnifiedMessage = useCallback((msg) => {
    if (streaming.active) {
      streaming.handleIncomingMessage(msg);
    } else {
      handleInterpreterMessage(msg);
    }
  }, [streaming.active, streaming.handleIncomingMessage, handleInterpreterMessage]);

  return {
    active: unifiedActive,
    isStreaming,
    setActive,
    mySubtitles: isStreaming ? streaming.mySubtitles : mySubtitles,
    partnerSubtitles: isStreaming ? streaming.partnerSubtitles : partnerSubtitles,
    lastSubtitle: isStreaming ? streaming.partnerLiveSubtitle : lastSubtitle,
    myLiveText: streaming.myLiveText,
    partnerLiveSubtitle: streaming.partnerLiveSubtitle,
    start: startUnified,
    stop: stopUnified,
    handleInterpreterMessage: handleUnifiedMessage,
  };
}
