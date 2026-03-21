'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { getLang } from '../lib/constants.js';
import { createNoiseGate } from '../lib/noiseGate.js';

// ═══════════════════════════════════════════════════════════════
// useStreamingInterpreter — Subtitle-First + TTS a Frase
//
// Pipeline per modalità faccia-a-faccia:
// 1. Deepgram WebSocket STT streaming → trascrizioni interim/final
// 2. Ogni frase final (is_final + pausa) → traduzione con context → subtitle
// 3. Fine frase (utterance_end o pausa >800ms) → TTS sulla traduzione completa
// 4. Il partner vede subtitle in real-time, sente voce per frase completata
//
// Sfrutta la conversation memory per traduzione speculativa:
// - Il LLM sa di cosa si parla (context tags + ultimi 10 messaggi)
// - Frammenti parziali tradotti con alta confidenza grazie al contesto
// ═══════════════════════════════════════════════════════════════

const SENTENCE_PAUSE_MS = 800;       // Pausa che indica fine frase → trigger TTS
const MIN_WORDS_FOR_TRANSLATE = 2;   // Minimo parole per avviare traduzione chunk
const MAX_SUBTITLE_AGE_MS = 10000;   // Auto-clear subtitle dopo 10s
const TRANSLATE_DEBOUNCE_MS = 300;   // Debounce tra traduzioni incrementali

