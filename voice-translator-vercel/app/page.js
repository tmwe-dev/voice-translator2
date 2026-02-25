'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { t, mapLang } from './lib/i18n.js';
import { APP_URL, LANGS, VOICES, AVATARS, AVATAR_NAMES, MODES, CONTEXTS, FONT, CREDIT_PACKAGES,
  FREE_DAILY_LIMIT, THEMES, getLang, vibrate, formatCredits } from './lib/constants.js';
import getStyles from './lib/styles.js';

// Custom hooks
import useAudioSystem from './hooks/useAudioSystem.js';
import useTranslation from './hooks/useTranslation.js';
import useRoomPolling from './hooks/useRoomPolling.js';
import useAuth from './hooks/useAuth.js';
import useContacts from './hooks/useContacts.js';

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


export default function Home() {
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

  // =============================================
  // HOOKS — now use the SAME refs that get synced below
  // =============================================
  const auth = useAuth();
  const audio = useAudioSystem({
    prefsRef,
    isTrialRef: auth.isTrialRef,
    isTopProRef: auth.isTopProRef,
    selectedELVoice: auth.selectedELVoice,
    roomIdRef,
    getEffectiveToken: auth.getEffectiveToken
  });
  const roomPolling = useRoomPolling({
    prefsRef,
    myLangRef,
    roomInfoRef,
    queueAudio: audio.queueAudio,
    getEffectiveToken: auth.getEffectiveToken
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
    userEmail: auth.userAccount?.email || auth.authEmail || ''
  });
  const contactsHook = useContacts({ userTokenRef: auth.userTokenRef });

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
        auth.setUserToken(savedToken);
        auth.userTokenRef.current = savedToken;
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
            setView(pickView(!!saved));
          } else {
            localStorage.removeItem('vt-token');
            auth.setUserToken(null);
            setView(pickView(!!saved));
          }
        }).catch(() => { setView(pickView(!!saved)); });
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
      const res = await fetch('/api/conversation', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'list', userName:prefs.name }) });
      if (res.ok) { const { conversations } = await res.json(); setConvHistory(conversations || []); }
    } catch (e) { console.error('History error:', e); }
  }

  async function endChatAndSave() {
    if (!roomPolling.roomId) return;
    roomPolling.stopPolling();
    setStatus('...');
    try {
      await fetch('/api/conversation', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'end', roomId: roomPolling.roomId }) });
    } catch (e) { console.error('End chat error:', e); }
    roomPolling.leaveRoom();
    setStatus('');
    setView('home');
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

  // Helper functions
  async function changeRoomMode(newMode) {
    if (!roomPolling.roomId) return;
    try {
      await fetch('/api/room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'changeMode', roomId: roomPolling.roomId, mode:newMode }) });
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
      roomContextRef.current = { contextId: selectedContext, contextPrompt: CONTEXTS.find(c => c.id === selectedContext)?.prompt || '', description: roomDescription };
      setView('lobby');
      setStatus('');
    } catch (e) { setStatus('Error: ' + e.message); }
  }

  async function handleJoinRoom() {
    if (!joinCode.trim()) return;
    // Unlock audio + mic early (must be in user gesture context)
    audio.unlockAudio();
    try {
      setStatus('...');
      const room = await roomPolling.handleJoinRoom(joinCode, prefs.name, myLang, prefs.avatar);
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
  // i18n shorthand
  // =============================================
  const L = (key) => t(prefs.lang, key);

  // =============================================
  // RENDER
  // =============================================
  if (view === 'loading') return <div style={S.page}><div style={S.center}><div style={{fontSize:40, opacity:0.5}}>...</div></div></div>;

  if (view === 'welcome') return (
    <WelcomeView L={L} S={S} prefs={prefs} setPrefs={setPrefs} savePrefs={savePrefs}
      joinCode={joinCode} userToken={auth.userToken} setView={setView} setAuthStep={auth.setAuthStep} theme={theme} setTheme={setTheme} />
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
      creditBalance={auth.creditBalance} refreshBalance={auth.refreshBalance} freeCharsUsed={freeCharsUsed} />
  );

  if (view === 'home') return (
    <HomeView L={L} S={S} prefs={prefs} setPrefs={setPrefs} savePrefs={savePrefs} myLang={myLang} selectedMode={selectedMode}
      setSelectedMode={setSelectedMode} selectedContext={selectedContext}
      setSelectedContext={setSelectedContext} roomDescription={roomDescription}
      setRoomDescription={setRoomDescription} handleCreateRoom={handleCreateRoom} setView={setView}
      userToken={auth.userToken} userAccount={auth.userAccount} useOwnKeys={auth.useOwnKeys}
      creditBalance={auth.creditBalance} refreshBalance={auth.refreshBalance} setAuthStep={auth.setAuthStep}
      loadHistory={loadHistory} showShareApp={showShareApp} setShowShareApp={setShowShareApp}
      shareAppLang={shareAppLang} setShareAppLang={setShareAppLang} shareApp={shareApp}
      showTutorial={showTutorial} setShowTutorial={setShowTutorial} tutorialStep={tutorialStep}
      setTutorialStep={setTutorialStep} status={status} isTrial={auth.isTrial} platformHasEL={auth.platformHasEL}
      referralCode={auth.referralCode}  theme={theme} setTheme={setTheme} logout={auth.logout}
      showInstallBanner={showInstallBanner} handleInstallApp={handleInstallApp} dismissInstallBanner={dismissInstallBanner}
      notifPermission={notifPermission} requestNotifPermission={requestNotifPermission}
      deferredInstallPrompt={deferredInstallPrompt} />
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
      leaveRoom={roomPolling.leaveRoom} unlockAudio={audio.unlockAudio} setView={setView}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'room') return (
    <RoomView L={L} S={S} prefs={prefs} myLang={myLang} roomId={roomPolling.roomId} roomInfo={roomPolling.roomInfo}
      messages={roomPolling.messages} streamingMsg={translation.streamingMsg} recording={translation.recording}
      isListening={translation.isListening} partnerConnected={roomPolling.partnerConnected}
      partnerSpeaking={roomPolling.partnerSpeaking} partnerLiveText={roomPolling.partnerLiveText}
      partnerTyping={roomPolling.partnerTyping} playingMsgId={audio.playingMsgId}
      audioEnabled={audio.audioEnabled} setAudioEnabled={audio.setAudioEnabled}
      isTrial={auth.isTrial} isTopPro={auth.isTopPro} showModeSelector={showModeSelector}
      setShowModeSelector={setShowModeSelector} textInput={translation.textInput} setTextInput={translation.setTextInput}
      sendingText={translation.sendingText} sendTextMessage={translation.sendTextMessage} sendTypingState={roomPolling.sendTypingState}
      toggleRecording={translation.toggleRecording} startFreeTalk={translation.startFreeTalk} stopFreeTalk={translation.stopFreeTalk}
      endChatAndSave={endChatAndSave} changeRoomMode={changeRoomMode} playMessage={audio.playMessage}
      unlockAudio={audio.unlockAudio} exportConversation={exportConversation} status={status}
      msgsEndRef={msgsEndRef} freeCharsUsed={freeCharsUsed} freeLimitExceeded={freeLimitExceeded}
      freeResetTime={freeResetTime} setView={setView} setMyLang={setMyLang} savePrefs={savePrefs} theme={theme} setTheme={setTheme} />
  );

  if (view === 'history') return (
    <HistoryView L={L} S={S} prefs={prefs} convHistory={convHistory}
      viewConversation={viewConversation} setView={setView} status={status}  theme={theme} setTheme={setTheme} />
  );

  if (view === 'summary') return (
    <SummaryView L={L} S={S} prefs={prefs} currentConv={currentConv} summaryLoading={summaryLoading}
      shareSummary={shareSummary} setCurrentConv={setCurrentConv} setView={setView} status={status}  theme={theme} setTheme={setTheme} />
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
      inviteCode={contactsHook.inviteCode}
      fetchContacts={contactsHook.fetchContacts} addContact={contactsHook.addContact}
      removeContact={contactsHook.removeContact} createInvite={contactsHook.createInvite}
      shareInvite={contactsHook.shareInvite} acceptInvite={contactsHook.acceptInvite}
      startPolling={contactsHook.startPolling}
      handleStartChat={handleStartChatWithContact}
      setView={setView} status={status} theme={theme} />
  );

  return null;
}
