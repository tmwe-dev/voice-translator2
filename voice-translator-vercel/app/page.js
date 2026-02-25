'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

const LANGS = [
  { code:'it', name:'Italiano', flag:'\u{1F1EE}\u{1F1F9}', speech:'it-IT' },
  { code:'th', name:'\u0E44\u0E17\u0E22 (Thai)', flag:'\u{1F1F9}\u{1F1ED}', speech:'th-TH' },
  { code:'en', name:'English', flag:'\u{1F1EC}\u{1F1E7}', speech:'en-US' },
  { code:'es', name:'Espa\u00F1ol', flag:'\u{1F1EA}\u{1F1F8}', speech:'es-ES' },
  { code:'fr', name:'Fran\u00E7ais', flag:'\u{1F1EB}\u{1F1F7}', speech:'fr-FR' },
  { code:'de', name:'Deutsch', flag:'\u{1F1E9}\u{1F1EA}', speech:'de-DE' },
  { code:'pt', name:'Portugu\u00EAs', flag:'\u{1F1E7}\u{1F1F7}', speech:'pt-BR' },
  { code:'zh', name:'\u4E2D\u6587', flag:'\u{1F1E8}\u{1F1F3}', speech:'zh-CN' },
  { code:'ja', name:'\u65E5\u672C\u8A9E', flag:'\u{1F1EF}\u{1F1F5}', speech:'ja-JP' },
  { code:'ko', name:'\uD55C\uAD6D\uC5B4', flag:'\u{1F1F0}\u{1F1F7}', speech:'ko-KR' },
  { code:'ar', name:'\u0627\u0644\u0639\u0631\u0628\u064A\u0629', flag:'\u{1F1F8}\u{1F1E6}', speech:'ar-SA' },
  { code:'hi', name:'\u0939\u093F\u0928\u094D\u0926\u0940', flag:'\u{1F1EE}\u{1F1F3}', speech:'hi-IN' },
  { code:'ru', name:'\u0420\u0443\u0441\u0441\u043A\u0438\u0439', flag:'\u{1F1F7}\u{1F1FA}', speech:'ru-RU' },
  { code:'tr', name:'T\u00FCrk\u00E7e', flag:'\u{1F1F9}\u{1F1F7}', speech:'tr-TR' },
  { code:'vi', name:'Ti\u1EBFng Vi\u1EC7t', flag:'\u{1F1FB}\u{1F1F3}', speech:'vi-VN' },
  { code:'id', name:'Bahasa Indonesia', flag:'\u{1F1EE}\u{1F1E9}', speech:'id-ID' },
  { code:'ms', name:'Bahasa Melayu', flag:'\u{1F1F2}\u{1F1FE}', speech:'ms-MY' },
  { code:'nl', name:'Nederlands', flag:'\u{1F1F3}\u{1F1F1}', speech:'nl-NL' },
  { code:'pl', name:'Polski', flag:'\u{1F1F5}\u{1F1F1}', speech:'pl-PL' },
  { code:'sv', name:'Svenska', flag:'\u{1F1F8}\u{1F1EA}', speech:'sv-SE' },
  { code:'el', name:'\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC', flag:'\u{1F1EC}\u{1F1F7}', speech:'el-GR' },
  { code:'cs', name:'\u010Ce\u0161tina', flag:'\u{1F1E8}\u{1F1FF}', speech:'cs-CZ' },
  { code:'ro', name:'Rom\u00E2n\u0103', flag:'\u{1F1F7}\u{1F1F4}', speech:'ro-RO' },
  { code:'hu', name:'Magyar', flag:'\u{1F1ED}\u{1F1FA}', speech:'hu-HU' },
  { code:'fi', name:'Suomi', flag:'\u{1F1EB}\u{1F1EE}', speech:'fi-FI' },
];

const VOICES = ['alloy','echo','fable','onyx','nova','shimmer'];
const AVATARS = ['\u{1F9D1}\u200D\u{1F4BB}','\u{1F468}\u200D\u{1F4BC}','\u{1F469}\u200D\u{1F4BC}','\u{1F9D1}\u200D\u{1F3A8}','\u{1F468}\u200D\u{1F3EB}','\u{1F469}\u200D\u{1F3EB}','\u{1F9D1}\u200D\u{1F52C}','\u{1F468}\u200D\u{1F373}','\u{1F469}\u200D\u{1F680}','\u{1F9D1}\u200D\u{1F3A4}','\u{1F47D}','\u{1F916}'];

const MODES = [
  { id:'conversation', name:'Conversazione', icon:'\u{1F4AC}', desc:'Tocca per parlare, tocca per fermare' },
  { id:'classroom', name:'Classroom', icon:'\u{1F3EB}', desc:'Host parla, gli altri ascoltano' },
  { id:'freetalk', name:'Free Talk', icon:'\u{1F389}', desc:'Microfono aperto, traduzione automatica' },
];

const FONT = "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function getLang(code) { return LANGS.find(l => l.code === code) || LANGS[0]; }

