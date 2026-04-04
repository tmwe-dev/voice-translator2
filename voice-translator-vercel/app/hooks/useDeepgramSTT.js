'use client';
import { useRef, useEffect, useCallback } from 'react';
import { getLang } from '../lib/constants.js';

/**
 * Deepgram Streaming STT hook — server-grade WebSocket speech recognition.
 *
 * Responsibilities:
 * - Check Deepgram availability via /api/deepgram-token
 * - Start/stop WebSocket streaming with PCM16 audio capture
 * - Accumulate final + interim transcripts
 * - Clean up all resources on stop or unmount
 *
 * Returns: { deepgramAvailableRef, startDeepgramStreaming, stopDeepgramStreaming }
 */
export default function useDeepgramSTT({
  allWordsRef,
  streamingModeRef,
  setStreamingMsg,
  setRecording,
  setSpeakingState,
  roomId,
  unlockAudio,
  speakingKeepAliveRef,
}) {
  const deepgramAvailableRef = useRef(null); // null = checking, true/false
  const deepgramWsRef = useRef(null);
  const deepgramStreamRef = useRef(null);
  const deepgramProcessorRef = useRef(null);
  const deepgramAudioCtxRef = useRef(null);
  const deepgramKeyRef = useRef(null);

  // Check Deepgram availability on mount
  useEffect(() => {
    async function checkDeepgram() {
      try {
        const res = await fetch('/api/deepgram-token');
        if (res.ok) {
          const data = await res.json();
          if (data.key) {
            deepgramAvailableRef.current = true;
            deepgramKeyRef.current = data.key;
            return;
          }
        }
      } catch {}
      deepgramAvailableRef.current = false;
    }
    checkDeepgram();
  }, []);

  /**
   * Start Deepgram WebSocket streaming STT.
   * @param {string|object} langObj — language code or language object
   * @returns {Promise<boolean>} — true if connected, false if fallback needed
   */
  const startDeepgramStreaming = useCallback(async (langObj) => {
    const speechLang = getLang(langObj)?.speech || 'en-US';
    const dgLang = speechLang.split('-')[0]; // 'it-IT' → 'it'

    unlockAudio();
    setRecording(true);
    if (roomId) setSpeakingState(roomId, true);
    allWordsRef.current = '';
    streamingModeRef.current = true;
    setStreamingMsg({ original: '', translated: null, isStreaming: true });

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      console.error('[STT-Deepgram] Mic access error:', e);
      return false;
    }
    deepgramStreamRef.current = stream;

    const params = new URLSearchParams({
      model: 'nova-2', language: dgLang, smart_format: 'true',
      interim_results: 'true', utterance_end_ms: '1500',
      encoding: 'linear16', sample_rate: '16000', channels: '1',
    });

    const ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params.toString()}`,
      ['token', deepgramKeyRef.current]
    );
    deepgramWsRef.current = ws;

    return new Promise((resolve) => {
      let resolved = false;

      ws.onopen = () => {
        console.log('[STT-Deepgram] WebSocket connected');
        // Start audio capture
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          deepgramAudioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          deepgramProcessorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const input = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) {
              const s = Math.max(-1, Math.min(1, input[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            ws.send(pcm16.buffer);
          };
          source.connect(processor);
          // Don't connect processor to destination - this causes echo!
          // Processor only needs to capture audio, not output it
        } catch (e) {
          console.error('[STT-Deepgram] Audio capture error:', e);
        }

        // Keepalive
        if (speakingKeepAliveRef.current) clearInterval(speakingKeepAliveRef.current);
        speakingKeepAliveRef.current = setInterval(() => {
          if (roomId && streamingModeRef.current) setSpeakingState(roomId, true);
        }, 15000);

        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      };

      ws.onmessage = (event) => {
        try {
          let data; try { data = JSON.parse(event.data); } catch { console.warn('[useDeepgramSTT] WS parse failed'); return; }
          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript || '';
            if (!transcript) return;
            if (data.is_final) {
              allWordsRef.current += (allWordsRef.current ? ' ' : '') + transcript;
              setStreamingMsg(prev => prev ? { ...prev, original: allWordsRef.current } : null);
            } else {
              const preview = allWordsRef.current + (allWordsRef.current ? ' ' : '') + transcript;
              setStreamingMsg(prev => prev ? { ...prev, original: preview } : null);
            }
          }
        } catch {}
      };

      ws.onerror = () => {
        console.warn('[STT-Deepgram] WebSocket error');
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };

      ws.onclose = () => {
        console.log('[STT-Deepgram] WebSocket closed');
      };

      // Timeout: if WebSocket doesn't connect in 3s, fall back
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, 3000);
    });
  }, [roomId, unlockAudio, setSpeakingState, setRecording, setStreamingMsg, allWordsRef, streamingModeRef, speakingKeepAliveRef]);

  /**
   * Stop Deepgram streaming and clean up all resources.
   */
  const stopDeepgramStreaming = useCallback(async () => {
    if (deepgramProcessorRef.current) {
      try { deepgramProcessorRef.current.disconnect(); } catch {}
      deepgramProcessorRef.current = null;
    }
    if (deepgramAudioCtxRef.current && deepgramAudioCtxRef.current.state !== 'closed') {
      try { deepgramAudioCtxRef.current.close(); } catch {}
      deepgramAudioCtxRef.current = null;
    }
    if (deepgramStreamRef.current) {
      deepgramStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      deepgramStreamRef.current = null;
    }
    if (deepgramWsRef.current) {
      try {
        if (deepgramWsRef.current.readyState === WebSocket.OPEN) {
          // Send CloseStream and wait for Deepgram to flush final results
          deepgramWsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
          await new Promise(r => setTimeout(r, 400)); // Wait for final transcription
        }
        deepgramWsRef.current.close();
      } catch {}
      deepgramWsRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopDeepgramStreaming();
  }, [stopDeepgramStreaming]);

  return {
    deepgramAvailableRef,
    startDeepgramStreaming,
    stopDeepgramStreaming,
  };
}