export default function useStreamingInterpreter({
  webrtc,
  myLang,
  partnerLang,
  roomId,
  userToken,
  conversationContext,  // { getContext, addMessage }
  startDucking,
  stopDucking,
}) {
  const [active, setActive] = useState(false);
  const [myLiveText, setMyLiveText] = useState('');           // Testo STT in tempo reale (mio)
  const [partnerLiveSubtitle, setPartnerLiveSubtitle] = useState(''); // Subtitle tradotto in real-time
  const [mySubtitles, setMySubtitles] = useState([]);         // Cronologia subtitle miei
  const [partnerSubtitles, setPartnerSubtitles] = useState([]); // Cronologia subtitle partner

  // Refs
  const activeRef = useRef(false);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const noiseGateRef = useRef(null);
  const convContextRef = useRef(conversationContext);

  // Sentence accumulator
  const currentSentenceRef = useRef('');    // Frase corrente accumulata da final transcripts
  const interimTextRef = useRef('');         // Ultimo interim (preview)
  const lastFinalTimeRef = useRef(0);        // Timestamp ultimo final transcript
  const sentencePauseTimerRef = useRef(null); // Timer per detect fine frase
  const translateTimerRef = useRef(null);     // Debounce traduzione
  const currentTranslationRef = useRef('');   // Traduzione corrente della frase in corso
  const ttsQueueRef = useRef([]);             // Coda TTS frasi completate
  const processingTTSRef = useRef(false);
  const deepgramKeyRef = useRef(null);

  // Subtitle cleanup timers
  const subtitleTimersRef = useRef([]);

  // Sync refs
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { convContextRef.current = conversationContext; }, [conversationContext]);

  // ═══ FETCH DEEPGRAM KEY ═══
  useEffect(() => {
    fetch('/api/deepgram-token').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.key) deepgramKeyRef.current = d.key; })
      .catch(() => {});
  }, []);

  // ═══ INCREMENTAL TRANSLATION ═══
  // Traduce un frammento di frase con il conversation context
  const translateChunk = useCallback(async (text, isFinal = false) => {
    if (!text || text.trim().length < 3) return '';
    try {
      const context = convContextRef.current?.getContext?.() || '';
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          sourceLang: myLang,
          targetLang: partnerLang,
          sourceLangName: getLang(myLang)?.name || myLang,
          targetLangName: getLang(partnerLang)?.name || partnerLang,
          userToken: userToken || '',
          roomId,
          conversationContext: context,
          // Hint per il modello: frammento parziale vs frase completa
          fragmentHint: isFinal ? undefined : 'partial',
        }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      return data.translated || '';
    } catch {
      return '';
    }
  }, [myLang, partnerLang, roomId, userToken]);

  // ═══ SEND SUBTITLE TO PARTNER ═══
  const sendSubtitleToPartner = useCallback((translatedText, originalText, isFinal) => {
    if (!webrtc?.sendDirectMessage || !translatedText) return;
    webrtc.sendDirectMessage({
      type: 'interpreter-subtitle',
      text: translatedText,
      lang: partnerLang,
      originalText,
      originalLang: myLang,
      isFinal: !!isFinal,  // Partner sa se è parziale o finale
    });
  }, [webrtc, myLang, partnerLang]);

  // ═══ TTS + SEND AUDIO ═══
  const speakAndSend = useCallback(async (translatedText) => {
    if (!translatedText || translatedText.trim().length < 2) return;
    try {
      const ttsRes = await fetch('/api/tts-edge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: translatedText, langCode: partnerLang }),
      });
      if (!ttsRes.ok) return;

      const ttsBlob = await ttsRes.blob();
      const buffer = await ttsBlob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);

      // Send audio via DataChannel
      if (webrtc?.sendDirectMessage) {
        const MAX_DC_SIZE = 10000;
        if (base64.length <= MAX_DC_SIZE) {
          webrtc.sendDirectMessage({ type: 'interpreter-audio', data: base64 });
        } else {
          const parts = Math.ceil(base64.length / MAX_DC_SIZE);
          const id = Date.now().toString(36);
          for (let i = 0; i < parts; i++) {
            webrtc.sendDirectMessage({
              type: 'interpreter-audio-part',
              id, part: i, total: parts,
              data: base64.slice(i * MAX_DC_SIZE, (i + 1) * MAX_DC_SIZE),
            });
          }
        }
      }
    } catch (e) {
      console.warn('[StreamInterp] TTS error:', e);
    }
  }, [partnerLang, webrtc]);

  // ═══ TTS QUEUE PROCESSOR ═══
  // Processa la coda TTS sequenzialmente (una frase alla volta)
  const processTTSQueue = useCallback(async () => {
    if (processingTTSRef.current) return;
    processingTTSRef.current = true;

    while (ttsQueueRef.current.length > 0) {
      const item = ttsQueueRef.current.shift();
      if (item?.text) {
        startDucking?.();
        await speakAndSend(item.text);
        stopDucking?.();
      }
    }

    processingTTSRef.current = false;
  }, [speakAndSend, startDucking, stopDucking]);

  // ═══ HANDLE SENTENCE COMPLETE ═══
  // Chiamata quando una frase è completa (pausa rilevata)
  const handleSentenceComplete = useCallback(async (sentence) => {
    if (!sentence || sentence.trim().length < 2) return;
    const trimmed = sentence.trim();

    // Traduzione finale della frase completa
    const translated = await translateChunk(trimmed, true);
    if (!translated) return;

    // Update translation display
    currentTranslationRef.current = translated;
    setPartnerLiveSubtitle(translated);

    // Send FINAL subtitle to partner
    sendSubtitleToPartner(translated, trimmed, true);

    // Add to subtitle history
    const sub = { text: translated, original: trimmed, ts: Date.now(), isFinal: true };
    setMySubtitles(prev => [...prev.slice(-20), sub]);

    // Add to conversation context (memory per disambiguation futura)
    convContextRef.current?.addMessage?.({
      sender: 'me',
      original: trimmed,
      translated,
      sourceLang: myLang,
      targetLang: partnerLang,
    });

    // Queue TTS (voce per frase completa)
    ttsQueueRef.current.push({ text: translated });
    processTTSQueue();

    // Clear current sentence
    currentSentenceRef.current = '';
    currentTranslationRef.current = '';
  }, [translateChunk, sendSubtitleToPartner, myLang, partnerLang, processTTSQueue]);

  // ═══ HANDLE TRANSCRIPT FROM DEEPGRAM ═══
  const handleTranscript = useCallback((transcript, isFinal) => {
    if (!activeRef.current || !transcript) return;

    if (isFinal) {
      // Accumula nella frase corrente
      currentSentenceRef.current += (currentSentenceRef.current ? ' ' : '') + transcript;
      lastFinalTimeRef.current = Date.now();
      interimTextRef.current = '';

      // Update live text display
      setMyLiveText(currentSentenceRef.current);

      // Debounced incremental translation (subtitle preview)
      if (currentSentenceRef.current.split(/\s+/).length >= MIN_WORDS_FOR_TRANSLATE) {
        clearTimeout(translateTimerRef.current);
        translateTimerRef.current = setTimeout(async () => {
          if (!activeRef.current) return;
          const partial = await translateChunk(currentSentenceRef.current, false);
          if (partial && activeRef.current) {
            currentTranslationRef.current = partial;
            setPartnerLiveSubtitle(partial);
            // Send interim subtitle to partner
            sendSubtitleToPartner(partial, currentSentenceRef.current, false);
          }
        }, TRANSLATE_DEBOUNCE_MS);
      }

      // Reset sentence pause timer — se non arriva nulla per SENTENCE_PAUSE_MS, la frase è finita
      clearTimeout(sentencePauseTimerRef.current);
      sentencePauseTimerRef.current = setTimeout(() => {
        if (currentSentenceRef.current.trim()) {
          handleSentenceComplete(currentSentenceRef.current);
        }
      }, SENTENCE_PAUSE_MS);

    } else {
      // Interim: mostra preview ma non accumula
      interimTextRef.current = transcript;
      const preview = currentSentenceRef.current + (currentSentenceRef.current ? ' ' : '') + transcript;
      setMyLiveText(preview);
    }
  }, [translateChunk, sendSubtitleToPartner, handleSentenceComplete]);

  // ═══ HANDLE UTTERANCE END (Deepgram) ═══
  // Deepgram manda UtteranceEnd quando rileva fine discorso
  const handleUtteranceEnd = useCallback(() => {
    clearTimeout(sentencePauseTimerRef.current);
    if (currentSentenceRef.current.trim()) {
      handleSentenceComplete(currentSentenceRef.current);
    }
  }, [handleSentenceComplete]);

  // ═══ START STREAMING ═══
  const start = useCallback(async () => {
    if (!deepgramKeyRef.current) {
      // Try to get key
      try {
        const res = await fetch('/api/deepgram-token');
        if (res.ok) {
          const d = await res.json();
          if (d?.key) deepgramKeyRef.current = d.key;
        }
      } catch {}
    }

    if (!deepgramKeyRef.current) {
      console.error('[StreamInterp] No Deepgram key available');
      return false;
    }

    try {
      // Get mic stream
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = rawStream;

      // Noise gate
      let recordStream = rawStream;
      try {
        const ng = createNoiseGate(rawStream, { threshold: -45 });
        if (ng?.cleanStream) {
          noiseGateRef.current = ng;
          recordStream = ng.cleanStream;
        }
      } catch {}

      // Deepgram WebSocket
      const speechLang = getLang(myLang)?.speech || 'en-US';
      const dgLang = speechLang.split('-')[0];
      const params = new URLSearchParams({
        model: 'nova-2',
        language: dgLang,
        smart_format: 'true',
        interim_results: 'true',
        utterance_end_ms: String(SENTENCE_PAUSE_MS),
        endpointing: '300',  // Più aggressivo per real-time
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
      });

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ['token', deepgramKeyRef.current]
      );
      wsRef.current = ws;

      return new Promise((resolve) => {
        ws.onopen = () => {
          console.log('[StreamInterp] Connected to Deepgram');

          // Audio capture → PCM16 → WebSocket
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(recordStream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

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
          processor.connect(audioCtx.destination);
          setActive(true);
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'Results') {
              const transcript = data.channel?.alternatives?.[0]?.transcript || '';
              if (transcript) {
                handleTranscript(transcript, data.is_final);
              }
            }
            // Deepgram UtteranceEnd = silenzio prolungato → frase finita
            if (data.type === 'UtteranceEnd') {
              handleUtteranceEnd();
            }
          } catch {}
        };

        ws.onerror = () => { console.warn('[StreamInterp] WS error'); resolve(false); };
        ws.onclose = () => { console.log('[StreamInterp] WS closed'); };
        setTimeout(() => resolve(false), 4000);
      });
    } catch (e) {
      console.error('[StreamInterp] Start failed:', e);
      return false;
    }
  }, [myLang, handleTranscript, handleUtteranceEnd]);

  // ═══ STOP STREAMING ═══
  const stop = useCallback(() => {
    setActive(false);
    clearTimeout(sentencePauseTimerRef.current);
    clearTimeout(translateTimerRef.current);

    // Flush remaining sentence
    if (currentSentenceRef.current.trim()) {
      handleSentenceComplete(currentSentenceRef.current);
    }

    // Cleanup audio
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    if (audioCtxRef.current?.state !== 'closed') { try { audioCtxRef.current?.close(); } catch {} audioCtxRef.current = null; }
    if (noiseGateRef.current) { try { noiseGateRef.current.destroy(); } catch {} noiseGateRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} }); streamRef.current = null; }
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    // Reset state
    currentSentenceRef.current = '';
    interimTextRef.current = '';
    currentTranslationRef.current = '';
    setMyLiveText('');
    setPartnerLiveSubtitle('');
  }, [handleSentenceComplete]);

  // ═══ HANDLE INCOMING FROM PARTNER ═══
  // Il partner che usa lo stesso hook manda subtitle e audio
  const handleIncomingMessage = useCallback((msg) => {
    if (!msg) return;

    if (msg.type === 'interpreter-subtitle') {
      if (msg.isFinal) {
        setPartnerSubtitles(prev => [...prev.slice(-20), {
          text: msg.text, original: msg.originalText, lang: msg.lang, ts: Date.now()
        }]);
      }
      setPartnerLiveSubtitle(msg.text);
      // Auto-clear
      const timerId = setTimeout(() => {
        setPartnerLiveSubtitle(prev => prev === msg.text ? '' : prev);
      }, MAX_SUBTITLE_AGE_MS);
      subtitleTimersRef.current.push(timerId);

      // Add partner message to conversation context
      if (msg.isFinal && msg.originalText) {
        convContextRef.current?.addMessage?.({
          sender: 'partner',
          original: msg.originalText,
          translated: msg.text,
          sourceLang: msg.originalLang || partnerLang,
          targetLang: myLang,
        });
      }
    }

    // Audio playback (same logic as old interpreter)
    if (msg.type === 'interpreter-audio' && msg.data) {
      playBase64Audio(msg.data);
    }
    if (msg.type === 'interpreter-audio-part') {
      handleAudioPart(msg);
    }
  }, [myLang, partnerLang]);

  // ═══ AUDIO PLAYBACK HELPERS ═══
  const audioPartsRef = useRef({});

  const playBase64Audio = useCallback((base64Data) => {
    try {
      const audioBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 0.9;
      startDucking?.();
      audio.play().catch(() => {});
      audio.onended = () => { URL.revokeObjectURL(url); stopDucking?.(); };
      audio.onerror = () => { stopDucking?.(); };
    } catch { stopDucking?.(); }
  }, [startDucking, stopDucking]);

  const handleAudioPart = useCallback((msg) => {
    const buf = audioPartsRef.current;
    if (!buf[msg.id]) buf[msg.id] = { parts: {}, total: msg.total, ts: Date.now() };
    buf[msg.id].parts[msg.part] = msg.data;
    const entry = buf[msg.id];
    if (Object.keys(entry.parts).length === entry.total) {
      let full = '';
      for (let i = 0; i < entry.total; i++) full += entry.parts[i] || '';
      delete buf[msg.id];
      playBase64Audio(full);
    }
  }, [playBase64Audio]);

  // Cleanup stale audio buffers
  useEffect(() => {
    const interval = setInterval(() => {
      const buf = audioPartsRef.current;
      const now = Date.now();
      for (const id of Object.keys(buf)) {
        if (now - (buf[id].ts || 0) > 30000) delete buf[id];
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      if (audioCtxRef.current?.state !== 'closed') { try { audioCtxRef.current?.close(); } catch {} }
      subtitleTimersRef.current.forEach(id => clearTimeout(id));
      clearTimeout(sentencePauseTimerRef.current);
      clearTimeout(translateTimerRef.current);
    };
  }, []);

  return {
    active,
    start,
    stop,
    myLiveText,                    // Testo STT real-time (quello che sto dicendo)
    partnerLiveSubtitle,           // Subtitle tradotto real-time (preview per partner)
    mySubtitles,                   // Cronologia frasi tradotte mie
    partnerSubtitles,              // Cronologia frasi tradotte partner
    handleIncomingMessage,         // Handler per messaggi P2P dal partner
  };
}
