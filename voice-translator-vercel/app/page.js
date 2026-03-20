'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { t, mapLang, preloadLang } from './lib/i18n.js';
import { APP_URL, LANGS, VOICES, AVATARS, AVATAR_NAMES, MODES, CONTEXTS, FONT, CREDIT_PACKAGES,
  FREE_DAILY_LIMIT, THEMES, getLang, vibrate, formatCredits } from './lib/constants.js';
import getStyles from './lib/styles.js';

// Custom hooks
import useAudioSystem from './hooks/useAudioSystem.js';
import useTranslation from './hooks/useTranslation.js';
import useRoomPolling from './hooks/useRoomPolling.js';
import useAuth from './hooks/useAuth.js';
import useContacts from './hooks/useContacts.js';
import useWebRTC from './hooks/useWebRTC.js';
import useConversationContext from './hooks/useConversationContext.js';

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
import VoiceTestView from './components/VoiceTestView.js';
import ContactsView from './components/ContactsView.js';
import VoiceCloneView from './components/VoiceCloneView.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import ConnectionQuality from './components/ConnectionQuality.js';


export default function Home() {
  return (
    <ErrorBoundary>
      <HomeInner />
    </ErrorBoundary>
  );
}

function HomeInner() {
  // =============================================
  // LOCAL STATE
  // =============================================
  const [view, setView] = useState('loading');
  const [prefs, setPrefs] = useState({ name:'', lang:'it', avatar:AVATARS[0], voice:'nova', autoPlay:true });
  const [convHistory, setConvHistory] = useState([]);
  const [currentConv, setCurrentConv] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [myLang, setMyLang] = useState('it');
  const [status, setStatus] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [selectedMode, setSelectedMode] = useState('conversation');
  const [selectedContext, setSelectedContext] = useState('general');
  const [roomDescription, setRoomDescription] = useState('');
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [inviteLang, setInviteLang] = useState('en');
  const [inviteMsgLang, setInviteMsgLang] = useState(null);
  const [showShareApp, setShowShareApp] = useState(false);
  const [shareAppLang, setShareAppLang] = useState('en');

  // FREE tier usage tracking
  const [freeCharsUsed, setFreeCharsUsed] = useState(0);
  const [freeLimitExceeded, setFreeLimitExceeded] = useState(false);
  const [freeResetTime, setFreeResetTime] = useState('');
  const freeCharsRef = useRef(0);

  // PWA install + notifications
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // Theme state
  const [theme, setTheme] = useState(THEMES.DARK);

  // Refs — created BEFORE hooks so they can be shared
  const msgsEndRef = useRef(null);
  const prefsRef = useRef({ name:'', lang:'it', avatar:AVATARS[0], voice:'nova', autoPlay:true });
  const myLangRef = useRef('it');
  const roomInfoRef = useRef(null);
  const roomContextRef = useRef({ contextId: 'general', contextPrompt: '', description: '' });
  const roomIdRef = useRef(null);

  // ── Stable ref for P2P DataChannel message sending ──
  // Declared before hooks so useTranslation can reference it via callback wrapper
  const sendDirectMessageRef = useRef(null);
  const sendDirectMessageStable = useCallback((msg) => {
    return sendDirectMessageRef.current ? sendDirectMessageRef.current(msg) : false;
  }, []);

  // =============================================
  // HOOKS — now use the SAME refs that get synced below
  // =============================================
  const auth = useAuth();
  const convContext = useConversationContext();
  const audio = useAudioSystem({
    prefsRef,
    myLangRef,
    isTrialRef: auth.isTrialRef,
    isTopProRef: auth.isTopProRef,
    canUseElevenLabsRef: auth.canUseElevenLabsRef,
    selectedELVoice: auth.selectedELVoice,
    roomIdRef,
    getEffectiveToken: auth.getEffectiveToken
  });
  const roomPolling = useRoomPolling({
    prefsRef,
    myLangRef,
    roomInfoRef,
    queueAudio: audio.queueAudio,
    getEffectiveToken: auth.getEffectiveToken,
    onMessageReceived: convContext.addMessage, // Feed incoming messages to conversation context
  });
  const translation = useTranslation({
    myLangRef,
    roomInfoRef,
    prefsRef,
    roomId: roomPolling.roomId,
    roomContextRef,
    isTrialRef: auth.isTrialRef,
    isTopProRef: auth.isTopProRef,
    freeCharsRef,
    useOwnKeys: auth.useOwnKeys,
    getMicStream: audio.getMicStream,
    unlockAudio: audio.unlockAudio,
    broadcastLiveText: roomPolling.broadcastLiveText,
    setSpeakingState: roomPolling.setSpeakingState,
    getEffectiveToken: auth.getEffectiveToken,
    refreshBalance: auth.refreshBalance,
    trackFreeChars,
    userEmail: auth.userAccount?.email || auth.authEmail || '',
    sentByMeRef: roomPolling.sentByMeRef,  // FASE 1A: for message dedup
    roomSessionTokenRef: roomPolling.roomSessionTokenRef,
    broadcastMessage: roomPolling.broadcastMessage,
    broadcastMessageUpdate: roomPolling.broadcastMessageUpdate,
    sendDirectMessage: sendDirectMessageStable,
    verifiedNameRef: roomPolling.verifiedNameRef,
    addLocalMessage: roomPolling.addLocalMessage,
    updateLocalMessage: roomPolling.updateLocalMessage,
    conversationContext: convContext, // Rolling knowledge base for context-aware translation
  });
  const contactsHook = useContacts({ userTokenRef: auth.userTokenRef });

  // Handle incoming P2P messages via DataChannel
  const handleDirectMessage = useCallback((msg) => {
    if (msg?.type === 'chat-message' && msg.message) {
      const message = msg.message;
      // Dedup: skip if we sent it ourselves
      if (roomPolling.sentByMeRef?.current?.has(message.id)) return;
      // Add to messages list via the same handler used by Realtime
      roomPolling.addIncomingMessage(message);
      // ── Send delivery ack back to sender via P2P ──
      if (sendDirectMessageRef.current && message.id) {
        try { sendDirectMessageRef.current({ type: 'msg-ack', msgId: message.id }); } catch {}
      }
    }
    // Phase 2: translation update arrived via P2P — forward to same handler as Realtime
    if (msg?.type === 'message-update' && msg.original) {
      roomPolling.handleMessageUpdate(msg);
    }
    // ── Delivery ack received — update message status to 'delivered' ──
    if (msg?.type === 'msg-ack' && msg.msgId) {
      roomPolling.markDelivered(msg.msgId);
    }
    // ── Read receipt received — update message status to 'read' ──
    if (msg?.type === 'msg-read' && msg.msgId) {
      roomPolling.markRead(msg.msgId);
    }
  }, [roomPolling.sentByMeRef, roomPolling.addIncomingMessage, roomPolling.handleMessageUpdate]);

  const webrtc = useWebRTC({
    roomId: roomPolling.roomId,
    myName: roomPolling.verifiedNameRef?.current || prefs.name,
    onDirectMessage: handleDirectMessage,
    roomSessionTokenRef: roomPolling.roomSessionTokenRef,
  });

  // Sync sendDirectMessageRef when WebRTC connects/disconnects
  useEffect(() => {
    sendDirectMessageRef.current = webrtc.webrtcConnected ? webrtc.sendDirectMessage : null;
  }, [webrtc.webrtcConnected, webrtc.sendDirectMessage]);

  // =============================================
  // STYLES & THEME
  // =============================================
  const S = useMemo(() => getStyles(theme), [theme]);

  // Load theme from localStorage
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('vt-theme');
      if (savedTheme && Object.values(THEMES).includes(savedTheme)) {
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
  useEffect(() => { roomInfoRef.current = roomPolling.roomInfo; }, [roomPolling.roomInfo]);
  useEffect(() => { roomIdRef.current = roomPolling.roomId; }, [roomPolling.roomId]);


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
  // AUTO-LOAD ELEVENLABS VOICES
  // =============================================
  // When a PRO user has ElevenLabs access and voices aren't loaded yet,
  // auto-fetch so the voice picker in RoomView works immediately
  useEffect(() => {
    if (auth.canUseElevenLabs && auth.elevenLabsVoices.length === 0) {
      const token = auth.userTokenRef.current || '';
      fetch(`/api/tts-elevenlabs?action=voices&token=${token}`)
        .then(r => r.json())
        .then(data => {
          if (data.voices) auth.setElevenLabsVoices(data.voices);
        })
        .catch(() => {});
    }
  }, [auth.canUseElevenLabs]);

  // Persist selected ElevenLabs voice to localStorage
  useEffect(() => {
    try {
      const savedVoice = localStorage.getItem('vt-elvoice');
      if (savedVoice) auth.setSelectedELVoice(savedVoice);
    } catch {}
  }, []);

  useEffect(() => {
    if (auth.selectedELVoice) {
      try { localStorage.setItem('vt-elvoice', auth.selectedELVoice); } catch {}
    }
  }, [auth.selectedELVoice]);

  // Auto-select cloned voice as default when available and no voice selected
  useEffect(() => {
    if (auth.clonedVoiceId && !auth.selectedELVoice && auth.canUseElevenLabs) {
      auth.setSelectedELVoice(auth.clonedVoiceId);
    }
  }, [auth.clonedVoiceId, auth.canUseElevenLabs]);

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
        if (!p.avatar || !p.avatar.startsWith('/avatars/') || !p.avatar.endsWith('.png')) p.avatar = AVATARS[0];
        setPrefs(p); setMyLang(p.lang);
      }

      const langParam = urlParams.get('lang');
      if (langParam && LANGS.find(l => l.code === langParam)) {
        setInviteMsgLang(langParam);
        setMyLang(langParam);
        // Always update prefs.lang to invite language (so savePrefs won't overwrite myLang)
        setPrefs(p => ({...p, lang: langParam}));
      }

      // Capture referral code from URL
      const refParam = urlParams.get('ref');
      if (refParam) {
        auth.setPendingReferralCode(refParam);
      }

      // Capture invite code from URL (contacts system)
      const inviteParam = urlParams.get('invite');
      if (inviteParam) {
        // Store for processing after auth
        localStorage.setItem('vt-pending-invite', inviteParam);
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (roomParam) {
        setJoinCode(roomParam.toUpperCase());
        // Clean URL so back button works properly (prevents re-entering join on refresh)
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (paymentStatus === 'success' && paymentCredits) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      const pickView = (hasSaved) => {
        if (roomParam) return 'join';
        if (!hasSaved) return 'welcome';
        return 'home';
      };

      // ── DEV_MODE check: bypass auth for testers ──
      fetch('/api/health').then(r => r.json()).then(h => {
        if (h.devMode) {
          console.log('[DEV_MODE] Active — all features unlocked for testing');
          auth.setIsTrial(false);
          auth.setIsTopPro(true);
          auth.setCanUseElevenLabs(true);
          auth.setCreditBalance(99999);
          auth.setPlatformHasEL(true);
        }
      }).catch(() => {});

      if (savedToken) {
        auth.setUserToken(savedToken);
        auth.userTokenRef.current = savedToken;
        // FAST PATH: show view immediately for returning users (don't wait for /api/auth)
        // Auth validates in background — user sees home/join instantly
        setView(pickView(!!saved));
        // Background validation — updates account data without blocking UI
        fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ action:'me', token:savedToken })
        }).then(r => r.json()).then(data => {
          if (data.user) {
            auth.setUserAccount(data.user);
            auth.setCreditBalance(data.user.credits || 0);
            auth.setUseOwnKeys(data.user.useOwnKeys || false);
            if (data.referralCode) auth.setReferralCode(data.referralCode);
            if (data.platformHasElevenLabs) auth.setPlatformHasEL(true);
            // Restore saved API keys into state so Settings shows them
            if (data.user.useOwnKeys && data.user.apiKeys) {
              auth.setApiKeyInputs({
                openai: data.user.apiKeys.openai || '',
                anthropic: data.user.apiKeys.anthropic || '',
                gemini: data.user.apiKeys.gemini || '',
                elevenlabs: data.user.apiKeys.elevenlabs || ''
              });
              if (data.user.apiKeys.elevenlabs) auth.setIsTopPro(true);
            }
            // Restore cloned voice if exists
            if (data.user.clonedVoiceId) {
              auth.setClonedVoiceId(data.user.clonedVoiceId);
              auth.setClonedVoiceName(data.user.clonedVoiceName || 'My Voice');
            }
          } else {
            // Token invalid — clear it but DON'T redirect (user is already on a page)
            localStorage.removeItem('vt-token');
            auth.setUserToken(null);
          }
        }).catch(() => { /* Network error — stay on current view, token might still be valid */ });
      } else {
        setView(pickView(!!saved));
      }
    } catch { setView('welcome'); }
  }, []);

  // Register service worker for offline support + force update stale caches
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.update().catch(() => {});
      }).catch(err => console.error('SW registration failed:', err));
    }
  }, []);

  // =============================================
  // PWA INSTALL PROMPT
  // =============================================
  useEffect(() => {
    // Capture the install prompt event
    function handleBeforeInstall(e) {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      // Show install banner if not dismissed before
      if (!localStorage.getItem('vt-install-dismissed')) {
        setShowInstallBanner(true);
      }
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Check current notification permission
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  async function handleInstallApp() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
      setDeferredInstallPrompt(null);
    }
  }

  function dismissInstallBanner() {
    setShowInstallBanner(false);
    localStorage.setItem('vt-install-dismissed', '1');
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    return perm;
  }

  // Send local notification when new messages arrive and app is in background
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    const msgs = roomPolling.messages || [];
    if (msgs.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
      const lastMsg = msgs[msgs.length - 1];
      // Only notify if message is from partner (not from us) and page is hidden
      if (lastMsg && lastMsg.speaker !== prefs.name && document.hidden) {
        // Update badge
        if (navigator.setAppBadge) {
          const unread = msgs.length - prevMsgCountRef.current;
          navigator.setAppBadge(unread).catch(() => {});
        }
        // Send local notification via SW
        if (notifPermission === 'granted' && navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_LOCAL_NOTIFICATION',
            title: `${lastMsg.speaker || 'Partner'}`,
            body: lastMsg.translated || lastMsg.original || 'Nuovo messaggio',
            tag: `vt-msg-${roomPolling.roomId}`,
            roomId: roomPolling.roomId,
            url: '/'
          });
        }
      }
    }
    prevMsgCountRef.current = msgs.length;
  }, [roomPolling.messages]);

  // Clear badge when page becomes visible
  useEffect(() => {
    function handleVisibility() {
      if (!document.hidden && navigator.clearAppBadge) {
        navigator.clearAppBadge().catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [roomPolling.messages]);

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

  /**
   * Re-translate recent partner messages when user changes language.
   * Translates the last N messages that don't have a translation for the new lang.
   */
  async function retranslateForNewLang(newLangCode) {
    const msgs = roomPolling.messages;
    const myName = roomPolling.verifiedNameRef?.current || prefs.name;
    if (!msgs || msgs.length === 0 || !translation.translateUniversal) return;

    // Collect partner messages missing translation for newLangCode (last 15)
    const toRetranslate = msgs
      .filter(m => m.sender !== myName && m.original && (!m.translations || !m.translations[newLangCode]))
      .slice(-15);

    if (toRetranslate.length === 0) return;

    const newLang = getLang(newLangCode);

    // Translate in parallel (max 5 at a time)
    const batches = [];
    for (let i = 0; i < toRetranslate.length; i += 5) {
      batches.push(toRetranslate.slice(i, i + 5));
    }

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(async (msg) => {
          const srcLang = getLang(msg.sourceLang || 'en');
          try {
            const data = await translation.translateUniversal(
              msg.original, srcLang.code, newLang.code, srcLang.name, newLang.name, {}
            );
            return { msgId: msg.id, translated: data.translated || '' };
          } catch {
            return { msgId: msg.id, translated: '' };
          }
        })
      );

      // Update messages state with new translations
      const translationMap = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.translated) {
          translationMap[r.value.msgId] = r.value.translated;
        }
      }

      if (Object.keys(translationMap).length > 0) {
        roomPolling.setMessages(prev => prev.map(m => {
          if (translationMap[m.id]) {
            return {
              ...m,
              translations: { ...(m.translations || {}), [newLangCode]: translationMap[m.id] }
            };
          }
          return m;
        }));
      }
    }
  }

  // Process pending invite after auth
  useEffect(() => {
    if (!auth.userToken) return;
    const pendingInvite = localStorage.getItem('vt-pending-invite');
    if (pendingInvite) {
      localStorage.removeItem('vt-pending-invite');
      contactsHook.acceptInvite(pendingInvite).then(result => {
        if (result.ok) {
          setStatus(L('createRoom') === 'Crea Stanza'
            ? `Contatto aggiunto: ${result.inviter?.name || result.inviter?.email || ''}`
            : `Contact added: ${result.inviter?.name || result.inviter?.email || ''}`);
          setTimeout(() => setStatus(''), 3000);
        }
      });
    }
  }, [auth.userToken]);

  // Start chat with a contact — create room and go to lobby
  async function handleStartChatWithContact(contact) {
    try {
      setStatus('...');
      const room = await roomPolling.handleCreateRoom(
        prefs.name, myLang, 'conversation', prefs.avatar,
        'general', 'conversation', '',
        auth.isTrial, auth.isTopPro, auth.userAccount
      );
      roomContextRef.current = { contextId: 'general', contextPrompt: '', description: '' };
      // Send invite link to the contact (could also push notification in future)
      setInviteLang(contact.lang || 'en');
      setView('lobby');
      setStatus('');
    } catch (e) { setStatus('Error: ' + e.message); }
  }

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
    const url = `${APP_URL}?room=${roomPolling.roomId}&lang=${inviteLang}`;
    if (navigator.share) navigator.share({ title:'VoiceTranslate', text:`${t(inviteLang,'inviteText')}`, url });
    else { navigator.clipboard.writeText(url); setStatus('Link copied!'); setTimeout(() => setStatus(''), 2000); }
  }

  function exportConversation() {
    if (!roomPolling.messages.length) return;
    const roomName = roomPolling.roomInfo?.host ? `${roomPolling.roomInfo.host}'s Room` : roomPolling.roomId;
    const date = new Date().toLocaleString();
    let text = `VoiceTranslate - ${roomName}\n${date}\n${'='.repeat(40)}\n\n`;
    for (const msg of roomPolling.messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      text += `[${time}] ${msg.sender}:\n  ${msg.original}\n  \u2192 ${msg.translated}\n\n`;
    }
    text += `${'='.repeat(40)}\n${roomPolling.messages.length} ${L('messages')} | VoiceTranslate`;
    if (navigator.share) navigator.share({ title: `VoiceTranslate - ${roomName}`, text });
    else { navigator.clipboard.writeText(text); setStatus(L('exportCopied')); setTimeout(() => setStatus(''), 2000); }
  }

  // =============================================
  // CONVERSATION HISTORY & SUMMARY
  // =============================================
  async function loadHistory() {
    if (!prefs.name) return;
    try {
      const listBody = { action:'list', userToken: auth.userTokenRef?.current || null };
      if (!auth.userTokenRef?.current) listBody.userName = prefs.name;
      const res = await fetch('/api/conversation', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(listBody) });
      if (res.ok) { const { conversations } = await res.json(); setConvHistory(conversations || []); }
    } catch (e) { console.error('History error:', e); }
  }

  async function endChatAndSave() {
    if (!roomPolling.roomId) return;
    roomPolling.stopPolling();
    setStatus('...');
    try {
      const endBody = { action:'end', roomId: roomPolling.roomId,
        roomSessionToken: roomPolling.roomSessionTokenRef?.current || null };
      if (!roomPolling.roomSessionTokenRef?.current) endBody.userName = prefs.name;
      await fetch('/api/conversation', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(endBody) });
    } catch (e) { console.error('End chat error:', e); }
    roomPolling.leaveRoom();
    convContext.resetContext(); // Clear conversation knowledge base
    setStatus('');
    setView('home');
  }

  function leaveRoomTemporary() {
    if (!roomPolling.roomId) return;
    // Save room to active rooms list in localStorage
    try {
      let activeRooms = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]');
      const roomData = {
        roomId: roomPolling.roomId,
        host: roomPolling.roomInfo?.host,
        members: roomPolling.roomInfo?.members?.map(m => ({name: m.name, lang: m.lang, avatar: m.avatar})) || [],
        mode: roomPolling.roomInfo?.mode || 'conversation',
        leftAt: Date.now()
      };
      activeRooms = activeRooms.filter(r => r.roomId !== roomData.roomId);
      activeRooms.unshift(roomData);
      localStorage.setItem('vt-active-rooms', JSON.stringify(activeRooms.slice(0, 10)));
    } catch {}
    roomPolling.stopPolling();
    roomPolling.leaveRoom();
    setView('home');
  }

  async function rejoinRoom(rid) {
    audio.unlockAudio();
    try {
      setStatus('...');
      const room = await roomPolling.handleJoinRoom(rid, prefs.name, myLang, prefs.avatar);
      roomInfoRef.current = room;
      roomContextRef.current = { contextId: room.context || 'general', contextPrompt: room.contextPrompt || '', description: room.description || '' };
      const hostTier = room.hostTier || 'FREE';
      auth.roomTierOverrideRef.current = hostTier;
      if (hostTier === 'FREE') { auth.setIsTrial(true); auth.setIsTopPro(false); }
      else if (hostTier === 'TOP PRO') { auth.setIsTrial(false); auth.setIsTopPro(true); }
      else { auth.setIsTrial(false); auth.setIsTopPro(false); }
      // Remove from active rooms list since we're back in
      try {
        let activeRooms = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]');
        activeRooms = activeRooms.filter(r => r.roomId !== rid);
        localStorage.setItem('vt-active-rooms', JSON.stringify(activeRooms));
      } catch {}
      setView('room');
      setStatus('');
    } catch (e) {
      // Room expired or gone — remove from active rooms
      try {
        let activeRooms = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]');
        activeRooms = activeRooms.filter(r => r.roomId !== rid);
        localStorage.setItem('vt-active-rooms', JSON.stringify(activeRooms));
      } catch {}
      setStatus('Chat terminata');
      setTimeout(() => setStatus(''), 2000);
    }
  }

  async function viewConversation(convId) {
    setStatus('...');
    try {
      const rstParam = roomPolling.roomSessionTokenRef?.current ? `&rst=${encodeURIComponent(roomPolling.roomSessionTokenRef.current)}` : '';
      const utParam = auth.userTokenRef?.current ? `&userToken=${encodeURIComponent(auth.userTokenRef.current)}` : '';
      const nameParam = (!rstParam && !utParam) ? `&name=${encodeURIComponent(prefs.name)}` : '';
      const res = await fetch(`/api/conversation?id=${convId}${nameParam}${rstParam}${utParam}`);
      if (res.ok) {
        const { conversation } = await res.json();
        if (conversation) {
          const verifiedName = roomPolling.verifiedNameRef?.current || prefs.name;
          if (conversation.host === verifiedName && !conversation.summary) {
            setSummaryLoading(true);
            try {
              const sumRes = await fetch('/api/summary', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ convId, userToken: auth.userTokenRef?.current || null }) });
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

  // Helper functions
  async function changeRoomMode(newMode) {
    if (!roomPolling.roomId) return;
    try {
      const body = { action:'changeMode', roomId: roomPolling.roomId, mode:newMode };
      if (roomPolling.roomSessionTokenRef?.current) {
        body.roomSessionToken = roomPolling.roomSessionTokenRef.current;
      } else {
        body.name = prefs.name;
      }
      await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body) });
      setShowModeSelector(false);
    } catch (e) { console.error('Mode change error:', e); }
  }

  async function handleCreateRoom() {
    try {
      setStatus('...');
      const room = await roomPolling.handleCreateRoom(
        prefs.name, myLang, selectedMode, prefs.avatar,
        selectedContext, selectedMode, roomDescription,
        auth.isTrial, auth.isTopPro, auth.userAccount
      );
      // Immediately sync roomInfoRef (don't wait for useEffect re-render)
      roomInfoRef.current = room;
      roomContextRef.current = { contextId: selectedContext, contextPrompt: CONTEXTS.find(c => c.id === selectedContext)?.prompt || '', description: roomDescription };
      setView('lobby');
      setStatus('');
    } catch (e) { setStatus('Error: ' + e.message); }
  }

  async function startChatWithContact(contact) {
    try {
      setStatus('...');
      const room = await roomPolling.handleCreateRoom(
        prefs.name, myLang, selectedMode, prefs.avatar,
        selectedContext, selectedMode, '',
        auth.isTrial, auth.isTopPro, auth.userAccount
      );
      roomInfoRef.current = room;
      roomContextRef.current = { contextId: selectedContext, contextPrompt: CONTEXTS.find(c => c.id === selectedContext)?.prompt || '', description: '' };
      setView('lobby');
      setStatus('');
      // Auto-copy invite link for the contact
      const link = `${window.location.origin}?room=${room.roomId}`;
      try { await navigator.clipboard.writeText(link); } catch {}
    } catch (e) { setStatus('Error: ' + e.message); }
  }

  async function handleJoinRoom() {
    if (!joinCode.trim()) return;
    // Unlock audio + mic early (must be in user gesture context)
    audio.unlockAudio();
    try {
      setStatus('...');
      const room = await roomPolling.handleJoinRoom(joinCode, prefs.name, myLang, prefs.avatar);
      // Immediately sync roomInfoRef (don't wait for useEffect re-render)
      // This ensures getTargetLangInfo() sees the partner's language right away
      roomInfoRef.current = room;
      roomContextRef.current = { contextId: room.context || 'general', contextPrompt: room.contextPrompt || '', description: room.description || '' };
      const hostTier = room.hostTier || 'FREE';
      auth.roomTierOverrideRef.current = hostTier;
      if (hostTier === 'FREE') { auth.setIsTrial(true); auth.setIsTopPro(false); }
      else if (hostTier === 'TOP PRO') { auth.setIsTrial(false); auth.setIsTopPro(true); }
      else { auth.setIsTrial(false); auth.setIsTopPro(false); }
      setView('room');
      setStatus('');
    } catch (e) { setStatus('Error: ' + e.message); }
  }


  // =============================================
  // i18n — preload language pack when user switches language
  // =============================================
  useEffect(() => { if (prefs.lang) preloadLang(prefs.lang); }, [prefs.lang]);
  const L = (key) => t(prefs.lang, key);

  // =============================================
  // RENDER
  // =============================================
  if (view === 'loading') return (
    <div style={S.page}>
      <style>{`@keyframes vtSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.center}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid rgba(108,99,255,0.2)', borderTopColor: '#6C63FF',
          animation: 'vtSpin 0.8s linear infinite',
        }} />
      </div>
    </div>
  );

  if (view === 'welcome') return (
    <WelcomeView L={L} S={S} prefs={prefs} setPrefs={setPrefs} savePrefs={savePrefs}
      joinCode={joinCode} userToken={auth.userToken} setView={setView} setAuthStep={auth.setAuthStep} theme={theme} setTheme={setTheme}
      sendAuthCode={auth.sendAuthCode} verifyAuthCodeFn={() => auth.verifyAuthCodeFn(auth.pendingReferralCode)}
      loginWithGoogle={auth.loginWithGoogle} loginWithApple={auth.loginWithApple}
      authStep={auth.authStep} authEmail={auth.authEmail} setAuthEmail={auth.setAuthEmail}
      authCode={auth.authCode} setAuthCode={auth.setAuthCode} authLoading={auth.authLoading}
      authTestCode={auth.authTestCode} pendingReferralCode={auth.pendingReferralCode} />
  );

  if (view === 'account') return (
    <AccountView L={L} S={S} authStep={auth.authStep} authEmail={auth.authEmail} setAuthEmail={auth.setAuthEmail}
      authCode={auth.authCode} setAuthCode={auth.setAuthCode} authLoading={auth.authLoading}
      authTestCode={auth.authTestCode} sendAuthCode={auth.sendAuthCode} verifyAuthCodeFn={() => auth.verifyAuthCodeFn(auth.pendingReferralCode)}
      loginWithGoogle={auth.loginWithGoogle} loginWithApple={auth.loginWithApple}
      pendingReferralCode={auth.pendingReferralCode}
      setAuthStep={auth.setAuthStep} setView={setView} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'credits') return (
    <CreditsView L={L} S={S} creditBalance={auth.creditBalance} buyCredits={auth.buyCredits}
      authLoading={auth.authLoading} userAccount={auth.userAccount} setView={setView} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'apikeys') return (
    <ApiKeysView L={L} S={S} apiKeyInputs={auth.apiKeyInputs} setApiKeyInputs={auth.setApiKeyInputs}
      saveUserApiKeys={auth.saveUserApiKeys} authLoading={auth.authLoading} userAccount={auth.userAccount}
      setView={setView} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'settings') return (
    <SettingsView L={L} S={S} prefs={prefs} setPrefs={setPrefs} savePrefs={savePrefs} setView={setView}
      isTrial={auth.isTrial} isTopPro={auth.isTopPro} setIsTopPro={auth.setIsTopPro} useOwnKeys={auth.useOwnKeys}
      apiKeyInputs={auth.apiKeyInputs} platformHasEL={auth.platformHasEL} elevenLabsVoices={auth.elevenLabsVoices}
      selectedELVoice={auth.selectedELVoice} setSelectedELVoice={auth.setSelectedELVoice}
      setElevenLabsVoices={auth.setElevenLabsVoices} userToken={auth.userToken} userTokenRef={auth.userTokenRef}
      userAccount={auth.userAccount} logout={auth.logout} status={status}  theme={theme} setTheme={setTheme}
      creditBalance={auth.creditBalance} refreshBalance={auth.refreshBalance} freeCharsUsed={freeCharsUsed}
      clonedVoiceId={auth.clonedVoiceId} clonedVoiceName={auth.clonedVoiceName}
      setClonedVoiceId={auth.setClonedVoiceId} setClonedVoiceName={auth.setClonedVoiceName} />
  );

  if (view === 'home') return (
    <HomeView L={L} S={S} prefs={prefs} setPrefs={setPrefs} savePrefs={savePrefs} myLang={myLang}
      selectedMode={selectedMode} setSelectedMode={setSelectedMode}
      selectedContext={selectedContext} setSelectedContext={setSelectedContext}
      roomDescription={roomDescription} setRoomDescription={setRoomDescription}
      handleCreateRoom={handleCreateRoom} setView={setView}
      theme={theme} setTheme={setTheme}
      contacts={contactsHook.contacts} fetchContacts={contactsHook.fetchContacts}
      rejoinRoom={rejoinRoom} startChatWithContact={startChatWithContact} />
  );

  if (view === 'join') return (
    <JoinView L={L} S={S} prefs={prefs} setPrefs={setPrefs} savePrefs={savePrefs} myLang={myLang}
      setMyLang={setMyLang} joinCode={joinCode} setJoinCode={setJoinCode}
      inviteMsgLang={inviteMsgLang} setInviteMsgLang={setInviteMsgLang}
      handleJoinRoom={handleJoinRoom} setView={setView} userToken={auth.userToken}
      setAuthStep={auth.setAuthStep} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'lobby') return (
    <LobbyView L={L} S={S} roomId={roomPolling.roomId} roomInfo={roomPolling.roomInfo} partnerConnected={roomPolling.partnerConnected}
      inviteLang={inviteLang} setInviteLang={setInviteLang} shareRoom={shareRoom}
      leaveRoom={() => { roomPolling.leaveRoom(); convContext.resetContext(); setView('home'); }} unlockAudio={audio.unlockAudio} setView={setView}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'room') return (
    <RoomView L={L} S={S} prefs={prefs} myLang={myLang} roomId={roomPolling.roomId} roomInfo={roomPolling.roomInfo}
      messages={roomPolling.messages} streamingMsg={translation.streamingMsg} recording={translation.recording}
      isListening={translation.isListening} partnerConnected={roomPolling.partnerConnected}
      partnerSpeaking={roomPolling.partnerSpeaking} partnerLiveText={roomPolling.partnerLiveText}
      partnerTyping={roomPolling.partnerTyping} playingMsgId={audio.playingMsgId}
      audioEnabled={audio.audioEnabled} setAudioEnabled={audio.setAudioEnabled}
      isTrial={auth.isTrial} isTopPro={auth.isTopPro} canUseElevenLabs={auth.canUseElevenLabs}
      useOwnKeys={auth.useOwnKeys} apiKeyInputs={auth.apiKeyInputs}
      elevenLabsVoices={auth.elevenLabsVoices} selectedELVoice={auth.selectedELVoice}
      setSelectedELVoice={auth.setSelectedELVoice}
      showModeSelector={showModeSelector}
      setShowModeSelector={setShowModeSelector} textInput={translation.textInput} setTextInput={translation.setTextInput}
      sendingText={translation.sendingText} sendTextMessage={translation.sendTextMessage} sendTypingState={roomPolling.sendTypingState}
      toggleRecording={translation.toggleRecording} cancelRecording={translation.cancelRecording}
      startFreeTalk={translation.startFreeTalk} stopFreeTalk={translation.stopFreeTalk}
      endChatAndSave={endChatAndSave} leaveRoomTemporary={leaveRoomTemporary} changeRoomMode={changeRoomMode} playMessage={audio.playMessage}
      unlockAudio={audio.unlockAudio} exportConversation={exportConversation} status={status}
      msgsEndRef={msgsEndRef} freeCharsUsed={freeCharsUsed} freeLimitExceeded={freeLimitExceeded}
      freeResetTime={freeResetTime} setView={setView} setMyLang={setMyLang} savePrefs={savePrefs}
      syncLangChange={roomPolling.syncLangChange} retranslateForNewLang={retranslateForNewLang} theme={theme} setTheme={setTheme}
      clonedVoiceId={auth.clonedVoiceId} clonedVoiceName={auth.clonedVoiceName}
      duckingLevel={audio.duckingLevel} setDuckingLevel={audio.setDuckingLevel}
      vadAudioLevel={translation.vadAudioLevel} vadSilenceCountdown={translation.vadSilenceCountdown}
      vadSensitivity={translation.vadSensitivity} setVadSensitivity={translation.setVadSensitivity}
      realtimeConnected={roomPolling.realtimeConnected}
      webrtc={webrtc}
      isHostVerified={roomPolling.isHostRef?.current || false}
      verifiedName={roomPolling.verifiedNameRef?.current || prefs.name}
      setLiveMode={audio.setLiveMode}
      onMessageRead={(msgId) => {
        // Send read receipt to partner via P2P DataChannel
        if (sendDirectMessageRef.current && msgId) {
          try { sendDirectMessageRef.current({ type: 'msg-read', msgId }); } catch {}
        }
      }} />
  );

  if (view === 'history') return (
    <HistoryView L={L} S={S} prefs={prefs} convHistory={convHistory}
      viewConversation={viewConversation} setView={setView} status={status} theme={theme} setTheme={setTheme}
      verifiedName={roomPolling.verifiedNameRef?.current || prefs.name} />
  );

  if (view === 'summary') return (
    <SummaryView L={L} S={S} prefs={prefs} currentConv={currentConv} summaryLoading={summaryLoading}
      shareSummary={shareSummary} setCurrentConv={setCurrentConv} setView={setView} status={status} theme={theme} setTheme={setTheme}
      verifiedName={roomPolling.verifiedNameRef?.current || prefs.name} />
  );

  if (view === 'voicetest') return (
    <VoiceTestView L={L} S={S} prefs={prefs} setView={setView}
      isTrial={auth.isTrial} isTopPro={auth.isTopPro} useOwnKeys={auth.useOwnKeys}
      apiKeyInputs={auth.apiKeyInputs} platformHasEL={auth.platformHasEL}
      elevenLabsVoices={auth.elevenLabsVoices} selectedELVoice={auth.selectedELVoice}
      setElevenLabsVoices={auth.setElevenLabsVoices} userToken={auth.userToken}
      userTokenRef={auth.userTokenRef} creditBalance={auth.creditBalance} theme={theme} />
  );

  if (view === 'contacts') return (
    <ContactsView L={L} S={S} prefs={prefs}
      contacts={contactsHook.contacts} contactsLoading={contactsHook.contactsLoading}
      inviteCode={contactsHook.inviteCode} creditBalance={auth.creditBalance}
      fetchContacts={contactsHook.fetchContacts} addContact={contactsHook.addContact}
      removeContact={contactsHook.removeContact} createInvite={contactsHook.createInvite}
      shareInvite={contactsHook.shareInvite} acceptInvite={contactsHook.acceptInvite}
      startPolling={contactsHook.startPolling}
      handleStartChat={handleStartChatWithContact}
      pickDeviceContacts={contactsHook.pickDeviceContacts}
      hasDeviceContacts={contactsHook.hasDeviceContacts}
      setView={setView} status={status} theme={theme} />
  );

  if (view === 'voice-clone') return (
    <VoiceCloneView L={L} S={S} prefs={prefs}
      userToken={auth.userToken} userTokenRef={auth.userTokenRef}
      setView={setView} creditBalance={auth.creditBalance} theme={theme}
      onVoiceCloned={(voiceId, name) => {
        auth.setClonedVoiceId(voiceId);
        auth.setClonedVoiceName(name);
        auth.refreshBalance();
      }} />
  );

  return null;
}
