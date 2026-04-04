'use client';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { FONT, LANGS, getLang, vibrate } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import Icon from './Icon.js';
import { toast } from './Toast.js';

// ═══════════════════════════════════════════════════════════════
// TaxiTalk — Redesigned: "Parla, Traduci, Mostra"
//
// Single-screen translator with big mic CTA, chat-style results,
// optional destination overlay, and mirror mode for face-to-face.
//
// Flow: speak/type → translate → TTS → show (mirror optional)
// ═══════════════════════════════════════════════════════════════

const COMMON_LANGS = ['en','it','es','fr','de','pt','zh','ja','ko','ar','hi','ru','tr','th','vi'];

function SpeakerView({ L, S, prefs, setView, theme, userToken }) {
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    bg: '#060810',
    textPrimary: col.textPrimary || '#F2F4F7',
    textSecondary: col.textSecondary || 'rgba(242,244,247,0.90)',
    textMuted: col.textMuted || 'rgba(242,244,247,0.60)',
    card: col.glassCard || 'rgba(12,16,30,0.65)',
    cardBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    input: col.inputBg || 'rgba(14,18,32,0.6)',
    inputBorder: col.inputBorder || 'rgba(255,255,255,0.07)',
    accent: col.accent1 || '#26D9B0',
    purple: col.accent2 || '#8B6AFF',
    red: col.accent3 || '#FF6B6B',
    popup: col.popupBg || 'rgba(10,14,26,0.96)',
  };

  // ── State ──
  const [sourceLang, setSourceLang] = useState(prefs?.lang || 'it');
  const [targetLang, setTargetLang] = useState(prefs?.lang === 'en' ? 'it' : 'en');
  const [mode, setMode] = useState('batch'); // 'live' | 'batch'
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [history, setHistory] = useState([]);
  const [showLangPicker, setShowLangPicker] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(false);
  const [destination, setDestination] = useState('');
  const [destCoords, setDestCoords] = useState(null);
  const [destLoading, setDestLoading] = useState(false);
  const [destError, setDestError] = useState('');
  const [textMessage, setTextMessage] = useState('');
  const [userPos, setUserPos] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showRouteSteps, setShowRouteSteps] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showDestPanel, setShowDestPanel] = useState(false);

  // ── Refs ──
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
  const speechRecRef = useRef(null);
  const fetchRouteRef = useRef(null);

  // ── Fetch Deepgram key on mount ──
  useEffect(() => {
    fetch('/api/deepgram-token').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.key) dgKeyRef.current = d.key; })
      .catch(() => {});
  }, []);

  // ── Auto-scroll history ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  // ── Auto mirror on phone flip ──
  useEffect(() => {
    let lastFlip = false;
    const handleOrientation = (e) => {
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

  // ── GPS + route when destination is set ──
  useEffect(() => {
    if (!destCoords) { setUserPos(null); setRouteInfo(null); return; }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lon: position.coords.longitude };
        setUserPos(pos);
        if (fetchRouteRef.current) fetchRouteRef.current(pos.lat, pos.lon, destCoords.lat, destCoords.lon);
      },
      () => {},
      { timeout: 10000 }
    );
  }, [destCoords]);

  // ── Swap languages ──
  const swapLangs = useCallback(() => {
    vibrate();
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setLiveText('');
    setTranslatedText('');
  }, [sourceLang, targetLang]);

  // ── Translate text ──
  const translateText = useCallback(async (text, isFinal = true) => {
    if (!text || text.trim().length < 2) return '';
    try {
      const src = getLang(sourceLang);
      const tgt = getLang(targetLang);
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(), sourceLang, targetLang,
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

  // ── TTS: Edge TTS (free) → OpenAI fallback ──
  const playTTS = useCallback(async (text, lang) => {
    if (!text) return;
    setPlaying(true);
    try {
      const langCode = getLang(lang)?.speech || lang || 'en';
      const edgeRes = await fetch('/api/tts-edge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, langCode, gender: 'female' }),
      });
      if (edgeRes.ok) {
        const blob = await edgeRes.blob();
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.volume = 1.0;
          audio.play().catch(() => {});
          audio.onended = () => { URL.revokeObjectURL(url); setPlaying(false); };
          audio.onerror = () => { setPlaying(false); };
          return;
        }
      }
    } catch {}
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: prefs?.voice || 'nova', lang, userToken: userToken || '' }),
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

  // ── Destination geocoding ──
  const searchDestination = useCallback(async (query) => {
    if (!query || query.trim().length < 2) return;
    setDestLoading(true); setDestError(''); setSearchResults([]);
    try {
      const q = encodeURIComponent(query.trim());
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': targetLang || 'en' } }
      );
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();
      if (data.length === 0) {
        setDestError('Luogo non trovato');
        setDestCoords(null);
      } else if (data.length === 1) {
        const place = data[0];
        setDestCoords({ lat: parseFloat(place.lat), lon: parseFloat(place.lon), displayName: place.display_name });
        setShowDestPanel(false);
      } else {
        setSearchResults(data.map(p => ({
          lat: parseFloat(p.lat), lon: parseFloat(p.lon),
          displayName: p.display_name, type: p.type || '',
        })));
      }
    } catch { setDestError('Errore di ricerca'); setDestCoords(null); }
    setDestLoading(false);
  }, [targetLang]);

  const selectSearchResult = useCallback((result) => {
    setDestCoords(result); setSearchResults([]); setDestError(''); setShowDestPanel(false);
  }, []);

  const clearDestination = useCallback(() => {
    setDestination(''); setDestCoords(null); setDestError('');
    setTextMessage(''); setSearchResults([]);
  }, []);

  // ── Fetch route via OSRM ──
  const fetchRoute = useCallback(async (fromLat, fromLon, toLat, toLon) => {
    setRouteLoading(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.routes?.[0]) {
        const route = data.routes[0];
        const distKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        const steps = [];
        route.legs?.forEach(leg => leg.steps?.forEach(step => {
          steps.push({
            instruction: step.maneuver?.instruction || 'Continue',
            modifier: step.maneuver?.modifier || '',
            distance: (step.distance / 1000).toFixed(2),
          });
        }));
        setRouteInfo({ distKm, durationMin, steps });
      }
    } catch {}
    setRouteLoading(false);
  }, []);
  fetchRouteRef.current = fetchRoute;

  // ── Send typed message ──
  const sendTextMessage = useCallback(async () => {
    if (!textMessage.trim()) return;
    vibrate(); setProcessing(true); setLiveText(textMessage.trim());
    const translated = await translateText(textMessage.trim(), true);
    setTranslatedText(translated);
    if (translated) {
      setHistory(prev => [...prev.slice(-50), {
        original: textMessage.trim(), translated, sourceLang, targetLang, ts: Date.now(),
        destination: destCoords?.displayName?.split(',').slice(0, 2).join(',') || '',
      }]);
      playTTS(translated, targetLang);
    } else {
      toast.error(L('translationError') || 'Traduzione fallita');
    }
    setProcessing(false); setTextMessage('');
  }, [textMessage, translateText, sourceLang, targetLang, destCoords, playTTS, L]);

  // ── Batch recording (Web Speech API) ──
  const startBatchRecord = useCallback(async () => {
    vibrate(); setRecording(true); setLiveText(''); setTranslatedText('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setMode('live'); setRecording(false); return; }
    const rec = new SpeechRecognition();
    speechRecRef.current = rec;
    rec.lang = getLang(sourceLang)?.speech || 'en-US';
    rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setLiveText(finalText + interim);
    };
    rec.onerror = (e) => { if (e.error === 'no-speech') return; };
    rec.onend = async () => {
      const original = finalText.trim();
      if (!original) { setRecording(false); return; }
      setProcessing(true); setLiveText(original);
      const translated = await translateText(original, true);
      setTranslatedText(translated);
      if (translated) {
        setHistory(prev => [...prev.slice(-50), {
          original, translated, sourceLang, targetLang, ts: Date.now(),
          destination: destCoords?.displayName?.split(',').slice(0, 2).join(',') || '',
        }]);
        playTTS(translated, targetLang);
      }
      setProcessing(false); setRecording(false);
    };
    try { rec.start(); } catch { setRecording(false); }
  }, [sourceLang, targetLang, translateText, playTTS, destCoords]);

  const stopBatchRecord = useCallback(() => {
    if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} speechRecRef.current = null; }
  }, []);

  // ── Live mode (Deepgram streaming) ──
  const startLiveMode = useCallback(async () => {
    vibrate();
    if (!dgKeyRef.current) {
      try { const res = await fetch('/api/deepgram-token'); if (res.ok) { const d = await res.json(); if (d?.key) dgKeyRef.current = d.key; } } catch {}
    }
    if (!dgKeyRef.current) { setMode('batch'); startBatchRecord(); return; }
    setRecording(true); setLiveText(''); setTranslatedText(''); sentenceRef.current = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const speechLang = getLang(sourceLang)?.speech || 'en-US';
      const params = new URLSearchParams({
        model: 'nova-2', language: speechLang.split('-')[0], smart_format: 'true',
        interim_results: 'true', utterance_end_ms: '900',
        endpointing: '400', encoding: 'linear16', sample_rate: '16000', channels: '1',
      });
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', dgKeyRef.current]);
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
          for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
          ws.send(pcm16.buffer);
        };
        source.connect(processor); processor.connect(audioCtx.destination);
      };
      ws.onmessage = (event) => {
        try {
          let data; try { data = JSON.parse(event.data); } catch { console.warn('[SpeakerView] WS message parse failed'); return; }
          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript || '';
            if (!transcript) return;
            if (data.is_final) {
              sentenceRef.current += (sentenceRef.current ? ' ' : '') + transcript;
              setLiveText(sentenceRef.current);
              clearTimeout(translateTimerRef.current);
              translateTimerRef.current = setTimeout(async () => {
                const t = await translateText(sentenceRef.current, false);
                if (t) setTranslatedText(t);
              }, 250);
            } else {
              setLiveText(sentenceRef.current + (sentenceRef.current ? ' ' : '') + transcript);
            }
          }
          if (data.type === 'UtteranceEnd' && sentenceRef.current.trim()) {
            const sentence = sentenceRef.current.trim();
            sentenceRef.current = '';
            (async () => {
              const translated = await translateText(sentence, true);
              if (translated) {
                setTranslatedText(translated);
                setHistory(prev => [...prev.slice(-50), { original: sentence, translated, sourceLang, targetLang, ts: Date.now() }]);
                playTTS(translated, targetLang);
              }
              setTimeout(() => { setLiveText(''); setTranslatedText(''); }, 3000);
            })();
          }
        } catch {}
      };
    } catch { setRecording(false); }
  }, [sourceLang, targetLang, translateText, playTTS, startBatchRecord]);

  const stopLiveMode = useCallback(() => {
    if (sentenceRef.current.trim()) {
      const sentence = sentenceRef.current.trim();
      sentenceRef.current = '';
      translateText(sentence, true).then(translated => {
        if (translated) {
          setTranslatedText(translated);
          setHistory(prev => [...prev.slice(-50), { original: sentence, translated, sourceLang, targetLang, ts: Date.now() }]);
          playTTS(translated, targetLang);
        }
      });
    }
    clearTimeout(translateTimerRef.current);
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    if (audioCtxRef.current?.state !== 'closed') { try { audioCtxRef.current?.close(); } catch {} audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} }); streamRef.current = null; }
    if (wsRef.current) {
      try { if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'CloseStream' })); wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    setRecording(false);
  }, [sourceLang, targetLang, translateText, playTTS]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (audioRef.current) try { audioRef.current.pause(); } catch {}
      if (wsRef.current) try { wsRef.current.close(); } catch {}
      if (streamRef.current) streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      if (audioCtxRef.current?.state !== 'closed') try { audioCtxRef.current?.close(); } catch {}
      clearTimeout(translateTimerRef.current);
    };
  }, []);

  // ── Bbox helper ──
  const computeBbox = useCallback((p1, p2, pad = 0.01) => {
    if (!p1 || !p2) return null;
    return {
      minLon: Math.min(p1.lon, p2.lon) - pad, maxLon: Math.max(p1.lon, p2.lon) + pad,
      minLat: Math.min(p1.lat, p2.lat) - pad, maxLat: Math.max(p1.lat, p2.lat) + pad,
    };
  }, []);

  const srcInfo = getLang(sourceLang);
  const tgtInfo = getLang(targetLang);

  // ═══════════════════════════════════════════════
  // MIRROR MODE — fullscreen split for face-to-face
  // ═══════════════════════════════════════════════
  if (mirrorMode) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000', display: 'flex', flexDirection: 'column',
        fontFamily: FONT, overflow: 'hidden',
      }}
        onClick={(e) => { if (e.clientY < 60) setMirrorMode(false); }}>

        {/* Exit hint */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          padding: '4px 16px', borderRadius: 20,
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, zIndex: 10,
        }}>
          tap per uscire
        </div>

        {/* MY TEXT (bottom half, normal orientation) */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            {srcInfo?.flag} {srcInfo?.name}
          </div>
          <div style={{
            fontSize: liveText.length > 80 ? 18 : liveText.length > 40 ? 26 : 34,
            fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            textAlign: 'center', lineHeight: 1.4, maxWidth: '100%', wordBreak: 'break-word',
          }}>
            {liveText || (recording ? '...' : 'Parla al microfono')}
          </div>
        </div>

        {/* THEIR TEXT (top half, mirrored for person across) */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', padding: '20px 24px',
          transform: 'scaleX(-1) scaleY(-1)', overflow: 'hidden',
        }}>
          {destCoords ? (
            <>
              <div style={{ fontSize: 10, color: 'rgba(38,217,176,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                {destCoords.displayName?.split(',').slice(0, 2).join(',')}
              </div>
              {routeInfo && (
                <div style={{
                  fontSize: 26, fontWeight: 800, color: C.accent, marginBottom: 12,
                  textAlign: 'center', textShadow: `0 0 20px ${C.accent}40`,
                }}>
                  {routeInfo.distKm} km &middot; {routeInfo.durationMin} min
                </div>
              )}
              <div style={{
                flex: 1, width: '100%', borderRadius: 16, overflow: 'hidden',
                border: `2px solid ${C.accent}30`, position: 'relative', minHeight: 0,
              }}>
                {(() => {
                  const bbox = userPos ? computeBbox(userPos, destCoords, 0.015) : computeBbox(destCoords, destCoords, 0.008);
                  const b = bbox || { minLon: destCoords.lon - 0.008, minLat: destCoords.lat - 0.006, maxLon: destCoords.lon + 0.008, maxLat: destCoords.lat + 0.006 };
                  return (
                    <iframe title="Map" src={`https://www.openstreetmap.org/export/embed.html?bbox=${b.minLon}%2C${b.minLat}%2C${b.maxLon}%2C${b.maxLat}&layer=mapnik&marker=${destCoords.lat}%2C${destCoords.lon}`}
                      style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0 }} />
                  );
                })()}
              </div>
              {translatedText && (
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 8, textAlign: 'center', textShadow: `0 0 20px ${C.accent}30` }}>
                  {translatedText}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, color: `${C.accent}80`, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                {tgtInfo?.flag} {tgtInfo?.name}
              </div>
              <div style={{
                fontSize: translatedText.length > 80 ? 20 : translatedText.length > 40 ? 30 : 42,
                fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.3,
                maxWidth: '100%', wordBreak: 'break-word', textShadow: `0 0 30px ${C.accent}30`,
              }}>
                {translatedText || (processing ? 'Traduzione...' : '')}
              </div>
            </>
          )}
        </div>

        {/* Bottom mic controls */}
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <button
            onPointerDown={mode === 'batch' && !recording ? startBatchRecord : undefined}
            onPointerUp={mode === 'batch' && recording ? stopBatchRecord : undefined}
            onPointerLeave={mode === 'batch' && recording ? stopBatchRecord : undefined}
            onClick={mode === 'live' ? (recording ? stopLiveMode : startLiveMode) : undefined}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: recording ? 'linear-gradient(135deg, #FF3B30, #FF6584)' : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recording ? '0 0 40px rgba(255,59,48,0.5)' : `0 0 40px ${C.accent}50`,
              animation: recording ? 'vtMirrorPulse 1.5s ease-in-out infinite' : 'none',
              WebkitTapHighlightColor: 'transparent',
            }}>
            <span style={{ fontSize: 24, filter: 'brightness(2)' }}>{recording ? '⏹' : '🎤'}</span>
          </button>
        </div>

        <style>{`
          @keyframes vtMirrorPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        `}</style>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // MAIN VIEW — Single-screen translator
  // ═══════════════════════════════════════════════
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'hidden',
    }}>

      {/* ── Ambient background orb ── */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-30%', width: '70vw', height: '70vw',
        borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}08 0%, transparent 70%)`,
        pointerEvents: 'none', animation: 'vtOrbBreathe 8s ease-in-out infinite',
      }} />

      {/* ═══ HEADER ═══ */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 10px', flexShrink: 0, position: 'relative', zIndex: 5,
      }}>
        <button onClick={() => setView('home')} style={{
          width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent', color: C.textMuted, fontSize: 18,
        }}>
          {'‹'}
        </button>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 17, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.5,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            TaxiTalk
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: mode === 'live' ? `${C.red}20` : `${C.accent}15`,
              color: mode === 'live' ? C.red : C.accent,
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              {mode === 'live' ? 'Live' : 'Voce'}
            </span>
          </div>
        </div>

        {/* Mode toggle */}
        <button onClick={() => { setMode(mode === 'batch' ? 'live' : 'batch'); vibrate(); }}
          style={{
            padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
            background: C.card, border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            fontFamily: FONT, fontSize: 10, fontWeight: 700,
            color: C.textMuted, WebkitTapHighlightColor: 'transparent',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
          <span style={{ fontSize: 12 }}>{mode === 'batch' ? '⚡' : '🔴'}</span>
          {mode === 'batch' ? 'Live' : 'Batch'}
        </button>

        {/* Mirror button */}
        <button onClick={() => { vibrate(); setMirrorMode(true); }}
          style={{
            width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
            background: C.card, border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent', fontSize: 16,
          }}>
          {'🪞'}
        </button>
      </header>

      {/* ═══ LANGUAGE SELECTOR — Pill style ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        margin: '0 16px 8px', borderRadius: 16, overflow: 'hidden',
        background: C.card, border: `1px solid ${C.cardBorder}`,
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        position: 'relative', zIndex: 5,
      }}>
        {/* Source lang */}
        <button onClick={() => { vibrate(); setShowLangPicker(showLangPicker === 'source' ? null : 'source'); }}
          style={{
            flex: 1, padding: '10px 14px', cursor: 'pointer', border: 'none',
            background: 'transparent', fontFamily: FONT,
            display: 'flex', alignItems: 'center', gap: 8,
            WebkitTapHighlightColor: 'transparent',
          }}>
          <span style={{ fontSize: 22 }}>{srcInfo?.flag || '🌐'}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{srcInfo?.name || sourceLang}</div>
            <div style={{ fontSize: 9, color: C.textMuted }}>Parlo in</div>
          </div>
        </button>

        {/* Swap button */}
        <button onClick={swapLangs} style={{
          width: 40, height: 40, borderRadius: 12, cursor: 'pointer',
          background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, WebkitTapHighlightColor: 'transparent',
          boxShadow: `0 2px 12px ${C.accent}30`,
        }}>
          <Icon name="swap" size={18} color="#fff" />
        </button>

        {/* Target lang */}
        <button onClick={() => { vibrate(); setShowLangPicker(showLangPicker === 'target' ? null : 'target'); }}
          style={{
            flex: 1, padding: '10px 14px', cursor: 'pointer', border: 'none',
            background: 'transparent', fontFamily: FONT,
            display: 'flex', alignItems: 'center', gap: 8,
            justifyContent: 'flex-end',
            WebkitTapHighlightColor: 'transparent',
          }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{tgtInfo?.name || targetLang}</div>
            <div style={{ fontSize: 9, color: C.textMuted }}>Traduci in</div>
          </div>
          <span style={{ fontSize: 22 }}>{tgtInfo?.flag || '🌐'}</span>
        </button>
      </div>

      {/* Language picker dropdown */}
      {showLangPicker && (
        <div style={{
          margin: '0 16px 8px', padding: 10, borderRadius: 16,
          background: C.popup, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          maxHeight: 180, overflowY: 'auto',
          display: 'flex', flexWrap: 'wrap', gap: 4,
          position: 'relative', zIndex: 10,
        }}>
          {COMMON_LANGS.map(code => {
            const info = getLang(code);
            const isSel = showLangPicker === 'source' ? code === sourceLang : code === targetLang;
            return (
              <button key={code} onClick={() => {
                vibrate();
                if (showLangPicker === 'source') setSourceLang(code); else setTargetLang(code);
                setShowLangPicker(null);
              }} style={{
                padding: '7px 12px', borderRadius: 10, cursor: 'pointer',
                background: isSel ? `${C.accent}15` : 'transparent',
                border: isSel ? `1px solid ${C.accent}30` : '1px solid transparent',
                fontFamily: FONT, fontSize: 12, fontWeight: isSel ? 700 : 500,
                color: isSel ? C.accent : C.textSecondary,
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

      {/* ═══ DESTINATION BAR (collapsible) ═══ */}
      {destCoords ? (
        <div style={{
          margin: '0 16px 8px', borderRadius: 14, overflow: 'hidden',
          background: C.card, border: `1px solid ${C.accent}20`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        }}>
          {/* Map preview */}
          <div style={{ height: 100, position: 'relative' }}>
            {(() => {
              const bbox = userPos ? computeBbox(userPos, destCoords, 0.015) : computeBbox(destCoords, destCoords, 0.008);
              const b = bbox || { minLon: destCoords.lon - 0.008, minLat: destCoords.lat - 0.006, maxLon: destCoords.lon + 0.008, maxLat: destCoords.lat + 0.006 };
              return <iframe title="Map" src={`https://www.openstreetmap.org/export/embed.html?bbox=${b.minLon}%2C${b.minLat}%2C${b.maxLon}%2C${b.maxLat}&layer=mapnik&marker=${destCoords.lat}%2C${destCoords.lon}`}
                style={{ width: '100%', height: '100%', border: 'none' }} />;
            })()}
          </div>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {destCoords.displayName?.split(',').slice(0, 3).join(',')}
              </div>
              {routeInfo && (
                <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, marginTop: 2 }}>
                  {routeInfo.distKm} km &middot; ~{routeInfo.durationMin} min
                </div>
              )}
            </div>
            <button onClick={() => { vibrate(); setMirrorMode(true); }} style={{
              padding: '5px 10px', borderRadius: 8,
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', cursor: 'pointer', fontSize: 10, color: '#fff', fontWeight: 700, fontFamily: FONT,
            }}>
              Mostra
            </button>
            <button onClick={clearDestination} style={{
              padding: '5px 8px', borderRadius: 8,
              background: `${C.red}15`, border: `1px solid ${C.red}25`,
              cursor: 'pointer', fontSize: 11, color: C.red, fontFamily: FONT,
            }}>
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowDestPanel(!showDestPanel)} style={{
          margin: '0 16px 8px', padding: '8px 14px', borderRadius: 12,
          background: showDestPanel ? `${C.accent}10` : C.card,
          border: `1px solid ${showDestPanel ? `${C.accent}25` : C.cardBorder}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          cursor: 'pointer', fontFamily: FONT,
          display: 'flex', alignItems: 'center', gap: 8,
          WebkitTapHighlightColor: 'transparent',
        }}>
          <span style={{ fontSize: 14 }}>📍</span>
          <span style={{ fontSize: 11, color: C.textMuted, flex: 1, textAlign: 'left' }}>Aggiungi destinazione</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>{showDestPanel ? '▼' : '+'}</span>
        </button>
      )}

      {/* Destination search panel */}
      {showDestPanel && !destCoords && (
        <div style={{
          margin: '0 16px 8px', padding: 14, borderRadius: 16,
          background: C.popup, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && destination.trim()) searchDestination(destination); }}
              placeholder="Indirizzo, hotel, monumento..."
              autoFocus
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 12,
                background: C.input, border: `1px solid ${C.inputBorder}`,
                color: C.textPrimary, fontSize: 13, fontFamily: FONT, outline: 'none',
              }}
            />
            <button onClick={() => searchDestination(destination)}
              disabled={destLoading || !destination.trim()}
              style={{
                padding: '10px 16px', borderRadius: 12,
                background: destination.trim() ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : C.card,
                border: 'none', cursor: destination.trim() ? 'pointer' : 'default',
                color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT,
                opacity: destLoading || !destination.trim() ? 0.4 : 1,
              }}>
              {destLoading ? '...' : 'Cerca'}
            </button>
          </div>
          {destError && <div style={{ fontSize: 10, color: C.red, marginTop: 6 }}>{destError}</div>}
          {searchResults.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => selectSearchResult(r)} style={{
                  padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                  background: C.input, border: `1px solid ${C.inputBorder}`,
                  color: C.textPrimary, fontSize: 11, textAlign: 'left', fontFamily: 'inherit', lineHeight: 1.4,
                }}>
                  {r.displayName?.split(',').slice(0, 3).join(',')}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ CHAT AREA — translation results ═══ */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', scrollbarWidth: 'none', minHeight: 0,
        padding: '0 16px', position: 'relative', zIndex: 1,
      }}>
        {/* Current translation (if any) */}
        {(liveText || translatedText) && (
          <div style={{
            padding: 14, borderRadius: 18, marginBottom: 10,
            background: C.card, border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            animation: 'vtSlideUp 0.3s ease-out',
          }}>
            {liveText && (
              <div style={{
                fontSize: 13, color: C.textSecondary, lineHeight: 1.5,
                marginBottom: translatedText ? 10 : 0,
                paddingBottom: translatedText ? 10 : 0,
                borderBottom: translatedText ? `1px solid ${C.cardBorder}` : 'none',
              }}>
                <span style={{ fontSize: 16, marginRight: 6 }}>{srcInfo?.flag}</span>
                {liveText}
                {recording && mode === 'live' && (
                  <span style={{
                    display: 'inline-block', width: 6, height: 14,
                    background: C.accent, marginLeft: 4, borderRadius: 1,
                    animation: 'vtBlink 1s step-end infinite',
                  }} />
                )}
              </div>
            )}
            {translatedText && (
              <div style={{ fontSize: 17, fontWeight: 600, color: C.textPrimary, lineHeight: 1.5 }}>
                <span style={{ fontSize: 20, marginRight: 6 }}>{tgtInfo?.flag}</span>
                {translatedText}
              </div>
            )}
            {translatedText && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => playTTS(translatedText, targetLang)} disabled={playing}
                  style={{
                    padding: '6px 14px', borderRadius: 10,
                    background: playing ? C.card : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                    border: 'none', cursor: playing ? 'default' : 'pointer',
                    color: '#fff', fontFamily: FONT, fontSize: 11, fontWeight: 700,
                    opacity: playing ? 0.5 : 1,
                    boxShadow: playing ? 'none' : `0 2px 12px ${C.accent}25`,
                  }}>
                  {playing ? '⏳ ...' : '🔊 Ascolta'}
                </button>
                <button onClick={() => { vibrate(); setMirrorMode(true); }}
                  style={{
                    padding: '6px 14px', borderRadius: 10,
                    background: `${C.accent}12`, border: `1px solid ${C.accent}25`,
                    cursor: 'pointer', color: C.accent, fontFamily: FONT, fontSize: 11, fontWeight: 700,
                  }}>
                  🪞 Mostra
                </button>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.map((item, i) => (
          <div key={`${item.ts}-${i}`}
            onClick={() => { vibrate(); playTTS(item.translated, item.targetLang); }}
            style={{
              padding: '10px 14px', marginBottom: 6, borderRadius: 14,
              background: C.card, border: `1px solid ${C.cardBorder}`,
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              cursor: 'pointer', transition: 'transform 0.1s',
            }}>
            {item.destination && (
              <div style={{ fontSize: 9, color: C.accent, fontWeight: 700, marginBottom: 3 }}>
                📍 {item.destination}
              </div>
            )}
            <div style={{ fontSize: 12, color: C.textMuted }}>{getLang(item.sourceLang)?.flag} {item.original}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginTop: 3 }}>
              {getLang(item.targetLang)?.flag} {item.translated}
            </div>
            <div style={{ fontSize: 8, color: C.textMuted, marginTop: 3, opacity: 0.4 }}>
              {new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {history.length === 0 && !liveText && !translatedText && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
              border: `1px solid ${C.accent}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36,
            }}>
              🗣️
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
              Parla o scrivi
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, maxWidth: 260, margin: '0 auto' }}>
              {mode === 'batch'
                ? 'Tieni premuto il microfono, parla, rilascia. La traduzione viene letta ad alta voce.'
                : 'Tocca il microfono per iniziare la traduzione continua in tempo reale.'}
            </div>
            <div style={{
              marginTop: 20, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              {[
                { icon: '🎤', label: mode === 'batch' ? 'Tieni premuto' : 'Tap per parlare' },
                { icon: '⌨️', label: 'Scrivi messaggio' },
                { icon: '🪞', label: 'Mostra al tassista' },
              ].map((tip, i) => (
                <div key={i} style={{
                  padding: '6px 12px', borderRadius: 10,
                  background: `${C.accent}08`, border: `1px solid ${C.accent}10`,
                  fontSize: 10, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span>{tip.icon}</span> {tip.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ BOTTOM COMPOSE BAR ═══ */}
      <div style={{
        padding: '8px 16px', flexShrink: 0, position: 'relative', zIndex: 5,
        borderTop: `1px solid ${C.cardBorder}`,
        background: `${C.bg}E0`,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="text" value={textMessage}
            onChange={(e) => setTextMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendTextMessage(); }}
            placeholder={recording ? (mode === 'batch' ? 'Rilascia per tradurre...' : 'Sto ascoltando...') : 'Scrivi messaggio...'}
            disabled={recording}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 14,
              background: C.input, border: `1px solid ${recording ? `${C.red}30` : C.inputBorder}`,
              color: C.textPrimary, fontSize: 14, fontFamily: FONT, outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />

          {/* Send text OR mic button */}
          {textMessage.trim() ? (
            <button onClick={sendTextMessage} disabled={processing} style={{
              width: 46, height: 46, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent', flexShrink: 0,
              boxShadow: `0 4px 16px ${C.accent}30`,
            }}>
              <span style={{ fontSize: 18, filter: 'brightness(2)' }}>{processing ? '⏳' : '➤'}</span>
            </button>
          ) : (
            <button
              onPointerDown={mode === 'batch' && !recording ? startBatchRecord : undefined}
              onPointerUp={mode === 'batch' && recording ? stopBatchRecord : undefined}
              onPointerLeave={mode === 'batch' && recording ? stopBatchRecord : undefined}
              onClick={mode === 'live' ? (recording ? stopLiveMode : startLiveMode) : undefined}
              disabled={processing}
              style={{
                width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                background: recording
                  ? 'linear-gradient(135deg, #FF3B30, #FF6584)'
                  : `linear-gradient(135deg, ${C.accent} 0%, ${C.purple} 100%)`,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: recording ? 'vtMicPulse 1.2s ease-in-out infinite' : 'none',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: recording ? '0 0 30px rgba(255,59,48,0.4)' : `0 4px 16px ${C.accent}30`,
              }}>
              <span style={{ fontSize: 18, filter: 'brightness(2)' }}>
                {processing ? '⏳' : recording ? '⏹' : '🎤'}
              </span>
            </button>
          )}
        </div>

        {/* Recording hint */}
        {recording && (
          <div style={{
            textAlign: 'center', paddingTop: 6,
            fontSize: 10, color: C.red, fontWeight: 600,
            animation: 'vtPulse 1.5s ease-in-out infinite',
          }}>
            {mode === 'batch' ? '● Rilascia per tradurre' : '● Traduzione live attiva — tap per fermare'}
          </div>
        )}
      </div>

      {/* ═══ CSS ANIMATIONS ═══ */}
      <style>{`
        @keyframes vtMicPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes vtBlink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes vtSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vtPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes vtOrbBreathe { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.05); } }
      `}</style>
    </div>
  );
}

export default memo(SpeakerView);