export default function Home() {
  const [view, setView] = useState('loading');
  const [prefs, setPrefs] = useState({ name:'', lang:'it', avatar:AVATARS[0], voice:'nova', autoPlay:true });
  const [roomId, setRoomId] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [myLang, setMyLang] = useState('it');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('');
  const [recording, setRecording] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true); // user toggle
  const [audioReady, setAudioReady] = useState(false); // system unlocked
  const [selectedMode, setSelectedMode] = useState('conversation');
  const [isListening, setIsListening] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const pollRef = useRef(null);
  const lastMsgRef = useRef(0);
  const msgsEndRef = useRef(null);
  const prefsRef = useRef(prefs);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const myLangRef = useRef(myLang);
  const roomInfoRef = useRef(roomInfo);
  const audioEnabledRef = useRef(audioEnabled);
  const vadStreamRef = useRef(null);
  const vadRecRef = useRef(null);
  const vadTimerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const vadAnalyserRef = useRef(null);
  const persistentAudioRef = useRef(null); // persistent Audio element for auto-play
  const playedMsgIdsRef = useRef(new Set()); // track already-played messages
  const sentByMeRef = useRef(new Set()); // track message IDs sent by THIS client

  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  useEffect(() => { myLangRef.current = myLang; }, [myLang]);
  useEffect(() => { roomInfoRef.current = roomInfo; }, [roomInfo]);
  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);

  // =============================================
  // AUDIO SYSTEM - Persistent Audio element for reliable auto-play
  // =============================================

  // Get or create persistent Audio element (reusing it avoids mobile play() blocks)
  function getPersistentAudio() {
    if (!persistentAudioRef.current) {
      persistentAudioRef.current = new Audio();
      persistentAudioRef.current.volume = 1.0;
    }
    return persistentAudioRef.current;
  }

  // Unlock audio on ANY user interaction (critical for joiners)
  function unlockAudio() {
    if (audioReady) return;
    try {
      // 1) Unlock AudioContext
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      // 2) Unlock persistent Audio element with silent sound
      const pa = getPersistentAudio();
      pa.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      pa.play().then(() => {
        console.log('[Audio] Persistent element unlocked');
      }).catch(() => {
        console.log('[Audio] Persistent element unlock failed');
      });
      // 3) Also unlock a throwaway Audio (belt and suspenders)
      const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      a.volume = 0.01;
      a.play().catch(() => {});
      setAudioReady(true);
      console.log('[Audio] Unlocked successfully');
    } catch (e) {
      console.log('[Audio] Unlock failed:', e);
    }
  }

  // Global touch/click listener to unlock audio ASAP (especially for joiners)
  useEffect(() => {
    if (audioReady) return;
    const handler = () => unlockAudio();
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('click', handler, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('click', handler);
    };
  }, [audioReady]);

  async function testAudio() {
    unlockAudio();
    setStatus('Test audio...');
    try {
      const res = await fetch('/api/tts', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text:'Audio OK!', voice: prefsRef.current.voice || 'nova' })
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = getPersistentAudio();
      audio.onended = () => { URL.revokeObjectURL(url); setStatus(''); };
      audio.src = url;
      await audio.play();
      setStatus('Audio OK!');
      setTimeout(() => setStatus(''), 1500);
    } catch {
      browserSpeak('Audio test');
      setStatus('');
    }
  }

  // Audio queue - plays for ALL participants
  async function queueAudio(text, lang, msgId) {
    if (!audioEnabledRef.current) return; // respect user toggle
    // Avoid playing the same message twice (sender plays immediately + polling picks it up)
    if (msgId && playedMsgIdsRef.current.has(msgId)) return;
    if (msgId) playedMsgIdsRef.current.add(msgId);
    audioQueueRef.current.push({ text, lang });
    processAudioQueue();
  }
  async function processAudioQueue() {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const { text, lang } = audioQueueRef.current.shift();
    try { await playTTS(text, lang); } catch (e) { console.error('[Audio] Queue error:', e); }
    isPlayingRef.current = false;
    processAudioQueue();
  }

  async function playTTS(text, lang) {
    try {
      const res = await fetch('/api/tts', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text, voice: prefsRef.current.voice || 'nova' })
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        // Try persistent Audio element first (pre-unlocked)
        const audio = getPersistentAudio();
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          console.log('[Audio] Persistent element error, trying new Audio');
          playWithNewAudio(text, lang, resolve);
        };
        audio.src = url;
        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          console.log('[Audio] Persistent play() blocked, trying new Audio');
          playWithNewAudio(text, lang, resolve);
        });
      });
    } catch {
      browserSpeak(text, lang);
    }
  }

  // Fallback: try with a fresh Audio element, then browserSpeak
  function playWithNewAudio(text, lang, resolve) {
    fetch('/api/tts', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text, voice: prefsRef.current.voice || 'nova' })
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.onended = () => { URL.revokeObjectURL(url); resolve(); };
      a.play().catch(() => {
        URL.revokeObjectURL(url);
        console.log('[Audio] New Audio also blocked, using browserSpeak');
        browserSpeak(text, lang);
        resolve();
      });
    }).catch(() => {
      browserSpeak(text, lang);
      resolve();
    });
  }

  function browserSpeak(text, lang) {
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 0.9;
    speechSynthesis.speak(u);
  }

  async function playMessage(msg) {
    unlockAudio();
    setPlayingMsgId(msg.id);
    await playTTS(msg.translated, getLang(msg.targetLang).speech);
    setPlayingMsgId(null);
  }

  // =============================================
  // PREFS & INIT
  // =============================================
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vt-prefs');
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (saved) {
        const p = JSON.parse(saved);
        setPrefs(p);
        setMyLang(p.lang);
        if (roomParam) { setJoinCode(roomParam.toUpperCase()); setView('join'); }
        else setView('home');
      } else {
        if (roomParam) setJoinCode(roomParam.toUpperCase());
        setView('welcome');
      }
    } catch { setView('welcome'); }
  }, []);

  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  function savePrefs(newPrefs) {
    setPrefs(newPrefs);
    setMyLang(newPrefs.lang);
    localStorage.setItem('vt-prefs', JSON.stringify(newPrefs));
  }

  // =============================================
  // POLLING
  // =============================================
  const startPolling = useCallback((rid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    lastMsgRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const mRes = await fetch(`/api/messages?room=${rid}&after=${lastMsgRef.current}`);
        if (mRes.ok) {
          const { messages: newMsgs } = await mRes.json();
          if (newMsgs && newMsgs.length > 0) {
            setMessages(prev => {
              const ids = new Set(prev.map(m => m.id));
              const fresh = newMsgs.filter(m => !ids.has(m.id));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
            lastMsgRef.current = Math.max(...newMsgs.map(m => m.timestamp));
            // Auto-play ONLY for messages NOT sent by this client
            for (const msg of newMsgs) {
              // Skip if this message was sent by THIS client (tracked by ID)
              if (sentByMeRef.current.has(msg.id)) continue;
              // Also skip by name as fallback
              if (msg.sender === prefsRef.current.name) continue;
              // Auto-play if enabled
              if (msg.translated && prefsRef.current.autoPlay) {
                queueAudio(msg.translated, getLang(msg.targetLang).speech, msg.id);
              }
            }
          }
        }
        const rRes = await fetch('/api/room', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'heartbeat', roomId:rid, name:prefsRef.current.name })
        });
        if (rRes.ok) {
          const { room } = await rRes.json();
          setRoomInfo(room);
          setPartnerConnected(room.members.length >= 2);
          const partner = room.members.find(m => m.name !== prefsRef.current.name);
          setPartnerSpeaking(!!(partner && partner.speaking && (Date.now() - partner.speakingAt < 30000)));
        }
      } catch (e) { console.error('[Poll] error:', e); }
    }, 1200);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  // =============================================
  // ROOM ACTIONS
  // =============================================
  async function setSpeakingState(rid, speaking) {
    try {
      await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'speaking', roomId:rid, name:prefsRef.current.name, speaking }) });
    } catch {}
  }

  async function handleCreateRoom() {
    try {
      setStatus('Creazione stanza...');
      const res = await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'create', name:prefs.name, lang:myLang, mode:selectedMode }) });
      if (!res.ok) throw new Error('Errore');
      const { room } = await res.json();
      setRoomId(room.id); setRoomInfo(room); setMessages([]); setView('lobby');
      startPolling(room.id); setStatus('');
    } catch (e) { setStatus('Errore: ' + e.message); }
  }

  async function handleJoinRoom() {
    if (!joinCode.trim()) return;
    try {
      setStatus('Connessione...');
      const res = await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'join', roomId:joinCode.trim().toUpperCase(), name:prefs.name, lang:myLang }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Stanza non trovata'); }
      const { room } = await res.json();
      setRoomId(room.id); setRoomInfo(room); setMessages([]); setView('room');
      startPolling(room.id); setStatus('');
    } catch (e) { setStatus('Errore: ' + e.message); }
  }

  function leaveRoom() {
    stopPolling(); stopFreeTalk();
    setRoomId(null); setRoomInfo(null); setMessages([]); setPartnerSpeaking(false); setView('home');
  }

  // =============================================
  // RECORDING - TAP TO TALK (not hold!)
  // =============================================
  async function toggleRecording() {
    if (recording) {
      // STOP recording
      if (recRef.current && recRef.current.state === 'recording') {
        setStatus('Traduzione...');
        if (roomId) setSpeakingState(roomId, false);
        recRef.current.stop();
      }
    } else {
      // START recording
      unlockAudio();
      setRecording(true);
      setStatus('Parla ora...');
      if (roomId) setSpeakingState(roomId, true);
      chunksRef.current = [];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        recRef.current = new MediaRecorder(stream, { mimeType:mime });
        recRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recRef.current.onstop = async () => {
          recRef.current.stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunksRef.current, { type:recRef.current.mimeType });
          if (blob.size < 1000) { setRecording(false); setStatus(''); return; }
          try {
            await processAndSendAudio(blob);
          } catch (err) { setStatus('Errore: ' + err.message); }
          setRecording(false);
          setStatus('');
        };
        recRef.current.start(100);
      } catch (err) {
        setStatus('Errore microfono: ' + err.message);
        setRecording(false);
        if (roomId) setSpeakingState(roomId, false);
      }
    }
  }

  // =============================================
  // SHARED AUDIO PROCESSING
  // =============================================
  async function processAndSendAudio(blob) {
    const currentMyLang = myLangRef.current;
    const currentRoomInfo = roomInfoRef.current;
    const currentPrefs = prefsRef.current;
    const myL = getLang(currentMyLang);
    let otherLangCode = null;
    if (currentRoomInfo && currentRoomInfo.members) {
      const other = currentRoomInfo.members.find(m => m.name !== currentPrefs.name);
      if (other) otherLangCode = other.lang;
    }
    if (!otherLangCode) otherLangCode = currentMyLang === 'en' ? 'it' : 'en';
    const otherL = getLang(otherLangCode);
    console.log('[Translate]', myL.code, '->', otherL.code);

    const form = new FormData();
    form.append('audio', blob, 'audio.webm');
    form.append('sourceLang', myL.code);
    form.append('targetLang', otherL.code);
    form.append('sourceLangName', myL.name);
    form.append('targetLangName', otherL.name);
    if (roomId) form.append('roomId', roomId); // for cost tracking
    const res = await fetch('/api/process', { method:'POST', body:form });
    if (!res.ok) throw new Error('Errore server');
    const { original, translated, cost } = await res.json();
    if (original && roomId) {
      const msgRes = await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ roomId, sender:currentPrefs.name, original, translated,
          sourceLang:myL.code, targetLang:otherL.code }) });
      // Track this message ID so polling won't auto-play it for the sender
      try {
        const msgData = await msgRes.json();
        if (msgData.message?.id) sentByMeRef.current.add(msgData.message.id);
      } catch {}
    }
  }

  // =============================================
  // TEXT INPUT - Send text instead of voice
  // =============================================
  async function sendTextMessage() {
    if (!textInput.trim() || sendingText || !roomId) return;
    setSendingText(true);
    setStatus('Traduzione...');
    try {
      const currentMyLang = myLangRef.current;
      const currentRoomInfo = roomInfoRef.current;
      const currentPrefs = prefsRef.current;
      const myL = getLang(currentMyLang);
      let otherLangCode = null;
      if (currentRoomInfo && currentRoomInfo.members) {
        const other = currentRoomInfo.members.find(m => m.name !== currentPrefs.name);
        if (other) otherLangCode = other.lang;
      }
      if (!otherLangCode) otherLangCode = currentMyLang === 'en' ? 'it' : 'en';
      const otherL = getLang(otherLangCode);

      // Use GPT-4o-mini directly for text translation (no Whisper needed)
      const res = await fetch('/api/translate', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text:textInput.trim(), sourceLang:myL.code, targetLang:otherL.code,
          sourceLangName:myL.name, targetLangName:otherL.name, roomId }) });
      if (!res.ok) throw new Error('Errore traduzione');
      const { translated } = await res.json();
      if (translated) {
        const msgRes = await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ roomId, sender:currentPrefs.name, original:textInput.trim(), translated,
            sourceLang:myL.code, targetLang:otherL.code }) });
        // Track this message ID so polling won't auto-play it for the sender
        try {
          const msgData = await msgRes.json();
          if (msgData.message?.id) sentByMeRef.current.add(msgData.message.id);
        } catch {}
        setTextInput('');
      }
    } catch (err) { setStatus('Errore: ' + err.message); }
    setSendingText(false);
    setStatus('');
  }

  // =============================================
  // MODE CHANGE (host only)
  // =============================================
  async function changeRoomMode(newMode) {
    if (!roomId) return;
    try {
      await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'changeMode', roomId, mode:newMode }) });
      setShowModeSelector(false);
    } catch (e) { console.error('Mode change error:', e); }
  }

  // =============================================
  // FREE TALK (VAD)
  // =============================================
  async function startFreeTalk() {
    if (isListening) return;
    unlockAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      vadStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      vadAnalyserRef.current = analyser;
      setIsListening(true);
      let isRec = false;
      const threshold = 25, silenceDelay = 1500;
      function check() {
        if (!vadAnalyserRef.current) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a,b) => a+b, 0) / data.length;
        if (avg > threshold && !isRec) {
          isRec = true;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
          const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
          const ch = [];
          const r = new MediaRecorder(stream, { mimeType:mime });
          r.ondataavailable = e => { if (e.data.size > 0) ch.push(e.data); };
          r.onstop = async () => {
            const blob = new Blob(ch, { type:r.mimeType });
            if (blob.size > 1000) await processAndSendAudio(blob).catch(console.error);
          };
          vadRecRef.current = r;
          r.start(100);
          setRecording(true);
          if (roomId) setSpeakingState(roomId, true);
        } else if (avg <= threshold && isRec) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (vadRecRef.current?.state === 'recording') vadRecRef.current.stop();
              isRec = false; setRecording(false);
              if (roomId) setSpeakingState(roomId, false);
              silenceTimerRef.current = null;
            }, silenceDelay);
          }
        } else if (avg > threshold && isRec && silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null;
        }
        vadTimerRef.current = requestAnimationFrame(check);
      }
      check();
    } catch (err) { setStatus('Errore microfono: ' + err.message); }
  }
  function stopFreeTalk() {
    setIsListening(false); setRecording(false);
    if (vadTimerRef.current) { cancelAnimationFrame(vadTimerRef.current); vadTimerRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (vadRecRef.current?.state === 'recording') vadRecRef.current.stop();
    if (vadStreamRef.current) { vadStreamRef.current.getTracks().forEach(t => t.stop()); vadStreamRef.current = null; }
    vadAnalyserRef.current = null;
  }
  useEffect(() => () => stopFreeTalk(), []);

  // Share
  function shareRoom() {
    const url = `${window.location.origin}?room=${roomId}`;
    if (navigator.share) navigator.share({ title:'VoiceTranslate', text:`Entra: ${roomId}`, url });
    else { navigator.clipboard.writeText(url); setStatus('Link copiato!'); setTimeout(() => setStatus(''), 2000); }
  }

  const qrUrl = roomId ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${typeof window!=='undefined'?window.location.origin:''}?room=${roomId}`)}` : '';

  // =============================================
  // VIEWS
  // =============================================

  if (view === 'loading') return <div style={S.page}><div style={S.center}><div style={{fontSize:40, opacity:0.5}}>...</div></div></div>;

  // --- WELCOME ---
  if (view === 'welcome') return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={{fontSize:42, marginBottom:8}}>{'\u{1F30D}'}</div>
        <div style={S.title}>VoiceTranslate</div>
        <div style={S.sub}>Traduttore vocale in tempo reale</div>
        <div style={S.card}>
          <div style={S.cardTitle}>Configura il tuo profilo</div>
          <div style={S.field}>
            <div style={S.label}>Nome</div>
            <input style={S.input} placeholder="Come ti chiami?" value={prefs.name}
              onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20} />
          </div>
          <div style={S.field}>
            <div style={S.label}>Avatar</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => setPrefs({...prefs, avatar:a})}
                  style={{...S.avatarBtn, ...(prefs.avatar===a ? S.avatarSel : {})}}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div style={S.field}>
            <div style={S.label}>La tua lingua</div>
            <select style={S.select} value={prefs.lang}
              onChange={e => setPrefs({...prefs, lang:e.target.value})}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
          <div style={S.field}>
            <div style={S.label}>Voce traduzione</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
              {VOICES.map(v => (
                <button key={v} onClick={() => setPrefs({...prefs, voice:v})}
                  style={{...S.voiceBtn, ...(prefs.voice===v ? S.voiceSel : {})}}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <button style={{...S.btn, marginTop:12, opacity:prefs.name.trim()?1:0.4}}
            disabled={!prefs.name.trim()}
            onClick={() => { savePrefs(prefs); setView(joinCode ? 'join' : 'home'); }}>
            Iniziamo
          </button>
        </div>
      </div>
    </div>
  );

  // --- SETTINGS ---
  if (view === 'settings') return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView('home')}>{'\u2190'}</button>
          <span style={{fontWeight:600, fontSize:17}}>Impostazioni</span>
        </div>
        <div style={S.card}>
          <div style={S.field}>
            <div style={S.label}>Nome</div>
            <input style={S.input} value={prefs.name}
              onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20} />
          </div>
          <div style={S.field}>
            <div style={S.label}>Avatar</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => setPrefs({...prefs, avatar:a})}
                  style={{...S.avatarBtn, ...(prefs.avatar===a ? S.avatarSel : {})}}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div style={S.field}>
            <div style={S.label}>La tua lingua</div>
            <select style={S.select} value={prefs.lang}
              onChange={e => setPrefs({...prefs, lang:e.target.value})}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
          <div style={S.field}>
            <div style={S.label}>Voce traduzione</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
              {VOICES.map(v => (
                <button key={v} onClick={() => setPrefs({...prefs, voice:v})}
                  style={{...S.voiceBtn, ...(prefs.voice===v ? S.voiceSel : {})}}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{...S.label, marginBottom:0}}>Auto-play audio</span>
              <button onClick={() => setPrefs({...prefs, autoPlay:!prefs.autoPlay})}
                style={{...S.toggle, background:prefs.autoPlay ? '#e94560' : '#333'}}>
                <div style={{...S.toggleDot, transform:prefs.autoPlay ? 'translateX(20px)' : 'translateX(0)'}} />
              </button>
            </div>
          </div>
          <button style={{...S.btn, marginTop:12}} onClick={() => { savePrefs(prefs); setView('home'); }}>
            Salva
          </button>
        </div>
      </div>
    </div>
  );

  // --- HOME ---
  if (view === 'home') return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={{fontSize:36, marginBottom:4}}>{prefs.avatar}</div>
        <div style={{fontSize:18, fontWeight:600, marginBottom:2, letterSpacing:-0.3}}>Ciao, {prefs.name}</div>
        <div style={{color:'rgba(255,255,255,0.5)', fontSize:13, marginBottom:20}}>
          {getLang(prefs.lang).flag} {getLang(prefs.lang).name}
        </div>

        {/* Mode selector */}
        <div style={{width:'100%', maxWidth:380, marginBottom:16}}>
          <div style={{...S.label, marginBottom:8}}>Modalit{"a'"}</div>
          <div style={{display:'flex', gap:8}}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setSelectedMode(m.id)}
                style={{...S.modeBtn, ...(selectedMode===m.id ? S.modeBtnSel : {})}}>
                <span style={{fontSize:22}}>{m.icon}</span>
                <span style={{fontSize:11, fontWeight:600, marginTop:2}}>{m.name}</span>
              </button>
            ))}
          </div>
          <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:6, textAlign:'center'}}>
            {MODES.find(m => m.id === selectedMode)?.desc}
          </div>
        </div>

        <button style={S.bigBtn} onClick={handleCreateRoom}>
          <div style={{width:44, height:44, borderRadius:14, background:'rgba(255,255,255,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>+</div>
          <div>
            <div style={{fontWeight:600, fontSize:15}}>Crea Stanza</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:1}}>
              {MODES.find(m => m.id === selectedMode)?.name}
            </div>
          </div>
        </button>
        <button style={{...S.bigBtn, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)'}}
          onClick={() => setView('join')}>
          <div style={{width:44, height:44, borderRadius:14, background:'rgba(255,255,255,0.08)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0}}>{'\u{1F517}'}</div>
          <div>
            <div style={{fontWeight:600, fontSize:15}}>Entra nella Stanza</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:1}}>Codice o QR</div>
          </div>
        </button>
        <button style={S.settingsBtn} onClick={() => setView('settings')}>Impostazioni</button>
        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );

  // --- JOIN ---
  if (view === 'join') return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => { setView('home'); setJoinCode(''); }}>{'\u2190'}</button>
          <span style={{fontWeight:600, fontSize:17}}>Entra nella Stanza</span>
        </div>
        <div style={S.card}>
          <div style={S.field}>
            <div style={S.label}>Codice stanza</div>
            <input style={{...S.input, textAlign:'center', fontSize:22, letterSpacing:6, textTransform:'uppercase'}}
              placeholder="ABC123" value={joinCode} maxLength={6}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} />
          </div>
          <div style={S.field}>
            <div style={S.label}>La tua lingua</div>
            <select style={S.select} value={myLang} onChange={e => setMyLang(e.target.value)}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
          <button style={{...S.btn, marginTop:12, opacity:joinCode.length>=4?1:0.4}}
            disabled={joinCode.length<4} onClick={handleJoinRoom}>
            Entra
          </button>
          {status && <div style={S.statusMsg}>{status}</div>}
        </div>
      </div>
    </div>
  );

  // --- LOBBY ---
  if (view === 'lobby') return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={leaveRoom}>{'\u2190'}</button>
          <span style={{fontWeight:600, fontSize:17}}>La tua Stanza</span>
        </div>
        <div style={S.card}>
          <div style={{textAlign:'center', marginBottom:16}}>
            <div style={S.label}>Codice</div>
            <div style={{fontSize:30, fontWeight:700, letterSpacing:8, color:'#e94560'}}>{roomId}</div>
          </div>
          <div style={{textAlign:'center', marginBottom:14}}>
            <img src={qrUrl} alt="QR" style={{width:150, height:150, borderRadius:14, background:'#fff', padding:8}} />
          </div>
          <div style={{textAlign:'center', marginBottom:12}}>
            <button style={S.shareBtn} onClick={shareRoom}>Condividi Link</button>
          </div>
          <div style={{textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:13, marginBottom:12}}>
            {partnerConnected
              ? <span style={{color:'#4ecdc4'}}>Partner connesso ({roomInfo?.members?.[1]?.name})</span>
              : <span>In attesa...</span>}
          </div>
          {partnerConnected && (
            <button style={S.btn} onClick={() => { unlockAudio(); setView('room'); }}>
              Inizia a Tradurre
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // --- ROOM ---
  if (view === 'room') {
    const partner = roomInfo?.members?.find(m => m.name !== prefs.name);
    const myL = getLang(myLang);
    const otherL = partner ? getLang(partner.lang) : getLang('en');
    const roomMode = roomInfo?.mode || 'conversation';
    const isHost = roomInfo?.host === prefs.name;
    const modeInfo = MODES.find(m => m.id === roomMode) || MODES[0];
    const canTalk = roomMode === 'classroom' ? isHost : true;
    const totalCost = roomInfo?.totalCost || 0;
    const msgCount = roomInfo?.msgCount || 0;

    return (
      <div style={S.roomPage}>
        {/* Header */}
        <div style={S.roomHeader}>
          <button style={S.backBtnSmall} onClick={leaveRoom}>{'\u2190'}</button>
          <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
            <span style={{fontSize:18}}>{myL.flag}</span>
            <span style={{color:'rgba(255,255,255,0.3)', fontSize:16}}>{'\u21C4'}</span>
            <span style={{fontSize:18}}>{otherL.flag}</span>
          </div>
          {/* Privacy / Audio toggle */}
          <button onClick={() => { if (!audioEnabled) unlockAudio(); setAudioEnabled(!audioEnabled); }}
            style={{...S.iconBtn, display:'flex', alignItems:'center', gap:3, width:'auto', padding:'0 8px',
              color: audioEnabled ? '#4ecdc4' : '#ff6b6b',
              background: audioEnabled ? 'rgba(78,205,196,0.08)' : 'rgba(255,107,107,0.08)',
              border: audioEnabled ? '1px solid rgba(78,205,196,0.2)' : '1px solid rgba(255,107,107,0.2)'}}>
            <span style={{fontSize:13}}>{audioEnabled ? '\u{1F50A}' : '\u{1F512}'}</span>
            <span style={{fontSize:9, fontWeight:600}}>{audioEnabled ? 'AUTO' : 'PRIVACY'}</span>
          </button>
          {/* Connection status */}
          <div style={{width:8, height:8, borderRadius:4, marginLeft:4,
            background:partnerConnected ? '#4ecdc4' : '#ff6b6b'}} />
        </div>

        {/* Mode bar + Cost (tappable by host to change mode) */}
        <div style={{padding:'5px 12px', background:'rgba(255,255,255,0.02)',
          borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center',
          justifyContent:'space-between', flexShrink:0}}>
          <button onClick={() => isHost && setShowModeSelector(!showModeSelector)}
            style={{background:'none', border:'none', padding:0, cursor:isHost ? 'pointer' : 'default',
              display:'flex', alignItems:'center', gap:4, WebkitTapHighlightColor:'transparent'}}>
            <span style={{fontSize:11, color:'rgba(255,255,255,0.45)'}}>
              {modeInfo.icon} {modeInfo.name}
            </span>
            {isHost && <span style={{fontSize:9, color:'rgba(255,255,255,0.25)'}}>{'\u25BC'}</span>}
            {!isHost && roomMode === 'classroom' && (
              <span style={{fontSize:10, color:'rgba(255,255,255,0.3)'}}>
                {' \u2022 '}{roomInfo?.host || 'Host'} presenta
              </span>
            )}
          </button>
          {/* Cost display - visible to host */}
          {isHost && (
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <span style={{fontSize:10, color:'rgba(255,255,255,0.3)', fontFamily:'monospace'}}>
                ${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(3)}
              </span>
              <span style={{fontSize:9, color:'rgba(255,255,255,0.2)'}}>
                {msgCount} msg
              </span>
            </div>
          )}
        </div>

        {/* Mode selector dropdown (host only) */}
        {showModeSelector && isHost && (
          <div style={{padding:'8px 12px', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(10px)',
            borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0}}>
            <div style={{display:'flex', gap:6}}>
              {MODES.map(m => (
                <button key={m.id} onClick={() => changeRoomMode(m.id)}
                  style={{...S.modeBtn, flex:1, padding:'8px 4px',
                    ...(roomMode === m.id ? S.modeBtnSel : {})}}>
                  <span style={{fontSize:18}}>{m.icon}</span>
                  <span style={{fontSize:9, fontWeight:600, marginTop:1}}>{m.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Partner speaking */}
        {partnerSpeaking && (
          <div style={S.speakingBar}>
            <div style={S.speakingDots}>
              <span style={{...S.dot, animationDelay:'0s'}}/>
              <span style={{...S.dot, animationDelay:'0.2s'}}/>
              <span style={{...S.dot, animationDelay:'0.4s'}}/>
            </div>
            <span style={{fontSize:12}}>{partner?.name} sta parlando...</span>
          </div>
        )}

        {/* Text input bar */}
        <div style={{display:'flex', gap:6, padding:'6px 10px', flexShrink:0,
          background:'rgba(255,255,255,0.02)', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
          <input
            style={{flex:1, padding:'8px 12px', borderRadius:20, background:'rgba(255,255,255,0.06)',
              border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:14, outline:'none',
              fontFamily:FONT, boxSizing:'border-box'}}
            placeholder="Scrivi un messaggio..."
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage(); }}}
            disabled={sendingText}
          />
          <button onClick={sendTextMessage}
            style={{width:38, height:38, borderRadius:'50%', border:'none', flexShrink:0,
              background: textInput.trim() ? 'linear-gradient(135deg, #e94560, #c23152)' : 'rgba(255,255,255,0.06)',
              color: textInput.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
              fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              WebkitTapHighlightColor:'transparent', transition:'all 0.2s'}}>
            {sendingText ? '...' : '\u{27A4}'}
          </button>
        </div>

        {/* Messages */}
        <div style={S.chatArea}>
          {messages.length === 0 && (
            <div style={{textAlign:'center', color:'rgba(255,255,255,0.25)', marginTop:60, fontSize:13, lineHeight:1.6}}>
              Scrivi o parla per tradurre.{'\n'}
              {roomMode === 'freetalk'
                ? 'In Free Talk la traduzione avviene automaticamente.'
                : roomMode === 'classroom' && !isHost
                  ? `In ascolto di ${roomInfo?.host || 'Host'}.`
                  : 'Tocca il microfono per dettare.'}
            </div>
          )}
          {messages.map((m, i) => {
            const isMine = m.sender === prefs.name;
            return (
              <div key={m.id || i} style={{display:'flex', gap:8,
                flexDirection:isMine ? 'row-reverse' : 'row', marginBottom:12, alignItems:'flex-end'}}>
                {/* Avatar */}
                <div style={{fontSize:22, flexShrink:0, marginBottom:2}}>
                  {isMine ? prefs.avatar : '\u{1F464}'}
                </div>
                <div style={{maxWidth:'75%', display:'flex', flexDirection:'column',
                  alignItems:isMine ? 'flex-end' : 'flex-start'}}>
                  <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:3}}>
                    {isMine ? 'Tu' : m.sender}
                  </div>
                  <div style={{...S.bubble, ...(isMine ? S.bubbleMine : S.bubbleOther)}}>
                    <div style={{fontSize:14, fontWeight:500, lineHeight:1.5, color:'rgba(255,255,255,0.95)'}}>
                      {isMine ? m.original : m.translated}
                    </div>
                    <div style={{fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:4, lineHeight:1.4}}>
                      {isMine ? m.translated : m.original}
                    </div>
                  </div>
                  {/* Play - minimal */}
                  <button onClick={() => playMessage(m)}
                    style={{marginTop:2, padding:'2px 8px', borderRadius:8,
                      background:'transparent', border:'none', color:'rgba(255,255,255,0.35)',
                      fontSize:11, cursor:'pointer', WebkitTapHighlightColor:'transparent'}}>
                    {playingMsgId === m.id ? '\u{1F50A}' : '\u{25B6}\uFE0F'}
                  </button>
                </div>
              </div>
            );
          })}
          <div ref={msgsEndRef} />
        </div>

        {/* Talk bar - minimal, no text */}
        <div style={S.talkBar}>
          {status && <div style={{fontSize:11, color:'#e94560', marginBottom:4}}>{status}</div>}

          {(roomMode === 'conversation' || roomMode === 'classroom') && canTalk && (
            <button onClick={toggleRecording}
              style={{...S.talkBtn, ...(recording ? S.talkBtnRec : {})}}>
              {recording ? '\u{23F9}\uFE0F' : '\u{1F399}\uFE0F'}
            </button>
          )}

          {roomMode === 'classroom' && !canTalk && (
            <div style={{color:'rgba(255,255,255,0.25)', fontSize:11, padding:8}}>
              {'\u{1F512}'} Solo l{"'"}host parla
            </div>
          )}

          {roomMode === 'freetalk' && (
            <button onClick={() => isListening ? stopFreeTalk() : startFreeTalk()}
              style={{...S.talkBtn, ...(isListening ? S.talkBtnRec : {}),
                ...(recording ? {boxShadow:'0 0 0 8px rgba(233,69,96,0.15), 0 0 0 18px rgba(233,69,96,0.06)'} : {})}}>
              {isListening ? (recording ? '\u{1F534}' : '\u{1F7E2}') : '\u{1F399}\uFE0F'}
            </button>
          )}
        </div>

        <style>{`
          @keyframes vtPulse {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return null;
}

// ========================================
// STYLES - Premium, elegant, glassmorphism
// ========================================
const S = {
  page: { position:'fixed', top:0, left:0, right:0, bottom:0,
    background:'linear-gradient(145deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    color:'#fff', fontFamily:FONT, overflow:'hidden' },
  center: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    height:'100%', padding:'20px 16px', boxSizing:'border-box' },
  scrollCenter: { display:'flex', flexDirection:'column', alignItems:'center',
    height:'100%', padding:'20px 16px', boxSizing:'border-box',
    overflowY:'auto', WebkitOverflowScrolling:'touch' },
  title: { fontSize:26, fontWeight:700, letterSpacing:-0.5,
    background:'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #4facfe 100%)',
    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:4 },
  sub: { color:'rgba(255,255,255,0.45)', fontSize:13, marginBottom:20, letterSpacing:0.3 },
  card: { width:'100%', maxWidth:380, background:'rgba(255,255,255,0.06)', borderRadius:24,
    padding:'22px 20px', backdropFilter:'blur(24px)', border:'1px solid rgba(255,255,255,0.1)',
    boxShadow:'0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' },
  cardTitle: { fontSize:15, fontWeight:600, textAlign:'center', marginBottom:16,
    color:'rgba(255,255,255,0.75)', letterSpacing:-0.2 },
  field: { marginBottom:14 },
  label: { fontSize:10, fontWeight:600, letterSpacing:1, color:'rgba(255,255,255,0.35)', marginBottom:6,
    textTransform:'uppercase' },
  input: { width:'100%', padding:'12px 14px', borderRadius:14, background:'rgba(255,255,255,0.05)',
    border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, outline:'none',
    boxSizing:'border-box', fontFamily:FONT, transition:'border-color 0.2s' },
  select: { width:'100%', padding:'12px 14px', borderRadius:14, background:'rgba(255,255,255,0.05)',
    border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, outline:'none',
    boxSizing:'border-box', fontFamily:FONT },
  btn: { width:'100%', padding:'14px', borderRadius:16, border:'none',
    background:'linear-gradient(135deg, #f5576c, #e94560)', color:'#fff', fontSize:15, fontWeight:600,
    cursor:'pointer', textAlign:'center', fontFamily:FONT, letterSpacing:-0.2,
    boxShadow:'0 6px 20px rgba(233,69,96,0.35)', transition:'transform 0.1s',
    WebkitTapHighlightColor:'transparent' },
  bigBtn: { width:'100%', maxWidth:380, display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
    borderRadius:18, border:'none', color:'#fff', cursor:'pointer', marginBottom:10,
    background:'linear-gradient(135deg, #f5576c, #e94560)', textAlign:'left',
    boxShadow:'0 6px 24px rgba(233,69,96,0.3)', fontFamily:FONT,
    WebkitTapHighlightColor:'transparent' },
  settingsBtn: { marginTop:16, padding:'10px 24px', borderRadius:14, background:'rgba(255,255,255,0.04)',
    border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.45)', fontSize:13,
    cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
    backdropFilter:'blur(10px)' },
  avatarBtn: { width:42, height:42, borderRadius:14, border:'2px solid transparent',
    background:'rgba(255,255,255,0.04)', fontSize:22, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
    WebkitTapHighlightColor:'transparent', transition:'all 0.15s' },
  avatarSel: { borderColor:'#f5576c', background:'rgba(245,87,108,0.12)',
    boxShadow:'0 0 0 3px rgba(245,87,108,0.2)' },
  voiceBtn: { padding:'6px 14px', borderRadius:20, border:'1px solid rgba(255,255,255,0.08)',
    background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.45)', fontSize:12, cursor:'pointer',
    textTransform:'capitalize', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
    transition:'all 0.15s' },
  voiceSel: { borderColor:'#f5576c', background:'rgba(245,87,108,0.12)', color:'#fff' },
  toggle: { width:44, height:24, borderRadius:12, border:'none', padding:2, cursor:'pointer',
    display:'flex', alignItems:'center', transition:'background 0.2s',
    WebkitTapHighlightColor:'transparent' },
  toggleDot: { width:20, height:20, borderRadius:10, background:'#fff', transition:'transform 0.2s' },
  topBar: { display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:380, marginBottom:16, flexShrink:0 },
  backBtn: { width:38, height:38, borderRadius:14, background:'rgba(255,255,255,0.05)',
    border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:18, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT,
    WebkitTapHighlightColor:'transparent', backdropFilter:'blur(10px)' },
  shareBtn: { padding:'10px 24px', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)',
    background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', fontSize:13, cursor:'pointer',
    fontFamily:FONT, WebkitTapHighlightColor:'transparent', backdropFilter:'blur(10px)' },
  statusMsg: { marginTop:10, fontSize:12, color:'#f5576c', textAlign:'center' },
  // Mode buttons
  modeBtn: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
    padding:'10px 4px', borderRadius:16, border:'1px solid rgba(255,255,255,0.05)',
    background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.45)', cursor:'pointer',
    WebkitTapHighlightColor:'transparent', transition:'all 0.2s', backdropFilter:'blur(8px)' },
  modeBtnSel: { borderColor:'rgba(245,87,108,0.35)', background:'rgba(245,87,108,0.1)', color:'#fff',
    boxShadow:'0 4px 16px rgba(245,87,108,0.15)' },
  // Room
  roomPage: { display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, right:0, bottom:0,
    background:'linear-gradient(160deg, #0f0c29 0%, #1a1040 30%, #302b63 60%, #24243e 100%)',
    color:'#fff', fontFamily:FONT },
  roomHeader: { display:'flex', alignItems:'center', padding:'8px 12px', gap:6,
    background:'rgba(0,0,0,0.2)', borderBottom:'1px solid rgba(255,255,255,0.05)',
    flexShrink:0, backdropFilter:'blur(12px)' },
  backBtnSmall: { width:32, height:32, borderRadius:10, background:'transparent',
    border:'none', color:'rgba(255,255,255,0.6)', fontSize:16, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
    WebkitTapHighlightColor:'transparent' },
  iconBtn: { height:32, borderRadius:10, background:'rgba(255,255,255,0.04)',
    border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:14, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
    WebkitTapHighlightColor:'transparent' },
  speakingBar: { display:'flex', alignItems:'center', gap:8, padding:'5px 14px',
    background:'rgba(245,87,108,0.06)', borderBottom:'1px solid rgba(245,87,108,0.1)',
    color:'#f5576c', fontSize:12, flexShrink:0 },
  speakingDots: { display:'flex', gap:3, alignItems:'center' },
  dot: { width:5, height:5, borderRadius:'50%', background:'#f5576c',
    animation:'vtPulse 1.2s infinite ease-in-out', display:'inline-block' },
  chatArea: { flex:1, overflowY:'auto', padding:'14px 12px', minHeight:0, WebkitOverflowScrolling:'touch' },
  bubble: { padding:'12px 16px', borderRadius:18, position:'relative',
    backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.06)' },
  bubbleMine: { background:'rgba(245,87,108,0.1)', borderBottomRightRadius:6,
    boxShadow:'0 2px 12px rgba(245,87,108,0.08)' },
  bubbleOther: { background:'rgba(255,255,255,0.07)', borderBottomLeftRadius:6,
    boxShadow:'0 2px 12px rgba(0,0,0,0.15)' },
  talkBar: { flexShrink:0, padding:'8px 16px 16px', display:'flex', flexDirection:'column', alignItems:'center',
    background:'transparent' },
  talkBtn: { display:'flex', alignItems:'center', justifyContent:'center',
    width:60, height:60, borderRadius:'50%', border:'none',
    background:'transparent', color:'#fff', fontSize:28, cursor:'pointer', touchAction:'manipulation',
    WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
    filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' },
  talkBtnRec: { color:'#f5576c', fontSize:30,
    filter:'drop-shadow(0 0 12px rgba(245,87,108,0.4))' },
};
