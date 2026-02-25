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
const AVATARS = Array.from({length:14}, (_,i) => `/avatars/${i+1}.svg`);
const AVATAR_NAMES = ['Donna Pro','Uomo Baffi','Ragazza','Ragazzo','Donna Riccia','Nonno',
  'Gatto','Cane','Robot','Orso','Donna Rossa','Barba','Ragazza Rosa','Alieno'];

const MODES = [
  { id:'conversation', name:'Conversazione', icon:'\u{1F4AC}', desc:'Tocca per parlare, tocca per fermare' },
  { id:'classroom', name:'Classroom', icon:'\u{1F3EB}', desc:'Host parla, gli altri ascoltano' },
  { id:'freetalk', name:'Free Talk', icon:'\u{1F389}', desc:'Microfono aperto, traduzione automatica' },
];

const CONTEXTS = [
  { id:'general', icon:'\u{1F30D}', name:'Generale', desc:'Conversazione libera senza contesto specifico',
    prompt:'' },
  { id:'tourism', icon:'\u{1F3D6}\uFE0F', name:'Turismo', desc:'Viaggi, hotel, ristoranti, indicazioni, trasporti',
    prompt:'This is a tourism/travel conversation. Use travel terminology: directions, accommodation, sightseeing, transportation, restaurants, bookings. Keep translations practical and clear for travelers.' },
  { id:'medical', icon:'\u{1F3E5}', name:'Medicina', desc:'Sintomi, farmaci, visite mediche, emergenze',
    prompt:'This is a medical conversation. Use precise medical terminology: symptoms, medications, dosages, diagnoses, body parts, medical procedures. Accuracy is critical - never approximate medical terms.' },
  { id:'education', icon:'\u{1F393}', name:'Scuola', desc:'Lezioni, corsi, formazione, esami',
    prompt:'This is an educational conversation. Use academic terminology: courses, grades, assignments, lectures, exams, enrollment. Keep the tone educational and clear.' },
  { id:'business', icon:'\u{1F4BC}', name:'Business', desc:'Riunioni, contratti, negoziazioni, presentazioni',
    prompt:'This is a business conversation. Use professional/corporate terminology: contracts, negotiations, deadlines, KPIs, deliverables, stakeholders. Maintain formal register.' },
  { id:'restaurant', icon:'\u{1F37D}\uFE0F', name:'Ristorante', desc:'Ordini, menu, allergie, prenotazioni',
    prompt:'This is a restaurant/dining conversation. Use food and hospitality terminology: menu items, ingredients, allergies, dietary restrictions, cooking methods, reservations. Be precise about food terms.' },
  { id:'personal', icon:'\u{1F91D}', name:'Incontro', desc:'Presentazioni, conversazione informale, sociale',
    prompt:'This is an informal personal meeting. Use friendly, conversational tone. Translate idioms and colloquialisms naturally rather than literally. Preserve humor and warmth.' },
  { id:'legal', icon:'\u{2696}\uFE0F', name:'Legale', desc:'Documenti, consulenze, procedure, contratti',
    prompt:'This is a legal conversation. Use precise legal terminology: contracts, clauses, liability, compliance, jurisdiction, regulations. Never paraphrase legal terms - translate them exactly.' },
  { id:'shopping', icon:'\u{1F6CD}\uFE0F', name:'Shopping', desc:'Acquisti, prezzi, taglie, resi, pagamenti',
    prompt:'This is a shopping conversation. Use retail terminology: prices, sizes, colors, discounts, returns, payment methods, warranties. Be precise with numbers and measurements.' },
  { id:'realestate', icon:'\u{1F3E0}', name:'Immobiliare', desc:'Affitti, acquisti, visite, contratti',
    prompt:'This is a real estate conversation. Use property terminology: rent, lease, mortgage, square meters, rooms, amenities, neighborhood, deposits, inspections.' },
  { id:'tech', icon:'\u{1F527}', name:'Assistenza', desc:'Supporto tecnico, riparazioni, problemi',
    prompt:'This is a technical support conversation. Use technical terminology: troubleshooting, error codes, specifications, warranties, repairs, configurations. Be precise with technical terms.' },
  { id:'emergency', icon:'\u{1F6A8}', name:'Emergenza', desc:'Situazioni urgenti, polizia, pronto soccorso',
    prompt:'This is an EMERGENCY conversation. Translate with maximum clarity and urgency. Use direct, unambiguous language. Include emergency-specific terms: location, danger, injury, police, ambulance, fire. Speed and clarity are paramount.' },
];

const FONT = "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function getLang(code) { return LANGS.find(l => l.code === code) || LANGS[0]; }

