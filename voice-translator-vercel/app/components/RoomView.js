'use client';
import { memo, useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { MODES, CONTEXTS, FONT, getLang, vibrate } from '../lib/constants.js';
import { ultimoRapportoTesto } from '../lib/diagnosticaChiamata.js';
import { rapportoMonitorTesto } from '../lib/monitorSviluppo.js';
import { toast } from '../lib/avvisi.js';
import { vaInVetrina } from '../lib/decisioni.js';
import AvatarImg from './AvatarImg.js';
import VideoCallOverlay from './VideoCallOverlay.js';
import VoiceCallOverlay from './VoiceCallOverlay.js';
import MessageList from './MessageList.js';
import InvitaGuru from './ui/InvitaGuru.js';           // b.549 — i guru in stanza
import { parlaAmico } from '../lib/compagni/cliente.js'; // b.549 — la voce del guru
import { trovaCompagno } from '../lib/compagni/catalogo.js';
// b.372 — IL CAROSELLO DI RADIOCHAT, portato qui come SECONDO MODO di
// leggere la stessa chat (ordine di Luca). Si carica solo se lo si
// apre: si porta dietro three.js, e chi non lo usa non deve scaricarlo.
import { daBarTalk } from './Carosello3D.js';
const Carosello3D = lazy(() => import('./Carosello3D.js'));
import ComandoZoom from './ui/ComandoZoom.js';
import PannelloLaterale, { LinguettaPannello } from './ui/PannelloLaterale.js';
import { vesteMicrofono } from './ui/Microfono.js';
import { IconCamera, IconArchive } from './Icons.js';
import Icon from './Icon.js';   // b.549 — l'icona dei guru
import InterpreterView from './InterpreterView.js';
import ChatActionsPanel from './ChatActionsPanel.js';
import RoomHeader from './RoomHeader.js';
import NumeroSicurezza from './NumeroSicurezza.js';
import VoiceEngineBar from './VoiceEngineBar.js';
import TalkControls from './TalkControls.js';
import TaxiMode from './TaxiMode.js';
import ContenutiChat from './ContenutiChat.js';
import SchedaArgomento from './SchedaArgomento.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import { getAttenuazione, setVolumeTTS } from '../lib/audioPrefs.js';
import useReazioni from '../hooks/useReazioni.js';
import { eDiretta } from '../lib/decisioni.js';
// b.387 — i membri si leggono da un posto solo, che non lancia mai:
// la lettura pubblica di una stanza non li manda apposta, e due punti
// del client davano per scontato un array e morivano.
import { membriDi } from '../lib/membri.js';

// b.470 — la veste di una voce del pannello: alta 44 come ogni altro
// tasto (regola dei quarantaquattro), a tutta larghezza, senza riquadro.
function vocePannello(S) {
  return {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    minHeight: 44, padding: '0 10px', borderRadius: 12,
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
    color: S.colors.textSecondary, fontSize: 14.5, fontFamily: FONT,
    WebkitTapHighlightColor: 'transparent',
  };
}

const RoomView = memo(function RoomView({ roomId, roomInfo, messages, streamingMsg,
  recording, isListening, partnerConnected, partnerSpeaking, partnerLiveText, partnerTyping,
  playingMsgId, audioEnabled, setAudioEnabled, audioReady, isTrial, isTopPro, canUseElevenLabs,
  useOwnKeys, apiKeyInputs,
  elevenLabsVoices, selectedELVoice, setSelectedELVoice,
  showModeSelector,
  setShowModeSelector, textInput, setTextInput, sendingText, sendTextMessage, sendTypingState,
  toggleRecording, cancelRecording, startFreeTalk, stopFreeTalk, endChatAndSave, leaveRoomTemporary, changeRoomMode, playMessage,
  unlockAudio, exportConversation, msgsEndRef,
  freeCharsUsed, freeLimitExceeded, freeResetTime,
  syncLangChange, retranslateForNewLang,
  clonedVoiceId, clonedVoiceName,
  duckingLevel, setDuckingLevel,
  vadLivelloRef, vadSilenceCountdown, vadSensitivity, setVadSensitivity,
  realtimeConnected, webrtc, isHostVerified, verifiedName,
  setLiveMode, interpreter, onMessageRead,
  showChatActions, setShowChatActions, localChat, ProviderBadge,
  roomSessionToken, userToken }) {
  const { L, S, prefs, myLang, setView, setMyLang, savePrefs, status, theme, setTheme } = useApp();
  // b.468 — il pannello laterale della chat: dentro ci sono le voci.
  const [pannelloVoci, setPannelloVoci] = useState(false);

  // b.379 — CHI SONO IO, DICHIARATO SUBITO. Stava piu di cento righe piu
  // in basso, e da b.372 due punti sopra lo leggevano gia: l'elenco di
  // dipendenze di un effetto, e il calcolo dei messaggi per il carosello.
  //
  // In JavaScript un `const` letto PRIMA della sua riga non vale
  // "non definito": e un errore che uccide il componente. Quindi la
  // stanza non si apriva PIU DA NESSUN PERCORSO — non era una stanza
  // rotta, era il componente che moriva a ogni montaggio, e i quattro
  // percorsi diversi cadevano tutti nello stesso punto.
  //
  // L'ho introdotto io portando il carosello da RadioChat. Riparata la
  // CAUSA e non i sintomi: il nome nasce dove nascono le sue due
  // sorgenti, cosi nessuno puo tornare a leggerlo troppo presto
  // spostando un pezzo di codice.
  const myName = verifiedName || prefs.name;

  // ── b.99 · reazioni durevoli ──
  // Si chiedono i conteggi dei soli messaggi a schermo, in una chiamata
  // sola. Sessanta e il tetto che accetta la rotta.
  const idsVisibili = useMemo(
    () => (messages || []).slice(-60).map(m => m.id).filter(Boolean),
    [messages]
  );
  const reazioni = useReazioni({ roomId, roomSessionToken, msgIds: idsVisibili });

  // Il messaggio a cui si sta rispondendo, mostrato sopra il campo di
  // scrittura finche non si invia o non si annulla.
  // b.372 — il carosello: quale carta si guarda, e le due manopole.
  // Zoom e altezza si ricordano, come in RadioChat: sono regolazioni che
  // uno fa una volta per il suo schermo, non a ogni apertura.
  const [modoCarosello, setModoCarosello] = useState(false);
  const [indiceCarosello, setIndiceCarosello] = useState(0);
  const [zoomCarosello, setZoomCarosello] = useState(() => {
    try { return parseFloat(localStorage.getItem('bartalk_carosello_zoom')) || 1.0; }
    catch { /* memoria del browser negata (navigazione privata): si riparte dal valore normale */ return 1.0; }
  });
  const [altezzaCarosello, setAltezzaCarosello] = useState(() => {
    try { return parseInt(localStorage.getItem('bartalk_carosello_alto')) || 0; }
    catch { /* memoria del browser negata: si riparte dall'altezza normale */ return 0; }
  });
  useEffect(() => {
    try { localStorage.setItem('bartalk_carosello_zoom', String(zoomCarosello)); }
    catch { /* non poter RICORDARE una manopola non e un guasto da segnalare a nessuno */ }
  }, [zoomCarosello]);
  useEffect(() => {
    try { localStorage.setItem('bartalk_carosello_alto', String(altezzaCarosello)); }
    catch { /* non poter ricordare l'altezza della vista non e un guasto da dire a nessuno */ }
  }, [altezzaCarosello]);

  // i messaggi tradotti nella forma che il carosello si aspetta. Si
  // rifa solo quando cambiano davvero: costruire otto immagini a ogni
  // respiro sarebbe un macello.
  const messaggiCarosello = useMemo(
    () => (messages || []).map((m) => daBarTalk(m, myName, myLang)),
    [messages, myName, myLang]
  );

  const [rispostaA, setRispostaA] = useState(null);
  const [schedaChat, setSchedaChat] = useState(null); // { tipo, dati } | null — link condiviso in chat, aperto (b.154)

  // ── Conservare i messaggi: SOLO nelle stanze Community ──
  // Il client manda tutto, il SERVER decide: se la stanza non e stata
  // pubblicata in Community non conserva niente e risponde
  // "conservato: false". Cosi la promessa di riservatezza delle chat
  // private non dipende dal fatto che il telefono si comporti bene.
  const giaConservati = useRef(new Set());
  useEffect(() => {
    if (!roomId || !roomSessionToken) return;
    for (const m of messages || []) {
      if (!m?.id || giaConservati.current.has(m.id)) continue;
      // b.363 — SOLO I MIEI messaggi. Prima si conservavano anche quelli del
      // partner, ma il server registra come autore CHI CHIAMA: nelle stanze
      // di gruppo ogni messaggio finiva nello storico una volta per membro,
      // e le copie salvate dagli altri risultavano firmate dalla persona
      // sbagliata. E la lingua: il campo vero e `sourceLang` (`m.lang` non
      // esiste), quindi si registrava sempre la lingua del lettore.
      if (m.sender !== myName) continue;
      const testo = m.original || m.text || '';
      if (!testo) continue;
      giaConservati.current.add(m.id);
      reazioni.conserva(m.id, testo, m.sourceLang || myLang, m.rispostaA || null);
    }
  }, [messages, roomId, roomSessionToken, reazioni, myLang, myName]);

  // b.363 — LA RISPOSTA CITATA PARTIVA A VUOTO: il banner "Rispondi a X"
  // si apriva, ma ne il tasto ne l'Invio passavano la citazione, e il banner
  // restava appeso anche dopo l'invio. Ora la citazione viaggia col
  // messaggio e il banner si chiude da solo.
  const inviaConCitazione = useCallback(() => {
    const citato = rispostaA?.id || null;
    sendTextMessage(citato ? { rispostaA: citato } : undefined);
    setRispostaA(null);
    // b.390 — IL CAMPO NON PERDE PIU IL FUOCO. Era una riga: l'input si
    // DISABILITAVA mentre il messaggio partiva, e un campo disabilitato
    // il browser lo abbandona. Quando tornava attivo nessuno gli
    // ridava il fuoco, e chi scriveva cinque messaggi di fila — come si
    // fa in una chat — ne mandava uno: gli altri quattro finivano nel
    // vuoto, senza che niente lo dicesse.
    //
    // Adesso il campo resta scrivibile mentre il messaggio vola (si puo
    // gia scrivere il prossimo, come in qualunque chat) e il fuoco si
    // rimette comunque, per il caso in cui a inviare sia stato il tasto.
    try { campoTestoRef.current?.focus(); } catch { /* il campo non c'e piu: si e usciti dalla stanza */ }
  }, [rispostaA, sendTextMessage]);

  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const [interpreterActive, setInterpreterActive] = useState(false);
  const [videoDucking, setVideoDucking] = useState(false);
  const [lastTranslationSubtitle, setLastTranslationSubtitle] = useState(null);
  const [partnerVolume, setPartnerVolume] = useState(0.7);
  const [liveMode, setLiveModeState] = useState(false);
  const [taxiVisible, setTaxiVisible] = useState(false);
  const [taxiData, setTaxiData] = useState({ original: '', translated: '', fromLang: '', toLang: '' });
  const partnerVolumeBeforeMuteRef = useRef(0.7);
  const subtitleTimerRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const typingDebounceRef = useRef(null);

  // ── Compute derived values ──
// b.485 — «U.find is not a function», DI NUOVO, e stavolta trovato da
// Luca sul telefono con la pagina intera sostituita dalla scritta di
// errore. E' lo stesso difetto di b.426: il punto interrogativo
// protegge dal MANCANTE, non dal NON-ELENCO. Se `members` torna un
// oggetto (e la lettura pubblica di una stanza non li restituisce
// apposta), `?.` non salta niente: chiama .find su un oggetto e la
// schermata muore. L'aiutante giusto esiste da b.387: membriDi().
  const otherMembers = membriDi(roomInfo).filter(m => m.name !== myName);

  // b.550 — QUESTI DUE BLOCCHI STANNO QUI, NON PIU IN CIMA. Leggono
  // `myName` e `otherMembers`, che nascono qui sopra: scritti prima,
  // finivano nella zona morta e uccidevano la stanza intera — la stessa
  // trappola che ieri ha fatto morire il feed («Cannot access 'T'»).
  // Stavolta l'ha presa la prova mai-letto-prima-di-nascere, non Luca.
  // b.550 — «AVVISAMI QUANDO ARRIVA QUALCUNO». La promessa di b.537 con
  // le parole gia tradotte in 38 lingue e nessuno che le mostrasse.
  // La richiesta vive nel telefono: quando la stanza smette di essere
  // vuota, il telefono lo dice — senza che il server debba tenere
  // l'elenco di chi aspetta cosa.
  const [avvisoAcceso, setAvvisoAcceso] = useState(false);
  const avvisatoRef = useRef(false);
  const chiediAvviso = useCallback(() => {
    setAvvisoAcceso(true);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
    } catch { /* niente permesso: si avvisa lo stesso dentro l'app */ }
  }, []);
  useEffect(() => {
    if (!avvisoAcceso || avvisatoRef.current) return;
    if (otherMembers.length === 0) return;
    avvisatoRef.current = true;
    const chi = otherMembers[0]?.name || '';
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        // eslint-disable-next-line no-new -- la notifica non serve conservarla
        new Notification(L('warnMeArrived'), { body: chi, icon: '/icons/icon-192x192.png' });
      }
    } catch { /* il browser non vuole: resta l'avviso dentro l'app */ }
    try { toast(L('warnMeArrived')); } catch { /* niente striscia: l'avviso resta quello del sistema */ }
  }, [avvisoAcceso, otherMembers, L]);

  // ═══ b.549 — I GURU IN STANZA ═══
  // Luca: «non vedo alcun comando ne icona dei guru da invitare alla chat
  // (archimede albert pitagora newton etc)». I Compagni vivevano solo
  // dentro Vita; qui, dove servono di piu — una stanza che si e' fermata,
  // un fatto da verificare, una conversazione da aprire — non c'era
  // nessuna porta. Adesso c'e: il guru legge gli ultimi scambi e dice la
  // sua nella conversazione, con la sua vocazione.
  const [guruAperto, setGuruAperto] = useState(false);
  const [guruInCorso, setGuruInCorso] = useState(false);
  const invitaGuru = useCallback(async (compagnoId) => {
    if (guruInCorso) return;
    setGuruInCorso(true);
    try {
      const chi = trovaCompagno(compagnoId);
      // gli ultimi scambi, cosi entra sapendo di cosa si parla
      const ultimi = (messages || []).slice(-8).map((m) => ({
        ruolo: m.sender === myName ? 'persona' : 'persona',
        testo: String(m.original || m.translated || '').slice(0, 400),
        nome: m.sender || '',
      })).filter((m) => m.testo);
      const esito = await parlaAmico({
        compagnoId,
        messaggi: ultimi.length ? ultimi : [{ ruolo: 'persona', testo: L('inviteGuruOpen'), nome: myName }],
        lingua: myLang || 'it',
        userToken,
        superficie: 'amico',
      });
      const detto = String(esito?.risposta || esito?.testo || '').trim();
      if (!detto) return;
      // il guru parla NELLA conversazione: il messaggio parte come gli
      // altri e viene tradotto per tutti, come quello di una persona.
      setTextInput(`${chi?.nome || 'Compagno'}: ${detto}`);
      setGuruAperto(false);
    } catch { /* il guru non risponde: la stanza resta come prima */ }
    finally { setGuruInCorso(false); }
  }, [guruInCorso, messages, myName, myLang, userToken, L, setTextInput]);

  const partner = otherMembers[0];
  const myL = getLang(myLang);
  const otherL = partner ? getLang(partner.lang) : getLang('en');
  const roomMode = roomInfo?.mode || 'conversation';
  // b.152 — REGOLA DI PRODOTTO (Luca, 14/8): le stanze della sezione
  // Mondo sono SOLO SCRITTE, con lettura vocale (TTS) per chi la vuole;
  // la videochiamata e la chiamata vocale vivono nelle chat private.
  // Il discriminante e pulito: `roomType` viene scritto sulla stanza
  // SOLO quando viene pubblicata in vetrina (aggiornaPoliticaPubblica,
  // chiamata unicamente da /api/mondo). Le stanze da invito/QR/contatti
  // non ce l'hanno, e li le chiamate restano come sono sempre state.
  const stanzaMondo = !!roomInfo?.roomType && vaInVetrina(roomInfo.roomType);
  // ═══ b.294 — LA PLANCIA A TRE STATI (richiesta di Luca) ═══
  // 'libera' (default): la chat prende TUTTO lo spazio; in primo piano,
  // fuori da ogni contenitore, due tondi: ⌨ al centro (semitrasparente,
  // apre la scrittura col cursore gia nel campo) e il microfono a lato.
  // 'scrivi': il campo di testo galleggia sopra i messaggi, a fuoco.
  // 'parla': il microfono-eroe coi suoi strumenti, anche lui libero.
  // La X (o l'invio) riporta alla pagina libera.
  const [plancia, setPlancia] = useState('libera');
  // b.475 — il rosso segue la REGISTRAZIONE VERA, non l'apertura di un
  // pannello che non c'e piu.
  const campoTestoRef = useRef(null);
  useEffect(() => {
    // b.471 — il campo e sempre a schermo: non c'e piu un momento in cui
    // «si apre» e vuole il fuoco. Lo prende chi lo tocca.
  }, [plancia]);
  const isHost = isHostVerified !== undefined ? isHostVerified : roomInfo?.host === myName;
  const modeInfo = MODES.find(m => m.id === roomMode) || MODES[0];
  // b.157 — audit dei setting: canTalk era cablato a "solo l'host" in
  // classroom, punto e basta. L'intero percorso "alza mano -> l'host
  // concede la parola" (raiseHand/grantSpeak, TalkControls.js) scriveva
  // uno stato che nessuno leggeva mai: lo studente autorizzato restava
  // muto come prima della concessione. Ora si legge il campo persistente
  // "granted" che grantSpeaking imposta sul proprio membro (vedi
  // GRANT_SPEAKING in redisLua.js — non e piu lo stesso campo "speaking"
  // che ogni battuta di conversazione riscrive).
  const myMember = membriDi(roomInfo).find(m => m.name === myName);
  const canTalk = roomMode === 'classroom' ? (isHost || !!myMember?.granted) : true;
  const totalCost = roomInfo?.totalCost || 0;
  const msgCount = roomInfo?.msgCount || 0;
  const roomCtx = CONTEXTS.find(c => c.id === (roomInfo?.context || 'general')) || CONTEXTS[0];

  // Force unlock audio on room mount (critical for guests auto-joined from QR)
  useEffect(() => {
    if (unlockAudio) unlockAudio();
  }, []);

  // Auto-open voice/video panel when call connects
  useEffect(() => {
    const state = webrtc?.webrtcState;
    if (state === 'connected') {
      const type = webrtc?.callType;
      if (type === 'voice') {
        setShowVoiceCall(true);
        setShowVideoCall(false);
      } else {
        if (!showVideoCall) setShowVideoCall(true);
        if (!videoFullscreen) setVideoFullscreen(true);
      }
    }
    // b.248 — si ascolta anche il TIPO: quando "passa a video" promuove
    // una chiamata voce (da entrambi i lati), lo stato resta 'connected'
    // e senza questa dipendenza la finestra video non si apriva mai.
  }, [webrtc?.webrtcState, webrtc?.callType]);

  // Auto-enable ducking when in video call and languages differ
  // b.527 — Luca dal vivo: «la voce dell'ospite non viene resa piu
  // soffice per default». Quando le lingue sono diverse, la voce
  // originale del partner parte a 0.45 (non a 0.7): la protagonista e
  // la traduzione, l'originale resta un sottofondo comprensibile. Solo
  // come DEFAULT: se l'utente ha gia toccato il cursore, comanda lui.
  const partnerVolumeToccatoRef = useRef(false);
  const cambiaPartnerVolume = useCallback((v) => {
    partnerVolumeToccatoRef.current = true;
    setPartnerVolume(v);
  }, []);
  useEffect(() => {
    if (webrtc?.webrtcConnected && partner && partner.lang !== myLang) {
      setVideoDucking(true);
      if (!partnerVolumeToccatoRef.current) setPartnerVolume(0.45);
    }
  }, [webrtc?.webrtcConnected, partner?.lang, myLang]);

  // Auto-disable ducking when video call ends
  useEffect(() => {
    const state = webrtc?.webrtcState;
    if (state === 'idle' || state === 'failed') {
      setVideoDucking(false);
      setVideoFullscreen(false);
      setShowVideoCall(false);
      setShowVoiceCall(false);
      setInterpreterActive(false);
    }
  }, [webrtc?.webrtcState]);

  // ═══ b.286 — IL DEFAULT E "TRADUCI E ASCOLTA" (ordine di Luca) ═══
  // Appena la chiamata si allaccia, la traduzione (voce + testo) parte
  // DA SOLA: l'utente semmai la spegne, non deve accenderla. Si accende
  // UNA volta per chiamata (al passaggio a "connesso"): se poi la
  // spegne a mano, nessuno gliela riaccende sotto le dita. Nelle Stanze
  // Dirette non parte: la voce li non passa dai server, per promessa.
  const autoTraduzioneFattaRef = useRef(false);
  useEffect(() => {
    const connesso = !!webrtc?.webrtcConnected;
    if (!connesso) { autoTraduzioneFattaRef.current = false; return; }
    if (autoTraduzioneFattaRef.current) return;
    autoTraduzioneFattaRef.current = true;
    // b.287 — la preferenza dal profilo comanda il default:
    //   'voce' (default) -> traduzione con voce e testo
    //   'testo'          -> traduzione accesa ma voce a zero
    //   'off'            -> non parte niente: la accende l'utente
    const scelta = prefs?.autoTraduzione || 'voce';
    if (scelta === 'off') return;
    // b.289 — con PIU di due persone l'interprete simultaneo non parte:
    // e un impianto a due (un canale, una lingua) e nel gruppo darebbe
    // la traduzione a UNO solo spacciandola per tutti. Nel gruppo ognuno
    // legge gia nella propria lingua dalla stanza video.
    if (otherMembers.length > 1) return;
    if (!roomInfo?.diretta && setInterpreterActive && !interpreterActive) {
      if (scelta === 'testo') setVolumeTTS(0);
      setInterpreterActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webrtc?.webrtcConnected]);

  // Interpreter start/stop
  // b.527 — PRIMA UN AVVIO FALLITO ERA PER SEMPRE: se start() cadeva
  // (microfono conteso, presa di linea lenta) `active` restava falso ma
  // questo effetto non ripartiva piu, e la chiamata proseguiva con i
  // sottotitoli vuoti e nessuna voce — in silenzio. Ora il fallimento
  // e uno stato (erroreAvvio, vedi useInterpreterMode) e si RIPROVA con
  // un piccolo respiro, finche l'utente tiene la traduzione accesa.
  useEffect(() => {
    if (!interpreter) return undefined;
    if (interpreterActive && !interpreter.active) {
      const t = setTimeout(() => { interpreter.start(); }, interpreter.erroreAvvio ? 2500 : 0);
      return () => clearTimeout(t);
    }
    if (!interpreterActive && interpreter.active) {
      interpreter.stop();
    }
    return undefined;
  }, [interpreterActive, interpreter, interpreter?.active, interpreter?.erroreAvvio]);

  // b.277 — P1: CAMBIO LINGUA A INTERPRETE ACCESO.
  // Chi trascrive la voce viene istruito sulla lingua UNA volta, alla
  // partenza. Cambiando lingua dalla stanza l'interfaccia cambiava ma
  // l'ascolto restava su quella vecchia: un italiano passato al francese
  // continuava a essere trascritto come italiano. Ora al cambio di
  // lingua l'interprete si spegne e si riaccende, e riparte istruito
  // sulla lingua nuova.
  const linguaInterpreteRef = useRef(myLang);
  useEffect(() => {
    if (linguaInterpreteRef.current === myLang) return;
    linguaInterpreteRef.current = myLang;
    if (!interpreter?.active) return;
    interpreter.stop();
    // La riaccensione passa dallo stesso effetto di sopra al giro dopo:
    // qui basta un rilancio esplicito, breve, per non dipendere dai tempi.
    const t = setTimeout(() => { if (interpreterActive) interpreter.start(); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLang]);

  // Subtitle queue for video fullscreen
  const lastSubMsgIdRef = useRef(null);
  useEffect(() => {
    if (!videoFullscreen || !messages.length) return;
    const lastPartnerMsg = [...messages].reverse().find(m => m.sender !== myName);
    if (!lastPartnerMsg) return;
    const msgKey = lastPartnerMsg.id || `${lastPartnerMsg.sender}|${lastPartnerMsg.original}`;
    if (msgKey === lastSubMsgIdRef.current) return;
    const translationText = getTranslationForMe(lastPartnerMsg);
    const hasTranslation = !!(lastPartnerMsg.translated || (lastPartnerMsg.translations && Object.keys(lastPartnerMsg.translations).length > 0));
    if (hasTranslation && translationText) {
      lastSubMsgIdRef.current = msgKey;
      const newSub = { text: translationText, original: lastPartnerMsg.original, ts: Date.now(), key: msgKey };
      setLastTranslationSubtitle(prev => {
        const queue = Array.isArray(prev) ? prev : (prev ? [prev] : []);
        return [...queue, newSub].slice(-2);
      });
      setTimeout(() => {
        setLastTranslationSubtitle(prev => {
          if (!prev) return null;
          const queue = Array.isArray(prev) ? prev : [prev];
          const filtered = queue.filter(s => s.key !== msgKey);
          return filtered.length > 0 ? filtered : null;
        });
      }, 7000);
    }
  }, [messages, videoFullscreen]);

  // Hidden audio element for remote WebRTC audio
  useEffect(() => {
    const stream = webrtc?.remoteStream;
    if (!remoteAudioRef.current) return;
    if (stream) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.volume = partnerVolume;
      remoteAudioRef.current.play().catch(() => {});
    } else {
      remoteAudioRef.current.srcObject = null;
    }
  }, [webrtc?.remoteStream]);

  // ── Attenuazione REALE della voce del partner mentre parla la traduzione ──
  // Usa element.volume (funziona ovunque, iPhone compreso). Il livello lo
  // decide l'utente dai preset in chiamata (audioPrefs.getAttenuazione):
  // 0 = solo tradotta · 0.2 = originale attenuata · 0.55 = entrambe.
  useEffect(() => {
    const suTTS = (e) => {
      const el = remoteAudioRef.current;
      if (!el) return;
      el.volume = e.detail?.attivo
        ? partnerVolume * getAttenuazione()
        : partnerVolume;
    };
    window.addEventListener('bartalk:tts', suTTS);
    return () => window.removeEventListener('bartalk:tts', suTTS);
  }, [partnerVolume]);

  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.volume = partnerVolume;
  }, [partnerVolume]);

  // b.177 — FIX Android: l'ospite non sentiva la voce del partner in
  // chiamata. Questo muto e un anti-eco pensato per i messaggi vocali
  // async (mentre registri/ascolti, azzera l'audio in arrivo cosi il
  // microfono non lo ri-trascrive). Ma in Android il riconoscimento del
  // browser gira in ascolto CONTINUO: `isListening` resta true, quindi
  // il partner restava muto PER SEMPRE. Su iPhone si usa Whisper
  // push-to-talk, isListening quasi sempre false, e si sentiva — ecco
  // l'asimmetria Apple/Android.
  // In CHIAMATA (c'e un remoteStream) il partner NON si azzera mai:
  // l'eco lo gestisce gia echoCancellation del microfono. Fuori chiamata
  // l'anti-eco resta identico a prima: nessuna regressione sull'async.
  useEffect(() => {
    if (!remoteAudioRef.current) return;
    const inChiamata = !!webrtc?.remoteStream;
    remoteAudioRef.current.muted = !inChiamata && !!(recording || isListening);
  }, [recording, isListening, webrtc?.remoteStream]);

  // Helper: get translation for viewer's language
  function getTranslationForMe(msg) {
    if (msg.translations && msg.translations[myLang]) return msg.translations[myLang];
    if (msg.sourceLang === myLang && msg.original) return msg.original;
    if (msg.targetLang === myLang && msg.translated) return msg.translated;
    // b.289 — P1-8: MAI la lingua di un altro come ripiego. Un francese
    // in una stanza con inglesi e thai riceveva translations.en "perche
    // era la prima": meglio l'originale, dichiarando che la sua
    // traduzione sta arrivando.
    if (msg.original) return msg.original;
    return msg.translated || '';
  }

  function getSenderAvatar(senderName) {
    const member = membriDi(roomInfo).find(m => m.name === senderName);
    return member?.avatar || 'av1';
  }

  function handleLangChange(langCode) {
    if (setMyLang) setMyLang(langCode);
    if (savePrefs) savePrefs({...prefs, lang: langCode});
    if (syncLangChange) syncLangChange(langCode);
    if (retranslateForNewLang) retranslateForNewLang(langCode);
    setShowLangPicker(false);
  }

  return (
    <div style={S.roomPage} role="main" aria-label={L('translationRoomAria')}>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{display:'none'}} />

      {/* ── b.113 · la Stanza Diretta si vede sempre ──
          Non e un vezzo grafico: se la traduzione non funziona e non si
          capisce perche, si pensa a un guasto. Qui c'e scritto che e una
          scelta, e di chi. */}
      {eDiretta(roomInfo) && (
        <div style={{
          padding: '8px 14px', background: 'rgba(38,217,176,0.10)',
          borderBottom: '1px solid rgba(38,217,176,0.25)',
          fontSize: 11, color: S.colors.textPrimary, lineHeight: 1.5,
        }}>
          <strong style={{ color: '#26D9B0' }}>{L('directRoomBannerTitle')}</strong>{' '}
          {L('directRoomBannerBody')}
        </div>
      )}

      {/* ── b.113 · con chi stai parlando ──
          Compare solo quando c'e un collegamento diretto fra i due
          telefoni: e li che la domanda ha senso. Chiuso di suo, per non
          mettersi in mezzo a una conversazione; si apre toccandolo. */}
      {webrtc?.webrtcConnected && (
        <div style={{ padding: '6px 12px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <NumeroSicurezza numero={webrtc.numeroSicurezza} C={S.colors} compatto />
        </div>
      )}

      {/* ═══ Header ═══ */}
      {/* b.363 — showCaptions/setShowCaptions non si passano piu alla
          testata: li entravano e morivano, nessuno li leggeva (residuo del
          menu smontato in b.353). I sottotitoli restano governati qui. */}
      <RoomHeader
        L={L} S={S} myLang={myLang} myL={myL} otherL={otherL} setView={setView}
        otherMembers={otherMembers} partner={partner}
        showLangPicker={showLangPicker} setShowLangPicker={setShowLangPicker}
        handleLangChange={handleLangChange}
        audioEnabled={audioEnabled} setAudioEnabled={setAudioEnabled} unlockAudio={unlockAudio}
        webrtc={webrtc} partnerConnected={partnerConnected} realtimeConnected={realtimeConnected}
        stanzaSoloTesto={stanzaMondo}
        showVideoCall={showVideoCall} setShowVideoCall={setShowVideoCall}
        videoFullscreen={videoFullscreen} setVideoFullscreen={setVideoFullscreen}
        setShowVoiceCall={setShowVoiceCall}
        exportConversation={exportConversation}
        messages={messages} setShowChatActions={setShowChatActions}
        duckingLevel={duckingLevel} setDuckingLevel={setDuckingLevel}
        isTrial={isTrial} freeCharsUsed={freeCharsUsed}
        freeLimitExceeded={freeLimitExceeded} freeResetTime={freeResetTime}
        endChatAndSave={endChatAndSave} leaveRoomTemporary={leaveRoomTemporary}
        taxiVisible={taxiVisible} setTaxiVisible={setTaxiVisible} setTaxiData={setTaxiData}
        myName={myName} roomId={roomId}
        setZoomTesto={(f) => {
          // b.470 — il carattere si salva nelle PREFERENZE, non in questa
          // schermata: e la stessa misura di «Parla ora», e chi la sceglie
          // una volta se la ritrova ovunque.
          const ora = Number(prefs?.testoGrande) || 0;
          savePrefs?.({ ...prefs, testoGrande: typeof f === 'function' ? f(ora) : f });
        }}
      />

      {/* ══ b.470 — CHI C'E' E IN CHE LINGUA, come nel template ══
          E' la riga che il template mette per prima, subito sotto la
          testata, e che qui mancava del tutto: i nomi e le lingue stavano
          dentro il menu ••• — cioe nascosti — e in una stanza a tre non si
          sapeva chi ci fosse senza aprirlo.
          Non e decorazione: e la prima domanda che uno si fa entrando in una
          stanza tradotta, e la risposta deve stare a schermo. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        // b.472 — VENTI di margine laterale, come tutta l'applicazione
        // (template). Avevo messo quattordici qui e dieci sotto: due valori
        // diversi nella stessa pagina, e nessuno dei due era quello giusto.
        padding: '8px 20px 2px', flexShrink: 0,
      }}>
        {/* b.473 — il chip «Tu» apre il selettore della lingua: e la porta
            che prima era la coppia grande in testata, tolta perche ripeteva
            questa riga. La lingua si cambia da dove la si legge. */}
        <button onClick={() => { vibrate(6); setShowLangPicker(!showLangPicker); }}
          aria-expanded={showLangPicker} aria-label={L('yourLang')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 9px', borderRadius: 999, fontSize: 12, fontFamily: FONT,
            border: `1px solid ${showLangPicker ? S.colors.accent1 : S.colors.cardBorder}`,
            background: showLangPicker ? `${S.colors.accent1}18` : S.colors.cardBg,
            color: S.colors.textSecondary, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}>
          <span>{myL.flag}</span><span>{L('youWord')}</span>
        </button>
        {otherMembers.map((m, i) => (
          <span key={m.id || m.name || i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 9px', borderRadius: 999, fontSize: 12, fontFamily: FONT,
            border: `1px solid ${S.colors.cardBorder}`, background: S.colors.cardBg,
            color: S.colors.textSecondary,
            // b.470 — chi non e connesso si smorza, come gia fa la bandiera
            // in testata: presente nell'elenco ma spento, non sparito.
            opacity: partnerConnected || otherMembers.length > 1 ? 1 : 0.45,
          }}>
            <span>{getLang(m.lang).flag}</span>
            <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.name}
            </span>
          </span>
        ))}
        {/* quanti sono dentro: icona e numero, verdi e piccoli — mai il
            pallino che gridava piu del nome della stanza (b.438) */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 12.5, color: S.colors.accent4 || '#3ddc84', fontFamily: FONT,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
          </svg>
          {otherMembers.length + 1}
        </span>
      </div>

      {/* ═══ Audio unlock — compact banner (does NOT block video call) ═══ */}
      {!audioReady && (
        <div
          onClick={() => {
            if (unlockAudio) unlockAudio();
            try {
              if (typeof speechSynthesis !== 'undefined') {
                speechSynthesis.cancel();
                const warmup = new SpeechSynthesisUtterance(' ');
                warmup.volume = 0.01; warmup.rate = 10;
                speechSynthesis.speak(warmup);
                setTimeout(() => speechSynthesis.cancel(), 100);
              }
            } catch { /* il riconoscimento vocale non e disponibile qui */ }
            try {
              const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
              a.playsInline = true; a.volume = 0.01;
              a.play().catch(() => {});
            } catch { /* il browser puo rifiutare di suonare senza un tocco dell utente */ }
          }}
          style={{
            position: 'fixed', bottom: 80, left: 16, right: 16,
            zIndex: 50,
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            borderRadius: 16, padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
          aria-label={L('activateAudio')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>
            Tocca per attivare l'audio / Tap to enable audio
          </span>
        </div>
      )}

      {/* ══ b.468 — LA LINGUETTA E IL PANNELLO, come nel template ══
          Ordine di Luca: «inserire la linguetta, la side bar, mettere
          all'interno il setting delle voci (ElevenLabs e le altre che ora
          vedi fuori)».
          La barra delle voci stava SEMPRE a schermo, in fondo alla chat:
          motore vocale, modo della stanza, costo, badge del traduttore.
          Sono cose che si guardano una volta e poi restano li a occupare
          una riga sopra i messaggi — cioe sopra l'unica cosa per cui si e
          nella pagina. Adesso vivono dietro la linguetta, dove il pannello
          tiene gia i comandi di sezione nel resto dell'applicazione. */}
      {!pannelloVoci && !showChatActions && (
        <LinguettaPannello onApri={() => setPannelloVoci(true)} C={S.colors}
          etichetta={L('voiceEngine') || L('settings')} />
      )}
      {/* b.549 — IL PANNELLO DEI GURU. Luca: «non vedo alcun comando ne
          icona dei guru da invitare alla chat». Vive qui, accanto agli
          altri pannelli della stanza: si apre dal tasto vicino al campo
          di scrittura e si chiude da solo dopo aver chiamato il guru. */}
      <InvitaGuru aperto={guruAperto} onChiudi={() => setGuruAperto(false)}
        onInvita={invitaGuru} inCorso={guruInCorso} C={S.colors} L={L} />

      <PannelloLaterale aperto={pannelloVoci} onChiudi={() => setPannelloVoci(false)}
        titolo={L('settings')} C={S.colors}>

        {/* ══ b.470 — NEL PANNELLO CI VANNO ANCHE LE PREFERENZE ══
            Ordine di Luca: «sidebar deve contenere filtri e setting di
            preferenze». Non solo il motore vocale: le cose che si decidono
            una volta e poi restano decise. Sono le stesse che stavano
            sparse fra la testata e il menu ••• — di la si arrivava solo
            sapendo che c'erano. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase',
            color: S.colors.textMuted, padding: '0 10px 7px', fontFamily: FONT }}>
            {L('settings')}
          </div>

          {/* la voce tradotta si sente, oppure no */}
          <button onClick={() => { if (!audioEnabled) unlockAudio?.(); setAudioEnabled(!audioEnabled); }}
            style={vocePannello(S)}>
            <span>{audioEnabled ? L('muteTranslations') : L('unmuteTranslations')}</span>
            {/* b.477 — lo stato lo dice il PALLINO, non una parola: «on/off»
                non esiste nei pacchetti, e inventarne una qui vorrebbe dire
                scriverla a mano in trentotto lingue per due lettere. */}
            <span aria-hidden style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 999,
              background: audioEnabled ? (S.colors.accent4 || '#3ddc84') : S.colors.textMuted }} />
          </button>

          {/* il rapporto tecnico: scende qui dalla testata, dove occupava un
              posto fisso per uno strumento che si usa una volta ogni mille */}
          <button onClick={async () => {
              const testo = ultimoRapportoTesto() + '\n\n— CATENA VOCE / TESTO —\n' + rapportoMonitorTesto();
              try { await navigator.clipboard.writeText(testo); toast.success(L('techReportCopied')); }
              catch { toast.info(testo.slice(0, 300)); }
            }}
            style={vocePannello(S)}>
            <span>{L('techReport')}</span>
          </button>

          {/* b.473 — il modo di leggere, con scritto cosa cambia: era una
              pillola muta che galleggiava sopra i messaggi. */}
          <button onClick={() => { vibrate(6); setModoCarosello((v) => !v); }}
            style={vocePannello(S)}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>{modoCarosello ? L('listView') : L('carouselView')}</span>
              <span style={{ fontSize: 11.5, color: S.colors.textMuted }}>
                {modoCarosello ? L('listViewDesc') : L('carouselViewDesc')}
              </span>
            </span>
          </button>

          {/* le impostazioni vere e proprie, quelle di tutta l'applicazione */}
          <button onClick={() => setView('settings')} style={vocePannello(S)}>
            <span>{L('settings')}</span>
            <span style={{ marginLeft: 'auto', color: S.colors.textMuted }}>&rsaquo;</span>
          </button>

          {/* b.482 — «CHIUDI E ARCHIVIA», ARRIVATA QUI DAL MENU •••. Li stava
              a un dito dalla chiamata vocale e dagli strumenti AI, cioe dai
              comandi che si toccano mentre si parla: un tocco storto e la
              conversazione finiva. Qui e in fondo alle cose che si fanno una
              volta sola, e ci si arriva aprendo apposta il pannello.
              Resta rossa, perche chiude davvero. */}
          <button onClick={() => { setPannelloVoci(false); endChatAndSave(); }}
            style={{ ...vocePannello(S), color: S.colors.statusError,
              borderTop: `1px solid ${S.colors.cardBorder}`, marginTop: 6, paddingTop: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center' }}><IconArchive size={16} /></span>
            <span>{L('closeArchive')}</span>
          </button>
        </div>

        <div style={{ fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase',
          color: S.colors.textMuted, padding: '4px 10px 7px', fontFamily: FONT }}>
          {L('micWord')}
        </div>
        <TalkControls
          L={L} S={S} roomMode={roomMode} roomId={roomId} isHost={isHost}
          canTalk={canTalk} modeInfo={modeInfo} isTrial={isTrial}
          recording={recording} isListening={isListening}
          toggleRecording={toggleRecording} cancelRecording={cancelRecording}
          startFreeTalk={startFreeTalk} stopFreeTalk={stopFreeTalk}
          vadLivelloRef={vadLivelloRef} vadSilenceCountdown={vadSilenceCountdown}
          vadSensitivity={vadSensitivity} setVadSensitivity={setVadSensitivity}
          liveMode={liveMode} setLiveModeState={setLiveModeState} setLiveMode={setLiveMode}
          status={status} webrtc={webrtc} myName={myName} roomInfo={roomInfo}
          endChatAndSave={endChatAndSave} setView={setView}
          roomSessionToken={roomSessionToken}
        />

        <div style={{ fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase',
          color: S.colors.textMuted, padding: '4px 10px 7px', fontFamily: FONT }}>
          {L('voiceEngine')}
        </div>
      <VoiceEngineBar
        L={L} S={S} prefs={prefs} savePrefs={savePrefs}
        isTrial={isTrial} isTopPro={isTopPro} canUseElevenLabs={canUseElevenLabs}
        useOwnKeys={useOwnKeys} apiKeyInputs={apiKeyInputs}
        elevenLabsVoices={elevenLabsVoices} selectedELVoice={selectedELVoice}
        setSelectedELVoice={setSelectedELVoice}
        clonedVoiceId={clonedVoiceId} clonedVoiceName={clonedVoiceName}
        audioEnabled={audioEnabled} roomMode={roomMode} roomInfo={roomInfo}
        isHost={isHost} myLang={myLang}
        totalCost={totalCost} msgCount={msgCount} modeInfo={modeInfo} roomCtx={roomCtx}
        showModeSelector={showModeSelector} setShowModeSelector={setShowModeSelector}
        changeRoomMode={changeRoomMode}
        badge={ProviderBadge && partner
          ? <ProviderBadge sourceLang={myLang} targetLang={partner.lang} theme={theme} compact />
          : null}
      />

      </PannelloLaterale>

      {/* Animations */}
      <style>{`
        @keyframes vtConnecting { 0% { transform: translateX(-100%); } 50% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        @keyframes vtBattPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
        @keyframes vtSlideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes vtSlideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* ── Incoming Call Banner ── */}
      {webrtc?.incomingCall && (() => {
        const isVideo = webrtc.incomingCall.withVideo !== false;
        return (
          <div style={{
            position:'absolute', top:0, left:0, right:0, zIndex:100,
            background:'linear-gradient(135deg, #1a1a2e, #16213e)',
            borderBottom:'2px solid #0f3460',
            padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between',
            animation:'vtSlideDown 0.3s ease-out', boxShadow:'0 4px 20px rgba(0,0,0,0.4)',
          }}>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <div style={{width:12, height:12, borderRadius:'50%', background:'#4ade80', animation:'vtBattPulse 1.5s infinite'}} />
              <div>
                <div style={{color:'#fff', fontSize:14, fontWeight: 500}}>
                  {isVideo ? <IconCamera size={16} /> : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
                  {' '}{webrtc.incomingCall.from} {L('callIncoming')}
                </div>
                <div style={{color:'#94a3b8', fontSize:11, marginTop:2}}>
                  {isVideo ? L('incomingVideoCall') : L('incomingVoiceCall')}
                </div>
              </div>
            </div>
            <div style={{display:'flex', gap:10}}>
              <button onClick={() => webrtc.declineIncomingCall()}
                style={{padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer',
                  background:PALETTE.red, color:'#fff', fontSize:13, fontWeight: 500}}>
                {L('callDecline')}
              </button>
              <button onClick={() => {
                webrtc.acceptIncomingCall();
                if (isVideo) { setShowVideoCall(true); setVideoFullscreen(true); }
              }}
                style={{padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer',
                  background:PALETTE.green, color:'#fff', fontSize:13, fontWeight: 500}}>
                {L('callAccept')}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Video Call Overlay ── */}
      <VideoCallOverlay
        webrtc={webrtc} partner={partner} getSenderAvatar={getSenderAvatar}
        videoFullscreen={videoFullscreen} setVideoFullscreen={setVideoFullscreen}
        showVideoCall={showVideoCall} setShowVideoCall={setShowVideoCall}
        videoDucking={videoDucking} setVideoDucking={setVideoDucking}
        partnerVolume={partnerVolume} setPartnerVolume={cambiaPartnerVolume}
        lastTranslationSubtitle={lastTranslationSubtitle}
        interpreter={interpreter}
        interpreterActive={interpreterActive}
        setInterpreterActive={setInterpreterActive}
        recording={recording} isListening={isListening}
        partnerSpeaking={partnerSpeaking} partnerTyping={partnerTyping} S={S}
        stanzaDiretta={!!roomInfo?.diretta}
        stanzaConPiuDiDue={otherMembers.length > 1}
      />

      {/* ── Voice Call Overlay ── */}
      {showVoiceCall && webrtc?.webrtcConnected && webrtc?.callType === 'voice' && (
        <VoiceCallOverlay
          webrtc={webrtc} partner={partner} getSenderAvatar={getSenderAvatar} S={S}
          partnerVolume={partnerVolume} setPartnerVolume={setPartnerVolume}
          partnerSpeaking={partnerSpeaking} partnerTyping={partnerTyping}
          interpreterActive={interpreterActive} setInterpreterActive={setInterpreterActive}
          interpreter={interpreter}
          onClose={() => setShowVoiceCall(false)}
          onUpgradeToVideo={() => {
            // ── b.248 · "passa a video" accende DAVVERO la camera ──
            // Prima cambiava solo le finestre: nessuna acquisizione,
            // nessuna rinegoziazione, il partner non riceveva nulla.
            // toggleVideo (useWebRTC) fa gia tutto: getUserMedia,
            // addTrack, offerta di rinegoziazione (che l'altro accetta
            // da solo, senza riaccettare) e promozione del tipo a
            // 'video' — bastava chiamarla dal pulsante.
            webrtc.toggleVideo();
            setShowVoiceCall(false);
            setShowVideoCall(true);
            setVideoFullscreen(true);
          }}
        />
      )}

      {/* ── Messages ── */}
      {/* b.473 — LA PILLOLA «ELENCO / CAROSELLO» NON STA PIU QUI.
          Collaudo di Luca: «mi spieghi che cazzo e il carosello/elenco? e
          perche presenti un cambio pagina?».
          Domanda giusta, e la risposta e che non doveva starci. Il carosello
          e un secondo modo di leggere la stessa chat — una frase alla volta,
          come una carta grande, per farla leggere a qualcuno a distanza di
          braccio — che avevo portato da un'altra applicazione. Nel template
          non c'e, nessuno l'ha chiesto, e quel tondo galleggiante sopra i
          messaggi cambiava la pagina sotto le dita senza spiegare niente:
          sembrava di essere finiti da un'altra parte.
          Il modo di leggere e una PREFERENZA, e le preferenze stanno nel
          pannello (ordine di Luca). Li c'e scritto anche cosa fa. */}
      {modoCarosello ? (
        <Suspense fallback={<div style={{ flex: 1 }} />}>
          <Carosello3D
            messages={messaggiCarosello}
            currentIndex={indiceCarosello}
            onIndexChange={setIndiceCarosello}
            zoom={zoomCarosello}
            verticalOffset={altezzaCarosello}
            L={L} />
          <ComandoZoom
            zoom={zoomCarosello} onZoomChange={setZoomCarosello}
            verticalOffset={altezzaCarosello} onVerticalOffsetChange={setAltezzaCarosello} />
        </Suspense>
      ) : (
      <MessageList
        /* b.537 — la stanza vuota diventa un annuncio: vedi MessageList */
        solo={otherMembers.length === 0}
        onAvvisami={chiediAvviso} avvisoAcceso={avvisoAcceso}
        passoTesto={Number(prefs?.testoGrande) || 0}
        messages={messages} streamingMsg={streamingMsg}
        myName={myName} myLang={myLang} prefs={prefs}
        partner={partner} roomInfo={roomInfo} roomMode={roomMode} isHost={isHost}
        getTranslationForMe={getTranslationForMe} getSenderAvatar={getSenderAvatar}
        playMessage={playMessage} playingMsgId={playingMsgId}
        partnerSpeaking={partnerSpeaking} partnerTyping={partnerTyping}
        partnerLiveText={partnerLiveText} msgsEndRef={msgsEndRef}
        S={S} L={L} onMessageRead={onMessageRead}
        userToken={userToken} roomId={roomInfo?.id || roomInfo?.roomId}
        onReaction={(msgId, emoji) => {
          if (webrtc?.sendDirectMessage) {
            webrtc.sendDirectMessage({ type: 'msg-reaction', msgId, emoji, from: myName });
          }
        }}
        conteReazioni={reazioni.conte}
        mieReazioni={reazioni.mie}
        onReagisci={reazioni.reagisci}
        onRispondi={(msgId) => {
          // Rispondere non apre una schermata: prepara il campo di scrittura
          // con la citazione, e la risposta entra nella chat come gli altri
          // messaggi. Come in una conversazione vera, non come in un forum.
          const citato = (messages || []).find(m => m.id === msgId);
          if (!citato) return;
          setRispostaA({ id: msgId, nome: citato.sender || citato.from, testo: citato.original || citato.text || '' });
          vibrate(10);
        }}
        onMessageDoubleClick={(msg) => {
          const original = msg.text || msg.original || '';
          const translated = msg.translation || msg.translated || '';
          // b.110 — era `msg.from`, campo che non esiste: chi produce il
          // messaggio scrive `sender` (useTranslationAPI:86). Il confronto
          // era sempre falso, quindi anche i MIEI messaggi venivano
          // trattati come del partner e le due lingue finivano scambiate.
          const mioMessaggio = msg.sender === myName;
          const msgFromLang = mioMessaggio ? myLang : (partner?.lang || 'en');
          const msgToLang = mioMessaggio ? (msg.targetLang || (partner?.lang || 'en')) : myLang;
          setTaxiData({ original, translated, fromLang: msgFromLang, toLang: msgToLang });
          setTaxiVisible(true);
        }}
      />
      )}

      {/* Captions Overlay */}
      {showCaptions && partnerLiveText && (partnerSpeaking || partnerTyping) && (
        <div style={{position:'relative', zIndex:10, margin:'0 10px 4px',
          padding:'8px 14px', borderRadius:12,
          background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)',
          border:`1px solid ${S.colors.accent3Border}`,
          boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
          animation:'vtCaptionFade 0.2s ease-out'}}>
          <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:4}}>
            <AvatarImg src={partner ? getSenderAvatar(partner.name) : null} size={20} />
            <span style={{fontSize:10, color:S.colors.accent3, fontWeight: 500}}>
              {partner?.name} {partnerSpeaking ? L('speakingWord') : L('typingWord')}
            </span>
            <span style={{display:'inline-block', width:5, height:5, borderRadius:'50%',
              background:S.colors.accent3, animation:'vtPulse 1.2s infinite ease-in-out'}} />
          </div>
          <div style={{fontSize:15, color:'#FFFFFF', lineHeight:1.5, fontWeight:500,
            textShadow:'0 1px 3px rgba(0,0,0,0.5)'}}>
            {partnerLiveText}
          </div>
        </div>
      )}

      {/* ═══ INIZIO b.173 — parte bassa ridisegnata (template C, voce-first) ═══
          COSA: da UNA riga [input · invio · mic] — in cui TalkControls
          (colonna alta) sforava e sparpagliava i controlli — a una
          COLONNA allineata: microfono-eroe centrato in alto (con i suoi
          extra), riga di testo (input + invio) in un pill unico sotto.
          Sostituisce la disposizione v.154 (mic a destra del testo).
          NESSUN handler toccato: stessi onClick, solo riorganizzati.
          PERCHE: "gli elementi in basso non sono allineati, non sono
          messi in modo funzionale" + template C ("il microfono e l'eroe"). */}
      {/* ═══ INIZIO b.294 — la plancia e LIBERA: niente barra fissa ═══ */}
      <style>{`@keyframes vtSaleDalBasso { from { transform: translateY(100%); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }`}</style>
      {/* ══ b.471 — IL MODULO DEL TESTO STA SEMPRE IN BASSO ══
          Collaudo di Luca: «perche non vedo testo microfono la in basso
          come il template?».
          Perche non c'era. Qui stavano DUE TONDI FLOTTANTI — una tastiera e
          un microfono, per giunta disegnati con delle EMOJI, che in questa
          interfaccia sono vietate — e il campo di scrittura compariva solo
          dopo averne toccato uno. Tre stati (libera, scrivi, parla) per
          fare quello che il template fa con una riga sola.
          La regola del template e scritta nel kit: «dove si scrive sta
          sempre in basso, sempre a schermo». Adesso e cosi: una fascia
          sola, il piu a sinistra, il campo, la fotocamera e il microfono.
          Il microfono apre i comandi della voce che c'erano gia. */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40,
        padding: '8px 20px calc(10px + env(safe-area-inset-bottom))',
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 45%)',
        pointerEvents: 'none' }}>
        {/* b.477 — LA CITAZIONE, RIMESSA. Stava dentro il pannello che si
            apriva col tondo a tastiera, e togliendo quello e sparita con lui:
            rispondere a un messaggio non si poteva piu. Adesso sta sopra il
            modulo, attaccata al campo in cui si scrive la risposta — che e
            il posto dove serve. */}
        {rispostaA && (
          <div style={{ pointerEvents: 'auto', marginBottom: 8, padding: '8px 12px', borderRadius: 12,
            background: S.colors.overlayBg, borderLeft: `3px solid ${S.colors.accent1}`,
            display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 500, color: S.colors.accent1, marginBottom: 1 }}>
                {L('replyToWord')} {rispostaA.nome}
              </div>
              <div style={{ fontSize: 12, color: S.colors.textMuted,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {rispostaA.testo}
              </div>
            </div>
            <button onClick={() => setRispostaA(null)} aria-label={L('cancelReply')}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: S.colors.textMuted, fontSize: 16, padding: '0 4px' }}>×</button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, pointerEvents: 'auto' }}>
          {/* b.474, ordine di Luca: «deve diventare rosso insieme all'area di
              testo». Mentre si registra non e il microfono a cambiare
              colore: e TUTTA la fascia. Cosi non si deve guardare un
              tondino da trentotto per sapere se il telefono sta
              ascoltando — lo dice la riga intera, che e larga quanto lo
              schermo e non si puo non vedere. */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-end', gap: 6,
            minHeight: 54, padding: '8px', borderRadius: 16,
            transition: 'border-color .2s, background .2s',
            border: `1px solid ${recording ? `${S.colors.accent3 || '#ff5470'}88` : S.colors.cardBorder}`,
            background: recording ? `${S.colors.accent3 || '#ff5470'}14` : S.colors.inputBg }}>
            {/* il piu: da qui entrano foto, file, posizione, contatto */}
            <button onClick={() => { vibrate(); setShowChatActions(true); }}
              aria-label={L('addShort')}
              style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, padding: 0,
                border: `1px solid ${S.colors.cardBorder}`, background: 'transparent',
                color: S.colors.textSecondary, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent' }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={1.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            {/* b.549 — LA PORTA DEI GURU, accanto al campo: e' li che
                serve, nel momento in cui stai per scrivere e ti manca un
                fatto o una spinta. */}
            <button onClick={() => { vibrate(); setGuruAperto(true); }}
              aria-label={L('inviteGuruTitle')} title={L('inviteGuruTitle')}
              style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, padding: 0,
                border: `1px solid ${S.colors.cardBorder}`, background: 'transparent',
                color: S.colors.textSecondary, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent' }}>
              <Icon name="users" size={17} color={S.colors.textSecondary} />
            </button>
            <input
              ref={campoTestoRef}
              aria-label={L('typePlaceholder')}
              placeholder={L('typePlaceholder')}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); inviaConCitazione(); } }}
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                color: S.colors.textPrimary, fontSize: 16, outline: 'none', fontFamily: FONT,
                padding: '8px 0' }}
            />
            {/* la fotocamera, come nel template */}
            <button onClick={() => { vibrate(); setShowChatActions(true); }}
              aria-label={L('addShort')}
              style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, padding: 0,
                border: `1px solid ${S.colors.accent1}57`, background: `${S.colors.accent1}14`,
                color: S.colors.textPrimary, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent' }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            {/* b.475, collaudo di Luca: «perche dici di tener premuto? Tutti
                  devono funzionare come nella home».
                  Aveva ragione due volte. Primo: questo tasto apriva un
                  PANNELLO che saliva e copriva il campo di scrittura, con
                  dentro un secondo microfono e due impostazioni. Due tocchi
                  e mezzo schermo coperto per fare quello che nella Home si
                  fa con un tocco. Adesso registra direttamente.
                  Secondo: la scritta diceva «tieni premuto», ma il comando
                  sotto era gia un TOCCO che accende e un tocco che spegne —
                  la stessa cosa della Home. Diceva il falso, e a un anziano
                  o a un bambino che tiene premuto e aspetta non succede
                  niente. */}
            {/* a destra: la freccia se c'e del testo, se no il microfono —
                cio che appare SOSTITUISCE nello stesso posto (regola 05) */}
            {textInput.trim() ? (
              <button onClick={() => { vibrate(); inviaConCitazione(); }}
                aria-label={L('send')}
                style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, padding: 0,
                  border: `1px solid ${S.colors.goldAccent || '#ffc44d'}66`,
                  background: `${S.colors.goldAccent || '#ffc44d'}22`,
                  color: S.colors.goldAccent || '#ffc44d', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent' }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            ) : (
              <button onClick={() => { vibrate(); toggleRecording?.(); }}
                aria-label={L('conversationDesc')} aria-pressed={recording}
                style={{ ...vesteMicrofono({ misura: 38, acceso: recording, C: S.colors }).cerchio,
                  borderRadius: 12, flexShrink: 0 }}>
                <svg width={vesteMicrofono({ misura: 38, C: S.colors }).icona} height={vesteMicrofono({ misura: 38, C: S.colors }).icona}
                  viewBox="0 0 24 24" fill="none"
                  stroke={vesteMicrofono({ misura: 38, acceso: recording, C: S.colors }).coloreIcona}
                  strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* b.475 — IL PANNELLO CHE SALIVA NON C'E' PIU. Copriva il campo di
          scrittura con un secondo microfono e due impostazioni, e per
          parlare chiedeva due tocchi invece di uno. Il microfono e nel
          modulo, come nella Home e come nel template.
          I comandi che stavano qui dentro — riduzione del rumore, modo
          della conversazione, sensibilita — sono impostazioni: sono nel
          pannello laterale, dove Luca ha chiesto che stiano filtri e
          preferenze. */}
      {/* b.471 — qui c'era il SECONDO campo di scrittura, quello che si
          apriva col tondo a tastiera. Non serve piu: il campo sta sempre in
          basso, sopra. Tenerlo sarebbe stato un doppione capace di
          comparire sopra l'altro. */}
      {/* ═══ FINE b.294 (gia b.173) ═══ */}

      {/* ═══ INIZIO v.154 — Contenuti chat (link condivisi) ═══
          COSA: striscia scorrevole subito sotto il campo di scrittura.
          PERCHE: richiesta di Luca (14/8) — i link condivisi in chat
          (articoli, video) diventano miniature apribili invece di
          restare testo nudo in mezzo ai messaggi. Legge solo `messages`,
          nessun nuovo campo nei messaggi. */}
      <ContenutiChat messages={messages} S={S} L={L} onApri={setSchedaChat} />
      {/* ═══ FINE v.154 ═══ */}

      {/* ═══ INIZIO b.250 — Provider Badge nel flusso, non piu sospeso ═══
          COSA: via il contenitore position:absolute (top:50, left:8).
          PERCHE: atterrava ESATTAMENTE sopra la riga della modalita
          della barra modalita — i tasti in alto a sinistra sovrapposti
          visti dal vivo sul telefono. Ora il badge viaggia dentro
          VoiceEngineBar, nella stessa riga, come elemento di flusso. */}
      {/* ═══ FINE b.250 ═══ */}

      {/* ═══ Interpreter View Overlay ═══ */}
      {interpreterActive && interpreter?.active && webrtc?.remoteStream && (
        <InterpreterView
          theme={theme} remoteStream={webrtc.remoteStream}
          mySubtitles={interpreter.mySubtitles || []}
          partnerSubtitles={interpreter.partnerSubtitles || []}
          latencyMs={0} onClose={() => setInterpreterActive(false)}
          partnerName={partner?.name || ''} myLang={myLang}
          partnerLang={partner?.lang || 'en'}
          isStreaming={interpreter.isStreaming || false}
          myLiveText={interpreter.myLiveText || ''}
          partnerLiveSubtitle={interpreter.partnerLiveSubtitle || ''}
        />
      )}

      {/* ═══ Chat Actions Panel ═══ */}
      {/* b.248 — LE AZIONI AI PARTIVANO SEMPRE SENZA CREDENZIALI.
          Qui c'era userToken={null} cablato: /api/chat-action autentica
          proprio con resolveAuth({userToken, lendingCode}) e senza gettone
          risponde 401 "Authentication required" — anche per un utente
          loggato con credito. Riassunto, analisi, consigli e vocabolario
          erano quindi irraggiungibili per chiunque. Ora il gettone vero
          arriva via prop da page.js (auth.userToken), come per le altre
          viste. lendingCode resta null: nel client non esiste (ancora)
          nessun posto che conservi un codice di prestito — non e un
          cablaggio mancante, e una funzione solo lato server. */}
      {showChatActions && (
        <ChatActionsPanel
          theme={theme} messages={messages} members={membriDi(roomInfo)}
          mode={roomMode} domain={roomInfo?.context} userToken={userToken} lendingCode={null}
          roomId={roomId} roomSessionToken={roomSessionToken}
          onClose={() => setShowChatActions(false)} t={L}
        />
      )}

      {/* ═══ Taxi Mode Overlay ═══ */}
      <TaxiMode
        visible={taxiVisible}
        onClose={() => setTaxiVisible(false)}
        // b.252 — TaxiMode ascolta l'inclinazione del telefono per aprirsi
        // da solo quando lo giri verso il tassista, ma la sua guardia esce
        // subito se manca questo callback: nessuno glielo passava, quindi
        // l'intero gesto non ha MAI funzionato. Il pulsante resta, ovvio.
        onAutoActivate={() => setTaxiVisible(true)}
        originalText={taxiData.original}
        translatedText={taxiData.translated}
        fromLang={taxiData.fromLang}
        toLang={taxiData.toLang}
        onPlayTTS={(text, lang) => {
          if (playMessage && text) {
            // Build a synthetic msg object compatible with playMessage
            const syntheticMsg = {
              id: 'taxi-tts',
              original: taxiData.original,
              translated: text,
              sourceLang: taxiData.fromLang,
              targetLang: lang || taxiData.toLang,
              translations: { [lang || taxiData.toLang]: text },
            };
            playMessage(syntheticMsg);
          }
        }}
        S={S}
        theme={theme}
      />

      {/* ═══ INIZIO v.154 — Scheda del link condiviso ═══
          COSA: la scheda di lettura/visione gia costruita per Mondo
          News, riusata qui per i link scoperti in chat da ContenutiChat.
          PERCHE: "a destra riassunto o accesso all'articolo" (Luca,
          14/8) — la scheda ha gia dentro sintesi/link/player. */}
      <SchedaArgomento
        aperta={!!schedaChat}
        tipo={schedaChat?.tipo}
        dati={schedaChat?.dati}
        C={S.colors}
        onClose={() => setSchedaChat(null)}
        onParlane={() => {
          if (schedaChat?.dati?.titolo) setTextInput(t => (t ? t : '') + schedaChat.dati.titolo);
          setSchedaChat(null);
        }}
      />
      {/* ═══ FINE v.154 ═══ */}

      <style>{`
        @keyframes vtPulse { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
        @keyframes vtSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vtRecordPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,157,0.5); } 50% { box-shadow: 0 0 0 12px rgba(255,107,157,0); } }
        @keyframes vtCaptionFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
});

export default RoomView;
