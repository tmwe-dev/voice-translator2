'use client';
import { memo, useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { MODES, CONTEXTS, FONT, getLang, vibrate } from '../lib/constants.js';
import { vaInVetrina } from '../lib/decisioni.js';
import AvatarImg from './AvatarImg.js';
import VideoCallOverlay from './VideoCallOverlay.js';
import VoiceCallOverlay from './VoiceCallOverlay.js';
import MessageList from './MessageList.js';
// b.372 — IL CAROSELLO DI RADIOCHAT, portato qui come SECONDO MODO di
// leggere la stessa chat (ordine di Luca). Si carica solo se lo si
// apre: si porta dietro three.js, e chi non lo usa non deve scaricarlo.
import { daBarTalk } from './Carosello3D.js';
const Carosello3D = lazy(() => import('./Carosello3D.js'));
import ComandoZoom from './ui/ComandoZoom.js';
import PannelloLaterale, { LinguettaPannello } from './ui/PannelloLaterale.js';
import { IconCamera } from './Icons.js';
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
  const otherMembers = roomInfo?.members?.filter(m => m.name !== myName) || [];
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
  const campoTestoRef = useRef(null);
  useEffect(() => {
    if (plancia === 'scrivi') { try { campoTestoRef.current?.focus(); } catch { /* il campo non e ancora montato: il fuoco arriva al giro dopo */ } }
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
  const myMember = roomInfo?.members?.find(m => m.name === myName);
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
  useEffect(() => {
    if (webrtc?.webrtcConnected && partner && partner.lang !== myLang) {
      setVideoDucking(true);
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
  useEffect(() => {
    if (!interpreter) return;
    if (interpreterActive && !interpreter.active) {
      interpreter.start();
    } else if (!interpreterActive && interpreter.active) {
      interpreter.stop();
    }
  }, [interpreterActive, interpreter]);

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
    const member = roomInfo?.members?.find(m => m.name === senderName);
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
      />

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
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
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
      <PannelloLaterale aperto={pannelloVoci} onChiudi={() => setPannelloVoci(false)}
        titolo={L('voiceEngine') || L('settings')} C={S.colors}>
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
                <div style={{color:'#fff', fontSize:14, fontWeight:600}}>
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
                  background:PALETTE.red, color:'#fff', fontSize:13, fontWeight:600}}>
                {L('callDecline')}
              </button>
              <button onClick={() => {
                webrtc.acceptIncomingCall();
                if (isVideo) { setShowVideoCall(true); setVideoFullscreen(true); }
              }}
                style={{padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer',
                  background:PALETTE.green, color:'#fff', fontSize:13, fontWeight:600}}>
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
        partnerVolume={partnerVolume} setPartnerVolume={setPartnerVolume}
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
      {/* b.372 — DUE MODI DI LEGGERE LA STESSA CHAT. Il carosello non si
          aggiunge sotto l'elenco: lo SOSTITUISCE nello stesso posto,
          stessa altezza. E il tasto per scambiarli sta sopra, su una riga
          che c'era gia. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 12px', flexShrink: 0 }}>
        <button onClick={() => { vibrate(6); setModoCarosello(v => !v); }}
          aria-pressed={modoCarosello}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px',
            borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
            background: modoCarosello ? 'rgba(38,217,176,0.14)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${modoCarosello ? 'rgba(38,217,176,0.45)' : 'rgba(255,255,255,0.10)'}`,
            color: modoCarosello ? '#26D9B0' : 'rgba(214,226,245,0.75)',
            WebkitTapHighlightColor: 'transparent',
          }}>
          {modoCarosello ? L('listView') : L('carouselView')}
        </button>
      </div>

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
            <span style={{fontSize:10, color:S.colors.accent3, fontWeight:600}}>
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
      {plancia === 'libera' && (
        <div style={{ position: 'absolute', left: 0, right: 0,
          bottom: 'max(18px, env(safe-area-inset-bottom))', zIndex: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
          pointerEvents: 'none' }}>
          <button onClick={() => { vibrate(); setPlancia('scrivi'); }}
            aria-label={L('typePlaceholder')}
            style={{ pointerEvents: 'auto', width: 56, height: 56, borderRadius: 28,
              border: '1px solid rgba(160,190,255,0.25)', cursor: 'pointer',
              background: 'rgba(10,14,26,0.55)', backdropFilter: 'blur(10px)',
              color: S.colors.textPrimary, fontSize: 24, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent' }}>
            {'\u2328\uFE0E'}
          </button>
          <button onClick={() => { vibrate(); setPlancia('parla'); }}
            aria-label={L('speakNow')}
            style={{ pointerEvents: 'auto', width: 72, height: 72, borderRadius: 36,
              border: 'none', cursor: 'pointer',
              background: S.colors.btnGradient, color: '#000', fontSize: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 28px rgba(91,140,255,0.45)',
              WebkitTapHighlightColor: 'transparent' }}>
            {'\u{1F3A4}'}
          </button>
        </div>
      )}

      {plancia === 'parla' && (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40,
        animation: 'vtSaleDalBasso 0.22s ease-out',
        display:'flex', flexDirection:'column', flexShrink:0,
        background:'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%)',
        padding:'8px 10px calc(10px + env(safe-area-inset-bottom))'}}>
        <button onClick={() => setPlancia('libera')} aria-label={L('close')}
          style={{ alignSelf: 'center', background: 'rgba(10,14,26,0.6)', border: '1px solid rgba(160,190,255,0.2)',
            color: S.colors.textMuted, width: 34, height: 34, borderRadius: 17, cursor: 'pointer',
            fontSize: 15, marginBottom: 6 }}>{'\u2715'}</button>
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

      </div>
      )}

      {plancia === 'scrivi' && (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40,
        animation: 'vtSaleDalBasso 0.22s ease-out',
        display:'flex', flexDirection:'column',
        background:'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%)',
        padding:'8px 10px calc(10px + env(safe-area-inset-bottom))'}}>
        <button onClick={() => setPlancia('libera')} aria-label={L('close')}
          style={{ alignSelf: 'center', background: 'rgba(10,14,26,0.6)', border: '1px solid rgba(160,190,255,0.2)',
            color: S.colors.textMuted, width: 34, height: 34, borderRadius: 17, cursor: 'pointer',
            fontSize: 15, marginBottom: 6 }}>{'\u2715'}</button>
        {/* Risposta citata — subito sopra la riga di testo, legata all'input */}
        {rispostaA && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 12,
            background: S.colors.overlayBg, borderLeft: `3px solid ${S.colors.accent1}`,
            display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: S.colors.accent1, marginBottom: 1 }}>
                {/* b.363 — italiano fisso in una stanza per il resto tradotta */}
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
        <div style={{display:'flex', alignItems:'center', gap:8, marginTop:10,
          background:S.colors.inputBg, border:`1px solid ${S.colors.inputBorder}`,
          borderRadius:22, padding:'5px 6px 5px 14px'}}>
        <input
          ref={campoTestoRef}
          aria-label={L('typePlaceholder')}
          style={{flex:1, background:'transparent', border:'none', color:S.colors.textPrimary,
            fontSize:14, outline:'none', fontFamily:FONT, minWidth:0}}
          placeholder={L('typePlaceholder')}
          value={textInput}
          onChange={e => {
            setTextInput(e.target.value);
            if (e.target.value.trim()) {
              if (!typingDebounceRef.current) {
                sendTypingState(true);
                typingDebounceRef.current = setTimeout(() => { typingDebounceRef.current = null; }, 2000);
              }
            }
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTypingState(false); inviaConCitazione(); }}}
          onBlur={() => sendTypingState(false)}
        />
        <button onClick={() => { vibrate(); sendTypingState(false); inviaConCitazione(); }}
          aria-label={L('send')}
          style={{width:38, height:38, borderRadius:'50%', border:'none', flexShrink:0,
            background: textInput.trim() ? S.colors.btnGradient : S.colors.overlayBg,
            color: textInput.trim() ? S.colors.textPrimary : S.colors.textMuted,
            fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            WebkitTapHighlightColor:'transparent', transition:'all 0.2s'}}>
          {sendingText ? '...' : '\u2192'}
        </button>
        </div>
      </div>
      )}
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
