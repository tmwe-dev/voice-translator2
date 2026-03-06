'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

// ═══════════════════════════════════════════════
// useStreamingSTT — Real-time speech-to-text via Deepgram WebSocket
//
// Flow:
// 1. Get temporary API key from /api/stt-token
// 2. Open WebSocket to Deepgram's streaming API
// 3. Stream raw audio from microphone
// 4. Receive real-time transcription (interim + final)
//
// Fallback: If Deepgram is not configured (no API key),
// returns { available: false } so caller can use browser STT
//
// Usage:
//   const stt = useStreamingSTT({ lang: 'it-IT', onTranscript });
//   stt.start(); // start streaming
//   stt.stop();  // stop + get final text
// ═══════════════════════════════════════════════

const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';

export default function useStreamingSTT({ lang = 'en-US', onInterim, onFinal, onError }) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [available, setAvailable] = useState(null); // null = checking, true/false
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const audioCtxRef = useRef(null);
  const apiKeyRef = useRef(null);
  const accumulatedTextRef = useRef('');

  // Check availability on mount
  useEffect(() => {
    let cancelled = false;
    async function checkAvailability() {
      try {
        const res = await fetch('/api/stt-token', { method: 'POST' });
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            apiKeyRef.current = data.key;
            setAvailable(true);
          } else {
            setAvailable(false);
          }
        }
      } catch {
        if (!cancelled) setAvailable(false);
      }
    }
    checkAvailability();
    return () => { cancelled = true; };
  }, []);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      streamRef.current = null;
    }
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          // Send close frame to Deepgram
          wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
        }
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const start = useCallback(async () => {
    if (isStreaming || !available) return false;

    // Refresh API key if needed
    if (!apiKeyRef.current) {
      try {
        const res = await fetch('/api/stt-token', { method: 'POST' });
        if (!res.ok) return false;
        const data = await res.json();
        apiKeyRef.current = data.key;
      } catch {
        return false;
      }
    }

    accumulatedTextRef.current = '';

    try {
      // Get microphone stream (16kHz mono for best Deepgram performance)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Map lang code to Deepgram language
      const dgLang = mapToDeepgramLang(lang);

      // Open WebSocket to Deepgram
      const params = new URLSearchParams({
        model: 'nova-2',
        language: dgLang,
        smart_format: 'true',
        interim_results: 'true',
        utterance_end_ms: '1500',
        vad_events: 'true',
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
      });

      const ws = new WebSocket(
        `${DEEPGRAM_WS_URL}?${params.toString()}`,
        ['token', apiKeyRef.current]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[StreamingSTT] WebSocket connected');
        setIsStreaming(true);
        startAudioCapture(stream, ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript || '';
            if (!transcript) return;

            if (data.is_final) {
              accumulatedTextRef.current += (accumulatedTextRef.current ? ' ' : '') + transcript;
              onFinal?.(accumulatedTextRef.current, transcript);
            } else {
              onInterim?.(accumulatedTextRef.current + ' ' + transcript, transcript);
            }
          }
        } catch {}
      };

      ws.onerror = (event) => {
        console.error('[StreamingSTT] WebSocket error:', event);
        onError?.('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[StreamingSTT] WebSocket closed:', event.code, event.reason);
        if (isStreaming) cleanup();
      };

      return true;
    } catch (e) {
      console.error('[StreamingSTT] Start error:', e);
      onError?.(e.message);
      cleanup();
      return false;
    }
  }, [isStreaming, available, lang, onInterim, onFinal, onError, cleanup]);

  function startAudioCapture(stream, ws) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      // Use ScriptProcessorNode (widely supported) to capture raw PCM
      // Buffer size 4096 at 16kHz = 256ms chunks (good for streaming)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 (linear16)
        const pcm16 = float32ToInt16(inputData);
        ws.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (e) {
      console.error('[StreamingSTT] Audio capture error:', e);
      onError?.(e.message);
    }
  }

  const stop = useCallback(() => {
    const finalText = accumulatedTextRef.current.trim();
    cleanup();
    return finalText;
  }, [cleanup]);

  const getAccumulatedText = useCallback(() => {
    return accumulatedTextRef.current.trim();
  }, []);

  return {
    available,
    isStreaming,
    start,
    stop,
    getAccumulatedText,
    cleanup,
  };
}

// ── Helpers ──

function float32ToInt16(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

/**
 * Map BCP-47 speech lang codes to Deepgram language codes
 * Deepgram uses ISO 639-1 (2-letter) with some exceptions
 */
function mapToDeepgramLang(speechLang) {
  const map = {
    'it-IT': 'it', 'en-US': 'en-US', 'en-GB': 'en-GB',
    'es-ES': 'es', 'fr-FR': 'fr', 'de-DE': 'de',
    'pt-BR': 'pt-BR', 'zh-CN': 'zh', 'ja-JP': 'ja',
    'ko-KR': 'ko', 'ar-SA': 'ar', 'hi-IN': 'hi',
    'ru-RU': 'ru', 'tr-TR': 'tr', 'vi-VN': 'vi',
    'id-ID': 'id', 'ms-MY': 'ms', 'nl-NL': 'nl',
    'pl-PL': 'pl', 'sv-SE': 'sv', 'el-GR': 'el',
    'cs-CZ': 'cs', 'ro-RO': 'ro', 'hu-HU': 'hu',
    'fi-FI': 'fi', 'th-TH': 'th',
  };
  return map[speechLang] || speechLang.split('-')[0] || 'en';
}