export default function Home() {
  const [view, setView] = useState('loading');
  const [prefs, setPrefs] = useState({ name:'', lang:'it', avatar:AVATARS[0], voice:'nova', autoPlay:true });
  const [convHistory, setConvHistory] = useState([]);
  const [currentConv, setCurrentConv] = useState(null); // for viewing summary
  const [summaryLoading, setSummaryLoading] = useState(false);
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
  const [selectedContext, setSelectedContext] = useState('general');
  const [roomDescription, setRoomDescription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);

  // Account & Credits state
  const [userToken, setUserToken] = useState(null);
  const [userAccount, setUserAccount] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authStep, setAuthStep] = useState('email'); // email, code, choose
  const [authLoading, setAuthLoading] = useState(false);
  const [authTestCode, setAuthTestCode] = useState('');
  const [apiKeyInputs, setApiKeyInputs] = useState({ openai:'', anthropic:'', gemini:'' });
  const [useOwnKeys, setUseOwnKeys] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const userTokenRef = useRef(null);

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
  const roomContextRef = useRef({ contextId: 'general', contextPrompt: '', description: '' });
  const vadStreamRef = useRef(null);
  const vadRecRef = useRef(null);
  const vadTimerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const vadAnalyserRef = useRef(null);
  const persistentAudioRef = useRef(null); // persistent Audio element for auto-play
  const playedMsgIdsRef = useRef(new Set()); // track already-played messages
  const sentByMeRef = useRef(new Set()); // track message IDs sent by THIS client

  // Streaming translation refs
  const speechRecRef = useRef(null);
  const wordBufferRef = useRef(''); // words pending chunk emission
  const allWordsRef = useRef(''); // all finalized words so far
  const translatedChunksRef = useRef([]); // translated chunk strings
  const reviewTimerRef = useRef(null); // post-hoc review interval
  const streamingModeRef = useRef(false); // true when streaming active
  const chunkingActiveRef = useRef(false); // prevent concurrent emitChunk
  const lastInterimRef = useRef(''); // last interim text (safety net)
  const backupRecRef = useRef(null); // parallel MediaRecorder for Whisper fallback
  const backupChunksRef = useRef([]); // audio chunks from backup recorder
  const backupStreamRef = useRef(null); // mic stream for backup recorder
  const [streamingMsg, setStreamingMsg] = useState(null); // live streaming bubble
  const persistentMicRef = useRef(null); // persistent mic stream to avoid repeated permission prompts

  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  useEffect(() => { myLangRef.current = myLang; }, [myLang]);
  useEffect(() => { roomInfoRef.current = roomInfo; }, [roomInfo]);
  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);
  useEffect(() => { userTokenRef.current = userToken; }, [userToken]);

  // =============================================
  // MIC SYSTEM - Request permission once, reuse stream
  // =============================================

  async function getMicStream() {
    // Return existing stream if still active
    if (persistentMicRef.current) {
      const tracks = persistentMicRef.current.getTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') {
        return persistentMicRef.current;
      }
    }
    // Request new stream
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    persistentMicRef.current = stream;
    return stream;
  }

  // Request mic permission early on first user interaction
  function requestMicEarly() {
    if (persistentMicRef.current) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      persistentMicRef.current = stream;
      console.log('[Mic] Permission granted early');
    }).catch(() => {});
  }

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
    requestMicEarly(); // Also request mic permission on first interaction
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
      const savedToken = localStorage.getItem('vt-token');
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      const paymentStatus = urlParams.get('payment');
      const paymentCredits = urlParams.get('credits');

      if (saved) {
        const p = JSON.parse(saved);
        if (!p.avatar || !p.avatar.startsWith('/avatars/')) p.avatar = AVATARS[0];
        setPrefs(p);
        setMyLang(p.lang);
      }

      if (roomParam) setJoinCode(roomParam.toUpperCase());

      // Check for payment return
      if (paymentStatus === 'success' && paymentCredits) {
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (savedToken) {
        setUserToken(savedToken);
        userTokenRef.current = savedToken;
        // Verify session
        fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ action:'me', token:savedToken })
        }).then(r => r.json()).then(data => {
          if (data.user) {
            setUserAccount(data.user);
            setCreditBalance(data.user.credits || 0);
            setUseOwnKeys(data.user.useOwnKeys || false);
            if (!saved) { setView('welcome'); }
            else if (roomParam) { setView('join'); }
            else { setView('home'); }
          } else {
            // Token expired
            localStorage.removeItem('vt-token');
            setUserToken(null);
            if (!saved) setView('welcome');
            else if (roomParam) setView('join');
            else setView('home');
          }
        }).catch(() => {
          if (!saved) setView('welcome');
          else if (roomParam) setView('join');
          else setView('home');
        });
      } else {
        if (!saved) setView('welcome');
        else if (roomParam) setView('join');
        else setView('home');
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
      const ctxObj = CONTEXTS.find(c => c.id === selectedContext) || CONTEXTS[0];
      const res = await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'create', name:prefs.name, lang:myLang, mode:selectedMode, avatar:prefs.avatar,
          context: selectedContext, contextPrompt: ctxObj.prompt, description: roomDescription }) });
      if (!res.ok) throw new Error('Errore');
      const { room } = await res.json();
      roomContextRef.current = { contextId: selectedContext, contextPrompt: ctxObj.prompt, description: roomDescription };
      setRoomId(room.id); setRoomInfo(room); setMessages([]); setView('lobby');
      startPolling(room.id); setStatus('');
    } catch (e) { setStatus('Errore: ' + e.message); }
  }

  async function handleJoinRoom() {
    if (!joinCode.trim()) return;
    try {
      setStatus('Connessione...');
      const res = await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'join', roomId:joinCode.trim().toUpperCase(), name:prefs.name, lang:myLang, avatar:prefs.avatar }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Stanza non trovata'); }
      const { room } = await res.json();
      roomContextRef.current = {
        contextId: room.context || 'general',
        contextPrompt: room.contextPrompt || '',
        description: room.description || ''
      };
      setRoomId(room.id); setRoomInfo(room); setMessages([]); setView('room');
      startPolling(room.id); setStatus('');
    } catch (e) { setStatus('Errore: ' + e.message); }
  }

  function leaveRoom() {
    stopPolling(); stopFreeTalk();
    // Clean up streaming if active
    if (streamingModeRef.current) {
      streamingModeRef.current = false;
      if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} speechRecRef.current = null; }
      if (reviewTimerRef.current) { clearInterval(reviewTimerRef.current); reviewTimerRef.current = null; }
    }
    // Clean up backup recorder
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      try { backupRecRef.current.stop(); } catch {}
    }
    backupRecRef.current = null;
    if (backupStreamRef.current) {
      // Don't stop persistent mic tracks - they'll be reused
      backupStreamRef.current = null;
    }
    setStreamingMsg(null);
    // Stop persistent mic when leaving room
    if (persistentMicRef.current) {
      persistentMicRef.current.getTracks().forEach(t => t.stop());
      persistentMicRef.current = null;
    }
    setRoomId(null); setRoomInfo(null); setMessages([]); setPartnerSpeaking(false); setView('home');
  }

  // =============================================
  // RECORDING - TAP TO TALK with streaming translation
  // =============================================
  async function toggleRecording() {
    if (recording) {
      // STOP recording
      if (streamingModeRef.current) {
        stopStreamingTranslation();
      } else {
        stopClassicRecording();
      }
    } else {
      // START recording - use streaming by default
      startStreamingTranslation();
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
    if (roomId) form.append('roomId', roomId);
    if (roomContextRef.current.contextPrompt) form.append('domainContext', roomContextRef.current.contextPrompt);
    if (roomContextRef.current.description) form.append('description', roomContextRef.current.description);
    if (userTokenRef.current) form.append('userToken', userTokenRef.current);
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
  // STREAMING TRANSLATION - Word-based chunking
  // =============================================

  function getTargetLangInfo() {
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
    return { myL, otherL: getLang(otherLangCode) };
  }

  async function startStreamingTranslation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      startClassicRecording();
      return;
    }

    unlockAudio();
    setRecording(true);
    setStatus('');
    if (roomId) setSpeakingState(roomId, true);

    // Reset streaming state
    wordBufferRef.current = '';
    allWordsRef.current = '';
    lastInterimRef.current = '';
    translatedChunksRef.current = [];
    chunkingActiveRef.current = false;
    streamingModeRef.current = true;
    backupChunksRef.current = [];

    setStreamingMsg({ original: '', translated: '', isStreaming: true });

    // === 1) Start BACKUP MediaRecorder (always captures audio for Whisper fallback) ===
    try {
      const stream = await getMicStream();
      backupStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const backup = new MediaRecorder(stream, { mimeType: mime });
      backup.ondataavailable = e => { if (e.data.size > 0) backupChunksRef.current.push(e.data); };
      backupRecRef.current = backup;
      backup.start(250); // collect chunks every 250ms
      console.log('[Backup] MediaRecorder started alongside SpeechRecognition');
    } catch (e) {
      console.error('[Backup] MediaRecorder failed:', e);
      // If mic access fails entirely, abort
      setRecording(false);
      setStatus('Errore microfono');
      streamingModeRef.current = false;
      setStreamingMsg(null);
      return;
    }

    // === 2) Start SpeechRecognition for streaming chunks ===
    const recognition = new SpeechRecognition();
    recognition.lang = getLang(myLangRef.current).speech;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    speechRecRef.current = recognition;

    let lastFinalLength = 0;

    recognition.onresult = (event) => {
      let fullFinal = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          fullFinal += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Track interim text as safety net (in case isFinal never arrives)
      if (interimTranscript) {
        lastInterimRef.current = interimTranscript.trim();
      }

      // Detect NEW finalized text
      if (fullFinal.length > lastFinalLength) {
        const newText = fullFinal.substring(lastFinalLength).trim();
        lastFinalLength = fullFinal.length;

        if (newText) {
          lastInterimRef.current = ''; // clear interim since we got final
          wordBufferRef.current = (wordBufferRef.current + ' ' + newText).trim();
          allWordsRef.current = (allWordsRef.current + ' ' + newText).trim();

          setStreamingMsg(prev => prev ? { ...prev, original: allWordsRef.current } : null);

          const bufferWords = wordBufferRef.current.split(/\s+/).filter(w => w).length;
          if (bufferWords >= 4) {
            emitChunk();
          }
        }
      }

      // Show interim preview
      if (interimTranscript) {
        const preview = allWordsRef.current + ' ' + interimTranscript.trim();
        setStreamingMsg(prev => prev ? { ...prev, original: preview } : null);

        const totalPending = (wordBufferRef.current + ' ' + interimTranscript.trim()).trim();
        const pendingWordCount = totalPending.split(/\s+/).filter(w => w).length;
        if (pendingWordCount >= 12 && wordBufferRef.current.trim()) {
          emitChunk();
        }
      }
    };

    recognition.onerror = (e) => {
      console.log('[StreamRec] Error:', e.error);
    };

    recognition.onend = () => {
      if (streamingModeRef.current) {
        try { recognition.start(); } catch (err) {
          console.log('[StreamRec] Restart failed:', err);
        }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('[StreamRec] Start failed:', e);
      // SpeechRecognition failed to start - backup recorder is still running
    }

    // Start post-hoc review timer (every 12 seconds)
    reviewTimerRef.current = setInterval(() => {
      postHocReview();
    }, 12000);
  }

  async function emitChunk() {
    const chunk = wordBufferRef.current.trim();
    if (!chunk || chunkingActiveRef.current) return;
    wordBufferRef.current = '';
    chunkingActiveRef.current = true;

    const { myL, otherL } = getTargetLangInfo();

    try {
      // Build context from previous chunks for continuity
      const prevContext = translatedChunksRef.current.slice(-2).join(' ');

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunk,
          sourceLang: myL.code,
          targetLang: otherL.code,
          sourceLangName: myL.name,
          targetLangName: otherL.name,
          roomId,
          context: prevContext || undefined,
          domainContext: roomContextRef.current.contextPrompt || undefined,
          description: roomContextRef.current.description || undefined,
          userToken: userTokenRef.current || undefined
        })
      });

      if (res.ok) {
        const { translated } = await res.json();
        if (translated) {
          translatedChunksRef.current.push(translated);
          const fullTranslation = translatedChunksRef.current.join(' ');
          setStreamingMsg(prev => prev ? { ...prev, translated: fullTranslation } : null);
        }
      }
    } catch (e) {
      console.error('[Chunk] Translation error:', e);
    }
    chunkingActiveRef.current = false;

    // If more words accumulated while we were translating, emit again
    if (wordBufferRef.current.trim()) {
      const bufferWords = wordBufferRef.current.split(/\s+/).filter(w => w).length;
      if (bufferWords >= 4) emitChunk();
    }
  }

  async function postHocReview() {
    const allOriginal = allWordsRef.current.trim();
    if (!allOriginal) return;
    const wordCount = allOriginal.split(/\s+/).filter(w => w).length;
    if (wordCount < 10) return; // Not enough for meaningful review

    // Review last ~25 words
    const words = allOriginal.split(/\s+/).filter(w => w);
    const reviewText = words.slice(-25).join(' ');
    const { myL, otherL } = getTargetLangInfo();

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: reviewText,
          sourceLang: myL.code,
          targetLang: otherL.code,
          sourceLangName: myL.name,
          targetLangName: otherL.name,
          roomId,
          isReview: true,
          domainContext: roomContextRef.current.contextPrompt || undefined,
          description: roomContextRef.current.description || undefined,
          userToken: userTokenRef.current || undefined
        })
      });

      if (res.ok) {
        const { translated } = await res.json();
        if (translated && translatedChunksRef.current.length > 0) {
          // Figure out how many chunks correspond to the reviewed words
          // Heuristic: each chunk was ~6-10 words, so review of ~25 words = last 3-4 chunks
          const reviewWordCount = reviewText.split(/\s+/).length;
          const avgWordsPerChunk = Math.max(1, wordCount / translatedChunksRef.current.length);
          const chunksToReplace = Math.min(
            translatedChunksRef.current.length,
            Math.ceil(reviewWordCount / avgWordsPerChunk)
          );
          const keptChunks = translatedChunksRef.current.slice(0, -chunksToReplace);
          translatedChunksRef.current = [...keptChunks, translated];
          const fullTranslation = translatedChunksRef.current.join(' ');
          setStreamingMsg(prev => prev ? { ...prev, translated: fullTranslation } : null);
          console.log('[Review] Updated last', chunksToReplace, 'chunks with coherent translation');
        }
      }
    } catch (e) {
      console.error('[Review] Error:', e);
    }
  }

  async function stopStreamingTranslation() {
    streamingModeRef.current = false;
    setRecording(false);
    if (roomId) setSpeakingState(roomId, false);

    // Stop SpeechRecognition
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch {}
      speechRecRef.current = null;
    }

    // Stop review timer
    if (reviewTimerRef.current) {
      clearInterval(reviewTimerRef.current);
      reviewTimerRef.current = null;
    }

    // Stop backup MediaRecorder and get the audio blob
    let backupBlob = null;
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      await new Promise(resolve => {
        backupRecRef.current.onstop = () => resolve();
        backupRecRef.current.stop();
      });
      if (backupChunksRef.current.length > 0) {
        backupBlob = new Blob(backupChunksRef.current, { type: backupRecRef.current.mimeType });
      }
    }
    backupRecRef.current = null;
    // Stop backup mic stream
    if (backupStreamRef.current) {
      // Don't stop persistent mic tracks - they'll be reused
      backupStreamRef.current = null;
    }

    // Include any pending interim text that never got finalized
    if (lastInterimRef.current && !allWordsRef.current.includes(lastInterimRef.current)) {
      wordBufferRef.current = (wordBufferRef.current + ' ' + lastInterimRef.current).trim();
      allWordsRef.current = (allWordsRef.current + ' ' + lastInterimRef.current).trim();
    }

    // Emit any remaining buffered words
    if (wordBufferRef.current.trim()) {
      await emitChunk();
    }

    const allOriginal = allWordsRef.current.trim();

    // === FALLBACK: If SpeechRecognition captured nothing, use Whisper with backup audio ===
    if (!allOriginal && backupBlob && backupBlob.size > 1000) {
      console.log('[Fallback] SpeechRecognition empty, using Whisper with backup audio (' + backupBlob.size + ' bytes)');
      setStatus('Traduzione...');
      setStreamingMsg(null);
      try {
        await processAndSendAudio(backupBlob);
      } catch (err) {
        console.error('[Fallback] Whisper error:', err);
        setStatus('Errore: ' + err.message);
      }
      setStatus('');
      return;
    }

    // If still nothing (very short tap, no audio)
    if (!allOriginal) {
      setStreamingMsg(null);
      setStatus('');
      return;
    }

    // === STREAMING PATH: SpeechRecognition captured text, do final review ===
    setStatus('Revisione finale...');

    const { myL, otherL } = getTargetLangInfo();
    let finalTranslation = translatedChunksRef.current.join(' ');

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: allOriginal,
          sourceLang: myL.code,
          targetLang: otherL.code,
          sourceLangName: myL.name,
          targetLangName: otherL.name,
          roomId,
          isReview: true,
          domainContext: roomContextRef.current.contextPrompt || undefined,
          description: roomContextRef.current.description || undefined,
          userToken: userTokenRef.current || undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translated) finalTranslation = data.translated;
      }
    } catch (e) {
      console.error('[Final] Translation error:', e);
    }

    // If streaming chunks failed but we have original text, use Whisper as last resort
    if (!finalTranslation && backupBlob && backupBlob.size > 1000) {
      console.log('[Fallback] Chunk translations empty, using Whisper');
      setStreamingMsg(null);
      try {
        await processAndSendAudio(backupBlob);
      } catch (err) {
        console.error('[Fallback] Whisper error:', err);
      }
      setStatus('');
      return;
    }

    // Save as permanent message
    if (finalTranslation && roomId) {
      try {
        const msgRes = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            sender: prefsRef.current.name,
            original: allOriginal,
            translated: finalTranslation,
            sourceLang: myL.code,
            targetLang: otherL.code
          })
        });
        try {
          const msgData = await msgRes.json();
          if (msgData.message?.id) sentByMeRef.current.add(msgData.message.id);
        } catch {}
      } catch (e) {
        console.error('[Final] Message save error:', e);
      }
    }

    setStreamingMsg(null);
    setStatus('');
  }

  // Classic recording fallback (for browsers without SpeechRecognition)
  async function startClassicRecording() {
    unlockAudio();
    setRecording(true);
    setStatus('Parla ora...');
    if (roomId) setSpeakingState(roomId, true);
    chunksRef.current = [];
    try {
      const stream = await getMicStream();
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      recRef.current = new MediaRecorder(stream, { mimeType: mime });
      recRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recRef.current.onstop = async () => {
        // Don't stop persistent mic tracks - stream stays alive for reuse
        const blob = new Blob(chunksRef.current, { type: recRef.current.mimeType });
        if (blob.size < 1000) { setRecording(false); setStatus(''); return; }
        try { await processAndSendAudio(blob); }
        catch (err) { setStatus('Errore: ' + err.message); }
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

  function stopClassicRecording() {
    if (recRef.current && recRef.current.state === 'recording') {
      setStatus('Traduzione...');
      if (roomId) setSpeakingState(roomId, false);
      recRef.current.stop();
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
          sourceLangName:myL.name, targetLangName:otherL.name, roomId,
          domainContext: roomContextRef.current.contextPrompt || undefined,
          description: roomContextRef.current.description || undefined,
          userToken: userTokenRef.current || undefined }) });
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
  // FREE TALK (VAD) - now with streaming translation
  // =============================================
  async function startFreeTalk() {
    if (isListening) return;
    unlockAudio();

    // Check SpeechRecognition availability
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    try {
      const stream = await getMicStream();
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
      const threshold = 25, silenceDelay = 2000; // slightly longer for streaming

      // If SpeechRecognition available, use streaming mode for free talk
      if (SpeechRecognition) {
        wordBufferRef.current = '';
        allWordsRef.current = '';
        translatedChunksRef.current = [];
        streamingModeRef.current = true;
        chunkingActiveRef.current = false;

        const recognition = new SpeechRecognition();
        recognition.lang = getLang(myLangRef.current).speech;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;
        speechRecRef.current = recognition;

        let lastFinalLength = 0;

        recognition.onresult = (event) => {
          let fullFinal = '';
          let interimTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) fullFinal += event.results[i][0].transcript;
            else interimTranscript += event.results[i][0].transcript;
          }

          if (fullFinal.length > lastFinalLength) {
            const newText = fullFinal.substring(lastFinalLength).trim();
            lastFinalLength = fullFinal.length;
            if (newText) {
              wordBufferRef.current = (wordBufferRef.current + ' ' + newText).trim();
              allWordsRef.current = (allWordsRef.current + ' ' + newText).trim();
              setStreamingMsg(prev => prev ? { ...prev, original: allWordsRef.current } : null);
              const bufferWords = wordBufferRef.current.split(/\s+/).filter(w => w).length;
              if (bufferWords >= 4) emitChunk();
            }
          }
          if (interimTranscript) {
            const preview = allWordsRef.current + ' ' + interimTranscript.trim();
            setStreamingMsg(prev => prev ? { ...prev, original: preview } : null);
            const totalPending = (wordBufferRef.current + ' ' + interimTranscript.trim()).trim();
            if (totalPending.split(/\s+/).filter(w => w).length >= 12 && wordBufferRef.current.trim()) emitChunk();
          }
        };
        recognition.onerror = (e) => { console.log('[FreeTalkRec] Error:', e.error); };
        recognition.onend = () => {
          if (streamingModeRef.current && isListening) {
            try { recognition.start(); } catch {}
          }
        };
        recognition.start();

        // Post-hoc review timer
        reviewTimerRef.current = setInterval(() => postHocReview(), 12000);
      }

      // VAD loop - controls recording state indicator, and classic fallback
      function check() {
        if (!vadAnalyserRef.current) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a,b) => a+b, 0) / data.length;

        if (avg > threshold && !isRec) {
          isRec = true;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }

          // For streaming mode, just show recording state + init streaming msg
          if (SpeechRecognition) {
            if (!streamingMsg) setStreamingMsg({ original: '', translated: '', isStreaming: true });
            setRecording(true);
            if (roomId) setSpeakingState(roomId, true);
          } else {
            // Classic fallback with MediaRecorder
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
          }
        } else if (avg <= threshold && isRec) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(async () => {
              if (SpeechRecognition) {
                // In streaming mode, silence = finalize current segment
                isRec = false;
                setRecording(false);
                if (roomId) setSpeakingState(roomId, false);
                // Emit remaining buffer
                if (wordBufferRef.current.trim()) await emitChunk();
                // Finalize the streaming message after a longer pause
                // (We DON'T stop recognition - it keeps listening for next utterance)
                // But we do save the current message if there's content
                const allOriginal = allWordsRef.current.trim();
                if (allOriginal && translatedChunksRef.current.length > 0) {
                  const { myL, otherL } = getTargetLangInfo();
                  const finalTranslation = translatedChunksRef.current.join(' ');
                  try {
                    const msgRes = await fetch('/api/messages', {
                      method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify({ roomId, sender: prefsRef.current.name, original: allOriginal,
                        translated: finalTranslation, sourceLang: myL.code, targetLang: otherL.code })
                    });
                    try { const d = await msgRes.json(); if (d.message?.id) sentByMeRef.current.add(d.message.id); } catch {}
                  } catch {}
                  // Reset for next utterance
                  wordBufferRef.current = '';
                  allWordsRef.current = '';
                  translatedChunksRef.current = [];
                  setStreamingMsg({ original: '', translated: '', isStreaming: true });
                }
              } else {
                if (vadRecRef.current?.state === 'recording') vadRecRef.current.stop();
                isRec = false; setRecording(false);
                if (roomId) setSpeakingState(roomId, false);
              }
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
    // Don't stop persistent mic tracks when stopping free talk
    vadStreamRef.current = null;
    vadAnalyserRef.current = null;
    // Clean up streaming in freetalk
    if (streamingModeRef.current) {
      streamingModeRef.current = false;
      if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} speechRecRef.current = null; }
      if (reviewTimerRef.current) { clearInterval(reviewTimerRef.current); reviewTimerRef.current = null; }
      setStreamingMsg(null);
    }
  }

  useEffect(() => () => {
    stopFreeTalk();
    streamingModeRef.current = false;
    if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} }
    if (reviewTimerRef.current) clearInterval(reviewTimerRef.current);
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      try { backupRecRef.current.stop(); } catch {}
    }
    if (backupStreamRef.current) {
      // Don't stop persistent mic tracks - they'll be reused
    }
  }, []);

  // Share
  function shareRoom() {
    const url = `${window.location.origin}?room=${roomId}`;
    if (navigator.share) navigator.share({ title:'VoiceTranslate', text:`Entra: ${roomId}`, url });
    else { navigator.clipboard.writeText(url); setStatus('Link copiato!'); setTimeout(() => setStatus(''), 2000); }
  }

  const qrUrl = roomId ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${typeof window!=='undefined'?window.location.origin:''}?room=${roomId}`)}` : '';

  // Avatar image component - validates src is a valid image path
  function AvatarImg({ src, size = 36, style = {} }) {
    const validSrc = (src && src.startsWith('/avatars/')) ? src : AVATARS[0];
    return <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0, overflow:'hidden',
      background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center',
      ...style
    }}>
      <img src={validSrc} alt="" style={{
        width: size * 0.95, height: size * 0.95, objectFit:'contain'
      }} />
    </div>;
  }

  // =============================================
  // CONVERSATION HISTORY & SUMMARY
  // =============================================

  async function loadHistory() {
    if (!prefs.name) return;
    try {
      const res = await fetch('/api/conversation', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'list', userName:prefs.name })
      });
      if (res.ok) {
        const { conversations } = await res.json();
        setConvHistory(conversations || []);
      }
    } catch (e) { console.error('History error:', e); }
  }

  async function endChatAndSave() {
    if (!roomId) return;
    stopPolling(); stopFreeTalk();
    // Clean up streaming
    if (streamingModeRef.current) {
      streamingModeRef.current = false;
      if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} speechRecRef.current = null; }
      if (reviewTimerRef.current) { clearInterval(reviewTimerRef.current); reviewTimerRef.current = null; }
    }
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      try { backupRecRef.current.stop(); } catch {}
    }
    backupRecRef.current = null;
    if (backupStreamRef.current) {
      // Don't stop persistent mic tracks - they'll be reused
      backupStreamRef.current = null;
    }
    setStreamingMsg(null);
    setStatus('Salvataggio conversazione...');

    try {
      // Save conversation
      const res = await fetch('/api/conversation', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'end', roomId })
      });
      if (res.ok) {
        const { conversation } = await res.json();
        const isHost = roomInfo?.host === prefs.name;
        if (isHost && conversation) {
          // Generate AI summary for host
          setStatus('Generazione report AI...');
          setSummaryLoading(true);
          try {
            const sumRes = await fetch('/api/summary', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ convId: roomId })
            });
            if (sumRes.ok) {
              const { summary } = await sumRes.json();
              conversation.summary = summary;
            }
          } catch (e) { console.error('Summary error:', e); }
          setSummaryLoading(false);
          setCurrentConv(conversation);
          setView('summary');
        } else {
          // Non-host: show the conversation in read-only view
          setCurrentConv(conversation);
          setView('summary');
        }
      } else {
        setView('home');
      }
    } catch (e) {
      console.error('End chat error:', e);
      setView('home');
    }
    setRoomId(null); setRoomInfo(null); setMessages([]);
    setPartnerSpeaking(false); setStatus('');
  }

  async function viewConversation(convId) {
    setStatus('Caricamento...');
    try {
      const res = await fetch(`/api/conversation?id=${convId}`);
      if (res.ok) {
        const { conversation } = await res.json();
        if (conversation) {
          // If host and no summary yet, generate it
          if (conversation.host === prefs.name && !conversation.summary) {
            setSummaryLoading(true);
            try {
              const sumRes = await fetch('/api/summary', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ convId })
              });
              if (sumRes.ok) {
                const { summary } = await sumRes.json();
                conversation.summary = summary;
              }
            } catch {}
            setSummaryLoading(false);
          }
          setCurrentConv(conversation);
          setView('summary');
        }
      }
    } catch (e) { console.error('View conv error:', e); }
    setStatus('');
  }

  function shareSummary() {
    if (!currentConv?.summary) return;
    const s = currentConv.summary;
    const text = `${s.title || 'Conversazione'}\n\n${s.summary || ''}\n\n` +
      (s.keyPoints?.length ? 'Punti chiave:\n' + s.keyPoints.map(p => `• ${p}`).join('\n') + '\n\n' : '') +
      `Partecipanti: ${s.participants || ''}\nDurata: ${s.duration || ''}\nMessaggi: ${s.messageCount || 0}`;

    if (navigator.share) {
      navigator.share({ title: s.title || 'Report Conversazione', text });
    } else {
      navigator.clipboard.writeText(text);
      setStatus('Report copiato!');
      setTimeout(() => setStatus(''), 2000);
    }
  }

  // =============================================
  // AUTH & CREDITS FUNCTIONS
  // =============================================

  async function sendAuthCode() {
    if (!authEmail.trim() || !authEmail.includes('@')) { setStatus('Email non valida'); return; }
    setAuthLoading(true); setStatus('');
    try {
      const res = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'send-code', email:authEmail.trim() }) });
      const data = await res.json();
      if (data.ok) {
        setAuthStep('code');
        if (data.testCode) setAuthTestCode(data.testCode);
        setStatus('');
      } else { setStatus(data.error || 'Errore invio codice'); }
    } catch (e) { setStatus('Errore: ' + e.message); }
    setAuthLoading(false);
  }

  async function verifyAuthCodeFn() {
    if (!authCode.trim()) return;
    setAuthLoading(true); setStatus('');
    try {
      const res = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'verify', email:authEmail.trim(), code:authCode.trim(),
          name:prefs.name, lang:prefs.lang, avatar:prefs.avatar }) });
      const data = await res.json();
      if (data.ok && data.token) {
        setUserToken(data.token);
        userTokenRef.current = data.token;
        localStorage.setItem('vt-token', data.token);
        setUserAccount(data.user);
        setCreditBalance(data.user.credits || 0);
        setUseOwnKeys(data.user.useOwnKeys || false);
        setAuthStep('choose');
        setStatus('');
      } else { setStatus(data.error || 'Codice non valido'); }
    } catch (e) { setStatus('Errore: ' + e.message); }
    setAuthLoading(false);
  }

  async function refreshBalance() {
    const token = userTokenRef.current;
    if (!token) return;
    try {
      const res = await fetch('/api/user', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'credits', token }) });
      const data = await res.json();
      if (data.credits !== undefined) {
        setCreditBalance(data.credits);
        setUseOwnKeys(data.useOwnKeys || false);
      }
    } catch {}
  }

  async function buyCredits(packageId) {
    const token = userTokenRef.current;
    if (!token) { setStatus('Devi accedere prima'); return; }
    setAuthLoading(true); setStatus('');
    try {
      const res = await fetch('/api/stripe', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'checkout', packageId, token }) });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else { setStatus(data.error || 'Errore creazione pagamento'); }
    } catch (e) { setStatus('Errore: ' + e.message); }
    setAuthLoading(false);
  }

  async function saveUserApiKeys() {
    const token = userTokenRef.current;
    if (!token) return;
    setAuthLoading(true); setStatus('');
    try {
      const res = await fetch('/api/user', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'save-keys', token, apiKeys:apiKeyInputs, useOwnKeys:true }) });
      const data = await res.json();
      if (data.ok) {
        setUseOwnKeys(true);
        setStatus('Chiavi API salvate!');
        setTimeout(() => { setStatus(''); setView('home'); }, 1000);
      } else { setStatus(data.error || 'Errore salvataggio'); }
    } catch (e) { setStatus('Errore: ' + e.message); }
    setAuthLoading(false);
  }

  async function switchToCredits() {
    const token = userTokenRef.current;
    if (!token) return;
    try {
      await fetch('/api/user', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'save-keys', token, apiKeys:{}, useOwnKeys:false }) });
      setUseOwnKeys(false);
    } catch {}
  }

  function logout() {
    localStorage.removeItem('vt-token');
    setUserToken(null);
    setUserAccount(null);
    setCreditBalance(0);
    setView('home');
  }

  const CREDIT_PACKAGES = [
    { id:'pack_2', euros:2, credits:200, label:'\u20AC2', messages:'~400 msg' },
    { id:'pack_5', euros:5, credits:550, label:'\u20AC5', messages:'~1100 msg', bonus:'+10%' },
    { id:'pack_10', euros:10, credits:1200, label:'\u20AC10', messages:'~2400 msg', bonus:'+20%' },
    { id:'pack_20', euros:20, credits:2600, label:'\u20AC20', messages:'~5200 msg', bonus:'+30%' },
  ];

  function formatCredits(cents) {
    return '\u20AC' + (cents / 100).toFixed(2);
  }

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
              {AVATARS.map((a,i) => (
                <button key={a} onClick={() => setPrefs({...prefs, avatar:a})}
                  style={{...S.avatarBtn, ...(prefs.avatar===a ? S.avatarSel : {}), padding:2}}>
                  <img src={a} alt={AVATAR_NAMES[i]} style={{width:38, height:38, objectFit:'contain'}} />
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
            onClick={() => {
              savePrefs(prefs);
              if (joinCode) { setView('join'); }
              else if (userToken) { setView('home'); }
              else { setAuthStep('email'); setView('account'); }
            }}>
            Iniziamo
          </button>
          {!joinCode && (
            <button style={{marginTop:10, background:'none', border:'none', color:'rgba(255,255,255,0.35)',
              fontSize:12, cursor:'pointer', fontFamily:FONT, padding:8}}
              onClick={() => { savePrefs(prefs); setView('home'); }}>
              Continua senza account (ospite)
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // --- ACCOUNT SETUP ---
  if (view === 'account') return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={{fontSize:42, marginBottom:8}}>{authStep === 'choose' ? '\u2705' : '\u{1F512}'}</div>
        <div style={S.title}>Account</div>
        <div style={S.sub}>{authStep === 'choose' ? 'Accesso effettuato!' : 'Accedi per creare stanze e tradurre'}</div>

        {authStep === 'email' && (
          <div style={S.card}>
            <div style={S.cardTitle}>Accedi al tuo account</div>

            {/* Email magic code */}
            <div style={S.field}>
              <div style={S.label}>Email</div>
              <input style={S.input} type="email" placeholder="tua@email.com" value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendAuthCode()} />
            </div>
            <button style={{...S.btn, marginTop:8, opacity:authLoading?0.5:1}}
              disabled={authLoading} onClick={sendAuthCode}>
              {authLoading ? 'Invio...' : 'Accedi con codice email'}
            </button>

            <div style={{display:'flex', alignItems:'center', gap:12, margin:'16px 0'}}>
              <div style={{flex:1, height:1, background:'rgba(255,255,255,0.08)'}} />
              <div style={{fontSize:11, color:'rgba(255,255,255,0.25)'}}>oppure</div>
              <div style={{flex:1, height:1, background:'rgba(255,255,255,0.08)'}} />
            </div>

            {/* Google Sign-In */}
            <button style={{width:'100%', padding:'12px 16px', borderRadius:14, border:'1px solid rgba(255,255,255,0.1)',
              background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:14, cursor:'pointer',
              fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              WebkitTapHighlightColor:'transparent', marginBottom:8}}
              onClick={() => {
                setStatus('Google Sign-In richiede configurazione OAuth. Usa email per ora.');
                setTimeout(() => setStatus(''), 3000);
              }}>
              <span style={{fontSize:18}}>G</span>
              <span>Accedi con Google</span>
            </button>

            {/* Apple Sign-In */}
            <button style={{width:'100%', padding:'12px 16px', borderRadius:14, border:'1px solid rgba(255,255,255,0.1)',
              background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:14, cursor:'pointer',
              fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => {
                setStatus('Apple Sign-In richiede Apple Developer Account. Usa email per ora.');
                setTimeout(() => setStatus(''), 3000);
              }}>
              <span style={{fontSize:18}}>{'\uF8FF'}</span>
              <span>Accedi con Apple</span>
            </button>

            <div style={{fontSize:10, color:'rgba(255,255,255,0.2)', textAlign:'center', marginTop:12}}>
              Nessuna password richiesta
            </div>
          </div>
        )}

        {authStep === 'code' && (
          <div style={S.card}>
            <div style={S.cardTitle}>Inserisci il codice</div>
            <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', textAlign:'center', marginBottom:12}}>
              Inviato a {authEmail}
            </div>
            {authTestCode && (
              <div style={{fontSize:13, color:'#f5576c', textAlign:'center', marginBottom:12,
                padding:'8px 12px', background:'rgba(245,87,108,0.1)', borderRadius:12}}>
                Codice di test: <strong>{authTestCode}</strong>
              </div>
            )}
            <div style={S.field}>
              <input style={{...S.input, fontSize:24, textAlign:'center', letterSpacing:8}}
                placeholder="000000" value={authCode} maxLength={6}
                onChange={e => setAuthCode(e.target.value.replace(/\D/g,''))}
                onKeyDown={e => e.key === 'Enter' && verifyAuthCodeFn()} />
            </div>
            <button style={{...S.btn, marginTop:8, opacity:authLoading?0.5:1}}
              disabled={authLoading} onClick={verifyAuthCodeFn}>
              {authLoading ? 'Verifica...' : 'Verifica'}
            </button>
            <button style={{marginTop:10, background:'none', border:'none', color:'rgba(255,255,255,0.35)',
              fontSize:12, cursor:'pointer', fontFamily:FONT, padding:8, width:'100%', textAlign:'center'}}
              onClick={() => { setAuthStep('email'); setAuthCode(''); setAuthTestCode(''); }}>
              Cambia email
            </button>
          </div>
        )}

        {authStep === 'choose' && (
          <div style={{width:'100%', maxWidth:380}}>
            <div style={S.card}>
              <div style={S.cardTitle}>Come vuoi tradurre?</div>

              <button style={{...S.bigBtn, marginBottom:10, background:'linear-gradient(135deg, #f5576c, #e94560)'}}
                onClick={() => setView('credits')}>
                <div style={{width:44, height:44, borderRadius:14, background:'rgba(255,255,255,0.15)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>{'\u{1F4B3}'}</div>
                <div>
                  <div style={{fontWeight:600, fontSize:15}}>Compra crediti</div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.7)', marginTop:1}}>
                    Paga solo quando usi - da \u20AC2
                  </div>
                </div>
              </button>

              <button style={{...S.bigBtn, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)'}}
                onClick={() => setView('apikeys')}>
                <div style={{width:44, height:44, borderRadius:14, background:'rgba(255,255,255,0.08)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0}}>{'\u{1F511}'}</div>
                <div>
                  <div style={{fontWeight:600, fontSize:15}}>Usa le tue API key</div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:1}}>
                    OpenAI, Anthropic o Gemini
                  </div>
                </div>
              </button>
            </div>

            <button style={{marginTop:16, background:'none', border:'none', color:'rgba(255,255,255,0.35)',
              fontSize:13, cursor:'pointer', fontFamily:FONT, padding:10, width:'100%', textAlign:'center'}}
              onClick={() => setView('home')}>
              Scegli dopo
            </button>
          </div>
        )}

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );

  // --- CREDITS / BUY ---
  if (view === 'credits') return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView(userAccount ? 'home' : 'account')}>{'\u2190'}</button>
          <span style={{fontWeight:600, fontSize:17}}>Ricarica Crediti</span>
        </div>

        {creditBalance > 0 && (
          <div style={{width:'100%', maxWidth:380, marginBottom:16, padding:'14px 18px', borderRadius:18,
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)',
            textAlign:'center'}}>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4}}>SALDO ATTUALE</div>
            <div style={{fontSize:28, fontWeight:700, color:'#4facfe'}}>{formatCredits(creditBalance)}</div>
          </div>
        )}

        <div style={{width:'100%', maxWidth:380}}>
          {CREDIT_PACKAGES.map(pkg => (
            <button key={pkg.id} onClick={() => buyCredits(pkg.id)}
              style={{width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'16px 18px', marginBottom:10, borderRadius:18,
                background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)',
                color:'#fff', cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                transition:'all 0.15s'}}>
              <div style={{textAlign:'left'}}>
                <div style={{fontSize:22, fontWeight:700}}>{pkg.label}</div>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:2}}>
                  {pkg.messages}
                </div>
              </div>
              {pkg.bonus && (
                <div style={{padding:'4px 10px', borderRadius:10, background:'rgba(79,172,254,0.15)',
                  color:'#4facfe', fontSize:12, fontWeight:600}}>
                  {pkg.bonus}
                </div>
              )}
            </button>
          ))}
        </div>

        <div style={{width:'100%', maxWidth:380, marginTop:12, padding:'12px 16px', borderRadius:14,
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)'}}>
          <div style={{fontSize:11, color:'rgba(255,255,255,0.35)', lineHeight:1.6}}>
            {'\u{1F4B3}'} Pagamento sicuro via Stripe (Visa, Mastercard, Apple Pay, Google Pay)
          </div>
        </div>

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );

  // --- API KEYS ---
  if (view === 'apikeys') return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView(userAccount ? 'home' : 'account')}>{'\u2190'}</button>
          <span style={{fontWeight:600, fontSize:17}}>Le tue API Key</span>
        </div>
        <div style={S.card}>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16, lineHeight:1.5}}>
            Inserisci le tue chiavi API per tradurre senza limiti di credito. Serve almeno una chiave OpenAI.
          </div>
          <div style={S.field}>
            <div style={S.label}>OpenAI (obbligatorio)</div>
            <input style={S.input} placeholder="sk-proj-..." value={apiKeyInputs.openai}
              onChange={e => setApiKeyInputs({...apiKeyInputs, openai:e.target.value})} />
          </div>
          <div style={S.field}>
            <div style={S.label}>Anthropic (opzionale)</div>
            <input style={S.input} placeholder="sk-ant-..." value={apiKeyInputs.anthropic}
              onChange={e => setApiKeyInputs({...apiKeyInputs, anthropic:e.target.value})} />
          </div>
          <div style={S.field}>
            <div style={S.label}>Google Gemini (opzionale)</div>
            <input style={S.input} placeholder="AIza..." value={apiKeyInputs.gemini}
              onChange={e => setApiKeyInputs({...apiKeyInputs, gemini:e.target.value})} />
          </div>
          <button style={{...S.btn, marginTop:8, opacity:apiKeyInputs.openai.trim()?1:0.4}}
            disabled={!apiKeyInputs.openai.trim() || authLoading}
            onClick={saveUserApiKeys}>
            {authLoading ? 'Salvataggio...' : 'Salva e Usa le mie Key'}
          </button>
        </div>
        {status && <div style={S.statusMsg}>{status}</div>}
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
              {AVATARS.map((a,i) => (
                <button key={a} onClick={() => setPrefs({...prefs, avatar:a})}
                  style={{...S.avatarBtn, ...(prefs.avatar===a ? S.avatarSel : {}), padding:2}}>
                  <img src={a} alt={AVATAR_NAMES[i]} style={{width:38, height:38, objectFit:'contain'}} />
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
          {userToken && (
            <div style={{marginTop:20, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.3)', marginBottom:8}}>
                Account: {userAccount?.email || ''}
              </div>
              <button style={{...S.settingsBtn, color:'#f5576c', borderColor:'rgba(245,87,108,0.2)'}}
                onClick={logout}>
                Esci dall'account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // --- HOME ---
  if (view === 'home') return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <AvatarImg src={prefs.avatar} size={56} style={{marginBottom:4}} />
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

        {/* Context selector */}
        <div style={{width:'100%', maxWidth:380, marginBottom:16}}>
          <div style={{...S.label, marginBottom:8}}>Contesto</div>
          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
            {CONTEXTS.map(c => (
              <button key={c.id} onClick={() => setSelectedContext(c.id)}
                style={{display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:12,
                  border: selectedContext===c.id ? '1px solid rgba(245,87,108,0.35)' : '1px solid rgba(255,255,255,0.06)',
                  background: selectedContext===c.id ? 'rgba(245,87,108,0.1)' : 'rgba(255,255,255,0.03)',
                  color: selectedContext===c.id ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontSize:12, cursor:'pointer', fontFamily:FONT,
                  WebkitTapHighlightColor:'transparent', transition:'all 0.15s'}}>
                <span style={{fontSize:15}}>{c.icon}</span>
                <span style={{fontWeight:500}}>{c.name}</span>
              </button>
            ))}
          </div>
          <div style={{fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:6, textAlign:'center'}}>
            {CONTEXTS.find(c => c.id === selectedContext)?.desc}
          </div>
        </div>

        {/* Description field */}
        <div style={{width:'100%', maxWidth:380, marginBottom:16}}>
          <div style={{...S.label, marginBottom:6}}>Descrizione (opzionale)</div>
          <input style={{...S.input, fontSize:13}} value={roomDescription}
            onChange={e => setRoomDescription(e.target.value)}
            placeholder="Es: Visita medica dal dentista, Riunione con cliente giapponese..."
            maxLength={150} />
          <div style={{fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:4, textAlign:'right'}}>
            {roomDescription.length}/150
          </div>
        </div>

        <button style={S.bigBtn} onClick={handleCreateRoom}>
          <div style={{width:44, height:44, borderRadius:14, background:'rgba(255,255,255,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>+</div>
          <div>
            <div style={{fontWeight:600, fontSize:15}}>Crea Stanza</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:1}}>
              {CONTEXTS.find(c => c.id === selectedContext)?.icon}{' '}
              {CONTEXTS.find(c => c.id === selectedContext)?.name}
              {' \u2022 '}{MODES.find(m => m.id === selectedMode)?.name}
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
        {/* Balance / Account indicator */}
        {userToken && userAccount ? (
          <div style={{width:'100%', maxWidth:380, marginTop:10, padding:'10px 16px', borderRadius:14,
            background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)',
            display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:2}}>
                {useOwnKeys ? 'API KEY PERSONALI' : 'CREDITO'}
              </div>
              <div style={{fontSize:16, fontWeight:600, color: useOwnKeys ? '#4facfe' : creditBalance > 50 ? '#4facfe' : '#f5576c'}}>
                {useOwnKeys ? '\u2713 Attive' : formatCredits(creditBalance)}
              </div>
            </div>
            <button style={{padding:'7px 14px', borderRadius:10, background:'rgba(245,87,108,0.1)',
              border:'1px solid rgba(245,87,108,0.2)', color:'#f5576c', fontSize:12, fontWeight:600,
              cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent'}}
              onClick={() => { refreshBalance(); setView('credits'); }}>
              {useOwnKeys ? 'Crediti' : 'Ricarica'}
            </button>
          </div>
        ) : (
          <button style={{width:'100%', maxWidth:380, marginTop:10, padding:'12px 16px', borderRadius:14,
            background:'rgba(79,172,254,0.08)', border:'1px solid rgba(79,172,254,0.15)',
            color:'#4facfe', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:FONT,
            textAlign:'center', WebkitTapHighlightColor:'transparent'}}
            onClick={() => { setAuthStep('email'); setView('account'); }}>
            {'\u{1F512}'} Accedi per creare stanze
          </button>
        )}

        <div style={{display:'flex', gap:10, marginTop:16}}>
          <button style={S.settingsBtn} onClick={() => setView('settings')}>Impostazioni</button>
          <button style={S.settingsBtn} onClick={() => { loadHistory(); setView('history'); }}>Cronologia</button>
          {userToken && <button style={S.settingsBtn} onClick={() => setView('apikeys')}>API Key</button>}
        </div>
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
    const roomCtx = CONTEXTS.find(c => c.id === (roomInfo?.context || roomContextRef.current.contextId)) || CONTEXTS[0];

    return (
      <div style={S.roomPage}>
        {/* Header */}
        <div style={S.roomHeader}>
          <button style={S.backBtnSmall} onClick={endChatAndSave} title="Termina e salva">{'\u2716'}</button>
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
              {roomCtx.id !== 'general' && <span style={{marginLeft:4}}>{roomCtx.icon} {roomCtx.name}</span>}
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
                <AvatarImg src={isMine ? prefs.avatar : (partner?.avatar || AVATARS[0])} size={36} style={{marginBottom:2}} />
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
          {/* Streaming live bubble */}
          {streamingMsg && streamingMsg.original && (
            <div style={{display:'flex', gap:8, flexDirection:'row-reverse', marginBottom:12, alignItems:'flex-end'}}>
              <AvatarImg src={prefs.avatar} size={36} style={{marginBottom:2}} />
              <div style={{maxWidth:'75%', display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:3, display:'flex', alignItems:'center', gap:4}}>
                  <span>Tu</span>
                  <span style={{display:'inline-block', width:6, height:6, borderRadius:3, background:'#f5576c',
                    animation:'vtPulse 1.2s infinite ease-in-out'}} />
                  <span style={{color:'#f5576c', fontSize:9, fontWeight:600}}>LIVE</span>
                </div>
                <div style={{...S.bubble, ...S.bubbleMine, border:'1px solid rgba(245,87,108,0.2)'}}>
                  <div style={{fontSize:14, fontWeight:500, lineHeight:1.5, color:'rgba(255,255,255,0.95)'}}>
                    {streamingMsg.original}
                  </div>
                  {streamingMsg.translated ? (
                    <div style={{fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:4, lineHeight:1.4,
                      borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:4}}>
                      {streamingMsg.translated}
                    </div>
                  ) : (
                    <div style={{fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:4, fontStyle:'italic'}}>
                      traduzione in corso...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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

  // --- HISTORY ---
  if (view === 'history') return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView('home')}>{'\u2190'}</button>
          <span style={{fontWeight:600, fontSize:17}}>Cronologia</span>
        </div>
        {convHistory.length === 0 ? (
          <div style={{color:'rgba(255,255,255,0.3)', fontSize:14, textAlign:'center', marginTop:40}}>
            Nessuna conversazione salvata
          </div>
        ) : (
          <div style={{width:'100%', maxWidth:380, display:'flex', flexDirection:'column', gap:8}}>
            {convHistory.map((c, i) => (
              <button key={c.id + i} onClick={() => viewConversation(c.id)}
                style={{width:'100%', padding:'14px 16px', borderRadius:16,
                  background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                  color:'#fff', textAlign:'left', cursor:'pointer', fontFamily:FONT,
                  backdropFilter:'blur(8px)', WebkitTapHighlightColor:'transparent'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                  <span style={{fontWeight:600, fontSize:14}}>{c.members?.join(' & ') || 'Conversazione'}</span>
                  <span style={{fontSize:10, color:'rgba(255,255,255,0.3)'}}>
                    {c.msgCount || 0} msg
                  </span>
                </div>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>
                  {c.created ? new Date(c.created).toLocaleDateString('it-IT', {
                    day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
                  }) : ''}
                  {c.host === prefs.name && <span style={{color:'#f5576c', marginLeft:6}}>Host</span>}
                </div>
              </button>
            ))}
          </div>
        )}
        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );

  // --- SUMMARY / REPORT ---
  if (view === 'summary' && currentConv) {
    const s = currentConv.summary;
    const isHost = currentConv.host === prefs.name;
    return (
      <div style={S.page}>
        <div style={S.scrollCenter}>
          <div style={S.topBar}>
            <button style={S.backBtn} onClick={() => { setCurrentConv(null); setView('home'); }}>{'\u2190'}</button>
            <span style={{fontWeight:600, fontSize:17}}>Report</span>
          </div>

          {summaryLoading ? (
            <div style={{textAlign:'center', marginTop:40}}>
              <div style={{fontSize:24, marginBottom:8}}>...</div>
              <div style={{color:'rgba(255,255,255,0.4)', fontSize:13}}>Generazione report AI...</div>
            </div>
          ) : s ? (
            <div style={{...S.card, width:'100%', maxWidth:380}}>
              <div style={{fontSize:18, fontWeight:700, marginBottom:8, color:'rgba(255,255,255,0.95)',
                lineHeight:1.3}}>{s.title || 'Report Conversazione'}</div>

              {s.topics?.length > 0 && (
                <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:12}}>
                  {s.topics.map((t,i) => (
                    <span key={i} style={{padding:'3px 10px', borderRadius:12, fontSize:10, fontWeight:600,
                      background:'rgba(245,87,108,0.12)', color:'#f5576c', textTransform:'uppercase',
                      letterSpacing:0.5}}>{t}</span>
                  ))}
                  {s.sentiment && (
                    <span style={{padding:'3px 10px', borderRadius:12, fontSize:10, fontWeight:600,
                      background:'rgba(78,205,196,0.12)', color:'#4ecdc4', letterSpacing:0.5}}>
                      {s.sentiment}
                    </span>
                  )}
                </div>
              )}

              <div style={{fontSize:13, color:'rgba(255,255,255,0.7)', lineHeight:1.6, marginBottom:16}}>
                {s.summary}
              </div>

              {s.keyPoints?.length > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{...S.label, marginBottom:8}}>Punti Chiave</div>
                  {s.keyPoints.map((p,i) => (
                    <div key={i} style={{display:'flex', gap:8, marginBottom:6, fontSize:13,
                      color:'rgba(255,255,255,0.65)', lineHeight:1.5}}>
                      <span style={{color:'#f5576c', flexShrink:0}}>{'•'}</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{display:'flex', justifyContent:'space-between', padding:'10px 0',
                borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:11, color:'rgba(255,255,255,0.35)'}}>
                <span>{s.participants || currentConv.members?.map(m => m.name).join(' & ')}</span>
                <span>{s.duration || ''} | {s.messageCount || currentConv.msgCount} msg</span>
              </div>

              {isHost && (
                <button style={{...S.btn, marginTop:12}} onClick={shareSummary}>
                  Condividi Report
                </button>
              )}
            </div>
          ) : (
            <div style={{...S.card, width:'100%', maxWidth:380}}>
              <div style={{fontSize:15, fontWeight:600, marginBottom:12, color:'rgba(255,255,255,0.8)'}}>
                Conversazione Salvata
              </div>
              <div style={{fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:8}}>
                {currentConv.members?.map(m => m.name).join(' & ')} - {currentConv.msgCount} messaggi
              </div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.35)'}}>
                {currentConv.created ? new Date(currentConv.created).toLocaleString('it-IT') : ''}
              </div>
            </div>
          )}

          {/* Message transcript */}
          {currentConv.messages?.length > 0 && (
            <div style={{width:'100%', maxWidth:380, marginTop:12}}>
              <div style={{...S.label, marginBottom:8}}>Trascrizione</div>
              <div style={{background:'rgba(255,255,255,0.03)', borderRadius:16, padding:'12px 14px',
                border:'1px solid rgba(255,255,255,0.06)', maxHeight:300, overflowY:'auto'}}>
                {currentConv.messages.map((m,i) => (
                  <div key={i} style={{marginBottom:10, paddingBottom:10,
                    borderBottom:i < currentConv.messages.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none'}}>
                    <div style={{fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:2}}>
                      {m.sender}
                    </div>
                    <div style={{fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.5}}>
                      {m.original}
                    </div>
                    <div style={{fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:2, lineHeight:1.4}}>
                      {m.translated}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status && <div style={S.statusMsg}>{status}</div>}
        </div>
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
  avatarBtn: { width:48, height:48, borderRadius:14, border:'2px solid transparent',
    background:'rgba(255,255,255,0.04)', fontSize:22, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
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
