'use client';
import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MODES, CONTEXTS, FONT, getLang, vibrate } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import VideoCallOverlay from './VideoCallOverlay.js';
import VoiceCallOverlay from './VoiceCallOverlay.js';
import MessageList from './MessageList.js';
import { IconCamera, IconSend } from './Icons.js';
import InterpreterView from './InterpreterView.js';
import ChatActionsPanel from './ChatActionsPanel.js';
import RoomHeader from './RoomHeader.js';
import NumeroSicurezza from './NumeroSicurezza.js';
import VoiceEngineBar from './VoiceEngineBar.js';
import TalkControls from './TalkControls.js';
import TaxiMode, { TaxiButton } from './TaxiMode.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import { getAttenuazione } from '../lib/audioPrefs.js';
import useReazioni from '../hooks/useReazioni.js';

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
  roomSessionToken }) {
  const { L, S, prefs, myLang, setView, setMyLang, savePrefs, status, theme, setTheme } = useApp();

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
  const [rispostaA, setRispostaA] = useState(null);

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
      const testo = m.original || m.text || '';
      if (!testo) continue;
      giaConservati.current.add(m.id);
      reazioni.conserva(m.id, testo, m.lang || myLang, m.rispostaA || null);
    }
  }, [messages, roomId, roomSessionToken, reazioni, myLang]);

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
  const myName = verifiedName || prefs.name;
  const otherMembers = roomInfo?.members?.filter(m => m.name !== myName) || [];
  const partner = otherMembers[0];
  const myL = getLang(myLang);
  const otherL = partner ? getLang(partner.lang) : getLang('en');
  const roomMode = roomInfo?.mode || 'conversation';
  const isHost = isHostVerified !== undefined ? isHostVerified : roomInfo?.host === myName;
  const modeInfo = MODES.find(m => m.id === roomMode) || MODES[0];
  const canTalk = roomMode === 'classroom' ? isHost : true;
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
  }, [webrtc?.webrtcState]);

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

  // Interpreter start/stop
  useEffect(() => {
    if (!interpreter) return;
    if (interpreterActive && !interpreter.active) {
      interpreter.start();
    } else if (!interpreterActive && interpreter.active) {
      interpreter.stop();
    }
  }, [interpreterActive, interpreter]);

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

  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.muted = !!(recording || isListening);
  }, [recording, isListening]);

  // Helper: get translation for viewer's language
  function getTranslationForMe(msg) {
    if (msg.translations && msg.translations[myLang]) return msg.translations[myLang];
    if (msg.sourceLang === myLang && msg.original) return msg.original;
    if (msg.targetLang === myLang && msg.translated) return msg.translated;
    if (msg.translations) {
      const keys = Object.keys(msg.translations);
      if (keys.length > 0) return msg.translations[keys[0]];
    }
    return msg.translated || msg.original || '';
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
    <div style={S.roomPage} role="main" aria-label="Translation room">
      <audio ref={remoteAudioRef} autoPlay playsInline style={{display:'none'}} />

      {/* ── b.113 · la Stanza Diretta si vede sempre ──
          Non e un vezzo grafico: se la traduzione non funziona e non si
          capisce perche, si pensa a un guasto. Qui c'e scritto che e una
          scelta, e di chi. */}
      {roomInfo?.diretta && (
        <div style={{
          padding: '8px 14px', background: 'rgba(38,217,176,0.10)',
          borderBottom: '1px solid rgba(38,217,176,0.25)',
          fontSize: 11, color: S.colors.textPrimary, lineHeight: 1.5,
        }}>
          <strong style={{ color: '#26D9B0' }}>Stanza Diretta.</strong>{' '}
          I messaggi restano fra i due telefoni: non passano dai nostri
          server e non ne resta copia. In cambio non c&apos;è traduzione,
          né trascrizione, né lettura ad alta voce.
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
      <RoomHeader
        L={L} S={S} myLang={myLang} myL={myL} otherL={otherL}
        otherMembers={otherMembers} partner={partner}
        showLangPicker={showLangPicker} setShowLangPicker={setShowLangPicker}
        handleLangChange={handleLangChange}
        audioEnabled={audioEnabled} setAudioEnabled={setAudioEnabled} unlockAudio={unlockAudio}
        webrtc={webrtc} partnerConnected={partnerConnected} realtimeConnected={realtimeConnected}
        showVideoCall={showVideoCall} setShowVideoCall={setShowVideoCall}
        videoFullscreen={videoFullscreen} setVideoFullscreen={setVideoFullscreen}
        setShowVoiceCall={setShowVoiceCall}
        showCaptions={showCaptions} setShowCaptions={setShowCaptions}
        exportConversation={exportConversation}
        messages={messages} setShowChatActions={setShowChatActions}
        duckingLevel={duckingLevel} setDuckingLevel={setDuckingLevel}
        isTrial={isTrial} freeCharsUsed={freeCharsUsed}
        freeLimitExceeded={freeLimitExceeded} freeResetTime={freeResetTime}
        endChatAndSave={endChatAndSave} leaveRoomTemporary={leaveRoomTemporary}
        taxiVisible={taxiVisible} setTaxiVisible={setTaxiVisible} setTaxiData={setTaxiData}
        myName={myName}
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
            } catch {}
            try {
              const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
              a.playsInline = true; a.volume = 0.01;
              a.play().catch(() => {});
            } catch {}
          }}
          style={{
            position: 'fixed', bottom: 80, left: 16, right: 16,
            zIndex: 50,
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            borderRadius: 16, padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
          aria-label="Activate audio"
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

      {/* ═══ Voice Engine + Mode Bar ═══ */}
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
      />

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
                  {' '}{webrtc.incomingCall.from} {L('callIncoming') || 'ti sta chiamando'}
                </div>
                <div style={{color:'#94a3b8', fontSize:11, marginTop:2}}>
                  {isVideo ? 'Video call in arrivo' : 'Chiamata vocale in arrivo'}
                </div>
              </div>
            </div>
            <div style={{display:'flex', gap:10}}>
              <button onClick={() => webrtc.declineIncomingCall()}
                style={{padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer',
                  background:PALETTE.red, color:'#fff', fontSize:13, fontWeight:600}}>
                Rifiuta
              </button>
              <button onClick={() => {
                webrtc.acceptIncomingCall();
                if (isVideo) { setShowVideoCall(true); setVideoFullscreen(true); }
              }}
                style={{padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer',
                  background:PALETTE.green, color:'#fff', fontSize:13, fontWeight:600}}>
                Accetta
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
        recording={recording} isListening={isListening}
        partnerSpeaking={partnerSpeaking} partnerTyping={partnerTyping} S={S}
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
            setShowVoiceCall(false);
            setShowVideoCall(true);
            setVideoFullscreen(true);
          }}
        />
      )}

      {/* ── Messages ── */}
      <MessageList
        messages={messages} streamingMsg={streamingMsg}
        myName={myName} myLang={myLang} prefs={prefs}
        partner={partner} roomInfo={roomInfo} roomMode={roomMode} isHost={isHost}
        getTranslationForMe={getTranslationForMe} getSenderAvatar={getSenderAvatar}
        playMessage={playMessage} playingMsgId={playingMsgId}
        partnerSpeaking={partnerSpeaking} partnerTyping={partnerTyping}
        partnerLiveText={partnerLiveText} msgsEndRef={msgsEndRef}
        S={S} L={L} onMessageRead={onMessageRead}
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
              {partner?.name} {partnerSpeaking ? 'parla' : 'scrive'}
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

      {/* Text input bar */}
      <div style={{display:'flex', gap:6, padding:'6px 10px', flexShrink:0,
        background:'rgba(0,0,0,0.15)', borderTop:`1px solid ${S.colors.overlayBorder}`}}>
        <input
          aria-label={L('typePlaceholder') || 'Type a message'}
          style={{flex:1, padding:'8px 12px', borderRadius:20, background:S.colors.inputBg,
            border:`1px solid ${S.colors.inputBorder}`, color:S.colors.textPrimary, fontSize:14, outline:'none',
            fontFamily:FONT, boxSizing:'border-box'}}
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
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTypingState(false); sendTextMessage(); }}}
          onBlur={() => sendTypingState(false)}
          disabled={sendingText}
        />
        <button onClick={() => { vibrate(); sendTypingState(false); sendTextMessage(); }}
          aria-label={L('send') || 'Send message'}
          style={{width:38, height:38, borderRadius:'50%', border:'none', flexShrink:0,
            background: textInput.trim() ? S.colors.btnGradient : S.colors.overlayBg,
            color: textInput.trim() ? S.colors.textPrimary : S.colors.textMuted,
            fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            WebkitTapHighlightColor:'transparent', transition:'all 0.2s'}}>
          {sendingText ? '...' : '\u2192'}
        </button>
      </div>

      {/* ═══ Talk Controls ═══ */}
      {/* Stai rispondendo a qualcuno: si vede a chi, e si puo annullare */}
      {rispostaA && (
        <div style={{
          margin: '0 10px 6px', padding: '8px 12px', borderRadius: 12,
          background: S.colors.overlayBg, borderLeft: `3px solid ${S.colors.accent1}`,
          display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: S.colors.accent1, marginBottom: 1 }}>
              Rispondi a {rispostaA.nome}
            </div>
            <div style={{
              fontSize: 12, color: S.colors.textMuted,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {rispostaA.testo}
            </div>
          </div>
          <button onClick={() => setRispostaA(null)} aria-label="Annulla risposta"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: S.colors.textMuted, fontSize: 16, padding: '0 4px',
            }}>×</button>
        </div>
      )}

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
      />

      {/* ═══ Provider Badge ═══ */}
      {ProviderBadge && partner && (
        <div style={{position:'absolute', top:50, left:8, zIndex:10}}>
          <ProviderBadge sourceLang={myLang} targetLang={partner.lang} theme={theme} compact />
        </div>
      )}

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
      {showChatActions && (
        <ChatActionsPanel
          theme={theme} messages={messages} members={roomInfo?.members || []}
          mode={roomMode} domain={roomInfo?.context} userToken={null} lendingCode={null}
          onClose={() => setShowChatActions(false)} t={L}
        />
      )}

      {/* ═══ Taxi Mode Overlay ═══ */}
      <TaxiMode
        visible={taxiVisible}
        onClose={() => setTaxiVisible(false)}
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
