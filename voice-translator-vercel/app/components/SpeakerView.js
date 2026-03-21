'use client';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { FONT, LANGS, getLang, vibrate } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════════════════════
// TaxiTalk — "Parla e Traduci al volo"
//
// Due modalità:
// 1. LIVE: Deepgram streaming STT → traduzione incrementale → TTS continuo
//    Ideal per faccia-a-faccia: parli e il telefono traduce in tempo reale
//
// 2. BATCH: Registra messaggio → STT → traduci → TTS → play
//    Ideale per messaggi: detti il messaggio, premi invio, senti traduzione
//
// Nessuna room necessaria. Tool standalone per traduzione istantanea.
// ═══════════════════════════════════════════════════════════════

const COMMON_LANGS = ['en','it','es','fr','de','pt','zh','ja','ko','ar','hi','ru','tr','th','vi'];

function SpeakerView({ L, S, prefs, setView, theme, userToken }) {
  const _S = getStyles(theme);
  const col = _S.colors || {};
  // Map legacy property names used throughout this component
  const C = {
    pageBg: '#060810',
    textPrimary: col.textPrimary || '#F2F4F7',
    textSecondary: col.textSecondary || 'rgba(242,244,247,0.90)',
    textMuted: col.textMuted || 'rgba(242,244,247,0.60)',
    btnBg: col.cardBg || 'rgba(14,18,32,0.55)',
    btnBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    topBarBg: col.glassCard || 'rgba(12,16,30,0.65)',
    topBarBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    tabBg: col.overlayBg || 'rgba(255,255,255,0.03)',
    tabBorder: col.overlayBorder || 'rgba(255,255,255,0.05)',
    tabActiveBg: col.accent1Bg || 'rgba(38,217,176,0.10)',
    tabActiveColor: col.accent1 || '#26D9B0',
    popupBg: col.popupBg || 'rgba(10,14,26,0.96)',
    popupBorder: col.overlayBorder || 'rgba(255,255,255,0.05)',
    inputBg: col.inputBg || 'rgba(14,18,32,0.6)',
    inputBorder: col.inputBorder || 'rgba(255,255,255,0.07)',
    accent1: col.accent1 || '#26D9B0',
  };

  // State
  const [sourceLang, setSourceLang] = useState(prefs?.lang || 'it');
  const [targetLang, setTargetLang] = useState(prefs?.lang === 'en' ? 'it' : 'en');
  const [mode, setMode] = useState('batch'); // 'live' | 'batch'
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [liveText, setLiveText] = useState('');       // STT text in corso
  const [translatedText, setTranslatedText] = useState('');
  const [history, setHistory] = useState([]);          // Cronologia traduzioni
  const [showLangPicker, setShowLangPicker] = useState(null); // 'source' | 'target' | null
  const [playing, setPlaying] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(false); // Testo specchiato per chi guarda lo schermo al contrario
  const [destination, setDestination] = useState('');     // Indirizzo/luogo destinazione
  const [destCoords, setDestCoords] = useState(null);     // { lat, lon, displayName }
  const [destLoading, setDestLoading] = useState(false);
  const [showDestInput, setShowDestInput] = useState(true); // Search visibile di default
  const [destError, setDestError] = useState('');
  const [textMessage, setTextMessage] = useState('');      // Messaggio scritto a mano
  const [phase, setPhase] = useState('search');            // 'search' | 'compose' — flusso destination-first
  const [userPos, setUserPos] = useState(null);            // { lat, lon } — GPS position
  const [routeInfo, setRouteInfo] = useState(null);        // { distKm, durationMin, steps }
  const [routeLoading, setRouteLoading] = useState(false);
  const [showRouteSteps, setShowRouteSteps] = useState(false); // Toggle for step-by-step list

  // Refs
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const dgKeyRef = useRef(null);
  const sentenceRef = useRef('');
  const translateTimerRef = useRef(null);
  const audioRef = useRef(null);
  const scrollRef = useRef(null);
  const destInputRef = useRef(null);

  // Fetch Deepgram key on mount
  useEffect(() => {
    fetch('/api/deepgram-token').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.key) dgKeyRef.current = d.key; })
      .catch(() => {});
  }, []);

  // Auto-scroll history
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  // ═══ AUTO MIRROR: attiva mirror quando il telefono è capovolto (beta > 120°) ═══
  useEffect(() => {
    let lastFlip = false;
    const handleOrientation = (e) => {
      // beta = inclinazione avanti/indietro: ~0 = piatto, ~90 = verticale, >120 = capovolto verso l'altro
      // gamma per rotazione laterale
      const beta = e.beta ?? 0;
      const isFlipped = Math.abs(beta) > 120;
      if (isFlipped !== lastFlip) {
        lastFlip = isFlipped;
        setMirrorMode(isFlipped);
      }
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // ═══ GET USER GPS POSITION when destination is set ═══
  useEffect(() => {
    if (!destCoords) {
      setUserPos(null);
      setRouteInfo(null);
      return;
    }
    if (!navigator.geolocation) return;

    const success = (position) => {
      const pos = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      setUserPos(pos);
      fetchRoute(pos.lat, pos.lon, destCoords.lat, destCoords.lon);
    };

    const error = (err) => {
      console.warn('[SpeakerView] Geolocation error:', err);
    };

    navigator.geolocation.getCurrentPosition(success, error, { timeout: 10000 });
  }, [destCoords, fetchRoute]);

  // ═══ SWAP LANGUAGES ═══
  const swapLangs = useCallback(() => {
    vibrate();
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setLiveText('');
    setTranslatedText('');
  }, [sourceLang, targetLang]);

  // ═══ TRANSLATE TEXT ═══
  const translateText = useCallback(async (text, isFinal = true) => {
    if (!text || text.trim().length < 2) return '';
    try {
      const src = getLang(sourceLang);
      const tgt = getLang(targetLang);
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          sourceLang: sourceLang,
          targetLang: targetLang,
          sourceLangName: src?.name || sourceLang,
          targetLangName: tgt?.name || targetLang,
          userToken: userToken || '',
        }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      return data.translated || '';
    } catch { return ''; }
  }, [sourceLang, targetLang, userToken]);

  // ═══ TTS PLAY ═══
  const playTTS = useCallback(async (text, lang) => {
    if (!text) return;
    setPlaying(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, voice: prefs?.voice || 'nova', lang,
          userToken: userToken || '',
        }),
      });
      if (!res.ok) { setPlaying(false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.volume = 1.0;
      audio.play().catch(() => {});
      audio.onended = () => { URL.revokeObjectURL(url); setPlaying(false); };
      audio.onerror = () => { setPlaying(false); };
    } catch { setPlaying(false); }
  }, [prefs?.voice, userToken]);

  // ═══ DESTINATION: Geocoding via OpenStreetMap Nominatim ═══
  const searchDestination = useCallback(async (query) => {
    if (!query || query.trim().length < 2) return;
    setDestLoading(true);
    setDestError('');
    try {
      const q = encodeURIComponent(query.trim());
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=1`,
        { headers: { 'Accept-Language': targetLang || 'en' } }
      );
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();
      if (data.length === 0) {
        setDestError('Luogo non trovato');
        setDestCoords(null);
      } else {
        const place = data[0];
        setDestCoords({
          lat: parseFloat(place.lat),
          lon: parseFloat(place.lon),
          displayName: place.display_name,
        });
        setDestError('');
        setPhase('compose'); // → passa alla fase messaggio
      }
    } catch {
      setDestError('Errore di ricerca');
      setDestCoords(null);
    }
    setDestLoading(false);
  }, [targetLang]);

  const clearDestination = useCallback(() => {
    setDestination('');
    setDestCoords(null);
    setDestError('');
    setShowDestInput(true);
    setTextMessage('');
    setPhase('search');
  }, []);

  // ═══ FETCH ROUTE via OSRM ═══
  const fetchRoute = useCallback(async (fromLat, fromLon, toLat, toLon) => {
    setRouteLoading(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Route fetch failed');
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // distance in meters → km, duration in seconds → minutes
        const distKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        // Flatten steps from all legs
        const steps = [];
        if (route.legs) {
          route.legs.forEach(leg => {
            if (leg.steps) {
              leg.steps.forEach(step => {
                steps.push({
                  instruction: step.maneuver?.instruction || 'Continue',
                  modifier: step.maneuver?.modifier || '',
                  distance: (step.distance / 1000).toFixed(2),
                });
              });
            }
          });
        }
        setRouteInfo({ distKm, durationMin, steps });
      }
    } catch (err) {
      console.warn('[SpeakerView] Route fetch error:', err);
    }
    setRouteLoading(false);
  }, []);

  // ═══ TRANSLATE TYPED MESSAGE ═══
  const sendTextMessage = useCallback(async () => {
    if (!textMessage.trim()) return;
    vibrate();
    setProcessing(true);
    setLiveText(textMessage.trim());
    const translated = await translateText(textMessage.trim(), true);
    setTranslatedText(translated);
    if (translated) {
      setHistory(prev => [...prev.slice(-50), {
        original: textMessage.trim(), translated, sourceLang, targetLang, ts: Date.now(),
        destination: destCoords?.displayName?.split(',').slice(0, 2).join(',') || '',
      }]);
      playTTS(translated, targetLang);
    }
    setProcessing(false);
    setTextMessage('');
  }, [textMessage, translateText, sourceLang, targetLang, destCoords, playTTS]);

  // ═══ MODE: BATCH — Browser SpeechRecognition → Translate → TTS ═══
  // Uses Web Speech API (free, offline on most devices) for batch STT
  const speechRecRef = useRef(null);

  const startBatchRecord = useCallback(async () => {
    vibrate();
    setRecording(true);
    setLiveText('');
    setTranslatedText('');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // No browser STT — fallback to live mode with Deepgram
      setMode('live');
      setRecording(false);
      return;
    }

    const rec = new SpeechRecognition();
    speechRecRef.current = rec;
    const speechLang = getLang(sourceLang)?.speech || 'en-US';
    rec.lang = speechLang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = '';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setLiveText(finalText + interim);
    };

    rec.onerror = (e) => {
      console.warn('[Speaker] SpeechRec error:', e.error);
      if (e.error === 'no-speech') return; // Ignore no-speech, keep listening
    };

    rec.onend = async () => {
      // SpeechRecognition ended — process the result
      const original = finalText.trim();
      if (!original) { setRecording(false); return; }

      setProcessing(true);
      setLiveText(original);

      const translated = await translateText(original, true);
      setTranslatedText(translated);

      if (translated) {
        setHistory(prev => [...prev.slice(-50), {
          original, translated, sourceLang, targetLang, ts: Date.now(),
        }]);
        playTTS(translated, targetLang);
      }

      setProcessing(false);
      setRecording(false);
    };

    try { rec.start(); } catch (e) {
      console.warn('[Speaker] SpeechRec start error:', e);
      setRecording(false);
    }
  }, [sourceLang, targetLang, translateText, playTTS]);

  const stopBatchRecord = useCallback(() => {
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch {}
      speechRecRef.current = null;
    }
  }, []);

  // ═══ MODE: LIVE — Deepgram Streaming → Incremental Translate → TTS per frase ═══
  const startLiveMode = useCallback(async () => {
    vibrate();
    if (!dgKeyRef.current) {
      // Try to get key
      try {
        const res = await fetch('/api/deepgram-token');
        if (res.ok) { const d = await res.json(); if (d?.key) dgKeyRef.current = d.key; }
      } catch {}
    }
    if (!dgKeyRef.current) {
      // Fallback to batch if no Deepgram
      setMode('batch');
      startBatchRecord();
      return;
    }

    setRecording(true);
    setLiveText('');
    setTranslatedText('');
    sentenceRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const speechLang = getLang(sourceLang)?.speech || 'en-US';
      const dgLang = speechLang.split('-')[0];

      const params = new URLSearchParams({
        model: 'nova-2', language: dgLang, smart_format: 'true',
        interim_results: 'true', utterance_end_ms: '900',
        endpointing: '400', encoding: 'linear16', sample_rate: '16000', channels: '1',
      });

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ['token', dgKeyRef.current]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
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
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript || '';
            if (!transcript) return;

            if (data.is_final) {
              sentenceRef.current += (sentenceRef.current ? ' ' : '') + transcript;
              setLiveText(sentenceRef.current);

              // Debounced translation
              clearTimeout(translateTimerRef.current);
              translateTimerRef.current = setTimeout(async () => {
                const t = await translateText(sentenceRef.current, false);
                if (t) setTranslatedText(t);
              }, 250);
            } else {
              // Interim preview
              const preview = sentenceRef.current + (sentenceRef.current ? ' ' : '') + transcript;
              setLiveText(preview);
            }
          }

          // Utterance end → frase completa → TTS
          if (data.type === 'UtteranceEnd' && sentenceRef.current.trim()) {
            const sentence = sentenceRef.current.trim();
            sentenceRef.current = '';

            // Final translation + TTS
            (async () => {
              const translated = await translateText(sentence, true);
              if (translated) {
                setTranslatedText(translated);
                setHistory(prev => [...prev.slice(-50), {
                  original: sentence, translated,
                  sourceLang, targetLang, ts: Date.now(),
                }]);
                playTTS(translated, targetLang);
              }
              // Reset for next sentence
              setTimeout(() => {
                setLiveText('');
                setTranslatedText('');
              }, 3000);
            })();
          }
        } catch {}
      };

      ws.onerror = () => { console.warn('[Speaker] WS error'); };
    } catch (e) {
      console.warn('[Speaker] Live start error:', e);
      setRecording(false);
    }
  }, [sourceLang, targetLang, translateText, playTTS, startBatchRecord]);

  const stopLiveMode = useCallback(() => {
    // Flush remaining
    if (sentenceRef.current.trim()) {
      const sentence = sentenceRef.current.trim();
      sentenceRef.current = '';
      translateText(sentence, true).then(translated => {
        if (translated) {
          setTranslatedText(translated);
          setHistory(prev => [...prev.slice(-50), {
            original: sentence, translated, sourceLang, targetLang, ts: Date.now(),
          }]);
          playTTS(translated, targetLang);
        }
      });
    }

    clearTimeout(translateTimerRef.current);
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    if (audioCtxRef.current?.state !== 'closed') { try { audioCtxRef.current?.close(); } catch {} audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} }); streamRef.current = null; }
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setRecording(false);
  }, [sourceLang, targetLang, translateText, playTTS]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
      if (wsRef.current) { try { wsRef.current.close(); } catch {} }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      if (audioCtxRef.current?.state !== 'closed') { try { audioCtxRef.current?.close(); } catch {} }
      clearTimeout(translateTimerRef.current);
    };
  }, []);

  // ═══ COMPUTE BBOX from two points ═══
  const computeBbox = useCallback((pos1, pos2, paddingDeg = 0.01) => {
    if (!pos1 || !pos2) return null;
    const minLon = Math.min(pos1.lon, pos2.lon) - paddingDeg;
    const maxLon = Math.max(pos1.lon, pos2.lon) + paddingDeg;
    const minLat = Math.min(pos1.lat, pos2.lat) - paddingDeg;
    const maxLat = Math.max(pos1.lat, pos2.lat) + paddingDeg;
    return { minLon, minLat, maxLon, maxLat };
  }, []);

  // ═══ UI HELPERS ═══
  const srcInfo = getLang(sourceLang);
  const tgtInfo = getLang(targetLang);

  const langButton = (lang, type) => {
    const info = getLang(lang);
    return (
      <button
        onClick={() => { vibrate(); setShowLangPicker(showLangPicker === type ? null : type); }}
        style={{
          flex: 1, padding: '12px 14px', borderRadius: 16, cursor: 'pointer',
          background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
          transition: 'all 0.15s',
        }}>
        <span style={{ fontSize: 24 }}>{info?.flag || '🌐'}</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{info?.name || lang}</div>
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>
            {type === 'source' ? 'Parlo in' : 'Traduci in'}
          </div>
        </div>
      </button>
    );
  };

  // ═══ MIRROR MODE: fullscreen specchiato per il tassista ═══
  if (mirrorMode) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000', display: 'flex', flexDirection: 'column',
        fontFamily: FONT, overflow: 'hidden',
      }}
        onClick={(e) => {
          // Tap nella zona superiore (primi 60px) → exit mirror
          if (e.clientY < 60) { setMirrorMode(false); return; }
        }}>

        {/* Mini exit hint */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          padding: '4px 16px', borderRadius: 20,
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600,
          zIndex: 10,
        }}>
          tap qui per uscire
        </div>

        {/* ═══ HALF 1: Testo per ME (normale) — parte bassa dello schermo ═══ */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
            {srcInfo?.flag} {srcInfo?.name}
          </div>
          <div style={{
            fontSize: liveText.length > 80 ? 20 : liveText.length > 40 ? 28 : 36,
            fontWeight: 700, color: 'rgba(255,255,255,0.7)',
            textAlign: 'center', lineHeight: 1.4,
            maxWidth: '100%', wordBreak: 'break-word',
          }}>
            {liveText || (recording ? '...' : 'Parla al microfono')}
          </div>
        </div>

        {/* ═══ HALF 2: Testo/Mappa per LUI (specchiato) — parte alta che lui legge ═══ */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          padding: '20px 24px',
          transform: 'scaleX(-1) scaleY(-1)', // MIRROR: specchiato orizzontale + capovolto
          overflow: 'hidden',
        }}>
          {destCoords ? (
            /* ═══ MAPPA DESTINAZIONE (specchiata per il tassista) ═══ */
            <>
              <div style={{
                fontSize: 11, color: 'rgba(38,217,176,0.5)', marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: 1,
              }}>
                {'📍'} {destCoords.displayName?.split(',').slice(0, 2).join(',')}
              </div>

              {/* Route distance/duration prominently displayed */}
              {routeInfo && !routeLoading && (
                <div style={{
                  fontSize: 28, fontWeight: 800, color: '#10B981', marginBottom: 12,
                  textAlign: 'center', textShadow: '0 0 20px rgba(16,185,129,0.4)',
                }}>
                  {routeInfo.distKm} km · {routeInfo.durationMin} min
                </div>
              )}

              <div style={{
                flex: 1, width: '100%', borderRadius: 16, overflow: 'hidden',
                border: '2px solid rgba(38,217,176,0.3)',
                position: 'relative', minHeight: 0,
              }}>
                {(() => {
                  let bbox = null;
                  if (userPos && destCoords) {
                    bbox = computeBbox(userPos, destCoords, 0.015);
                  } else {
                    bbox = computeBbox(destCoords, { lat: destCoords.lat, lon: destCoords.lon }, 0.008);
                  }
                  const bboxStr = bbox
                    ? `${bbox.minLon}%2C${bbox.minLat}%2C${bbox.maxLon}%2C${bbox.maxLat}`
                    : `${destCoords.lon - 0.008}%2C${destCoords.lat - 0.006}%2C${destCoords.lon + 0.008}%2C${destCoords.lat + 0.006}`;

                  return (
                    <iframe
                      title="Destination map"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${bboxStr}&layer=mapnik&marker=${destCoords.lat}%2C${destCoords.lon}`}
                      style={{
                        width: '100%', height: '100%', border: 'none',
                        position: 'absolute', inset: 0,
                      }}
                    />
                  );
                })()}
              </div>
              {translatedText && (
                <div style={{
                  fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 8,
                  textAlign: 'center', textShadow: '0 0 20px rgba(38,217,176,0.3)',
                }}>
                  {translatedText}
                </div>
              )}
            </>
          ) : (
            /* ═══ SOLO TESTO TRADOTTO ═══ */
            <>
              <div style={{
                fontSize: 11, color: 'rgba(38,217,176,0.5)', marginBottom: 8,
                textTransform: 'uppercase', letterSpacing: 1,
              }}>
                {tgtInfo?.flag} {tgtInfo?.name}
              </div>
              <div style={{
                fontSize: translatedText.length > 80 ? 22 : translatedText.length > 40 ? 32 : 44,
                fontWeight: 800, color: '#fff',
                textAlign: 'center', lineHeight: 1.3,
                maxWidth: '100%', wordBreak: 'break-word',
                textShadow: '0 0 30px rgba(38,217,176,0.3)',
              }}>
                {translatedText || (processing ? '...' : '')}
              </div>
            </>
          )}
        </div>

        {/* Bottom controls in mirror mode */}
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {/* Destination button */}
          <button
            onClick={() => setShowDestInput(!showDestInput)}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: destCoords
                ? 'linear-gradient(135deg, #10B981, #34D399)'
                : 'rgba(255,255,255,0.1)',
              border: destCoords ? '2px solid rgba(16,185,129,0.4)' : '2px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>
            <span style={{ fontSize: 20 }}>{'📍'}</span>
          </button>

          {/* Mic button */}
          <button
            onPointerDown={mode === 'batch' && !recording ? startBatchRecord : undefined}
            onPointerUp={mode === 'batch' && recording ? stopBatchRecord : undefined}
            onPointerLeave={mode === 'batch' && recording ? stopBatchRecord : undefined}
            onClick={mode === 'live' ? (recording ? stopLiveMode : startLiveMode) : undefined}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: recording
                ? 'linear-gradient(135deg, #FF3B30, #FF6584)'
                : 'linear-gradient(135deg, #26D9B0, #8B6AFF)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recording
                ? '0 0 40px rgba(255,59,48,0.5)'
                : '0 0 40px rgba(38,217,176,0.4)',
              animation: recording ? 'vtMicPulse 1.5s ease-in-out infinite' : 'none',
              WebkitTapHighlightColor: 'transparent',
            }}>
            <span style={{ fontSize: 24 }}>{recording ? '⏹' : '🎤'}</span>
          </button>

          {/* Clear destination */}
          {destCoords && (
            <button onClick={clearDestination}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255,59,48,0.15)', border: '2px solid rgba(255,59,48,0.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{ fontSize: 18 }}>{'✕'}</span>
            </button>
          )}
        </div>

        {/* Destination input overlay in mirror mode */}
        {showDestInput && (
          <div style={{
            position: 'absolute', bottom: 100, left: 16, right: 16,
            zIndex: 20, background: 'rgba(20,20,30,0.95)',
            borderRadius: 20, padding: 16,
            border: '1px solid rgba(38,217,176,0.3)',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 600 }}>
              Dove vuoi andare?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={destInputRef}
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { searchDestination(destination); setShowDestInput(false); } }}
                placeholder="es. Colosseo, Roma"
                autoFocus
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: 14, fontFamily: FONT,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => { searchDestination(destination); setShowDestInput(false); }}
                disabled={destLoading || !destination.trim()}
                style={{
                  padding: '10px 18px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #26D9B0, #8B6AFF)',
                  border: 'none', cursor: 'pointer', color: '#fff',
                  fontSize: 13, fontWeight: 700, fontFamily: FONT,
                  opacity: destLoading || !destination.trim() ? 0.5 : 1,
                }}>
                {destLoading ? '...' : 'Vai'}
              </button>
            </div>
            {destError && (
              <div style={{ fontSize: 11, color: '#FF6584', marginTop: 6 }}>{destError}</div>
            )}
          </div>
        )}

        <style>{`
          @keyframes vtMicPulse {
            0%, 100% { transform: translateX(-50%) scale(1); }
            50% { transform: translateX(-50%) scale(1.1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      ...S.page,
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.pageBg || '#060810',
    }}>

      {/* ═══ HEADER ═══ */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', flexShrink: 0,
      }}>
        <button onClick={() => setView('home')}
          style={{
            width: 36, height: 36, borderRadius: 12, cursor: 'pointer',
            background: C.btnBg, border: `1px solid ${C.btnBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}>
          <span style={{ fontSize: 16 }}>{'‹'}</span>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.5 }}>TaxiTalk</div>
        </div>

        {/* Mirror toggle */}
        <button onClick={() => { vibrate(); setMirrorMode(true); }}
          aria-label="Mirror mode"
          style={{
            width: 36, height: 36, borderRadius: 12, cursor: 'pointer',
            background: C.btnBg, border: `1px solid ${C.btnBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent', marginRight: 6,
          }}>
          <span style={{ fontSize: 16 }}>{'🪞'}</span>
        </button>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', borderRadius: 10, overflow: 'hidden',
          border: `1px solid ${C.tabBorder}`, background: C.tabBg,
        }}>
          <button onClick={() => { setMode('batch'); vibrate(); }}
            style={{
              padding: '6px 12px', cursor: 'pointer', border: 'none',
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              background: mode === 'batch' ? C.tabActiveBg : 'transparent',
              color: mode === 'batch' ? C.tabActiveColor : C.textMuted,
              WebkitTapHighlightColor: 'transparent',
            }}>
            Messaggio
          </button>
          <button onClick={() => { setMode('live'); vibrate(); }}
            style={{
              padding: '6px 12px', cursor: 'pointer', border: 'none',
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              background: mode === 'live' ? C.tabActiveBg : 'transparent',
              color: mode === 'live' ? C.tabActiveColor : C.textMuted,
              WebkitTapHighlightColor: 'transparent',
            }}>
            Live
          </button>
        </div>
      </header>

      {/* ═══ LANGUAGE SELECTOR ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px', marginBottom: 12, flexShrink: 0,
      }}>
        {langButton(sourceLang, 'source')}
        <button onClick={swapLangs}
          style={{
            width: 40, height: 40, borderRadius: 12, cursor: 'pointer',
            background: 'linear-gradient(135deg, #26D9B0, #FF6584)',
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, WebkitTapHighlightColor: 'transparent',
            transition: 'transform 0.2s',
          }}>
          <span style={{ fontSize: 16, color: '#fff' }}>{'⇄'}</span>
        </button>
        {langButton(targetLang, 'target')}
      </div>

      {/* Language picker dropdown */}
      {showLangPicker && (
        <div style={{
          margin: '0 16px 12px', padding: 8, borderRadius: 16,
          background: C.popupBg, border: `1px solid ${C.popupBorder}`,
          maxHeight: 200, overflowY: 'auto',
          display: 'flex', flexWrap: 'wrap', gap: 4,
        }}>
          {COMMON_LANGS.map(code => {
            const info = getLang(code);
            const isSelected = showLangPicker === 'source' ? code === sourceLang : code === targetLang;
            return (
              <button key={code} onClick={() => {
                vibrate();
                if (showLangPicker === 'source') setSourceLang(code);
                else setTargetLang(code);
                setShowLangPicker(null);
              }}
                style={{
                  padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                  background: isSelected ? C.tabActiveBg : 'transparent',
                  border: isSelected ? `1px solid ${C.tabBorder}` : '1px solid transparent',
                  fontFamily: FONT, fontSize: 12, fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? C.tabActiveColor : C.textSecondary,
                  display: 'flex', alignItems: 'center', gap: 6,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <span style={{ fontSize: 16 }}>{info?.flag}</span>
                {info?.name || code}
              </button>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          PHASE 1: SEARCH DESTINATION
         ═══════════════════════════════════════════════════════════ */}
      {phase === 'search' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 16px', overflow: 'auto' }}>

          {/* Search bar — always visible */}
          <div style={{
            padding: 14, borderRadius: 18, marginBottom: 14,
            background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 10 }}>
              {'📍 Dove vuoi andare?'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={destInputRef}
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && destination.trim()) searchDestination(destination); }}
                placeholder="Incolla indirizzo o cerca... es. Sheraton Amsterdam"
                autoFocus
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 12,
                  background: C.inputBg || 'rgba(255,255,255,0.05)',
                  border: `1px solid ${C.inputBorder || C.topBarBorder}`,
                  color: C.textPrimary, fontSize: 14, fontFamily: FONT,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => searchDestination(destination)}
                disabled={destLoading || !destination.trim()}
                style={{
                  padding: '12px 20px', borderRadius: 12,
                  background: destination.trim()
                    ? 'linear-gradient(135deg, #26D9B0, #8B6AFF)'
                    : C.btnBg,
                  border: 'none', cursor: destination.trim() ? 'pointer' : 'default',
                  color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FONT,
                  opacity: destLoading || !destination.trim() ? 0.4 : 1,
                  transition: 'all 0.2s',
                }}>
                {destLoading ? '...' : '🔍'}
              </button>
            </div>
            {destError && (
              <div style={{ fontSize: 11, color: '#FF6584', marginTop: 8 }}>{destError}</div>
            )}
          </div>

          {/* Shortcut: skip to free talk (no destination) */}
          <button onClick={() => setPhase('compose')}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 14, marginBottom: 14,
              background: 'transparent', border: `1px dashed ${C.topBarBorder}`,
              cursor: 'pointer', fontFamily: FONT,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              WebkitTapHighlightColor: 'transparent',
            }}>
            <span style={{ fontSize: 16 }}>{'🎤'}</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>
              Oppure parla direttamente senza destinazione
            </span>
          </button>

          {/* History */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
            {history.length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Cronologia
              </div>
            )}
            {history.map((item, i) => (
              <div key={`${item.ts}-${i}`}
                onClick={() => { vibrate(); playTTS(item.translated, item.targetLang); }}
                style={{
                  padding: '10px 14px', marginBottom: 6, borderRadius: 14,
                  background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
                  cursor: 'pointer',
                }}>
                {item.destination && (
                  <div style={{ fontSize: 10, color: '#26D9B0', fontWeight: 700, marginBottom: 4 }}>
                    {'📍 '}{item.destination}
                  </div>
                )}
                <div style={{ fontSize: 12, color: C.textMuted }}>{getLang(item.sourceLang)?.flag} {item.original}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginTop: 3 }}>{getLang(item.targetLang)?.flag} {item.translated}</div>
              </div>
            ))}
            {history.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: C.textMuted }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{'🚕'}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>TaxiTalk</div>
                <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
                  Cerca la destinazione, mostra la mappa al tassista e comunica nella sua lingua.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          PHASE 2: COMPOSE — Map + Message to driver
         ═══════════════════════════════════════════════════════════ */}
      {phase === 'compose' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 16px', overflow: 'hidden' }}>

          {/* Map card (if destination set) */}
          {destCoords && (
            <div style={{
              borderRadius: 16, overflow: 'hidden', marginBottom: 10, flexShrink: 0,
              border: `1px solid ${C.topBarBorder}`,
            }}>
              <div style={{ height: 140, position: 'relative' }}>
                {(() => {
                  // Compute bbox: if route exists use both userPos & destCoords, else just destCoords
                  let bbox = null;
                  if (userPos && destCoords) {
                    bbox = computeBbox(userPos, destCoords, 0.015);
                  } else {
                    bbox = computeBbox(destCoords, { lat: destCoords.lat, lon: destCoords.lon }, 0.008);
                  }
                  const bboxStr = bbox
                    ? `${bbox.minLon}%2C${bbox.minLat}%2C${bbox.maxLon}%2C${bbox.maxLat}`
                    : `${destCoords.lon - 0.008}%2C${destCoords.lat - 0.006}%2C${destCoords.lon + 0.008}%2C${destCoords.lat + 0.006}`;

                  return (
                    <iframe
                      title="Destination map"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${bboxStr}&layer=mapnik&marker=${destCoords.lat}%2C${destCoords.lon}`}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                  );
                })()}
              </div>
              <div style={{
                padding: '8px 12px', background: C.topBarBg,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: C.textPrimary,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {'📍 '}{destCoords.displayName?.split(',').slice(0, 3).join(',')}
                  </div>
                </div>
                <button onClick={() => { vibrate(); setMirrorMode(true); }}
                  style={{
                    padding: '5px 10px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #26D9B0, #8B6AFF)',
                    border: 'none', cursor: 'pointer', fontSize: 11, color: '#fff',
                    fontWeight: 700, fontFamily: FONT,
                  }}>
                  {'🪞 Mostra'}
                </button>
                <button onClick={clearDestination}
                  style={{
                    padding: '5px 8px', borderRadius: 8,
                    background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)',
                    cursor: 'pointer', fontSize: 11, color: '#FF6584',
                  }}>
                  {'✕'}
                </button>
              </div>
            </div>
          )}

          {/* Route info bar — shows when destCoords + routeInfo exist */}
          {destCoords && routeInfo && !routeLoading && (
            <div style={{
              borderRadius: 12, overflow: 'hidden', marginBottom: 10, flexShrink: 0,
              border: `1px solid ${C.topBarBorder}`,
              background: C.topBarBg,
            }}>
              <div
                onClick={() => setShowRouteSteps(!showRouteSteps)}
                style={{
                  padding: '10px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}>
                <span style={{ fontSize: 16 }}>{'🚕'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
                    {routeInfo.distKm} km · ~{routeInfo.durationMin} min
                  </div>
                </div>
                <span style={{ fontSize: 12, color: C.textMuted }}>
                  {showRouteSteps ? '▼' : '▶'}
                </span>
              </div>

              {/* Collapsible step-by-step list */}
              {showRouteSteps && routeInfo.steps && routeInfo.steps.length > 0 && (
                <div style={{
                  borderTop: `1px solid ${C.topBarBorder}`,
                  maxHeight: 200, overflowY: 'auto', scrollbarWidth: 'thin',
                }}>
                  {routeInfo.steps.map((step, idx) => {
                    // Map modifier to simple direction emoji
                    const modifierMap = {
                      'straight': '⬆️',
                      'slight right': '↗️',
                      'right': '➡️',
                      'sharp right': '↘️',
                      'u-turn': '⤴️',
                      'sharp left': '↙️',
                      'left': '⬅️',
                      'slight left': '↖️',
                    };
                    const emoji = modifierMap[step.modifier?.toLowerCase()] || '⬆️';
                    return (
                      <div key={idx} style={{
                        padding: '8px 12px', borderBottom: idx < routeInfo.steps.length - 1 ? `1px solid ${C.topBarBorder}` : 'none',
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                      }}>
                        <span style={{ fontSize: 14, minWidth: 20 }}>{emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: C.textPrimary, lineHeight: 1.4 }}>
                            {step.instruction}
                          </div>
                          <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>
                            {step.distance} km
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* No destination — back link */}
          {!destCoords && (
            <button onClick={() => setPhase('search')}
              style={{
                padding: '8px 14px', borderRadius: 12, marginBottom: 10, flexShrink: 0,
                background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
                cursor: 'pointer', fontFamily: FONT,
                display: 'flex', alignItems: 'center', gap: 8,
                WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{ fontSize: 14 }}>{'📍'}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>Aggiungi destinazione con mappa</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted }}>{'+'}</span>
            </button>
          )}

          {/* Translation result */}
          {(liveText || translatedText) && (
            <div style={{
              padding: 14, borderRadius: 18, marginBottom: 10, flexShrink: 0,
              background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
            }}>
              {liveText && (
                <div style={{
                  fontSize: 13, color: C.textSecondary, lineHeight: 1.5,
                  marginBottom: translatedText ? 8 : 0,
                  paddingBottom: translatedText ? 8 : 0,
                  borderBottom: translatedText ? `1px solid ${C.topBarBorder}` : 'none',
                }}>
                  <span style={{ fontSize: 16, marginRight: 6 }}>{srcInfo?.flag}</span>
                  {liveText}
                  {recording && mode === 'live' && (
                    <span style={{
                      display: 'inline-block', width: 6, height: 14,
                      background: '#26D9B0', marginLeft: 4,
                      animation: 'vtBlink 1s step-end infinite',
                    }} />
                  )}
                </div>
              )}
              {translatedText && (
                <div style={{ fontSize: 18, fontWeight: 600, color: C.textPrimary, lineHeight: 1.5 }}>
                  <span style={{ fontSize: 20, marginRight: 6 }}>{tgtInfo?.flag}</span>
                  {translatedText}
                </div>
              )}
              {translatedText && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => playTTS(translatedText, targetLang)}
                    disabled={playing}
                    style={{
                      padding: '7px 14px', borderRadius: 10,
                      background: playing ? C.btnBg : 'linear-gradient(135deg, #26D9B0, #8B6AFF)',
                      border: 'none', cursor: playing ? 'default' : 'pointer',
                      color: '#fff', fontFamily: FONT, fontSize: 11, fontWeight: 700,
                      opacity: playing ? 0.6 : 1,
                    }}>
                    {playing ? '⏳' : '🔊 Riascolta'}
                  </button>
                  <button onClick={() => { vibrate(); setMirrorMode(true); }}
                    style={{
                      padding: '7px 14px', borderRadius: 10,
                      background: 'rgba(38,217,176,0.15)', border: '1px solid rgba(38,217,176,0.3)',
                      cursor: 'pointer', color: '#26D9B0', fontFamily: FONT, fontSize: 11, fontWeight: 700,
                    }}>
                    {'🪞 Mostra al tassista'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History scroll */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', minHeight: 0 }}>
            {history.map((item, i) => (
              <div key={`${item.ts}-${i}`}
                onClick={() => { vibrate(); playTTS(item.translated, item.targetLang); }}
                style={{
                  padding: '10px 14px', marginBottom: 6, borderRadius: 14,
                  background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
                  cursor: 'pointer',
                }}>
                {item.destination && (
                  <div style={{ fontSize: 10, color: '#26D9B0', fontWeight: 700, marginBottom: 3 }}>
                    {'📍 '}{item.destination}
                  </div>
                )}
                <div style={{ fontSize: 12, color: C.textMuted }}>{getLang(item.sourceLang)?.flag} {item.original}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginTop: 3 }}>{getLang(item.targetLang)?.flag} {item.translated}</div>
                <div style={{ fontSize: 9, color: C.textMuted, marginTop: 3, opacity: 0.5 }}>
                  {new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {history.length === 0 && !liveText && !translatedText && (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: C.textMuted }}>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {destCoords
                    ? 'Scrivi o detta un messaggio per il tassista.\nPremi 🪞 per mostrare mappa e testo.'
                    : 'Scrivi o detta un messaggio.\nVerrà tradotto e letto ad alta voce.'}
                </div>
              </div>
            )}
          </div>

          {/* ═══ COMPOSE BAR: text input + mic + send ═══ */}
          <div style={{
            padding: '10px 0 8px', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <input
              type="text"
              value={textMessage}
              onChange={(e) => setTextMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendTextMessage(); }}
              placeholder="Scrivi messaggio..."
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 14,
                background: C.inputBg || 'rgba(255,255,255,0.05)',
                border: `1px solid ${C.inputBorder || C.topBarBorder}`,
                color: C.textPrimary, fontSize: 14, fontFamily: FONT,
                outline: 'none',
              }}
            />
            {/* Send text button */}
            {textMessage.trim() && (
              <button onClick={sendTextMessage} disabled={processing}
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10B981, #34D399)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent', flexShrink: 0,
                }}>
                <span style={{ fontSize: 18 }}>{processing ? '⏳' : '➤'}</span>
              </button>
            )}
            {/* Mic button */}
            {!textMessage.trim() && (
              <button
                onPointerDown={mode === 'batch' && !recording ? startBatchRecord : undefined}
                onPointerUp={mode === 'batch' && recording ? stopBatchRecord : undefined}
                onPointerLeave={mode === 'batch' && recording ? stopBatchRecord : undefined}
                onClick={mode === 'live' ? (recording ? stopLiveMode : startLiveMode) : undefined}
                disabled={processing}
                style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: recording
                    ? 'linear-gradient(135deg, #FF3B30, #FF6584)'
                    : 'linear-gradient(135deg, #26D9B0 0%, #8B6AFF 100%)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: recording ? 'vtMicPulse 1.5s ease-in-out infinite' : 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <span style={{ fontSize: 18 }}>
                  {processing ? '⏳' : recording ? '⏹' : '🎤'}
                </span>
              </button>
            )}
          </div>

          {/* Mode hint */}
          <div style={{
            textAlign: 'center', paddingBottom: 12, flexShrink: 0,
            fontSize: 10, color: C.textMuted, fontFamily: FONT,
          }}>
            {recording
              ? (mode === 'batch' ? 'Rilascia per tradurre...' : 'Tap per fermare')
              : (mode === 'live' ? 'Live: tap mic per iniziare' : 'Scrivi o tieni premuto il mic')}
          </div>
        </div>
      )}

      {/* CSS */}
      <style>{`
        @keyframes vtMicPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes vtBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default memo(SpeakerView);
