'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { t, mapLang } from './lib/i18n.js';
import { APP_URL, LANGS, VOICES, AVATARS, AVATAR_NAMES, MODES, CONTEXTS, FONT, CREDIT_PACKAGES,
  FREE_DAILY_LIMIT, THEMES, getLang, vibrate, formatCredits } from './lib/constants.js';
import getStyles from './lib/styles.js';

// View components
import WelcomeView from './components/WelcomeView.js';
import AccountView from './components/AccountView.js';
import CreditsView from './components/CreditsView.js';
import ApiKeysView from './components/ApiKeysView.js';
import SettingsView from './components/SettingsView.js';
import HomeView from './components/HomeView.js';
import JoinView from './components/JoinView.js';
import LobbyView from './components/LobbyView.js';
import RoomView from './components/RoomView.js';
import HistoryView from './components/HistoryView.js';
import SummaryView from './components/SummaryView.js';


export default function Home() {
  // =============================================
  // STATE
  // =============================================
  const [view, setView] = useState('loading');
  const [prefs, setPrefs] = useState({ name:'', lang:'it', avatar:AVATARS[0], voice:'nova', autoPlay:true });
  const [convHistory, setConvHistory] = useState([]);
  const [currentConv, setCurrentConv] = useState(null);
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
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [selectedMode, setSelectedMode] = useState('conversation');
  const [selectedContext, setSelectedContext] = useState('general');
  const [roomDescription, setRoomDescription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [partnerLiveText, setPartnerLiveText] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [inviteLang, setInviteLang] = useState('en');
  const [inviteMsgLang, setInviteMsgLang] = useState(null);
  const [showShareApp, setShowShareApp] = useState(false);
  const [shareAppLang, setShareAppLang] = useState('en');

  // Account & Credits state
  const [userToken, setUserToken] = useState(null);
  const [userAccount, setUserAccount] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authStep, setAuthStep] = useState('email');
  const [authLoading, setAuthLoading] = useState(false);
  const [authTestCode, setAuthTestCode] = useState('');
  const [apiKeyInputs, setApiKeyInputs] = useState({ openai:'', anthropic:'', gemini:'', elevenlabs:'' });
  const [useOwnKeys, setUseOwnKeys] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [referralCode, setReferralCode] = useState(null);
  const [pendingReferralCode, setPendingReferralCode] = useState(null);
  const userTokenRef = useRef(null);

  // Tier system
  const [isTrial, setIsTrial] = useState(true);
  const isTrialRef = useRef(true);
  const [isTopPro, setIsTopPro] = useState(false);
  const isTopProRef = useRef(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState([]);
  const [selectedELVoice, setSelectedELVoice] = useState('');
  const [platformHasEL, setPlatformHasEL] = useState(false);
  const roomTierOverrideRef = useRef(null);

  // FREE tier usage tracking
  const [freeCharsUsed, setFreeCharsUsed] = useState(0);
  const [freeLimitExceeded, setFreeLimitExceeded] = useState(false);
  const [freeResetTime, setFreeResetTime] = useState('');
  const freeCharsRef = useRef(0);

  // Refs
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
  const persistentAudioRef = useRef(null);
  const playedMsgIdsRef = useRef(new Set());
  const sentByMeRef = useRef(new Set());

  // Streaming translation refs
  const speechRecRef = useRef(null);
  const wordBufferRef = useRef('');
  const allWordsRef = useRef('');
  const translatedChunksRef = useRef([]);
  const reviewTimerRef = useRef(null);
  const streamingModeRef = useRef(false);
  const chunkingActiveRef = useRef(false);
  const lastInterimRef = useRef('');
  const backupRecRef = useRef(null);
  const backupChunksRef = useRef([]);
  const backupStreamRef = useRef(null);
  const [streamingMsg, setStreamingMsg] = useState(null);
  const persistentMicRef = useRef(null);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // Theme state
  const [theme, setTheme] = useState(THEMES.DARK);

  // =============================================
  // STYLES & THEME
  // =============================================
  const S = useMemo(() => getStyles(theme), [theme]);

  // Load theme from localStorage
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('vt-theme');
      if (savedTheme && (savedTheme === THEMES.DARK || savedTheme === THEMES.LIGHT)) {
        setTheme(savedTheme);
      }
    } catch {}
  }, []);

  // Save theme to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem('vt-theme', theme);
    } catch {}
  }, [theme]);

  // =============================================
  // REF SYNC
  // =============================================
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  useEffect(() => { myLangRef.current = myLang; }, [myLang]);
  useEffect(() => { roomInfoRef.current = roomInfo; }, [roomInfo]);
  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);
  useEffect(() => { userTokenRef.current = userToken; }, [userToken]);
  useEffect(() => { isTrialRef.current = isTrial; }, [isTrial]);
  useEffect(() => { isTopProRef.current = isTopPro; }, [isTopPro]);

  // Update tier based on account status
  useEffect(() => {
    if (roomTierOverrideRef.current) return;
    if (userToken && (creditBalance > 0 || useOwnKeys)) {
      setIsTrial(false);
    } else {
      setIsTrial(true);
      if (!(useOwnKeys && apiKeyInputs.elevenlabs?.trim())) {
        setIsTopPro(false);
      }
    }
  }, [userToken, creditBalance, useOwnKeys, apiKeyInputs.elevenlabs]);

  // =============================================
  // FREE TIER USAGE TRACKING
  // =============================================
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vt-free-usage');
      if (saved) {
        const data = JSON.parse(saved);
        const savedDate = data.date || '';
        const todayUTC = new Date().toISOString().split('T')[0];
        if (savedDate === todayUTC) {
          setFreeCharsUsed(data.chars || 0);
          freeCharsRef.current = data.chars || 0;
          if ((data.chars || 0) >= FREE_DAILY_LIMIT) setFreeLimitExceeded(true);
        } else {
          localStorage.setItem('vt-free-usage', JSON.stringify({ date: todayUTC, chars: 0 }));
          setFreeCharsUsed(0); freeCharsRef.current = 0; setFreeLimitExceeded(false);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (freeCharsUsed > 0) {
      const todayUTC = new Date().toISOString().split('T')[0];
      localStorage.setItem('vt-free-usage', JSON.stringify({ date: todayUTC, chars: freeCharsUsed }));
      freeCharsRef.current = freeCharsUsed;
    }
  }, [freeCharsUsed]);

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const midnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
      const diff = midnightUTC - now;
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setFreeResetTime(`${hours}h ${mins}m`);
      if (hours === 0 && mins === 0) {
        setFreeCharsUsed(0); freeCharsRef.current = 0; setFreeLimitExceeded(false);
      }
    }
    updateCountdown();
    const timer = setInterval(updateCountdown, 60000);
    return () => clearInterval(timer);
  }, []);

  function trackFreeChars(chars) {
    setFreeCharsUsed(prev => {
      const newTotal = prev + chars;
      if (newTotal >= FREE_DAILY_LIMIT) setFreeLimitExceeded(true);
      return newTotal;
    });
  }

  // =============================================
  // MIC SYSTEM
  // =============================================
  async function getMicStream() {
    if (persistentMicRef.current) {
      const tracks = persistentMicRef.current.getTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') return persistentMicRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    persistentMicRef.current = stream;
    return stream;
  }

  function requestMicEarly() {
    if (persistentMicRef.current) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      persistentMicRef.current = stream;
    }).catch(() => {});
  }

  // =============================================
  // AUDIO SYSTEM
  // =============================================
  function getPersistentAudio() {
    if (!persistentAudioRef.current) {
      persistentAudioRef.current = new Audio();
      persistentAudioRef.current.volume = 1.0;
    }
    return persistentAudioRef.current;
  }

  function unlockAudio() {
    if (audioReady) return;
    requestMicEarly();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(ctx.destination); src.start(0);
      const pa = getPersistentAudio();
      pa.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      pa.play().catch(() => {});
      const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      a.volume = 0.01; a.play().catch(() => {});
      setAudioReady(true);
    } catch (e) {}
  }

  useEffect(() => {
    if (audioReady) return;
    const handler = () => unlockAudio();
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('click', handler, { passive: true });
    return () => { document.removeEventListener('touchstart', handler); document.removeEventListener('click', handler); };
  }, [audioReady]);

  function getEffectiveToken() {
    if (roomTierOverrideRef.current && roomTierOverrideRef.current !== 'FREE') return undefined;
    return userTokenRef.current || undefined;
  }

  async function playTTS(text, lang) {
    try {
      const res = await fetch('/api/tts', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text, voice: prefsRef.current.voice || 'nova', userToken: getEffectiveToken(), roomId: roomId || undefined })
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const audio = getPersistentAudio();
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); playWithNewAudio(text, lang, resolve); };
        audio.src = url;
        audio.play().catch(() => { URL.revokeObjectURL(url); playWithNewAudio(text, lang, resolve); });
      });
    } catch { browserSpeak(text, lang); }
  }

  function playWithNewAudio(text, lang, resolve) {
    fetch('/api/tts', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text, voice: prefsRef.current.voice || 'nova', userToken: getEffectiveToken(), roomId: roomId || undefined })
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.onended = () => { URL.revokeObjectURL(url); resolve(); };
      a.play().catch(() => { URL.revokeObjectURL(url); browserSpeak(text, lang); resolve(); });
    }).catch(() => { browserSpeak(text, lang); resolve(); });
  }

  function browserSpeak(text, lang) {
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 0.9;
    speechSynthesis.speak(u);
  }

  async function playTTSElevenLabs(text, langCode) {
    try {
      const res = await fetch('/api/tts-elevenlabs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: selectedELVoice || undefined,
          langCode: langCode?.split('-')[0] || undefined,
          userToken: getEffectiveToken(), roomId: roomId || undefined })
      });
      if (!res.ok) throw new Error('ElevenLabs TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const audio = getPersistentAudio();
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); playTTS(text, langCode).then(resolve); };
        audio.src = url;
        audio.play().catch(() => { URL.revokeObjectURL(url); playTTS(text, langCode).then(resolve); });
      });
    } catch { return playTTS(text, langCode); }
  }

  async function queueAudio(text, lang, msgId) {
    if (!audioEnabledRef.current) return;
    if (msgId && playedMsgIdsRef.current.has(msgId)) return;
    if (msgId) playedMsgIdsRef.current.add(msgId);
    audioQueueRef.current.push({ text, lang });
    processAudioQueue();
  }

  async function processAudioQueue() {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const { text, lang } = audioQueueRef.current.shift();
    try {
      if (isTrialRef.current) {
        await new Promise(resolve => { browserSpeak(text, lang); setTimeout(resolve, Math.max(1500, text.length * 80)); });
      } else if (isTopProRef.current) { await playTTSElevenLabs(text, lang); }
      else { await playTTS(text, lang); }
    } catch (e) {}
    isPlayingRef.current = false;
    processAudioQueue();
  }

  async function playMessage(msg) {
    unlockAudio();
    setPlayingMsgId(msg.id);
    if (isTrialRef.current) {
      await new Promise(resolve => { browserSpeak(msg.translated, getLang(msg.targetLang).speech); setTimeout(resolve, Math.max(1500, msg.translated.length * 80)); });
    } else if (isTopProRef.current) { await playTTSElevenLabs(msg.translated, getLang(msg.targetLang).speech); }
    else { await playTTS(msg.translated, getLang(msg.targetLang).speech); }
    setPlayingMsgId(null);
  }

  // =============================================
  // TRANSLATE
  // =============================================
  async function translateUniversal(text, sourceLang, targetLang, sourceLangName, targetLangName, options = {}) {
    if (isTrialRef.current) {
      if (freeCharsRef.current >= FREE_DAILY_LIMIT) {
        setFreeLimitExceeded(true);
        return { translated: text, fallback: true, limitExceeded: true };
      }
      const res = await fetch('/api/translate-free', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang, targetLang })
      });
      if (!res.ok) return { translated: text };
      const data = await res.json();
      if (data.charsUsed > 0) trackFreeChars(data.charsUsed);
      if (data.limitExceeded) setFreeLimitExceeded(true);
      return data;
    }
    const res = await fetch('/api/translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang, sourceLangName, targetLangName,
        roomId, ...options, userToken: getEffectiveToken() })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(errData.error || 'No credits');
      throw new Error('Translation error');
    }
    const data = await res.json();
    if (data.remainingCredits !== undefined) setCreditBalance(data.remainingCredits);
    return data;
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
        setPrefs(p); setMyLang(p.lang);
      }

      const langParam = urlParams.get('lang');
      if (langParam && LANGS.find(l => l.code === langParam)) {
        setInviteMsgLang(langParam);
        setMyLang(langParam);
        if (!saved) setPrefs(p => ({...p, lang: langParam}));
      }

      // Capture referral code from URL
      const refParam = urlParams.get('ref');
      if (refParam) {
        setPendingReferralCode(refParam);
      }

      if (roomParam) setJoinCode(roomParam.toUpperCase());
      if (paymentStatus === 'success' && paymentCredits) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      const pickView = (hasSaved) => {
        if (roomParam) return 'join';
        if (!hasSaved) return 'welcome';
        return 'home';
      };

      if (savedToken) {
        setUserToken(savedToken);
        userTokenRef.current = savedToken;
        fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ action:'me', token:savedToken })
        }).then(r => r.json()).then(data => {
          if (data.user) {
            setUserAccount(data.user);
            setCreditBalance(data.user.credits || 0);
            setUseOwnKeys(data.user.useOwnKeys || false);
            if (data.referralCode) setReferralCode(data.referralCode);
            if (data.platformHasElevenLabs) setPlatformHasEL(true);
            if (data.user.useOwnKeys && data.user.apiKeys?.elevenlabs) setIsTopPro(true);
            setView(pickView(!!saved));
          } else {
            localStorage.removeItem('vt-token');
            setUserToken(null);
            setView(pickView(!!saved));
          }
        }).catch(() => { setView(pickView(!!saved)); });
      } else {
        setView(pickView(!!saved));
      }
    } catch { setView('welcome'); }
  }, []);

  // Register service worker for offline support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW registration failed:', err));
    }
  }, []);

  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  useEffect(() => {
    if (view === 'home' && !localStorage.getItem('vt-tutorial-done')) {
      setTutorialStep(0); setShowTutorial(true);
      localStorage.setItem('vt-tutorial-done', '1');
    }
  }, [view]);

  function savePrefs(newPrefs) {
    setPrefs(newPrefs); setMyLang(newPrefs.lang);
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
            for (const msg of newMsgs) {
              if (sentByMeRef.current.has(msg.id)) continue;
              if (msg.sender === prefsRef.current.name) continue;
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
          setPartnerLiveText((partner && partner.speaking && partner.liveText) ? partner.liveText : '');
          setPartnerTyping(!!(partner && partner.typing && (Date.now() - (partner.typingAt || 0) < 5000)));
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
  async function setSpeakingState(rid, speaking, liveText = null, typing = false) {
    try {
      await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'speaking', roomId:rid, name:prefsRef.current.name, speaking, liveText, typing }) });
    } catch {}
  }

  const liveTextTimerRef = useRef(null);
  const lastLiveTextRef = useRef('');
  function broadcastLiveText(text) {
    if (!roomId || text === lastLiveTextRef.current) return;
    lastLiveTextRef.current = text;
    if (liveTextTimerRef.current) return;
    liveTextTimerRef.current = setTimeout(() => {
      liveTextTimerRef.current = null;
      setSpeakingState(roomId, true, lastLiveTextRef.current);
    }, 800);
  }

  function sendTypingState(isTyping) {
    if (!roomId) return;
    fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'speaking', roomId, name:prefsRef.current.name, speaking:false, typing:isTyping }) }).catch(() => {});
  }

  async function handleCreateRoom() {
    try {
      setStatus('...');
      const ctxObj = CONTEXTS.find(c => c.id === selectedContext) || CONTEXTS[0];
      const currentTier = isTrial ? 'FREE' : isTopPro ? 'TOP PRO' : 'PRO';
      const res = await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'create', name:prefs.name, lang:myLang, mode:selectedMode, avatar:prefs.avatar,
          context: selectedContext, contextPrompt: ctxObj.prompt, description: roomDescription, hostTier: currentTier,
          hostEmail: userAccount?.email || null }) });
      if (!res.ok) throw new Error('Error');
      const { room } = await res.json();
      roomContextRef.current = { contextId: selectedContext, contextPrompt: ctxObj.prompt, description: roomDescription };
      setRoomId(room.id); setRoomInfo(room); setMessages([]); setView('lobby');
      startPolling(room.id); setStatus('');
    } catch (e) { setStatus('Error: ' + e.message); }
  }

  async function handleJoinRoom() {
    if (!joinCode.trim()) return;
    try {
      setStatus('...');
      const res = await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'join', roomId:joinCode.trim().toUpperCase(), name:prefs.name, lang:myLang, avatar:prefs.avatar }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Stanza non trovata'); }
      const { room } = await res.json();
      roomContextRef.current = { contextId: room.context || 'general', contextPrompt: room.contextPrompt || '', description: room.description || '' };
      const hostTier = room.hostTier || 'FREE';
      roomTierOverrideRef.current = hostTier;
      if (hostTier === 'FREE') { setIsTrial(true); setIsTopPro(false); }
      else if (hostTier === 'TOP PRO') { setIsTrial(false); setIsTopPro(true); }
      else { setIsTrial(false); setIsTopPro(false); }
      setRoomId(room.id); setRoomInfo(room); setMessages([]); setView('room');
      startPolling(room.id); setStatus('');
    } catch (e) { setStatus('Error: ' + e.message); }
  }

  function leaveRoom() {
    stopPolling(); stopFreeTalk();
    if (streamingModeRef.current) {
      streamingModeRef.current = false;
      if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} speechRecRef.current = null; }
      if (reviewTimerRef.current) { clearInterval(reviewTimerRef.current); reviewTimerRef.current = null; }
    }
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') { try { backupRecRef.current.stop(); } catch {} }
    backupRecRef.current = null;
    backupStreamRef.current = null;
    setStreamingMsg(null);
    if (persistentMicRef.current) { persistentMicRef.current.getTracks().forEach(t => t.stop()); persistentMicRef.current = null; }
    roomTierOverrideRef.current = null;
    setRoomId(null); setRoomInfo(null); setMessages([]); setPartnerSpeaking(false); setView('home');
  }

  // =============================================
  // RECORDING - TAP TO TALK
  // =============================================
  async function toggleRecording() {
    if (recording) {
      if (streamingModeRef.current) stopStreamingTranslation();
      else stopClassicRecording();
    } else {
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

    const form = new FormData();
    form.append('audio', blob, 'audio.webm');
    form.append('sourceLang', myL.code);
    form.append('targetLang', otherL.code);
    form.append('sourceLangName', myL.name);
    form.append('targetLangName', otherL.name);
    if (roomId) form.append('roomId', roomId);
    if (roomContextRef.current.contextPrompt) form.append('domainContext', roomContextRef.current.contextPrompt);
    if (roomContextRef.current.description) form.append('description', roomContextRef.current.description);
    const effectiveToken = getEffectiveToken();
    if (effectiveToken) form.append('userToken', effectiveToken);
    const res = await fetch('/api/process', { method:'POST', body:form });
    if (!res.ok) throw new Error('Server error');
    const { original, translated, cost } = await res.json();
    if (original && roomId) {
      const msgRes = await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ roomId, sender:currentPrefs.name, original, translated,
          sourceLang:myL.code, targetLang:otherL.code }) });
      try { const msgData = await msgRes.json(); if (msgData.message?.id) sentByMeRef.current.add(msgData.message.id); } catch {}
    }
  }

  // =============================================
  // STREAMING TRANSLATION
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
    if (!SpeechRecognition) { startClassicRecording(); return; }

    unlockAudio();
    setRecording(true); setStatus('');
    if (roomId) setSpeakingState(roomId, true);

    wordBufferRef.current = ''; allWordsRef.current = ''; lastInterimRef.current = '';
    translatedChunksRef.current = []; chunkingActiveRef.current = false;
    streamingModeRef.current = true; backupChunksRef.current = [];
    setStreamingMsg({ original: '', translated: '', isStreaming: true });

    if (!isTrialRef.current) {
      try {
        const stream = await getMicStream();
        backupStreamRef.current = stream;
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const backup = new MediaRecorder(stream, { mimeType: mime });
        backup.ondataavailable = e => { if (e.data.size > 0) backupChunksRef.current.push(e.data); };
        backupRecRef.current = backup;
        backup.start(250);
      } catch (e) {
        setRecording(false); setStatus(t(prefsRef.current?.lang||'en','micError'));
        streamingModeRef.current = false; setStreamingMsg(null); return;
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getLang(myLangRef.current).speech;
    recognition.interimResults = true; recognition.continuous = true; recognition.maxAlternatives = 1;
    speechRecRef.current = recognition;

    let processedFinals = new Set();
    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          const key = i + ':' + text;
          if (text && !processedFinals.has(key)) {
            processedFinals.add(key);
            lastInterimRef.current = '';
            wordBufferRef.current = (wordBufferRef.current + ' ' + text).trim();
            allWordsRef.current = (allWordsRef.current + ' ' + text).trim();
            setStreamingMsg(prev => prev ? { ...prev, original: allWordsRef.current } : null);
            broadcastLiveText(allWordsRef.current);
            const bufferWords = wordBufferRef.current.split(/\s+/).filter(w => w).length;
            if (bufferWords >= 4) emitChunk();
          }
        } else { interimTranscript += event.results[i][0].transcript; }
      }
      if (interimTranscript) {
        lastInterimRef.current = interimTranscript.trim();
        const preview = allWordsRef.current + ' ' + interimTranscript.trim();
        setStreamingMsg(prev => prev ? { ...prev, original: preview } : null);
        broadcastLiveText(preview);
        const totalPending = (wordBufferRef.current + ' ' + interimTranscript.trim()).trim();
        if (totalPending.split(/\s+/).filter(w => w).length >= 12 && wordBufferRef.current.trim()) emitChunk();
      }
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      if (streamingModeRef.current) {
        processedFinals = new Set();
        try { recognition.start(); } catch {}
      }
    };
    try { recognition.start(); } catch {}
    reviewTimerRef.current = setInterval(() => postHocReview(), 12000);
  }

  async function emitChunk() {
    const chunk = wordBufferRef.current.trim();
    if (!chunk || chunkingActiveRef.current) return;
    wordBufferRef.current = ''; chunkingActiveRef.current = true;
    const { myL, otherL } = getTargetLangInfo();
    try {
      const prevContext = translatedChunksRef.current.slice(-2).join(' ');
      const data = await translateUniversal(chunk, myL.code, otherL.code, myL.name, otherL.name, {
        context: prevContext || undefined,
        domainContext: roomContextRef.current.contextPrompt || undefined,
        description: roomContextRef.current.description || undefined
      });
      if (data.translated) {
        translatedChunksRef.current.push(data.translated);
        const fullTranslation = translatedChunksRef.current.join(' ');
        setStreamingMsg(prev => prev ? { ...prev, translated: fullTranslation } : null);
      }
    } catch (e) { console.error('[Chunk] Translation error:', e); }
    chunkingActiveRef.current = false;
    if (wordBufferRef.current.trim()) {
      const bufferWords = wordBufferRef.current.split(/\s+/).filter(w => w).length;
      if (bufferWords >= 4) emitChunk();
    }
  }

  async function postHocReview() {
    const allOriginal = allWordsRef.current.trim();
    if (!allOriginal) return;
    const wordCount = allOriginal.split(/\s+/).filter(w => w).length;
    if (wordCount < 10) return;
    const words = allOriginal.split(/\s+/).filter(w => w);
    const reviewText = words.slice(-25).join(' ');
    const { myL, otherL } = getTargetLangInfo();
    try {
      if (isTrialRef.current) return;
      const res = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reviewText, sourceLang: myL.code, targetLang: otherL.code,
          sourceLangName: myL.name, targetLangName: otherL.name, roomId, isReview: true,
          domainContext: roomContextRef.current.contextPrompt || undefined,
          description: roomContextRef.current.description || undefined,
          userToken: getEffectiveToken() })
      });
      if (res.ok) {
        const { translated } = await res.json();
        if (translated && translatedChunksRef.current.length > 0) {
          const reviewWordCount = reviewText.split(/\s+/).length;
          const avgWordsPerChunk = Math.max(1, wordCount / translatedChunksRef.current.length);
          const chunksToReplace = Math.min(translatedChunksRef.current.length, Math.ceil(reviewWordCount / avgWordsPerChunk));
          const keptChunks = translatedChunksRef.current.slice(0, -chunksToReplace);
          translatedChunksRef.current = [...keptChunks, translated];
          const fullTranslation = translatedChunksRef.current.join(' ');
          setStreamingMsg(prev => prev ? { ...prev, translated: fullTranslation } : null);
        }
      }
    } catch (e) { console.error('[Review] Error:', e); }
  }

  async function stopStreamingTranslation() {
    streamingModeRef.current = false;
    setRecording(false);
    if (roomId) setSpeakingState(roomId, false);
    if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} speechRecRef.current = null; }
    if (reviewTimerRef.current) { clearInterval(reviewTimerRef.current); reviewTimerRef.current = null; }

    let backupBlob = null;
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      await new Promise(resolve => { backupRecRef.current.onstop = () => resolve(); backupRecRef.current.stop(); });
      if (backupChunksRef.current.length > 0) backupBlob = new Blob(backupChunksRef.current, { type: backupRecRef.current.mimeType });
    }
    backupRecRef.current = null; backupStreamRef.current = null;

    if (lastInterimRef.current) {
      const pending = lastInterimRef.current.trim();
      const existing = allWordsRef.current.trim();
      if (pending && !existing.endsWith(pending) && !existing.includes(pending)) {
        wordBufferRef.current = (wordBufferRef.current + ' ' + pending).trim();
        allWordsRef.current = (existing + ' ' + pending).trim();
      }
      lastInterimRef.current = '';
    }

    if (wordBufferRef.current.trim()) await emitChunk();

    const allOriginal = allWordsRef.current.trim();

    if (!allOriginal && backupBlob && backupBlob.size > 1000 && !isTrialRef.current) {
      setStatus(t(prefsRef.current?.lang||'en','translating'));
      setStreamingMsg(null);
      try { await processAndSendAudio(backupBlob); } catch (err) { setStatus('Error: ' + err.message); }
      setStatus(''); return;
    }

    if (!allOriginal) { setStreamingMsg(null); setStatus(''); return; }

    setStatus(t(prefsRef.current?.lang||'en','finalReview'));
    const { myL, otherL } = getTargetLangInfo();
    let finalTranslation = translatedChunksRef.current.join(' ');
    try {
      if (isTrialRef.current) {
        const data = await translateUniversal(allOriginal, myL.code, otherL.code, myL.name, otherL.name);
        if (data.translated) finalTranslation = data.translated;
      } else {
        const res = await fetch('/api/translate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: allOriginal, sourceLang: myL.code, targetLang: otherL.code,
            sourceLangName: myL.name, targetLangName: otherL.name, roomId, isReview: true,
            domainContext: roomContextRef.current.contextPrompt || undefined,
            description: roomContextRef.current.description || undefined,
            userToken: getEffectiveToken() })
        });
        if (res.ok) { const data = await res.json(); if (data.translated) finalTranslation = data.translated; }
      }
    } catch (e) { console.error('[Final] Translation error:', e); }

    if (!finalTranslation && backupBlob && backupBlob.size > 1000 && !isTrialRef.current) {
      setStreamingMsg(null);
      try { await processAndSendAudio(backupBlob); } catch {} setStatus(''); return;
    }

    if (finalTranslation && roomId) {
      try {
        const msgRes = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, sender: prefsRef.current.name, original: allOriginal, translated: finalTranslation,
            sourceLang: myL.code, targetLang: otherL.code }) });
        try { const msgData = await msgRes.json(); if (msgData.message?.id) sentByMeRef.current.add(msgData.message.id); } catch {}
      } catch (e) { console.error('[Final] Message save error:', e); }
    }
    setStreamingMsg(null); setStatus('');
    if (!isTrialRef.current && !useOwnKeys) refreshBalance();
  }

  async function startClassicRecording() {
    unlockAudio(); setRecording(true);
    setStatus(t(prefsRef.current?.lang||'en','speakNow'));
    if (roomId) setSpeakingState(roomId, true);
    chunksRef.current = [];
    try {
      const stream = await getMicStream();
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      recRef.current = new MediaRecorder(stream, { mimeType: mime });
      recRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recRef.current.mimeType });
        if (blob.size < 1000) { setRecording(false); setStatus(''); return; }
        try { await processAndSendAudio(blob); } catch (err) { setStatus('Error: ' + err.message); }
        setRecording(false); setStatus('');
        if (!isTrialRef.current && !useOwnKeys) refreshBalance();
      };
      recRef.current.start(100);
    } catch (err) {
      setStatus('Mic error:' + err.message); setRecording(false);
      if (roomId) setSpeakingState(roomId, false);
    }
  }

  function stopClassicRecording() {
    if (recRef.current && recRef.current.state === 'recording') {
      setStatus(t(prefsRef.current?.lang||'en','translating'));
      if (roomId) setSpeakingState(roomId, false);
      recRef.current.stop();
    }
  }

  // =============================================
  // TEXT INPUT
  // =============================================
  async function sendTextMessage() {
    if (!textInput.trim() || sendingText || !roomId) return;
    setSendingText(true);
    setStatus(t(prefsRef.current?.lang||'en','translating'));
    try {
      const myL = getLang(myLangRef.current);
      let otherLangCode = null;
      if (roomInfoRef.current && roomInfoRef.current.members) {
        const other = roomInfoRef.current.members.find(m => m.name !== prefsRef.current.name);
        if (other) otherLangCode = other.lang;
      }
      if (!otherLangCode) otherLangCode = myLangRef.current === 'en' ? 'it' : 'en';
      const otherL = getLang(otherLangCode);
      const data = await translateUniversal(textInput.trim(), myL.code, otherL.code, myL.name, otherL.name, {
        domainContext: roomContextRef.current.contextPrompt || undefined,
        description: roomContextRef.current.description || undefined
      });
      if (data.translated) {
        const msgRes = await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ roomId, sender:prefsRef.current.name, original:textInput.trim(), translated:data.translated,
            sourceLang:myL.code, targetLang:otherL.code }) });
        try { const msgData = await msgRes.json(); if (msgData.message?.id) sentByMeRef.current.add(msgData.message.id); } catch {}
        setTextInput('');
        if (!isTrialRef.current && !useOwnKeys) refreshBalance();
      }
    } catch (err) {
      setStatus('Error: ' + err.message);
      if (!isTrialRef.current && !useOwnKeys) refreshBalance();
    }
    setSendingText(false); setStatus('');
  }

  // =============================================
  // MODE CHANGE
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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      const stream = await getMicStream();
      vadStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      vadAnalyserRef.current = analyser;
      setIsListening(true);

      let isRec = false;
      const threshold = 25, silenceDelay = 2000;

      if (SpeechRecognition) {
        wordBufferRef.current = ''; allWordsRef.current = '';
        translatedChunksRef.current = []; streamingModeRef.current = true;
        chunkingActiveRef.current = false;

        const recognition = new SpeechRecognition();
        recognition.lang = getLang(myLangRef.current).speech;
        recognition.interimResults = true; recognition.continuous = true; recognition.maxAlternatives = 1;
        speechRecRef.current = recognition;

        let ftProcessedFinals = new Set();
        recognition.onresult = (event) => {
          let interimTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0].transcript.trim();
              const key = i + ':' + text;
              if (text && !ftProcessedFinals.has(key)) {
                ftProcessedFinals.add(key);
                lastInterimRef.current = '';
                wordBufferRef.current = (wordBufferRef.current + ' ' + text).trim();
                allWordsRef.current = (allWordsRef.current + ' ' + text).trim();
                setStreamingMsg(prev => prev ? { ...prev, original: allWordsRef.current } : null);
                broadcastLiveText(allWordsRef.current);
                const bufferWords = wordBufferRef.current.split(/\s+/).filter(w => w).length;
                if (bufferWords >= 4) emitChunk();
              }
            } else { interimTranscript += event.results[i][0].transcript; }
          }
          if (interimTranscript) {
            lastInterimRef.current = interimTranscript.trim();
            const preview = allWordsRef.current + ' ' + interimTranscript.trim();
            setStreamingMsg(prev => prev ? { ...prev, original: preview } : null);
            broadcastLiveText(preview);
            const totalPending = (wordBufferRef.current + ' ' + interimTranscript.trim()).trim();
            if (totalPending.split(/\s+/).filter(w => w).length >= 12 && wordBufferRef.current.trim()) emitChunk();
          }
        };
        recognition.onerror = () => {};
        recognition.onend = () => {
          if (streamingModeRef.current && isListening) {
            ftProcessedFinals = new Set();
            try { recognition.start(); } catch {}
          }
        };
        recognition.start();
        reviewTimerRef.current = setInterval(() => postHocReview(), 12000);
      }

      function check() {
        if (!vadAnalyserRef.current) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a,b) => a+b, 0) / data.length;

        if (avg > threshold && !isRec) {
          isRec = true;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
          if (SpeechRecognition) {
            if (!streamingMsg) setStreamingMsg({ original: '', translated: '', isStreaming: true });
            setRecording(true);
            if (roomId) setSpeakingState(roomId, true);
          } else {
            const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
              : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
            const ch = [];
            const r = new MediaRecorder(stream, { mimeType:mime });
            r.ondataavailable = e => { if (e.data.size > 0) ch.push(e.data); };
            r.onstop = async () => {
              const blob = new Blob(ch, { type:r.mimeType });
              if (blob.size > 1000) await processAndSendAudio(blob).catch(console.error);
            };
            vadRecRef.current = r; r.start(100);
            setRecording(true);
            if (roomId) setSpeakingState(roomId, true);
          }
        } else if (avg <= threshold && isRec) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(async () => {
              if (SpeechRecognition) {
                isRec = false; setRecording(false);
                if (roomId) setSpeakingState(roomId, false);
                if (wordBufferRef.current.trim()) await emitChunk();
                const allOriginal = allWordsRef.current.trim();
                if (allOriginal && translatedChunksRef.current.length > 0) {
                  const { myL, otherL } = getTargetLangInfo();
                  const finalTranslation = translatedChunksRef.current.join(' ');
                  try {
                    const msgRes = await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify({ roomId, sender: prefsRef.current.name, original: allOriginal,
                        translated: finalTranslation, sourceLang: myL.code, targetLang: otherL.code }) });
                    try { const d = await msgRes.json(); if (d.message?.id) sentByMeRef.current.add(d.message.id); } catch {}
                  } catch {}
                  wordBufferRef.current = ''; allWordsRef.current = '';
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
    } catch (err) { setStatus('Mic error:' + err.message); }
  }

  function stopFreeTalk() {
    setIsListening(false); setRecording(false);
    if (vadTimerRef.current) { cancelAnimationFrame(vadTimerRef.current); vadTimerRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (vadRecRef.current?.state === 'recording') vadRecRef.current.stop();
    vadStreamRef.current = null; vadAnalyserRef.current = null;
    if (streamingModeRef.current) {
      streamingModeRef.current = false;
      if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} speechRecRef.current = null; }
      if (reviewTimerRef.current) { clearInterval(reviewTimerRef.current); reviewTimerRef.current = null; }
      setStreamingMsg(null);
    }
  }

  useEffect(() => () => {
    stopFreeTalk(); streamingModeRef.current = false;
    if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} }
    if (reviewTimerRef.current) clearInterval(reviewTimerRef.current);
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') { try { backupRecRef.current.stop(); } catch {} }
  }, []);

  // =============================================
  // SHARE
  // =============================================
  function shareApp(lang) {
    const url = `${APP_URL}?lang=${lang || shareAppLang}`;
    const text = t(lang || shareAppLang, 'shareAppText');
    if (navigator.share) navigator.share({ title:'VoiceTranslate', text, url });
    else { navigator.clipboard.writeText(url); setStatus('Link copied!'); setTimeout(() => setStatus(''), 2000); }
  }

  function shareRoom() {
    const url = `${APP_URL}?room=${roomId}&lang=${inviteLang}`;
    if (navigator.share) navigator.share({ title:'VoiceTranslate', text:`${t(inviteLang,'inviteText')}`, url });
    else { navigator.clipboard.writeText(url); setStatus('Link copied!'); setTimeout(() => setStatus(''), 2000); }
  }

  function exportConversation() {
    if (!messages.length) return;
    const roomName = roomInfo?.host ? `${roomInfo.host}'s Room` : roomId;
    const date = new Date().toLocaleString();
    let text = `VoiceTranslate - ${roomName}\n${date}\n${'='.repeat(40)}\n\n`;
    for (const msg of messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      text += `[${time}] ${msg.sender}:\n  ${msg.original}\n  \u2192 ${msg.translated}\n\n`;
    }
    text += `${'='.repeat(40)}\n${messages.length} ${L('messages')} | VoiceTranslate`;
    if (navigator.share) navigator.share({ title: `VoiceTranslate - ${roomName}`, text });
    else { navigator.clipboard.writeText(text); setStatus(L('exportCopied')); setTimeout(() => setStatus(''), 2000); }
  }

  // =============================================
  // CONVERSATION HISTORY & SUMMARY
  // =============================================
  async function loadHistory() {
    if (!prefs.name) return;
    try {
      const res = await fetch('/api/conversation', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'list', userName:prefs.name }) });
      if (res.ok) { const { conversations } = await res.json(); setConvHistory(conversations || []); }
    } catch (e) { console.error('History error:', e); }
  }

  async function endChatAndSave() {
    if (!roomId) return;
    stopPolling(); stopFreeTalk();
    if (streamingModeRef.current) {
      streamingModeRef.current = false;
      if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} speechRecRef.current = null; }
      if (reviewTimerRef.current) { clearInterval(reviewTimerRef.current); reviewTimerRef.current = null; }
    }
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') { try { backupRecRef.current.stop(); } catch {} }
    backupRecRef.current = null; backupStreamRef.current = null;
    setStreamingMsg(null); setStatus('...');
    try {
      await fetch('/api/conversation', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'end', roomId }) });
    } catch (e) { console.error('End chat error:', e); }
    setRoomId(null); setRoomInfo(null); setMessages([]);
    setPartnerSpeaking(false); setStatus(''); setView('home');
  }

  async function viewConversation(convId) {
    setStatus('...');
    try {
      const res = await fetch(`/api/conversation?id=${convId}`);
      if (res.ok) {
        const { conversation } = await res.json();
        if (conversation) {
          if (conversation.host === prefs.name && !conversation.summary) {
            setSummaryLoading(true);
            try {
              const sumRes = await fetch('/api/summary', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ convId }) });
              if (sumRes.ok) { const { summary } = await sumRes.json(); conversation.summary = summary; }
            } catch {}
            setSummaryLoading(false);
          }
          setCurrentConv(conversation); setView('summary');
        }
      }
    } catch (e) { console.error('View conv error:', e); }
    setStatus('');
  }

  function shareSummary() {
    if (!currentConv?.summary) return;
    const s = currentConv.summary;
    const text = `${s.title || 'Conversazione'}\n\n${s.summary || ''}\n\n` +
      (s.keyPoints?.length ? 'Punti chiave:\n' + s.keyPoints.map(p => `\u2022 ${p}`).join('\n') + '\n\n' : '') +
      `Partecipanti: ${s.participants || ''}\nDurata: ${s.duration || ''}\nMessaggi: ${s.messageCount || 0}`;
    if (navigator.share) navigator.share({ title: s.title || 'Report', text });
    else { navigator.clipboard.writeText(text); setStatus(L('reportCopied')); setTimeout(() => setStatus(''), 2000); }
  }

  // =============================================
  // AUTH & CREDITS
  // =============================================
  async function sendAuthCode() {
    if (!authEmail.trim() || !authEmail.includes('@')) { setStatus('Invalid email'); return; }
    setAuthLoading(true); setStatus('');
    try {
      const res = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'send-code', email:authEmail.trim() }) });
      const data = await res.json();
      if (data.ok) { setAuthStep('code'); if (data.testCode) setAuthTestCode(data.testCode); setStatus(''); }
      else { setStatus(data.error || 'Code send error'); }
    } catch (e) { setStatus('Error: ' + e.message); }
    setAuthLoading(false);
  }

  async function verifyAuthCodeFn() {
    if (!authCode.trim()) return;
    setAuthLoading(true); setStatus('');
    try {
      const res = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'verify', email:authEmail.trim(), code:authCode.trim(),
          name:prefs.name, lang:prefs.lang, avatar:prefs.avatar, referralCode:pendingReferralCode }) });
      const data = await res.json();
      if (data.ok && data.token) {
        setUserToken(data.token); userTokenRef.current = data.token;
        localStorage.setItem('vt-token', data.token);
        setUserAccount(data.user); setCreditBalance(data.user.credits || 0);
        setUseOwnKeys(data.user.useOwnKeys || false);
        if (data.referralCode) setReferralCode(data.referralCode);
        if (data.referralInfo?.applied) setStatus('Referral bonus applied! +50 credits');
        setPendingReferralCode(null);
        setAuthStep('choose'); setStatus('');
      } else { setStatus(data.error || 'Codice non valido'); }
    } catch (e) { setStatus('Error: ' + e.message); }
    setAuthLoading(false);
  }

  async function refreshBalance() {
    const token = userTokenRef.current;
    if (!token) return;
    try {
      const res = await fetch('/api/user', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'credits', token }) });
      const data = await res.json();
      if (data.credits !== undefined) { setCreditBalance(data.credits); setUseOwnKeys(data.useOwnKeys || false); }
    } catch {}
  }

  async function buyCredits(packageId) {
    const token = userTokenRef.current;
    if (!token) { setStatus('Login required'); return; }
    setAuthLoading(true); setStatus('');
    try {
      const res = await fetch('/api/stripe', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'checkout', packageId, token }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setStatus(data.error || 'Payment error'); }
    } catch (e) { setStatus('Error: ' + e.message); }
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
        if (apiKeyInputs.elevenlabs?.trim()) setIsTopPro(true);
        setStatus(L('apiKeysSaved'));
        setTimeout(() => { setStatus(''); setView('home'); }, 1000);
      } else { setStatus(data.error || 'Save error'); }
    } catch (e) { setStatus('Error: ' + e.message); }
    setAuthLoading(false);
  }

  function logout() {
    localStorage.removeItem('vt-token');
    setUserToken(null); setUserAccount(null); setCreditBalance(0); setView('home');
  }

  // =============================================
  // i18n shorthand
  // =============================================
  const L = (key) => t(prefs.lang, key);

  // =============================================
  // RENDER
  // =============================================
  if (view === 'loading') return <div style={S.page}><div style={S.center}><div style={{fontSize:40, opacity:0.5}}>...</div></div></div>;

  if (view === 'welcome') return (
    <WelcomeView L={L} S={S} prefs={prefs} setPrefs={setPrefs} savePrefs={savePrefs}
      joinCode={joinCode} userToken={userToken} setView={setView} setAuthStep={setAuthStep} theme={theme} setTheme={setTheme} />
  );

  if (view === 'account') return (
    <AccountView L={L} S={S} authStep={authStep} authEmail={authEmail} setAuthEmail={setAuthEmail}
      authCode={authCode} setAuthCode={setAuthCode} authLoading={authLoading}
      authTestCode={authTestCode} sendAuthCode={sendAuthCode} verifyAuthCodeFn={verifyAuthCodeFn}
      setAuthStep={setAuthStep} setView={setView} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'credits') return (
    <CreditsView L={L} S={S} creditBalance={creditBalance} buyCredits={buyCredits}
      authLoading={authLoading} userAccount={userAccount} setView={setView} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'apikeys') return (
    <ApiKeysView L={L} S={S} apiKeyInputs={apiKeyInputs} setApiKeyInputs={setApiKeyInputs}
      saveUserApiKeys={saveUserApiKeys} authLoading={authLoading} userAccount={userAccount}
      setView={setView} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'settings') return (
    <SettingsView L={L} S={S} prefs={prefs} setPrefs={setPrefs} savePrefs={savePrefs} setView={setView}
      isTrial={isTrial} isTopPro={isTopPro} setIsTopPro={setIsTopPro} useOwnKeys={useOwnKeys}
      apiKeyInputs={apiKeyInputs} platformHasEL={platformHasEL} elevenLabsVoices={elevenLabsVoices}
      selectedELVoice={selectedELVoice} setSelectedELVoice={setSelectedELVoice}
      setElevenLabsVoices={setElevenLabsVoices} userToken={userToken} userTokenRef={userTokenRef}
      userAccount={userAccount} logout={logout} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'home') return (
    <HomeView L={L} S={S} prefs={prefs} myLang={myLang} selectedMode={selectedMode}
      setSelectedMode={setSelectedMode} selectedContext={selectedContext}
      setSelectedContext={setSelectedContext} roomDescription={roomDescription}
      setRoomDescription={setRoomDescription} handleCreateRoom={handleCreateRoom} setView={setView}
      userToken={userToken} userAccount={userAccount} useOwnKeys={useOwnKeys}
      creditBalance={creditBalance} refreshBalance={refreshBalance} setAuthStep={setAuthStep}
      loadHistory={loadHistory} showShareApp={showShareApp} setShowShareApp={setShowShareApp}
      shareAppLang={shareAppLang} setShareAppLang={setShareAppLang} shareApp={shareApp}
      showTutorial={showTutorial} setShowTutorial={setShowTutorial} tutorialStep={tutorialStep}
      setTutorialStep={setTutorialStep} status={status} isTrial={isTrial} platformHasEL={platformHasEL}
      referralCode={referralCode}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'join') return (
    <JoinView L={L} S={S} prefs={prefs} setPrefs={setPrefs} savePrefs={savePrefs} myLang={myLang}
      setMyLang={setMyLang} joinCode={joinCode} setJoinCode={setJoinCode}
      inviteMsgLang={inviteMsgLang} setInviteMsgLang={setInviteMsgLang}
      handleJoinRoom={handleJoinRoom} setView={setView} userToken={userToken}
      setAuthStep={setAuthStep} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'lobby') return (
    <LobbyView L={L} S={S} roomId={roomId} roomInfo={roomInfo} partnerConnected={partnerConnected}
      inviteLang={inviteLang} setInviteLang={setInviteLang} shareRoom={shareRoom}
      leaveRoom={leaveRoom} unlockAudio={unlockAudio} setView={setView}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'room') return (
    <RoomView L={L} S={S} prefs={prefs} myLang={myLang} roomId={roomId} roomInfo={roomInfo}
      messages={messages} streamingMsg={streamingMsg} recording={recording}
      isListening={isListening} partnerConnected={partnerConnected}
      partnerSpeaking={partnerSpeaking} partnerLiveText={partnerLiveText}
      partnerTyping={partnerTyping} playingMsgId={playingMsgId}
      audioEnabled={audioEnabled} setAudioEnabled={setAudioEnabled}
      isTrial={isTrial} isTopPro={isTopPro} showModeSelector={showModeSelector}
      setShowModeSelector={setShowModeSelector} textInput={textInput} setTextInput={setTextInput}
      sendingText={sendingText} sendTextMessage={sendTextMessage} sendTypingState={sendTypingState}
      toggleRecording={toggleRecording} startFreeTalk={startFreeTalk} stopFreeTalk={stopFreeTalk}
      endChatAndSave={endChatAndSave} changeRoomMode={changeRoomMode} playMessage={playMessage}
      unlockAudio={unlockAudio} exportConversation={exportConversation} status={status}
      msgsEndRef={msgsEndRef} freeCharsUsed={freeCharsUsed} freeLimitExceeded={freeLimitExceeded}
      freeResetTime={freeResetTime} setView={setView}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'history') return (
    <HistoryView L={L} S={S} prefs={prefs} convHistory={convHistory}
      viewConversation={viewConversation} setView={setView} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'summary') return (
    <SummaryView L={L} S={S} prefs={prefs} currentConv={currentConv} summaryLoading={summaryLoading}
      shareSummary={shareSummary} setCurrentConv={setCurrentConv} setView={setView} status={status}  theme={theme} setTheme={setTheme} />
  );

  return null;
}
