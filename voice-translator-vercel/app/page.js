'use client';
// b.128 — serve per non mandare conferme sul canale sbagliato in Diretta.
// b.139 — le due righe qui sotto chiedevano "siamo in Diretta?" per decidere
// se una conferma di lettura poteva passare da Realtime. E la stessa domanda
// che si fanno useTranslationAPI e le rotte: ora la risposta viene dal file
// unico delle decisioni, cosi non puo separarsi da loro.
import { trasportoAmmesso, TRASPORTO, modalitaDiStanza, vaInVetrina } from './lib/decisioni.js';
import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { t, mapLang, preloadLang } from './lib/i18n.js';
import { APP_URL, LANGS, VOICES, AVATARS, AVATAR_NAMES, MODES, CONTEXTS, FONT, CREDIT_PACKAGES,
  getLang, vibrate, formatCredits } from './lib/constants.js';
// Custom hooks
import useAudioSystem from './hooks/useAudioSystem.js';
import useTranslation from './hooks/useTranslation.js';
import useRoomPolling from './hooks/useRoomPolling.js';
import useAuth from './hooks/useAuth.js';
import useContacts from './hooks/useContacts.js';
import useWebRTC from './hooks/useWebRTC.js';
import useInterpreterMode from './hooks/useInterpreterMode.js';
import useConversationContext from './hooks/useConversationContext.js';
import useLocalChat from './hooks/useLocalChat.js';

// Extracted hooks (refactored from page.js monolith)
import useInitializeApp from './hooks/useInitializeApp.js';
import useFreeTierTracking from './hooks/useFreeTierTracking.js';
import usePWAInstall from './hooks/usePWAInstall.js';
import useTheme from './hooks/useTheme.js';
import useNotifications from './hooks/useNotifications.js';
import useElevenLabsSync from './hooks/useElevenLabsSync.js';

// ═══ CRITICAL PATH: eagerly loaded components (always visible) ═══
import WelcomeView from './components/WelcomeView.js';
// b.136 — la scelta del paese e la PRIMA schermata: non puo essere
// pigra, altrimenti al primo avvio si vede lo spinner al posto suo.
import SceltaPaeseView from './components/SceltaPaeseView.js';
import HomeView from './components/HomeView.js';
import JoinView from './components/JoinView.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import ToastContainer, { toast } from './components/Toast.js';
import NetworkStatus from './components/NetworkStatus.js';
import TutorialOverlay from './components/TutorialOverlay.js';
import { initMonitoring, reportError } from './lib/monitor.js';

// ═══ LAZY-LOADED: secondary views (loaded on demand → faster initial bundle) ═══
const AccountView = lazy(() => import('./components/AccountView.js'));
const CreditsView = lazy(() => import('./components/CreditsView.js'));
const ApiKeysView = lazy(() => import('./components/ApiKeysView.js'));
const SettingsView = lazy(() => import('./components/SettingsView.js'));
const LobbyView = lazy(() => import('./components/LobbyView.js'));
const PannelloModerazione = lazy(() => import('./components/PannelloModerazione.js'));
// b.102 — modulo separato: la videochiamata a due resta intatta.
const StanzaVideoGruppo = lazy(() => import('./components/StanzaVideoGruppo.js'));
const RoomView = lazy(() => import('./components/RoomView.js'));
const HistoryView = lazy(() => import('./components/HistoryView.js'));
const SummaryView = lazy(() => import('./components/SummaryView.js'));
const VoiceTestView = lazy(() => import('./components/VoiceTestView.js'));
const ContactsView = lazy(() => import('./components/ContactsView.js'));
const VoiceCloneView = lazy(() => import('./components/VoiceCloneView.js'));
const MondoView = lazy(() => import('./components/MondoView.js'));
const LifeView = lazy(() => import('./components/Life/LifeView.js'));
const SpeakerView = lazy(() => import('./components/SpeakerView.js'));
const TaxiTalk = lazy(() => import('./components/TaxiTalk.js')); // b.205 — TaxiTalk rifatto
const QuickInvite = lazy(() => import('./components/QuickInvite.js'));
const HelpView = lazy(() => import('./components/HelpView.js'));
const TaxiDriverView = lazy(() => import('./components/TaxiDriverView.js'));
const CreateRoomSheet = lazy(() => import('./components/CreateRoomSheet.js'));

// ═══ Always-imported (lightweight, used within RoomView) ═══
import ProviderBadge from './components/ProviderBadge.js';

// ═══ Lazy loading fallback ═══
const LazyFallback = () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100dvh',background:'#060810'}}>
    <div style={{width:32,height:32,borderRadius:'50%',border:'3px solid rgba(38,217,176,0.2)',borderTopColor:'#26D9B0',animation:'vtSpin 0.8s linear infinite'}} />
    <style>{`@keyframes vtSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ═══ Navigation ═══
import BottomNav from './components/BottomNav.js';
import NewConversationSheet from './components/NewConversationSheet.js';
import InvitaAmici, { INVITO_AMICI_VISTO } from './components/InvitaAmici.js';
// TaxiMode is used inside RoomView, not standalone
const AIView = lazy(() => import('./components/AIView.js'));
const DetailView = lazy(() => import('./components/DetailView.js'));

// ═══ Context provider for prop drilling elimination ═══
import { AppProvider } from './contexts/AppContext.js';
import SpatialBackdrop from './components/SpatialBackdrop.js';
import { montaCancelloDiretta, impostaModalita } from './lib/modalitaSessione.js';
import Sciame from './components/Sciame.js';
import InstallaApp from './components/InstallaApp.js';


export default function Home() {
  return (
    <ErrorBoundary>
      {/* Skip-to-content link lives in layout.js (<SkipToContent />) — do not duplicate here */}
      <NetworkStatus />
      <ToastContainer />
      {/* b.233 — niente più `id="main-content" role="main"` qui: era DUPLICATO
          del <main id="main-content"> del layout (id ripetuto + due landmark
          main annidati). Il salta-al-contenuto punta a quello del layout. */}
      <div>
        <HomeInner />
      </div>
    </ErrorBoundary>
  );
}

function HomeInner() {
  // =============================================
  // LOCAL STATE
  // =============================================
  const [view, setView] = useState('loading');
  // b.136 — `lang` e la lingua PARLATA, `uiLang` quella dell'INTERFACCIA,
  // `country` il paese (bandiera del profilo). Prima esisteva solo
  // `lang` e faceva tutti e tre i mestieri.
  // b.143 — LA BASE E L'INGLESE, NON L'ITALIANO.
  //
  // Questi valori valgono nell'istante fra il primo disegno e la
  // lettura delle preferenze salvate, e per chiunque arrivi senza
  // niente. Erano 'it' e 'IT' perche l'applicazione e nata qui: ma un
  // giapponese che apre il link vedeva un lampo di italiano prima che
  // `indovinaPaese()` facesse il suo lavoro.
  // L'inglese e la base neutra: nessuno lo trova offensivo, e chi ha
  // una lingua sua la ottiene un istante dopo.
  const [prefs, setPrefs] = useState({ name:'', lang:'en', uiLang:'en', country:'', avatar:AVATARS[0], voice:'nova', autoPlay:true });
  const [convHistory, setConvHistory] = useState([]);
  // b.123 — senza account l'archivio sul server non esiste (e non puo
  // esistere: non c'e niente a cui legarlo). Va detto, altrimenti
  // sembra che le conversazioni siano sparite.
  const [archivioSoloLocale, setArchivioSoloLocale] = useState(false);
  const [currentConv, setCurrentConv] = useState(null);
  const [detailConversation, setDetailConversation] = useState(null);
  const [detailMessages, setDetailMessages] = useState([]);
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
  // [Removed dead code: showShareApp, shareAppLang — unused]
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  // b.147 — "Parlane" su una Topic Card: il foglio di creazione stanza
  // si apre gia compilato con titolo e sintesi dell'argomento.
  const [topicPreset, setTopicPreset] = useState(null);
  const [intentoVideo, setIntentoVideo] = useState(false); // b.90 — si e scelta la videochiamata
  const [taxiDestId, setTaxiDestId] = useState(null);
  const [taxiKey, setTaxiKey] = useState(null);

  // FREE tier usage tracking (extracted hook)
  const freeTier = useFreeTierTracking();
  const { freeCharsUsed, freeLimitExceeded, freeResetTime, freeCharsRef, trackFreeChars } = freeTier;

  // PWA install (extracted hook)
  //
  // b.134 — QUI STAVA IL GUASTO. Questa riga prendeva UN campo solo:
  //
  //     const { notifPermission } = pwa;
  //
  // e gli altri quattro che l'hook restituisce — il banner
  // d'installazione, l'installazione stessa, il rifiuto e la richiesta
  // del permesso — non li usava nessuno, in tutta la cartella `app/`.
  //
  // Quindi il banner non compariva mai, il permesso non veniva mai
  // chiesto, `notifPermission` restava per sempre 'default', e a valle
  // useNotifications.js:27 aspettava 'granted' che non arrivava:
  // taceva anche la notifica LOCALE del messaggio a scheda nascosta.
  //
  // Una funzione intera spenta da una destrutturazione incompleta.
  const pwa = usePWAInstall();
  const { notifPermission } = pwa;

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  // b.153 (#12) — il passo "porta i tuoi amici": una volta sola, quando
  // il tutorial si chiude. Il segnalino sta sul telefono, non sul server.
  const [showInvitaAmici, setShowInvitaAmici] = useState(false);
  const tutorialEraAperto = useRef(false);
  useEffect(() => {
    if (showTutorial) { tutorialEraAperto.current = true; return; }
    if (!tutorialEraAperto.current) return;
    tutorialEraAperto.current = false;
    try {
      if (!localStorage.getItem(INVITO_AMICI_VISTO)) {
        localStorage.setItem(INVITO_AMICI_VISTO, '1');
        setShowInvitaAmici(true);
      }
    } catch { /* storage negato: niente invito, nessun dramma */ }
  }, [showTutorial]);
  const [autoJoinTriggered, setAutoJoinTriggered] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // Theme (extracted hook)
  const { theme, setTheme, S } = useTheme();

  // Refs — created BEFORE hooks so they can be shared
  const msgsEndRef = useRef(null);
  const prefsRef = useRef({ name:'', lang:'en', avatar:AVATARS[0], voice:'nova', autoPlay:true });
  const myLangRef = useRef('it');
  const roomInfoRef = useRef(null);
  const roomContextRef = useRef({ contextId: 'general', contextPrompt: '', description: '' });
  const roomIdRef = useRef(null);
  // b.161 — gemello di roomIdRef: useAudioSystem/useTTSEngine nascono PRIMA
  // di roomPolling (poco sotto), quindi non possono leggere direttamente
  // roomPolling.roomSessionTokenRef. Sincronizzato in un useEffect, come
  // gia si fa per roomIdRef.current piu in basso.
  const roomSessionTokenRef = useRef(null);

  // ── Session mode: 'direct' | 'translate' ──
  // Direct mode: E2E only, no server processing. Translate mode: full cloud pipeline.
  // Currently defaults to 'translate'. Will be set based on room/user choice.
  const sessionModeRef = useRef('translate');

  // ── b.111 · il cancello della modalita Diretta ──
  // La guardia sul server esisteva gia in dodici rotte, ma leggeva
  // un'intestazione che NESSUNO mandava: non e mai scattata. Qui si
  // monta un cancello unico davanti a fetch, che quell'intestazione la
  // aggiunge sempre e che in modalita Diretta non fa nemmeno partire le
  // richieste vietate. Un solo punto, invece di quaranta punti da
  // ricordare.
  useEffect(() => { montaCancelloDiretta(); }, []);

  // Unico modo di cambiare modalita: scrive nel ref (che leggono gli
  // hook) e nel cancello (che legge fetch). Due copie della stessa
  // verita che si separano sono il modo classico di ritrovarsi con la
  // promessa rotta da una parte sola.
  const cambiaModalitaSessione = useCallback((modo) => {
    sessionModeRef.current = impostaModalita(modo);
  }, []);

  // ── Stable ref for P2P DataChannel message sending ──
  // Declared before hooks so useTranslation can reference it via callback wrapper
  const sendDirectMessageRef = useRef(null);
  const sendDirectMessageStable = useCallback((msg) => {
    return sendDirectMessageRef.current ? sendDirectMessageRef.current(msg) : false;
  }, []);

  // ── b.111 · il contenuto non si perde ──
  // sendDirectMessageStable restituisce `false` quando il canale non e
  // aperto, e nessuno guardava quel `false`. Per i comandi va bene
  // (dire "ho acceso la camera" dieci secondi dopo non serve a nulla),
  // ma per un MESSAGGIO no: in modalita Direct non esiste copia sul
  // server, quindi quel messaggio era perso e basta. Questa via lo
  // mette da parte e lo rispedisce da sola quando il canale riapre.
  // Nota: qui NON si guarda `webrtcConnected` — e proprio quando non
  // si e connessi che la posta in uscita serve.
  const spedisciContenutoRef = useRef(null);
  const spedisciContenutoStable = useCallback((chiave, msg) => {
    return spedisciContenutoRef.current
      ? spedisciContenutoRef.current(chiave, msg)
      : false;
  }, []);

  // ── Stable ref for interpreter — breaks circular dependency ──
  // handleDirectMessage → interpreter → webrtc → handleDirectMessage
  const interpreterRef = useRef(null);

  // ── Cloned voice ref — syncs auth.clonedVoiceId to a ref for useAudioSystem ──
  const clonedVoiceIdRef = useRef(null);

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
    clonedVoiceIdRef,
    roomIdRef,
    roomSessionTokenRef,
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
    spedisciContenuto: spedisciContenutoStable,
    verifiedNameRef: roomPolling.verifiedNameRef,
    addLocalMessage: roomPolling.addLocalMessage,
    updateLocalMessage: roomPolling.updateLocalMessage,
    conversationContext: convContext, // Rolling knowledge base for context-aware translation
    sessionModeRef,
  });
  const contactsHook = useContacts({ userTokenRef: auth.userTokenRef });

  // ── Local chat persistence (IndexedDB — WhatsApp model) ──
  const localChat = useLocalChat({
    roomId: roomPolling.roomId,
    myName: roomPolling.verifiedNameRef?.current || prefs.name,
    members: roomPolling.roomInfo?.members,
    mode: roomPolling.roomInfo?.mode,
    context: roomPolling.roomInfo?.context,
  });

  // ── Chat Actions panel state ──
  const [showChatActions, setShowChatActions] = useState(false);

  // Handle incoming P2P messages via DataChannel
  const handleDirectMessage = useCallback((msg) => {
    if (msg?.type === 'chat-message' && msg.message) {
      const message = msg.message;
      // Dedup: skip if we sent it ourselves
      if (roomPolling.sentByMeRef?.current?.has(message.id)) return;
      // Add to messages list via the same handler used by Realtime
      roomPolling.addIncomingMessage(message);
      // ── b.128 · la conferma di consegna esce comunque ──
      // Vedi onMessageRead: prima esisteva solo la strada P2P.
      if (message.id) {
        let partita = false;
        if (sendDirectMessageRef.current) {
          try { partita = sendDirectMessageRef.current({ type: 'msg-ack', msgId: message.id }) !== false; }
          catch (e) { partita = false; }
        }
        if (!partita && trasportoAmmesso(sessionModeRef.current, TRASPORTO.REALTIME) && roomPolling.broadcastAck) {
          try { roomPolling.broadcastAck(message.id); } catch (e) { /* la spunta restera a una: non vale un errore a schermo */ }
        }
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
    // ── Reaction received — add emoji to message ──
    if (msg?.type === 'msg-reaction' && msg.msgId && msg.emoji) {
      roomPolling.setMessages(prev => prev.map(m => {
        if (m.id === msg.msgId) {
          const reactions = { ...(m._reactions || {}) };
          const users = reactions[msg.emoji] || [];
          if (!users.includes(msg.from)) {
            reactions[msg.emoji] = [...users, msg.from];
          }
          return { ...m, _reactions: reactions };
        }
        return m;
      }));
    }
    // ── Interpreter messages: subtitles + audio from partner ──
    if (msg?.type === 'interpreter-subtitle' || msg?.type === 'interpreter-audio' || msg?.type === 'interpreter-audio-part') {
      interpreterRef.current?.handleInterpreterMessage?.(msg);
    }
  }, [roomPolling.sentByMeRef, roomPolling.addIncomingMessage, roomPolling.handleMessageUpdate, roomPolling.markDelivered, roomPolling.markRead]);

  const webrtc = useWebRTC({
    roomId: roomPolling.roomId,
    myName: roomPolling.verifiedNameRef?.current || prefs.name,
    onDirectMessage: handleDirectMessage,
    roomSessionTokenRef: roomPolling.roomSessionTokenRef,
    sessionModeRef,
  });

  // Interpreter mode — bidirectional STT → Translate → TTS
  const partnerLang = roomPolling.roomInfo?.members?.find(m => m.name !== (roomPolling.verifiedNameRef?.current || prefs.name))?.lang || 'en';
  const interpreter = useInterpreterMode({
    webrtc,
    myLang,
    partnerLang,
    roomId: roomPolling.roomId,
    roomSessionTokenRef: roomPolling.roomSessionTokenRef,
    userToken: auth.userToken,
    useOwnKeys: auth.useOwnKeys,
    startDucking: audio.startDucking,
    stopDucking: audio.stopDucking,
    conversationContext: convContext,  // Subtitle-first pipeline: context memory for disambiguation
  });

  // Sync interpreterRef so handleDirectMessage can access it without circular deps
  useEffect(() => { interpreterRef.current = interpreter; }, [interpreter]);

  // Sync sendDirectMessageRef when WebRTC connects/disconnects
  useEffect(() => {
    sendDirectMessageRef.current = webrtc.webrtcConnected ? webrtc.sendDirectMessage : null;
    // La posta in uscita si collega SEMPRE, connessi o no: e il suo
    // mestiere tenere da parte quello che ora non puo partire.
    spedisciContenutoRef.current = webrtc.spedisciOAccoda || null;
  }, [webrtc.webrtcConnected, webrtc.sendDirectMessage, webrtc.spedisciOAccoda]);

  // =============================================
  // REF SYNC
  // =============================================
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  useEffect(() => { myLangRef.current = myLang; }, [myLang]);
  useEffect(() => { roomInfoRef.current = roomPolling.roomInfo; }, [roomPolling.roomInfo]);
  useEffect(() => { roomIdRef.current = roomPolling.roomId; }, [roomPolling.roomId]);
  // b.161 — stesso schema di roomIdRef qui sopra: roomPolling.roomSessionTokenRef
  // e' gia un ref (non stato), valorizzato da handleCreateRoom/handleJoinRoom
  // nello stesso momento in cui roomId cambia — quindi si aggancia alla
  // stessa dipendenza.
  useEffect(() => { roomSessionTokenRef.current = roomPolling.roomSessionTokenRef?.current || null; }, [roomPolling.roomId, roomPolling.roomSessionTokenRef]);
  useEffect(() => { clonedVoiceIdRef.current = auth.clonedVoiceId || null; }, [auth.clonedVoiceId]);

  // ── b.109 · qui c'era il "ponte" verso stores/appStore.js ──
  // Tre effetti che copiavano vista, tema, preferenze, stanza, l'INTERO
  // array dei messaggi, token, piano e credito dentro uno store. Il
  // commento diceva che serviva a far leggere i componenti nuovi senza
  // passarsi le prop.
  //
  // Nessun componente ha mai letto quello store: zero occorrenze di
  // useAppStore, useRoomStore, useAuthStore, useMessages e compagnia in
  // tutta l'applicazione e nei test. Era una migrazione annunciata e mai
  // avvenuta, e nel frattempo copiava l'array dei messaggi a ogni giro
  // del polling per nessuno.


  // (Free tier tracking extracted to useFreeTierTracking hook)

  // ElevenLabs voice sync (extracted hook)
  useElevenLabsSync(auth);

  // =============================================
  // APP INITIALIZATION (extracted hook)
  // =============================================
  useInitializeApp({
    setView, setPrefs, setMyLang, setJoinCode, setInviteMsgLang,
    setAutoJoinTriggered, setTaxiDestId, setTaxiKey, auth, initMonitoring,
  });

  // PWA + Notifications (extracted hooks)
  useNotifications({
    messages: roomPolling.messages, roomId: roomPolling.roomId,
    myName: prefs.name, notifPermission,
  });

  // ── Persist incoming messages to IndexedDB ──
  useEffect(() => {
    if (roomPolling.messages?.length > 0) {
      localChat.persistMessages(roomPolling.messages);
    }
  }, [roomPolling.messages]);

  // ── Flush offline queue when connection returns ──
  useEffect(() => {
    async function flushQueue() {
      if (!navigator.onLine || !roomPolling.roomId) return;
      try {
        const { flushOfflineQueue } = await import('./lib/chatStorage.js');
        const result = await flushOfflineQueue(async (msg) => {
          await translation.sendTextMessage(msg.text || msg.original);
        });
        if (result.sent > 0) {
          setStatus(`${result.sent} ${L('offlineMessagesSent')}`);
          setTimeout(() => setStatus(''), 3000);
        }
      } catch (e) { console.warn('[Page] Offline message flush failed:', e?.message); }
    }
    function onOnline() { flushQueue(); }
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [roomPolling.roomId]);

  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [roomPolling.messages]);

  // ── Escape key: back navigation from any view ──
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (view === 'room') { /* stay in room — Escape does nothing */ }
        else if (view !== 'home' && view !== 'loading') { setView('home'); }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [view]);

  // ── Offline/Online toast notifications ──
  useEffect(() => {
    function onOffline() { toast.offline(); }
    function onOnlineToast() { toast.success('Connessione ristabilita'); }
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnlineToast);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnlineToast);
    };
  }, []);

  // ── Register background sync when SW available ──
  useEffect(() => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        // Listen for SW flush signal
        navigator.serviceWorker.addEventListener('message', e => {
          if (e.data?.type === 'FLUSH_OFFLINE_QUEUE') {
            // Trigger queue flush from chatStorage
            import('./lib/chatStorage.js').then(mod => {
              if (mod.flushOfflineQueue) mod.flushOfflineQueue(async (msg) => {
                await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
              });
            }).catch(() => {});
          }
        });
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (view === 'home' && !localStorage.getItem('vt-tutorial-done')) {
      setTutorialStep(0); setShowTutorial(true);
      localStorage.setItem('vt-tutorial-done', '1');
    }
    // Auto-load history when navigating to archive tab
    if (view === 'history') {
      loadHistory();
    }
    // Auto-fetch contacts when navigating to contacts view
    if (view === 'contacts') {
      contactsHook.fetchContacts();
    }
  }, [view]);

  // b.111 — era una `function` normale, quindi un oggetto NUOVO a ogni
  // render. Finisce nel valore di AppContext, che la tiene fra le sue
  // dipendenze: il contesto risultava cambiato SEMPRE, e tutti i
  // componenti che usano useApp() si ridisegnavano a ogni battuta di
  // tasto, a ogni giro del microfono, a ogni interrogazione del
  // server. Tutta la memoizzazione fatta con cura in AppContext era
  // annullata da questa singola riga.
  //
  // Non ha dipendenze: setPrefs e setMyLang sono stabili per contratto
  // di React, il resto lo legge quando serve.
  const savePrefs = useCallback(function savePrefs(newPrefs) {
    setPrefs(newPrefs); setMyLang(newPrefs.lang);
    localStorage.setItem('vt-prefs', JSON.stringify(newPrefs));

    // b.98 — il nome viveva in DUE posti che non si parlavano: qui sul
    // telefono, e sul server. Nelle stanze Community si leggeva quello
    // locale, quindi bastava non aver mai aggiornato il server per
    // presentarsi al mondo con un nome vecchio o con delle iniziali.
    // Ora il locale comanda, e lo dice anche al server.
    const token = (() => { try { return localStorage.getItem('vt-token') || ''; } catch { return ''; } })();
    if (token && newPrefs.name) {
      fetch('/api/user', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update', name: newPrefs.name, lang: newPrefs.lang, avatar: newPrefs.avatar }),
      }).catch(() => { /* il nome locale resta valido: si riallinea al prossimo salvataggio */ });
    }
  }, []);

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
          // b.138 — qui era sopravvissuto l'ULTIMO indovinello di lingua
          // del vecchio sistema: `L('createRoom') === 'Crea Stanza'` per
          // capire se l'utente era italiano, con l'inglese per tutti gli
          // altri tredici. E lo stesso schema che b.136 aveva tolto da
          // quattro file: cambiare quella riga in it.js avrebbe spento
          // l'italiano in silenzio.
          setStatus(`${L('contactAddedLabel')}: ${result.inviter?.name || result.inviter?.email || ''}`);
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
  function shareRoom() {
    // auto=1 — chi riceve l'invito entra dritto nella chat. Senza, si
    // trovava davanti a un modulo da riempire: nome, lingua, codice.
    const url = `${APP_URL}?room=${roomPolling.roomId}&lang=${inviteLang}&auto=1`;
    if (navigator.share) navigator.share({ title:'BarTalk', text:`${t(inviteLang,'inviteText')}`, url });
    else { navigator.clipboard.writeText(url); toast.success(L('linkCopied')); }
  }

  function exportConversation() {
    if (!roomPolling.messages.length) return;
    const roomName = roomPolling.roomInfo?.host ? `${roomPolling.roomInfo.host}'s Room` : roomPolling.roomId;
    const date = new Date().toLocaleString();
    let text = `BarTalk - ${roomName}\n${date}\n${'='.repeat(40)}\n\n`;
    for (const msg of roomPolling.messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      text += `[${time}] ${msg.sender}:\n  ${msg.original}\n  \u2192 ${msg.translated}\n\n`;
    }
    text += `${'='.repeat(40)}\n${roomPolling.messages.length} ${L('messages')} | BarTalk`;
    if (navigator.share) navigator.share({ title: `BarTalk - ${roomName}`, text });
    else { navigator.clipboard.writeText(text); setStatus(L('exportCopied')); setTimeout(() => setStatus(''), 2000); }
  }

  // =============================================
  // CONVERSATION HISTORY & SUMMARY
  // =============================================
  async function loadHistory() {
    if (!prefs.name) return;
    try {
      // b.123 — il ripiego `userName` non c'e piu: chiedere l'archivio
      // dando un nome era il buco. Senza account non si chiede niente al
      // server, cosi non si fa una richiesta che sappiamo gia rifiutata.
      // La cronologia dell'ospite resta sul dispositivo (chatStorage).
      const token = auth.userTokenRef?.current || null;
      if (!token) { setConvHistory([]); setArchivioSoloLocale(true); return; }
      setArchivioSoloLocale(false);
      const res = await fetch('/api/conversation', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'list', userToken: token }) });
      if (res.ok) { const { conversations } = await res.json(); setConvHistory(conversations || []); }
    } catch (e) { console.error('History error:', e); }
  }

  async function endChatAndSave() {
    if (!roomPolling.roomId) return;
    // b.113 — come in leaveRoomTemporary: la modalita non si eredita.
    cambiaModalitaSessione('translate');
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
    // b.113 — si torna alla modalita normale. Senza, una Stanza Diretta
    // lascerebbe in eredita le sue regole alla conversazione dopo: la
    // traduzione risulterebbe rotta senza un motivo visibile.
    cambiaModalitaSessione('translate');
    // Save room to active rooms list in localStorage
    try {
      let activeRooms; try { activeRooms = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]'); } catch { activeRooms = []; }
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
    } catch (e) { console.warn('[Page] Save active rooms failed:', e?.message); }
    roomPolling.stopPolling();
    roomPolling.leaveRoom();
    setView('home');
  }


  // ═══════════════════════════════════════════════════════════════
  // UNA SOLA PORTA (b.123)
  //
  // Si entra in una stanza da tre parti: creandola, entrandoci da un
  // codice o da un invito, e RIENTRANDOCI dopo esserne usciti a meta.
  // Tutte e tre applicavano le stesse regole, ognuna per conto suo.
  //
  // A `rejoinRoom` ne mancava una: quella che conta.
  //
  //     handleJoinRoom  ->  cambiaModalitaSessione(room.diretta ? ...)
  //     creaStanza      ->  cambiaModalitaSessione(roomConfig.diretta ? ...)
  //     rejoinRoom      ->  (niente)
  //
  // Uscendo, `leaveRoomTemporary` riporta la sessione su 'translate'
  // — giusto: le regole di una conversazione riservata non si ereditano.
  // Ma rientrando nessuno le rimetteva. Quindi una stanza che nel
  // database ha `diretta: true`, e che a schermo continua a dire "i
  // messaggi viaggiano da telefono a telefono", ricominciava a mandare
  // tutto ai nostri server.
  //
  // Non un errore di calcolo: una PROMESSA DISATTESA, e sull'unica cosa
  // per cui qualcuno sceglierebbe la modalita Diretta.
  //
  // Il difetto non e la riga dimenticata. E che la stessa decisione
  // fosse scritta in tre punti: prima o poi uno dei tre resta indietro,
  // ed e sempre quello che si prova di meno. Qui c'e una volta sola.
  // ═══════════════════════════════════════════════════════════════
  const applicaPoliticaStanza = useCallback((room) => {
    if (!room) return;

    // PRIMA di ogni altra cosa: da questo istante il cancello davanti a
    // fetch deve gia sapere quali rotte lasciar passare.
    // b.139 — il ternario `room.diretta ? 'direct' : 'translate'` era scritto
    // qui e, con parole diverse, dentro il cancello e nelle rotte. Ora la
    // traduzione da stanza a modalita si fa in un posto solo.
    cambiaModalitaSessione(modalitaDiStanza(room));

    roomInfoRef.current = room;
    roomContextRef.current = {
      contextId: room.context || 'general',
      contextPrompt: room.contextPrompt || '',
      description: room.description || '',
    };

    const hostTier = room.hostTier || 'FREE';
    auth.roomTierOverrideRef.current = hostTier;
    if (hostTier === 'FREE') { auth.setIsTrial(true); auth.setIsTopPro(false); }
    else if (hostTier === 'TOP PRO') { auth.setIsTrial(false); auth.setIsTopPro(true); }
    else { auth.setIsTrial(false); auth.setIsTopPro(false); }
  }, [cambiaModalitaSessione, auth]);

  async function rejoinRoom(rid) {
    audio.unlockAudio();
    try {
      setStatus('...');
      const room = await roomPolling.handleJoinRoom(rid, prefs.name, myLang, prefs.avatar);
      // b.123 — qui mancava la modalita Diretta: una stanza riservata
      // tornava a passare dai server. Ora si entra da una porta sola.
      applicaPoliticaStanza(room);
      // Remove from active rooms list since we're back in
      try {
        let activeRooms; try { activeRooms = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]'); } catch { activeRooms = []; }
        activeRooms = activeRooms.filter(r => r.roomId !== rid);
        localStorage.setItem('vt-active-rooms', JSON.stringify(activeRooms));
      } catch (e) { console.warn('[Page] Update active rooms on rejoin failed:', e?.message); }
      setView('room');
      setStatus('');
    } catch (e) {
      // Room expired or gone — remove from active rooms
      try {
        let activeRooms; try { activeRooms = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]'); } catch { activeRooms = []; }
        activeRooms = activeRooms.filter(r => r.roomId !== rid);
        localStorage.setItem('vt-active-rooms', JSON.stringify(activeRooms));
      } catch (e2) { console.warn('[Page] Cleanup active rooms on rejoin error failed:', e2?.message); }
      setStatus('Chat terminata');
      setTimeout(() => setStatus(''), 2000);
    }
  }

  async function viewConversation(convId) {
    setStatus('...');
    try {
      const convHeaders = { 'Content-Type': 'application/json' };
      if (auth.userTokenRef?.current) convHeaders['Authorization'] = `Bearer ${auth.userTokenRef.current}`;
      if (roomPolling.roomSessionTokenRef?.current) convHeaders['X-Room-Session'] = roomPolling.roomSessionTokenRef.current;
      const res = await fetch(`/api/conversation?id=${convId}`, { headers: convHeaders });
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
            } catch (e) { console.warn('[Page] Summary fetch failed:', e?.message); }
            setSummaryLoading(false);
          }
          setCurrentConv(conversation);
          setDetailConversation(conversation);
          setDetailMessages(conversation.messages || []);
          setView('summary');
        }
      }
    } catch (e) { console.error('View conv error:', e); }
    setStatus('');
  }

  function shareSummary() {
    if (!currentConv?.summary) return;
    const s = currentConv.summary;
    const text = `${s.title || L('conversation')}\n\n${s.summary || ''}\n\n` +
      (s.keyPoints?.length ? `${L('keyPointsLabel')}:\n` + s.keyPoints.map(p => `\u2022 ${p}`).join('\n') + '\n\n' : '') +
      `${L('participantsLabel')}: ${s.participants || ''}\n${L('durationWord')}: ${s.duration || ''}\n${L('tabMessages')}: ${s.messageCount || 0}`;
    if (navigator.share) navigator.share({ title: s.title || L('reportWord'), text });
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
        prefs.name || 'Host', myLang, selectedMode, prefs.avatar,
        selectedContext, selectedMode, roomDescription,
        auth.isTrial, auth.isTopPro, auth.userAccount
      );
      // Immediately sync roomInfoRef (don't wait for useEffect re-render)
      roomInfoRef.current = room;
      roomContextRef.current = { contextId: selectedContext, contextPrompt: CONTEXTS.find(c => c.id === selectedContext)?.prompt || '', description: roomDescription };
      setView('lobby');
      setStatus('');
    } catch (e) {
      setStatus('');
      toast.error(e.message || L('cannotCreateRoom'));
    }
  }

  // Handler for NewConversationSheet selections
  function handleNewConversationSelect(optionId) {
    // ── INIZIO b.93 — il "+" non ripete piu la Home ──
    // Prima queste quattro voci erano identiche a quelle della Home.
    // Ora portano dove la Home non arriva.
    switch (optionId) {
      case 'entra-codice':
        // La pagina esisteva ma NESSUNO la apriva: si poteva entrare in
        // una stanza solo da un link o da un QR, mai digitando il codice.
        setJoinCode('');
        setView('join');
        break;
      case 'stanza-community':
        // b.146 — BOTTONE MORTO. CreateRoomSheet e montato SOLO dentro
        // la vista 'mondo': da Home questo setShowCreateRoom accendeva
        // un interruttore che nessun componente leggeva, e il "+" si
        // chiudeva senza aprire niente. Provato dal vivo, due volte.
        // Prima si va nella vista che ospita il foglio, poi lo si apre.
        setView('mondo');
        setShowCreateRoom(true);
        break;
      case 'contatti':
        setView('contacts');
        break;
      case 'cronologia':
        setView('history');
        break;
      // ── Voci storiche, ancora usate dalla Home ──
      case 'face-to-face':
        setIntentoVideo(false);
        handleCreateRoom();
        break;
      case 'invite':
        setView('quickinvite');
        break;
      case 'videocall':
        // b.90 — prima era identico a 'face-to-face' e la stanza non
        // faceva parola del video: ora la scelta viene ricordata e la
        // sala d'attesa lo dice.
        setIntentoVideo(true);
        handleCreateRoom();
        break;
      case 'taxitalk':
        setView('speaker');
        break;
    }
    // ── FINE b.93 ──
  }

  async function startChatWithContact(contact) {
    try {
      setStatus('...');
      const room = await roomPolling.handleCreateRoom(
        prefs.name || 'Host', myLang, selectedMode, prefs.avatar,
        selectedContext, selectedMode, '',
        auth.isTrial, auth.isTopPro, auth.userAccount
      );
      roomInfoRef.current = room;
      roomContextRef.current = { contextId: selectedContext, contextPrompt: CONTEXTS.find(c => c.id === selectedContext)?.prompt || '', description: '' };
      setView('lobby');
      setStatus('');
      // Auto-copy invite link for the contact
      // b.110 — era `room.roomId`, ma l'oggetto stanza ha `id`
      // (store.js:69). Il link copiato conteneva "room=undefined".
      const link = `${window.location.origin}?room=${room.id}`;
      try { await navigator.clipboard.writeText(link); } catch { /* l utente ha annullato, o il permesso non c e */ }
    } catch (e) { setStatus('Error: ' + e.message); }
  }

  // Auto-join: quando invitato con ?auto=1 e ha già i prefs
  useEffect(() => {
    if (autoJoinTriggered && joinCode && prefs.name) {
      setAutoJoinTriggered(false);
      handleJoinRoom();
    }
  }, [autoJoinTriggered, joinCode, prefs.name]);

  // ─── ISCRIZIONE ALLE NOTIFICHE (b.134) ───
  //
  // Si rinnova a OGNI accesso, non solo quando si concede il permesso.
  // Il browser puo revocare o rigenerare il recapito quando vuole, e su
  // Redis l'iscrizione scade dopo trenta giorni: chi apre l'applicazione
  // la rinnova senza accorgersene, e chi non l'apre per un mese smette
  // di ricevere avvisi — che e il comportamento giusto.
  //
  // Il permesso NON si chiede qui. Chiederlo all'avvio, senza contesto,
  // e il modo migliore per farselo negare per sempre: il browser ricorda
  // il rifiuto e non lo richiede piu. Lo chiede il banner, quando
  // l'utente ha appena detto che vuole gli avvisi.
  useEffect(() => {
    if (!auth.userToken) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    pwa.iscriviAllePush(auth.userToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userToken, notifPermission]);

  async function handleJoinRoom(codiceEsplicito) {
    // Chi arriva da un elenco passa il codice; chi digita usa lo stato.
    const codice = (codiceEsplicito || joinCode || '').trim();
    if (!codice) return;
    // Unlock audio + mic early (must be in user gesture context)
    audio.unlockAudio();
    try {
      setStatus('...');
      const room = await roomPolling.handleJoinRoom(codice, prefs.name, myLang, prefs.avatar);
      // b.113 — la Stanza Diretta si EREDITA. Chi entra da un invito non
      // ha scelto niente: se non leggesse questo campo continuerebbe a
      // mandare la propria voce alla nuvola dentro una stanza che si
      // presenta come riservata. E la modalita si azzera uscendo (sotto,
      // in leaveRoomTemporary), perche una conversazione riservata non
      // deve lasciare in eredita le sue regole a quella dopo.
      // b.123 — la stessa politica di rejoin e della creazione: una sola.
      applicaPoliticaStanza(room);
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
  // b.136 — si precaricava e si traduceva con `prefs.lang`, la lingua
  // PARLATA. Il pacchetto giusto e quello dell'INTERFACCIA: sono due
  // impostazioni distinte da questa versione, e chi parla danese non
  // deve far scaricare un pacchetto danese che non esiste.
  const linguaInterfaccia = prefs.uiLang || mapLang(prefs.lang || 'en');
  useEffect(() => { preloadLang(linguaInterfaccia); }, [linguaInterfaccia]);
  const L = (key) => t(linguaInterfaccia, key);

  // b.136 — la scelta del paese si raggiunge da tre punti diversi: il
  // primo avvio, il riepilogo nel benvenuto e la riga "Paese" nelle
  // impostazioni. Mandarli tutti e tre su 'welcome' butterebbe un
  // utente di vecchia data dentro l'onboarding solo per aver cambiato
  // bandiera. Si tiene da parte da dove si e venuti.
  const vistaPrimaDelPaese = useRef('loading');
  useEffect(() => { if (view !== 'paese') vistaPrimaDelPaese.current = view; }, [view]);
  const dopoLaSceltaDelPaese = () => {
    const prima = vistaPrimaDelPaese.current;
    // 'loading' vuol dire primo avvio: di li si prosegue col benvenuto
    // (o dritti nella stanza, se c'e un invito in mano).
    if (prima === 'loading' || prima === 'paese') { setView(joinCode ? 'join' : 'welcome'); return; }
    setView(prima);
  };

  // ═══ AppProvider — EVERY view is wrapped so useApp() works anywhere ═══
  const appCtxValue = {
    S, theme, setTheme, prefs, setPrefs, savePrefs,
    myLang, setMyLang, view, setView, status, setStatus,
    auth: {
      userToken: auth.userToken, isTrial: auth.isTrial, isTopPro: auth.isTopPro,
      creditBalance: auth.creditBalance, userAccount: auth.userAccount, useOwnKeys: auth.useOwnKeys,
    },
  };
  // ── b.111 · il velo si toglie dove serve la macchina ──
  // Lo sciame disegna 1.400 granelli a ogni fotogramma: sessanta volte
  // al secondo, sempre, su qualunque schermata. E bello e costa poco su
  // un portatile; su un telefono che nello stesso momento sta
  // codificando video, riconoscendo la voce e cifrando, quella CPU
  // manca dove serve davvero — e si sente, perche l'audio salta.
  //
  // Nelle tre schermate dove si PARLA il velo non c'e. Non e una
  // rinuncia: durante una conversazione nessuno lo guarda, e chi
  // ascolta preferisce sentire bene.
  //
  // SpatialBackdrop resta ovunque: sono due sfumature animate dal CSS,
  // le muove la scheda grafica e non tolgono niente a nessuno.
  const SCHERMATE_SENZA_VELO = new Set(['room', 'speaker', 'taxi-chat', 'join']); // b.205 — taxi-chat come speaker
  const wrap = (node) => (
    <AppProvider value={appCtxValue}>
      <SpatialBackdrop />
      {!SCHERMATE_SENZA_VELO.has(view) && <Sciame modo="velo" />}
      {node}
      {/* b.134 — l'invito a installare passa da qui perche `wrap` e
          l'unico imbuto: `{bottomNav}` compare in sedici punti diversi,
          e appenderlo li avrebbe voluto dire dimenticarlo in qualcuno.
          Durante una conversazione non si mostra: coprirebbe il campo
          di scrittura proprio mentre si sta parlando. */}
      {/* b.136-bis — PROVATO AL PRIMO AVVIO PULITO E NON ANDAVA.
          Sulla scelta del paese comparivano DUE pannelli sovrapposti in
          fondo: questo e l'avviso dei cookie. Chiedere di installare
          l'applicazione a chi non ha ancora detto da dove viene e fuori
          tempo — e coprivano il pulsante di conferma, che e l'unica cosa
          da fare in quella schermata. */}
      {!SCHERMATE_SENZA_VELO.has(view) && view !== 'paese' && <InstallaApp pwa={pwa} theme={theme} />}
    </AppProvider>
  );

  // =============================================
  // RENDER
  // =============================================
  // Full-screen views (no BottomNav)
  if (view === 'loading') return wrap(
    <div style={S.page}>
      <style>{`@keyframes vtSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.center}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid rgba(38,217,176,0.2)', borderTopColor: '#26D9B0',
          animation: 'vtSpin 0.8s linear infinite',
        }} />
      </div>
    </div>
  );

  // b.136 — viene PRIMA di 'welcome', ed e voluto: senza paese non si
  // sa in che lingua scrivere la schermata di benvenuto. Chi arriva da
  // un invito non passa di qui (useInitializeApp manda dritto a 'join').
  if (view === 'paese') return wrap(
    <SceltaPaeseView onFatto={dopoLaSceltaDelPaese} />
  );

  if (view === 'welcome') return wrap(
    <WelcomeView
      joinCode={joinCode} userToken={auth.userToken} setAuthStep={auth.setAuthStep}
      sendAuthCode={auth.sendAuthCode} verifyAuthCodeFn={() => auth.verifyAuthCodeFn(auth.pendingReferralCode)}
      loginWithGoogle={auth.loginWithGoogle} loginWithApple={auth.loginWithApple}
      authStep={auth.authStep} authEmail={auth.authEmail} setAuthEmail={auth.setAuthEmail}
      authCode={auth.authCode} setAuthCode={auth.setAuthCode} authLoading={auth.authLoading}
      authTestCode={auth.authTestCode} pendingReferralCode={auth.pendingReferralCode} />
  );

  if (view === 'room') return wrap(
    <Suspense fallback={<LazyFallback />}>
    <RoomView roomId={roomPolling.roomId} roomInfo={roomPolling.roomInfo}
      roomSessionToken={roomPolling.roomSessionTokenRef?.current}
      messages={roomPolling.messages} streamingMsg={translation.streamingMsg} recording={translation.recording}
      isListening={translation.isListening} partnerConnected={roomPolling.partnerConnected}
      partnerSpeaking={roomPolling.partnerSpeaking} partnerLiveText={roomPolling.partnerLiveText}
      partnerTyping={roomPolling.partnerTyping} playingMsgId={audio.playingMsgId}
      audioEnabled={audio.audioEnabled} setAudioEnabled={audio.setAudioEnabled} audioReady={audio.audioReady}
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
      unlockAudio={audio.unlockAudio} exportConversation={exportConversation}
      msgsEndRef={msgsEndRef} freeCharsUsed={freeCharsUsed} freeLimitExceeded={freeLimitExceeded}
      freeResetTime={freeResetTime}
      syncLangChange={roomPolling.syncLangChange} retranslateForNewLang={retranslateForNewLang}
      clonedVoiceId={auth.clonedVoiceId} clonedVoiceName={auth.clonedVoiceName}
      duckingLevel={audio.duckingLevel} setDuckingLevel={audio.setDuckingLevel}
      vadLivelloRef={translation.vadLivelloRef} vadSilenceCountdown={translation.vadSilenceCountdown}
      vadSensitivity={translation.vadSensitivity} setVadSensitivity={translation.setVadSensitivity}
      realtimeConnected={roomPolling.realtimeConnected}
      webrtc={webrtc}
      isHostVerified={roomPolling.isHostRef?.current || false}
      verifiedName={roomPolling.verifiedNameRef?.current || prefs.name}
      setLiveMode={audio.setLiveMode}
      interpreter={interpreter}
      onMessageRead={(msgId) => {
        if (!msgId) return;
        // ── b.128 · due strade, non una ──
        // Prima usciva SOLO dal canale P2P, che esiste solo durante una
        // chiamata: fuori da li la conferma di lettura non partiva mai e
        // il mittente restava a una spunta per sempre.
        // In Diretta resta il canale diretto, dove e giusto che stia.
        let partita = false;
        if (sendDirectMessageRef.current) {
          try { partita = sendDirectMessageRef.current({ type: 'msg-read', msgId }) !== false; }
          catch (e) { partita = false; }
        }
        if (!partita && trasportoAmmesso(sessionModeRef.current, TRASPORTO.REALTIME) && roomPolling.broadcastRead) {
          try { roomPolling.broadcastRead(msgId); } catch (e) { /* la spunta restera a una: non vale un errore a schermo */ }
        }
      }}
      showChatActions={showChatActions} setShowChatActions={setShowChatActions}
      localChat={localChat}
      ProviderBadge={ProviderBadge} />
    </Suspense>
  );

  // ── b.102 · Stanza video di gruppo ──
  // Vista a se: non passa da RoomView e non tocca useWebRTC. Se qui si
  // rompe qualcosa, la chiamata a due continua a funzionare com'e.
  if (view === 'stanza-video') return wrap(
    <Suspense fallback={<LazyFallback />}>
      <StanzaVideoGruppo
        roomId={roomPolling.roomId}
        roomSessionToken={roomPolling.roomSessionTokenRef?.current}
        mioNome={roomPolling.verifiedNameRef?.current || prefs.name}
        onEsci={() => setView(roomPolling.roomId ? 'room' : 'home')} />
    </Suspense>
  );

  if (view === 'lobby') return wrap(
    <Suspense fallback={<LazyFallback />}>
    <LobbyView roomId={roomPolling.roomId} roomInfo={roomPolling.roomInfo} partnerConnected={roomPolling.partnerConnected}
      inviteLang={inviteLang} setInviteLang={setInviteLang} shareRoom={shareRoom}
      leaveRoom={() => { roomPolling.leaveRoom(); convContext.resetContext(); setView('home'); }} unlockAudio={audio.unlockAudio}
      perVideo={intentoVideo} />
    {/* La porta per il video di gruppo sta DENTRO LobbyView: messa qui
        fuori finiva sotto la schermata della stanza e non si poteva
        premere. Il collaudo dal vivo lo ha mostrato in b.102. */}
    {/* La sala d'attesa e il posto giusto: e qui che l'host sta mentre gli
        altri bussano. Il pannello lo vede solo chi ospita. */}
    {roomPolling.isHostRef?.current !== false && (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 20px' }}>
        <PannelloModerazione
          aperto
          roomId={roomPolling.roomId}
          roomSessionToken={roomPolling.roomSessionTokenRef?.current}
          membri={roomPolling.roomInfo?.members || []}
          mioNome={roomPolling.verifiedNameRef?.current || prefs.name}
          onChiudi={null} />
      </div>
    )}
    </Suspense>
  );

  if (view === 'join') return wrap(
    <JoinView
      joinCode={joinCode} setJoinCode={setJoinCode}
      inviteMsgLang={inviteMsgLang} setInviteMsgLang={setInviteMsgLang}
      handleJoinRoom={handleJoinRoom} userToken={auth.userToken}
      setAuthStep={auth.setAuthStep} 
      unlockAudio={audio.unlockAudio} />
  );

  // Define BottomNav for views that use it (now with 5 tabs + FAB)
  const bottomNav = (
    <>
      <BottomNav currentView={view} onNewConversation={() => setShowNewConversation(true)} />
      <NewConversationSheet open={showNewConversation} onClose={() => setShowNewConversation(false)} onSelect={handleNewConversationSelect} />
    </>
  );

  // Views with BottomNav
  if (view === 'home') return wrap(
    <>
      <HomeView
        selectedMode={selectedMode} setSelectedMode={setSelectedMode}
        selectedContext={selectedContext} setSelectedContext={setSelectedContext}
        roomDescription={roomDescription} setRoomDescription={setRoomDescription}
        handleCreateRoom={handleCreateRoom}
        contacts={contactsHook.contacts} fetchContacts={contactsHook.fetchContacts}
        rejoinRoom={rejoinRoom} startChatWithContact={startChatWithContact} />
      {showTutorial && (
        <TutorialOverlay tutorialStep={tutorialStep}
          setTutorialStep={setTutorialStep} setShowTutorial={setShowTutorial} />
      )}
      <InvitaAmici aperta={showInvitaAmici} onClose={() => setShowInvitaAmici(false)} />
      {bottomNav}
    </>
  );

  if (view === 'account') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <AccountView authStep={auth.authStep} authEmail={auth.authEmail} setAuthEmail={auth.setAuthEmail}
        authCode={auth.authCode} setAuthCode={auth.setAuthCode} authLoading={auth.authLoading}
        authTestCode={auth.authTestCode} sendAuthCode={auth.sendAuthCode} verifyAuthCodeFn={() => auth.verifyAuthCodeFn(auth.pendingReferralCode)}
        loginWithGoogle={auth.loginWithGoogle} loginWithApple={auth.loginWithApple}
        pendingReferralCode={auth.pendingReferralCode}
        setAuthStep={auth.setAuthStep} />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'credits') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <CreditsView creditBalance={auth.creditBalance} buyCredits={auth.buyCredits}
        authLoading={auth.authLoading} userAccount={auth.userAccount} />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'apikeys') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <ApiKeysView apiKeyInputs={auth.apiKeyInputs} setApiKeyInputs={auth.setApiKeyInputs}
        saveUserApiKeys={auth.saveUserApiKeys} authLoading={auth.authLoading} userAccount={auth.userAccount} />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'settings') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <SettingsView
        isTrial={auth.isTrial} isTopPro={auth.isTopPro} setIsTopPro={auth.setIsTopPro} useOwnKeys={auth.useOwnKeys}
        apiKeyInputs={auth.apiKeyInputs} platformHasEL={auth.platformHasEL} elevenLabsVoices={auth.elevenLabsVoices}
        selectedELVoice={auth.selectedELVoice} setSelectedELVoice={auth.setSelectedELVoice}
        setElevenLabsVoices={auth.setElevenLabsVoices} userToken={auth.userToken} userTokenRef={auth.userTokenRef}
        userAccount={auth.userAccount} logout={auth.logout} 
        creditBalance={auth.creditBalance} refreshBalance={auth.refreshBalance} freeCharsUsed={freeCharsUsed}
        clonedVoiceId={auth.clonedVoiceId} clonedVoiceName={auth.clonedVoiceName}
        setClonedVoiceId={auth.setClonedVoiceId} setClonedVoiceName={auth.setClonedVoiceName} />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'history') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <HistoryView convHistory={convHistory} archivioSoloLocale={archivioSoloLocale} viewConversation={viewConversation}
        verifiedName={roomPolling.verifiedNameRef?.current || prefs.name} />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'summary') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <SummaryView currentConv={currentConv} summaryLoading={summaryLoading}
        shareSummary={shareSummary} setCurrentConv={setCurrentConv}
        verifiedName={roomPolling.verifiedNameRef?.current || prefs.name} />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'voicetest') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <VoiceTestView
        isTrial={auth.isTrial} isTopPro={auth.isTopPro} useOwnKeys={auth.useOwnKeys}
        apiKeyInputs={auth.apiKeyInputs} platformHasEL={auth.platformHasEL}
        elevenLabsVoices={auth.elevenLabsVoices} selectedELVoice={auth.selectedELVoice}
        setElevenLabsVoices={auth.setElevenLabsVoices} userToken={auth.userToken}
        userTokenRef={auth.userTokenRef} creditBalance={auth.creditBalance} />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'contacts') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <ContactsView
        contacts={contactsHook.contacts} contactsLoading={contactsHook.contactsLoading}
        inviteCode={contactsHook.inviteCode} creditBalance={auth.creditBalance}
        fetchContacts={contactsHook.fetchContacts} addContact={contactsHook.addContact}
        removeContact={contactsHook.removeContact} createInvite={contactsHook.createInvite}
        shareInvite={contactsHook.shareInvite} acceptInvite={contactsHook.acceptInvite}
        startPolling={contactsHook.startPolling}
        handleStartChat={handleStartChatWithContact}
        pickDeviceContacts={contactsHook.pickDeviceContacts}
        hasDeviceContacts={contactsHook.hasDeviceContacts}
        />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'taxi-driver') return wrap(
    <Suspense fallback={<LazyFallback />}>
      <TaxiDriverView destId={taxiDestId} decryptionKey={taxiKey} />
    </Suspense>
  );

  if (view === 'life') return wrap(
    <Suspense fallback={<LazyFallback />}>
      <LifeView
        // b.201 — dal Dossier si apre una stanza sull'argomento: si imposta
        // lo stesso preset di Mondo (nome + descrizione) e si va a Mondo,
        // dove il foglio di creazione che funziona è già montato. Nessuna
        // duplicazione del foglio (le sue prop differiscono fra i punti).
        onApriStanza={({ nome, descrizione }) => { setTopicPreset({ nome, descrizione }); setShowCreateRoom(true); setView('mondo'); }}
      />
    </Suspense>
  );

  if (view === 'mondo') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <MondoView
        // b.110 — setJoinCode e asincrono: handleJoinRoom leggeva lo
        // stato VECCHIO. La prima volta non succedeva niente, la seconda
        // si entrava nella stanza precedente. Ora il codice si passa.
        onJoinRoom={(rid) => { setJoinCode(rid); handleJoinRoom(rid); }}
        onCreateRoom={() => { setTopicPreset(null); setShowCreateRoom(true); }}
        onParlane={(topic) => {
          // b.147 — dalla notizia alla conversazione: e il punto del piano.
          setTopicPreset({ nome: topic.titolo, descrizione: topic.sintesi || '' });
          setShowCreateRoom(true);
        }} />
      </Suspense>
      <Suspense fallback={null}>
        <CreateRoomSheet
          open={showCreateRoom}
          preimpostato={topicPreset}
          onClose={() => { setShowCreateRoom(false); setTopicPreset(null); }}
          onCreate={async (roomConfig) => {
            const room = await roomPolling.handleCreateRoom(
              prefs.name || 'Host', roomConfig.lang || myLang,
              roomConfig.mode || selectedMode, prefs.avatar,
              selectedContext, roomConfig.mode || selectedMode,
              roomConfig.description || '',
              auth.isTrial, auth.isTopPro, auth.userAccount,
              roomConfig.diretta,
              roomConfig.maxParticipants
            );
            // ── b.113/b.123 · la scelta dell'utente diventa effettiva QUI ──
            // Prima di b.113 la modalita Diretta era un meccanismo
            // perfettamente funzionante che nessuno poteva accendere.
            // Da b.123 la riga non e piu qui ma dentro la politica
            // unica, cosi non puo restare indietro in uno dei tre
            // ingressi (a rejoinRoom era gia successo).
            // Si legge `diretta` dalla stanza tornata dal server, con
            // ripiego sulla scelta locale se il server non la rimanda.
            applicaPoliticaStanza({ ...room, diretta: room?.diretta ?? roomConfig.diretta });
            roomInfoRef.current = { ...room, diretta: !!roomConfig.diretta };

            // ── Fino a b.96 la storia finiva qui, e la stanza non nasceva ──
            // Il modulo raccoglieva nome, tipo, categoria e numero massimo, e
            // qui restavano lingua, modalita e descrizione: tutto il resto
            // veniva buttato via. Risultato: nasceva una normale chat a due,
            // Community restava eternamente "Nessuna stanza al momento", e la
            // POST di /api/mondo non la chiamava nessuno.
            const codice = room?.id;
            // b.139-bis — qui c'era scritto `roomType !== 'private'`, e la
            // stessa regola col segno opposto stava in /api/mondo. Il server
            // resta l'autorita e rifiuta comunque; questo controllo evita solo
            // una richiesta destinata a essere respinta, e ora legge la regola
            // dallo stesso posto da cui la legge il server.
            if (codice && vaInVetrina(roomConfig.roomType)) {
              try {
                await fetch('/api/mondo', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    roomId: codice,
                    host: prefs.name || 'Host',
                    nome: roomConfig.nome,
                    description: roomConfig.description || '',
                    mode: roomConfig.mode,
                    categoria: roomConfig.category,
                    lang: roomConfig.lang || myLang,
                    hostLang: prefs.lang || myLang,
                    roomType: roomConfig.roomType,
                    maxPartecipanti: roomConfig.maxParticipants,
                    // b.111 — stanza a litigio libero: nessuna tendina
                    // grigia davanti al linguaggio pesante. I reati
                    // restano vietati come in ogni altra stanza.
                    hot: !!roomConfig.hot,
                    // b.110 — `room.sessionToken` non esiste: handleCreateRoom
                    // restituisce solo la stanza e mette il token nel ref
                    // (useRoomPolling:661). Il campo era sempre vuoto, quindi
                    // se l'host non era loggato /api/mondo rispondeva 401 e la
                    // stanza non compariva mai in vetrina.
                    roomSessionToken: roomPolling.roomSessionTokenRef?.current || '',
                    userToken: auth.userAccount?.token
                      || (typeof window !== 'undefined' ? localStorage.getItem('vt-token') || '' : ''),
                  }),
                });
              } catch (e) {
                // La stanza esiste comunque: si entra col codice. Solo non
                // compare in vetrina, e l'host deve poterlo sapere.
                console.warn('[Community] stanza non pubblicata:', e?.message);
              }
            }
            setView('lobby');
          }}
        />
      </Suspense>
      {bottomNav}
    </>
  );

  // ── INIZIO b.205 — TaxiTalk rifatto: la vista 'speaker' apre la
  // schermata nuova e semplice (indirizzo+mappa+QR, parla→ribalta). La
  // conversazione tradotta di prima resta disponibile come CHAT opzionale
  // sotto 'taxi-chat' (riusa la maschera che già funziona). ── (Luca)
  if (view === 'speaker') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <TaxiTalk userToken={auth.userToken} />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'taxi-chat') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <SpeakerView userToken={auth.userToken} />
      </Suspense>
      {bottomNav}
    </>
  );
  // ── FINE b.205 ──

  if (view === 'quickinvite') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <QuickInvite
        handleCreateRoom={async (overrideLang) => {
          try {
            setStatus('...');
            const langToUse = overrideLang || myLang;
            // b.114 — qui NON esiste `roomConfig`: questa e la creazione
            // rapida dell'invito, che non passa dal modulo con le
            // opzioni. In b.113 ci era finito lo stesso, perche la
            // sostituzione ha colpito tutti e due i punti di chiamata, e
            // il risultato era "Errore di connessione. Riprova." su ogni
            // invito. Una stanza creata al volo non e Diretta.
            const room = await roomPolling.handleCreateRoom(
              prefs.name || 'Host', langToUse, selectedMode, prefs.avatar,
              selectedContext, selectedMode, '',
              auth.isTrial, auth.isTopPro, auth.userAccount,
              false
            );
            roomInfoRef.current = room;
            setStatus('');
            return room;
          } catch (e) { setStatus('Error: ' + e.message); throw e; }
        }}
        roomId={roomPolling.roomId}
        setViewAfterCreate={() => setView('room')} />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'voice-clone') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <VoiceCloneView
        userToken={auth.userToken} userTokenRef={auth.userTokenRef}
        creditBalance={auth.creditBalance}
        onVoiceCloned={(voiceId, name) => {
          auth.setClonedVoiceId(voiceId);
          auth.setClonedVoiceName(name);
          auth.refreshBalance();
        }} />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'help') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
      <HelpView />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'ai') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
        <AIView
          contacts={contactsHook.contacts}
          recentConversations={convHistory}
          handleCreateRoom={handleCreateRoom}
          setSelectedMode={setSelectedMode}
        />
      </Suspense>
      {bottomNav}
    </>
  );

  if (view === 'detail') return wrap(
    <>
      <Suspense fallback={<LazyFallback />}>
        <DetailView
          conversation={detailConversation || {}}
          messages={detailMessages || []}
          onBack={() => setView('history')}
          // b.126 — una conversazione salvata NON ha `roomId`: il suo `id`
          // E il codice della stanza (store.js: `const id = roomId.toUpperCase()`).
          // Chiedendo `detailConversation?.roomId` la condizione era sempre
          // falsa, quindi il pulsante Riprendi non compariva MAI.
          onResume={detailConversation?.id ? () => {
            if (rejoinRoom) rejoinRoom(detailConversation.id);
          } : undefined}
          onExport={() => {
            if (!detailMessages?.length) return;
            const convName = detailConversation?.host ? `${detailConversation.host}'s Room` : 'BarTalk';
            const date = new Date().toLocaleString();
            let text = `BarTalk - ${convName}\n${date}\n${'='.repeat(40)}\n\n`;
            for (const msg of detailMessages) {
              const time = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
              text += `[${time}] ${msg.sender}:\n  ${msg.original}\n  → ${msg.translated}\n\n`;
            }
            text += `${'='.repeat(40)}\n${detailMessages.length} ${L('messages')} | BarTalk`;
            if (navigator.share) navigator.share({ title: `BarTalk - ${convName}`, text });
            else { navigator.clipboard.writeText(text).then(() => { setStatus(L('exportCopied')); setTimeout(() => setStatus(''), 2000); }); }
          }}
          onShare={() => {
            // b.126 — il commento sotto lo diceva gia da b.110 ("la
            // conversazione ha `id`, non `roomId`") e la riga sopra
            // continuava a controllare `roomId`: usciva sempre subito, e
            // il link non veniva generato mai. Una spiegazione giusta
            // accanto a un codice che non l'aveva seguita.
            if (!detailConversation?.id) return;
            const link = `${window.location.origin}?room=${detailConversation.id}`;
            if (navigator.share) navigator.share({ title: 'BarTalk', url: link });
            else navigator.clipboard.writeText(link).then(() => { setStatus(L('linkCopied')); setTimeout(() => setStatus(''), 2000); });
          }}
          onDelete={() => {
            if (!detailConversation?.id) return;
            if (!confirm(L('deleteConvConfirm'))) return;
            fetch('/api/conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', convId: detailConversation.id, userToken: auth.userTokenRef?.current || null })
            })
              .then(async (res) => {
                // b.126 — prima non si guardava `res.ok`: il server
                // rispondeva "Invalid action" (l'azione `delete` non
                // esisteva) e l'utente vedeva la schermata tornare
                // indietro come se fosse stato cancellato. Una
                // cancellazione che non cancella, dichiarata riuscita.
                if (!res.ok) {
                  const errore = await res.json().catch(() => ({}));
                  setStatus(errore.error || L('cannotDelete'));
                  setTimeout(() => setStatus(''), 3000);
                  return;
                }
                loadHistory();
                setView('history');
              })
              .catch(e => {
                console.error('Delete error:', e);
                setStatus(L('cannotDelete'));
                setTimeout(() => setStatus(''), 3000);
              });
          }}
          onPlayMessage={(msg) => audio.playMessage(msg)}
          playingMsgId={audio.playingMsgId}
        />
      </Suspense>
      {bottomNav}
    </>
  );

  return null;
}
