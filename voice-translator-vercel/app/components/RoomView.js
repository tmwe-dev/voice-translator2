'use client';
import { memo, useState, useRef, useEffect } from 'react';
import { LANGS, MODES, CONTEXTS, FONT, getLang, vibrate, FREE_DAILY_LIMIT, AVATARS, AI_MODELS, VOICES } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import ConnectionQuality from './ConnectionQuality.js';
import VideoCallOverlay from './VideoCallOverlay.js';
import VoiceCallOverlay from './VoiceCallOverlay.js';
import MessageList from './MessageList.js';
import { IconBack, IconCamera, IconVolume, IconVolumeOff, IconSettings, IconMoreVertical,
  IconCheck, IconSubtitles, IconClipboard, IconMusic, IconArchive, IconBattery,
  IconSwap, IconMic, IconStop, IconClose, IconSend, IconLock, IconRecord,
  IconHome, IconMegaphone, IconSignal, IconSparkles, IconChevronDown } from './Icons.js';

const RoomView = memo(function RoomView({ L, S, prefs, myLang, roomId, roomInfo, messages, streamingMsg,
  recording, isListening, partnerConnected, partnerSpeaking, partnerLiveText, partnerTyping,
  playingMsgId, audioEnabled, setAudioEnabled, isTrial, isTopPro, canUseElevenLabs,
  useOwnKeys, apiKeyInputs,
  elevenLabsVoices, selectedELVoice, setSelectedELVoice,
  showModeSelector,
  setShowModeSelector, textInput, setTextInput, sendingText, sendTextMessage, sendTypingState,
  toggleRecording, cancelRecording, startFreeTalk, stopFreeTalk, endChatAndSave, leaveRoomTemporary, changeRoomMode, playMessage,
  unlockAudio, exportConversation, status, msgsEndRef,
  freeCharsUsed, freeLimitExceeded, freeResetTime, setView, setMyLang, savePrefs,
  syncLangChange, retranslateForNewLang, theme, setTheme,
  clonedVoiceId, clonedVoiceName,
  duckingLevel, setDuckingLevel,
  vadAudioLevel, vadSilenceCountdown, vadSensitivity, setVadSensitivity,
  realtimeConnected, webrtc, isHostVerified, verifiedName,
  setLiveMode, interpreter, onMessageRead }) {

  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showAiPicker, setShowAiPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  // showExitMenu removed — replaced by simple back button + archive in more menu
  const [showCaptions, setShowCaptions] = useState(true);
  const [showDuckingPanel, setShowDuckingPanel] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const [interpreterActive, setInterpreterActive] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [videoDucking, setVideoDucking] = useState(false); // auto-ducking during video call
  const [lastTranslationSubtitle, setLastTranslationSubtitle] = useState(null); // { text, ts }
  const [partnerVolume, setPartnerVolume] = useState(0.7); // Partner audio volume (0-1), default 70%
  const [liveMode, setLiveModeState] = useState(false); // Live mode: noise suppression on
  const partnerVolumeBeforeMuteRef = useRef(0.7); // Save volume before auto-mute during recording
  const subtitleTimerRef = useRef(null);

  // Hidden audio element ref — ALWAYS plays remote audio regardless of video UI state
  // (Video refs are managed by VideoCallOverlay component)
  const remoteAudioRef = useRef(null);

  // ── Compute derived values BEFORE any useEffects that reference them ──
  const myName = verifiedName || prefs.name;
  const otherMembers = roomInfo?.members?.filter(m => m.name !== myName) || [];
  const partner = otherMembers[0]; // Primary partner (for 1:1 backward compat)
  const myL = getLang(myLang);
  const otherL = partner ? getLang(partner.lang) : getLang('en');

  // Auto-open voice/video panel when call connects
  // Works for both caller (initiateConnection) and callee (acceptIncomingCall)
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

  // Auto-enable ducking when in video call and languages are different
  useEffect(() => {
    if (webrtc?.webrtcConnected && partner && partner.lang !== myLang) {
      setVideoDucking(true);
    }
  }, [webrtc?.webrtcConnected, partner?.lang, myLang]);

  // Auto-disable ducking when video call truly ends (idle or failed, NOT during connecting)
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

  // ── Interpreter start/stop when toggled ──
  useEffect(() => {
    if (!interpreter) return;
    if (interpreterActive && !interpreter.active) {
      interpreter.start();
    } else if (!interpreterActive && interpreter.active) {
      interpreter.stop();
    }
  }, [interpreterActive, interpreter]);

  // ── Subtitle queue: show up to 2 subtitles with auto-expire (FIFO) ──
  // Previous approach: single subtitle, overwritten by next message → user misses text
  // New approach: queue of max 2, each expires after 7s, oldest removed first
  const lastSubMsgIdRef = useRef(null);
  useEffect(() => {
    if (!videoFullscreen || !messages.length) return;
    const lastPartnerMsg = [...messages].reverse().find(m => m.sender !== myName);
    if (!lastPartnerMsg) return;
    const msgKey = lastPartnerMsg.id || `${lastPartnerMsg.sender}|${lastPartnerMsg.original}`;
    if (msgKey === lastSubMsgIdRef.current) return; // Already showing this one
    const translationText = getTranslationForMe(lastPartnerMsg);
    const hasTranslation = !!(lastPartnerMsg.translated || (lastPartnerMsg.translations && Object.keys(lastPartnerMsg.translations).length > 0));
    if (hasTranslation && translationText) {
      lastSubMsgIdRef.current = msgKey;
      const newSub = { text: translationText, original: lastPartnerMsg.original, ts: Date.now(), key: msgKey };
      setLastTranslationSubtitle(prev => {
        // Queue: keep max 2 — push new, trim oldest
        const queue = Array.isArray(prev) ? prev : (prev ? [prev] : []);
        const updated = [...queue, newSub].slice(-2);
        return updated;
      });
      // Auto-expire each subtitle after 7s
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

  // ── CRITICAL: Hidden <audio> element ALWAYS plays remote audio regardless of video UI ──
  // (Video stream attachment is handled by VideoCallOverlay component)
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

  // Sync partner volume to hidden audio element in real time
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = partnerVolume;
    }
  }, [partnerVolume]);

  // ── Auto-mute partner audio when recording (prevents mic pickup of partner's voice) ──
  useEffect(() => {
    if (recording || isListening) {
      // Save current volume and mute
      partnerVolumeBeforeMuteRef.current = partnerVolume;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = 0;
      }
    } else {
      // Restore volume when recording stops
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = partnerVolumeBeforeMuteRef.current;
      }
    }
  }, [recording, isListening]);

  // Helper: get the best translation for the viewer's language from a message
  function getTranslationForMe(msg) {
    // 1. Exact match: translations object has my language
    if (msg.translations && msg.translations[myLang]) {
      return msg.translations[myLang];
    }
    // 2. If the message was originally in MY language, show the original text
    if (msg.sourceLang === myLang && msg.original) {
      return msg.original;
    }
    // 3. Backward compat: single translated field when targetLang matches
    if (msg.targetLang === myLang && msg.translated) {
      return msg.translated;
    }
    // 4. Any translation available (for 2-person chat, there's usually only one target)
    if (msg.translations) {
      const keys = Object.keys(msg.translations);
      if (keys.length > 0) {
        return msg.translations[keys[0]];
      }
    }
    // 5. Last resort: translated field or original
    return msg.translated || msg.original || '';
  }

  // Helper: find avatar for a specific sender
  function getSenderAvatar(senderName) {
    const member = roomInfo?.members?.find(m => m.name === senderName);
    return member?.avatar || AVATARS[0];
  }
  const roomMode = roomInfo?.mode || 'conversation';
  const isHost = isHostVerified !== undefined ? isHostVerified : roomInfo?.host === myName;
  const modeInfo = MODES.find(m => m.id === roomMode) || MODES[0];
  const canTalk = roomMode === 'classroom' ? isHost : true;
  const totalCost = roomInfo?.totalCost || 0;
  const msgCount = roomInfo?.msgCount || 0;
  const roomCtx = CONTEXTS.find(c => c.id === (roomInfo?.context || 'general')) || CONTEXTS[0];

  function handleLangChange(langCode) {
    if (setMyLang) setMyLang(langCode);
    if (savePrefs) savePrefs({...prefs, lang: langCode});
    // Sync language change to room so all participants see it via polling
    if (syncLangChange) syncLangChange(langCode);
    // Re-translate existing messages to the new language (async, non-blocking)
    if (retranslateForNewLang) retranslateForNewLang(langCode);
    setShowLangPicker(false);
  }

  return (
    <div style={S.roomPage} role="main" aria-label="Translation room">
      {/* ═══ HIDDEN AUDIO: Always plays remote WebRTC audio regardless of video UI state ═══ */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{display:'none'}} />

      {/* ═══ Header ═══ */}
      <div style={{...S.roomHeader, position:'relative', flexWrap:'nowrap', gap:4, padding:'6px 8px'}} role="banner">
        {/* ── Left: Back button — single tap to leave (most common action) ── */}
        <button onClick={() => { if (leaveRoomTemporary) leaveRoomTemporary(); }}
          style={{
            ...S.backBtnSmall,
            fontSize: 18, padding: '4px 10px', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          title={L('leaveTemp') || 'Esci'}>
          <IconBack size={16}/>
          <span style={{fontSize: 11, fontWeight: 600}}>{L('exit') || 'Esci'}</span>
        </button>

        {/* ── Center: Language flags (flex:1 centered, no absolute) ── */}
        <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, minWidth:0}}>
          <button onClick={() => setShowLangPicker(!showLangPicker)}
            style={{fontSize:18, background:'none', border:'none', cursor:'pointer', padding:'2px 6px',
              borderRadius:8, transition:'background 0.15s', flexShrink:0,
              outline: showLangPicker ? `2px solid ${S.colors.accent4Border}` : 'none'}}>
            {myL.flag}
          </button>
          <span style={{color:S.colors.textTertiary, fontSize:14, flexShrink:0}}>{<IconSwap size={14}/>}</span>
          {otherMembers.length > 0 ? (
            <span style={{fontSize:18, display:'flex', gap:2, flexShrink:0}}>
              {[...new Set(otherMembers.map(m => getLang(m.lang).flag))].map((flag, i) => (
                <span key={i}>{flag}</span>
              ))}
            </span>
          ) : (
            <span style={{fontSize:18, flexShrink:0}}>{otherL.flag}</span>
          )}
        </div>

        {/* ── Right: Primary actions ── */}
        <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
          {/* Voice call button */}
          {webrtc && (
            <button onClick={() => {
              if (webrtc.webrtcConnected && webrtc.callType === 'voice') {
                setShowVoiceCall(true);
              } else if (webrtc.webrtcState === 'idle') {
                webrtc.initiateConnection(false); // audio-only
              }
            }}
              title="Chiamata vocale" aria-label="Avvia chiamata vocale"
              style={{display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                height:36, padding:'0 10px', borderRadius:18, fontSize:16, cursor:'pointer',
                border:'none', transition:'all 0.2s', WebkitTapHighlightColor:'transparent',
                background: (webrtc.webrtcConnected && webrtc.callType === 'voice')
                  ? 'rgba(34,197,94,0.2)' : S.colors.overlayBg,
                color: (webrtc.webrtcConnected && webrtc.callType === 'voice')
                  ? '#22c55e' : S.colors.textMuted}}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              {webrtc.webrtcConnected && webrtc.callType === 'voice' && <div style={{width:6, height:6, borderRadius:3, background:'#22c55e'}} />}
            </button>
          )}
          {/* Video call button */}
          {webrtc && (
            <button onClick={() => {
              if (!showVideoCall) {
                setShowVideoCall(true);
                if (webrtc.webrtcState === 'idle') webrtc.initiateConnection(true);
              } else {
                setShowVideoCall(false);
              }
            }}
              title={showVideoCall ? 'Chiudi video' : 'Videochiamata'}
              style={{display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                height:36, padding:'0 12px', borderRadius:18, fontSize:16, cursor:'pointer',
                border:'none', transition:'all 0.2s', WebkitTapHighlightColor:'transparent',
                background: showVideoCall
                  ? (webrtc.webrtcConnected ? 'rgba(34,197,94,0.2)' : S.colors.accent4Bg)
                  : S.colors.overlayBg,
                color: showVideoCall
                  ? (webrtc.webrtcConnected ? '#22c55e' : S.colors.textPrimary)
                  : S.colors.textMuted,
                boxShadow: webrtc.webrtcConnected && showVideoCall ? '0 0 8px rgba(34,197,94,0.3)' : 'none'}}>
              <IconCamera size={18}/>
              {webrtc.webrtcConnected && webrtc.callType === 'video' && <div style={{width:6, height:6, borderRadius:3, background:'#22c55e'}} />}
            </button>
          )}
          {/* Audio toggle */}
          <button onClick={() => { if (!audioEnabled) unlockAudio(); setAudioEnabled(!audioEnabled); }}
            title={audioEnabled ? 'Disattiva audio traduzioni' : 'Attiva audio traduzioni'}
            style={{display:'flex', alignItems:'center', justifyContent:'center',
              width:36, height:36, borderRadius:18, fontSize:16, cursor:'pointer',
              border:'none', transition:'all 0.2s', WebkitTapHighlightColor:'transparent',
              background: audioEnabled ? S.colors.accent4Bg : 'rgba(239,68,68,0.15)',
              color: audioEnabled ? S.colors.statusOk : '#ef4444'}}>
            {audioEnabled ? <IconVolume size={16}/> : <IconVolumeOff size={16}/>}
          </button>
          {/* More menu button */}
          <div style={{position:'relative', flexShrink:0}}>
            <button onClick={() => setShowMoreMenu(!showMoreMenu)}
              title="Impostazioni"
              style={{display:'flex', alignItems:'center', justifyContent:'center',
                width:36, height:36, borderRadius:18, fontSize:18, fontWeight:700,
                cursor:'pointer', border:'none', transition:'all 0.2s', WebkitTapHighlightColor:'transparent',
                background: showMoreMenu ? S.colors.accent4Bg : S.colors.overlayBg,
                color: S.colors.textPrimary, position:'relative'}}>
              <IconSettings size={18}/>
              {/* Partner status dot */}
              <div style={{position:'absolute', top:2, right:2, width:8, height:8, borderRadius:4,
                background: partnerConnected ? '#22c55e' : '#ef4444',
                border:'2px solid rgba(0,0,0,0.4)'}} />
            </button>
            {/* ── Overflow menu dropdown ── */}
            {showMoreMenu && (
              <div style={{position:'absolute', top:'100%', right:0, zIndex:100, marginTop:4,
                background:S.colors.overlayBg2 || S.colors.overlayBg, border:`1px solid ${S.colors.overlayBorder}`,
                borderRadius:12, padding:6, minWidth:220, backdropFilter:'blur(12px)',
                boxShadow:'0 8px 32px rgba(0,0,0,0.3)'}}>
                {/* Connection quality (moved here from header for mobile space) */}
                <div style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                  borderBottom:`1px solid ${S.colors.overlayBorder}`, marginBottom:4}}>
                  <ConnectionQuality
                    webrtcState={webrtc?.webrtcState || 'idle'}
                    partnerConnected={partnerConnected}
                    realtimeConnected={realtimeConnected}
                  />
                  <span style={{fontSize:11, color: partnerConnected ? S.colors.statusOk : S.colors.textMuted, fontWeight:600}}>
                    {partnerConnected ? (partner?.name || 'Partner') : 'In attesa...'}
                  </span>
                </div>
                {/* Captions toggle */}
                <button onClick={() => { setShowCaptions(!showCaptions); setShowMoreMenu(false); }}
                  style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px',
                    background:'none', border:'none', cursor:'pointer', borderRadius:8, color:S.colors.textPrimary,
                    fontSize:13, fontWeight:500, textAlign:'left'}}>
                  <span style={{fontSize:15, width:24, textAlign:'center'}}>{showCaptions ? 'CC' : 'cc'}</span>
                  <span>{showCaptions ? 'Nascondi sottotitoli' : 'Mostra sottotitoli'}</span>
                  {showCaptions && <span style={{marginLeft:'auto', color:S.colors.statusOk}}>{<IconCheck size={12}/>}</span>}
                </button>
                {/* Export */}
                <button onClick={() => { exportConversation(); setShowMoreMenu(false); }}
                  style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px',
                    background:'none', border:'none', cursor:'pointer', borderRadius:8, color:S.colors.textPrimary,
                    fontSize:13, fontWeight:500, textAlign:'left'}}>
                  <span style={{fontSize:15, width:24, textAlign:'center'}}>{<IconClipboard size={15}/>}</span>
                  <span>{L('exportConversation') || 'Esporta conversazione'}</span>
                </button>
                {/* Audio Ducking */}
                <div style={{padding:'8px 12px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                    <span style={{fontSize:15, width:24, textAlign:'center'}}>{<IconMusic size={15}/>}</span>
                    <span style={{fontSize:13, fontWeight:500, color:S.colors.textPrimary}}>Audio Ducking</span>
                    <span style={{marginLeft:'auto', fontSize:11, color:S.colors.textSecondary, fontFamily:'monospace'}}>
                      {Math.round((duckingLevel || 0.2) * 100)}%
                    </span>
                  </div>
                  <input type="range" min="5" max="80" step="5"
                    value={Math.round((duckingLevel || 0.2) * 100)}
                    onChange={e => { if (setDuckingLevel) setDuckingLevel(Number(e.target.value) / 100); }}
                    style={{width:'100%', accentColor:S.colors.accent4Border, height:4}} />
                  <div style={{fontSize:9, color:S.colors.textMuted, marginTop:4}}>
                    Volume partner durante la traduzione
                  </div>
                </div>
                {/* Close & Archive */}
                <button onClick={() => { setShowMoreMenu(false); endChatAndSave(); }}
                  style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px',
                    background:'none', border:'none', cursor:'pointer', borderRadius:8,
                    color: S.colors.statusError || '#FF6B6B',
                    fontSize:13, fontWeight:600, textAlign:'left',
                    borderTop:`1px solid ${S.colors.overlayBorder}`, marginTop:4, paddingTop:12}}>
                  <span style={{fontSize:15, width:24, textAlign:'center'}}>{<IconArchive size={15}/>}</span>
                  <span>{L('closeArchive') || 'Chiudi e archivia'}</span>
                </button>
                {/* FREE tier battery */}
                {isTrial && (() => {
                  const pct = Math.min(100, (freeCharsUsed / FREE_DAILY_LIMIT) * 100);
                  const remaining = 100 - pct;
                  const battColor = freeLimitExceeded ? S.colors.statusError
                    : remaining <= 20 ? S.colors.statusError
                    : remaining <= 50 ? S.colors.statusWarning
                    : S.colors.statusOk;
                  return (
                    <div style={{padding:'8px 12px', borderTop:`1px solid ${S.colors.overlayBorder}`, marginTop:4}}>
                      <div style={{display:'flex', alignItems:'center', gap:10}}>
                        <span style={{fontSize:15, width:24, textAlign:'center'}}>{<IconBattery size={15}/>}</span>
                        <span style={{fontSize:13, fontWeight:500, color:S.colors.textPrimary}}>
                          {freeLimitExceeded ? 'Limite raggiunto' : 'Piano FREE'}
                        </span>
                        <span style={{marginLeft:'auto', fontSize:12, fontWeight:700, color:battColor, fontFamily:'monospace'}}>
                          {freeLimitExceeded ? '0%' : `${Math.round(remaining)}%`}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{marginTop:6, height:4, borderRadius:2, background:`${S.colors.overlayBorder}`,
                        overflow:'hidden'}}>
                        <div style={{height:'100%', borderRadius:2, width:`${remaining}%`,
                          background:battColor, transition:'width 0.5s ease'}} />
                      </div>
                      <div style={{fontSize:9, color:S.colors.textMuted, marginTop:4}}>
                        {Math.round(freeCharsUsed/1000)}K / {FREE_DAILY_LIMIT/1000}K caratteri
                        {freeResetTime && ` \u2022 Reset: ${freeResetTime}`}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Backdrop to close menus */}
      {showMoreMenu && (
        <div onClick={() => { setShowMoreMenu(false); }}
          style={{position:'fixed', inset:0, zIndex:99, background:'transparent'}} />
      )}

      {/* Language picker dropdown */}
      {showLangPicker && (
        <div style={{position:'absolute', top:48, left:'50%', transform:'translateX(-50%)', zIndex:100,
          background:S.colors.glassCard,
          border:`1px solid ${S.colors.cardBorder}`,
          borderRadius:14, padding:'6px 0', maxHeight:280, overflowY:'auto', width:200,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => handleLangChange(l.code)}
              style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 14px',
                background: l.code === myLang ? S.colors.accent4Bg : 'transparent',
                border:'none', cursor:'pointer', fontFamily:FONT, fontSize:13,
                color:S.colors.textPrimary,
                transition:'background 0.1s'}}>
              <span style={{fontSize:18}}>{l.flag}</span>
              <span>{l.name}</span>
              {l.code === myLang && <span style={{marginLeft:'auto', color:S.colors.statusOk, fontSize:14}}>{<IconCheck size={12}/>}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close lang picker */}
      {showLangPicker && (
        <div onClick={() => setShowLangPicker(false)}
          style={{position:'fixed', inset:0, zIndex:99, background:'transparent'}} />
      )}

      {/* Mode + Info bar — compact single row */}
      <div style={{padding:'4px 12px', background:S.colors.overlayBg,
        borderBottom:`1px solid ${S.colors.overlayBorder}`, display:'flex', alignItems:'center',
        justifyContent:'space-between', flexShrink:0, minHeight:28}}>
        <button onClick={() => isHost && setShowModeSelector(!showModeSelector)}
          style={{background:'none', border:'none', padding:'2px 6px', cursor:isHost ? 'pointer' : 'default',
            display:'flex', alignItems:'center', gap:4, borderRadius:6,
            WebkitTapHighlightColor:'transparent', transition:'background 0.15s'}}>
          <span style={{fontSize:12, color:S.colors.textMuted, fontWeight:500}}>
            {modeInfo.icon} {L(modeInfo.nameKey)}
            {roomCtx.id !== 'general' && <span style={{marginLeft:4}}>{roomCtx.icon} {L(roomCtx.nameKey)}</span>}
          </span>
          {isHost && <span style={{fontSize:10, color:S.colors.textMuted}}>{<IconChevronDown size={8}/>}</span>}
          {!isHost && roomMode === 'classroom' && (
            <span style={{fontSize:10, color:S.colors.textTertiary}}>
              {' \u2022 '}{roomInfo?.host || 'Host'} presenta
            </span>
          )}
        </button>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          {isHost && (
            <span style={{fontSize:9, fontWeight:700, letterSpacing:0.5, padding:'2px 8px', borderRadius:6,
              background: isTrial ? S.colors.accent4Bg : isTopPro ? `${S.colors.goldAccent}26` : S.colors.accent3Bg,
              color: isTrial ? S.colors.statusOk : isTopPro ? S.colors.goldAccent : S.colors.accent3,
              border: `1px solid ${isTrial ? S.colors.accent4Border : isTopPro ? `${S.colors.goldAccent}40` : S.colors.accent3Border}`}}>
              {isTrial ? 'FREE' : isTopPro ? 'TOP PRO' : 'PRO'}
            </span>
          )}
          {isHost && !isTrial && (
            <span style={{fontSize:10, color:S.colors.textTertiary, fontFamily:'monospace'}}>
              ${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(3)} {'00B7'} {msgCount}msg
            </span>
          )}
        </div>
      </div>

      {/* Mode selector dropdown */}
      {showModeSelector && isHost && (
        <div style={{padding:'8px 12px', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(10px)',
          borderBottom:`1px solid ${S.colors.overlayBorder}`, flexShrink:0}}>
          <div style={{display:'flex', gap:6}}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => changeRoomMode(m.id)}
                style={{...S.modeBtn, flex:1, padding:'8px 4px',
                  ...(roomMode === m.id ? S.modeBtnSel : {})}}>
                <span style={{fontSize:18}}>{m.icon}</span>
                <span style={{fontSize:9, fontWeight:600, marginTop:1}}>{L(m.nameKey)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice engine + AI info bar — interactive */}
      <div style={{padding:'3px 12px', background:S.colors.accent1Bg,
        borderBottom:`1px solid ${S.colors.overlayBorder}`, display:'flex', alignItems:'center',
        justifyContent:'space-between', flexShrink:0, gap:6, position:'relative'}}>
        <div style={{display:'flex', alignItems:'center', gap:6, minWidth:0}}>
          {/* Voice engine — tappable to cycle */}
          <button onClick={() => {
            if (isTrial) return; // FREE users can't switch
            const voiceEngine = prefs.voiceEngine || 'auto';
            const engines = canUseElevenLabs
              ? ['auto', 'elevenlabs', 'openai', 'edge']
              : ['auto', 'openai', 'edge'];
            const nextIdx = (engines.indexOf(voiceEngine) + 1) % engines.length;
            savePrefs({...prefs, voiceEngine: engines[nextIdx]});
          }} style={{background:'none', border:'none', padding:'1px 4px', cursor: isTrial ? 'default' : 'pointer',
            display:'flex', alignItems:'center', gap:4, borderRadius:4,
            transition:'background 0.15s', WebkitTapHighlightColor:'transparent'}}>
            {(() => {
              const ve = prefs.voiceEngine || 'auto';
              const engineLabel = ve === 'auto'
                ? (isTrial ? 'Edge TTS' : canUseElevenLabs ? 'ElevenLabs' : 'OpenAI')
                : ve === 'elevenlabs' ? 'ElevenLabs'
                : ve === 'openai' ? 'OpenAI'
                : 'Edge TTS';
              return (
                <span style={{fontSize:9, color:S.colors.textSecondary, fontWeight:600, whiteSpace:'nowrap'}}>
                  {engineLabel}
                  {!isTrial && <span style={{fontSize:7, color:S.colors.textMuted, marginLeft:2}}>{<IconChevronDown size={8}/>}</span>}
                </span>
              );
            })()}
          </button>
          {/* Voice name badge — tappable to open voice picker */}
          <button onClick={() => { if (!isTrial) setShowVoicePicker(!showVoicePicker); }}
            style={{fontSize:8, color:S.colors.textMuted, fontWeight:500,
              padding:'1px 5px', borderRadius:4, background:S.colors.overlayBg,
              border: showVoicePicker ? `1px solid ${S.colors.accent4Border}` : `1px solid ${S.colors.overlayBorder}`,
              whiteSpace:'nowrap', cursor: isTrial ? 'default' : 'pointer',
              fontFamily:FONT, transition:'border 0.15s', WebkitTapHighlightColor:'transparent'}}>
            {(() => {
              const ve = prefs.voiceEngine || 'auto';
              const activeEngine = ve === 'auto'
                ? (isTrial ? 'edge' : canUseElevenLabs ? 'elevenlabs' : 'openai')
                : ve;
              if (activeEngine === 'elevenlabs') {
                if (selectedELVoice && clonedVoiceId && selectedELVoice === clonedVoiceId) {
                  return '\uD83C\uDFA4 ' + (clonedVoiceName || 'My Voice');
                }
                const elVoice = elevenLabsVoices?.find(v => v.id === selectedELVoice);
                return elVoice ? elVoice.name : 'Auto';
              }
              if (activeEngine === 'openai') return (prefs.voice || 'nova');
              if (activeEngine === 'edge') return (prefs.edgeTtsVoiceGender || 'female') === 'female' ? '\u2640 Female' : '\u2642 Male';
              return 'AUTO';
            })()}
            {!isTrial && <span style={{fontSize:6, marginLeft:2}}>{<IconChevronDown size={8}/>}</span>}
          </button>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          {/* AI model — tappable to open picker */}
          <button onClick={() => { if (!isTrial) setShowAiPicker(!showAiPicker); }}
            style={{background:'none', border:'none', padding:'1px 4px', cursor: isTrial ? 'default' : 'pointer',
              display:'flex', alignItems:'center', gap:3, borderRadius:4,
              outline: showAiPicker ? `1px solid ${S.colors.accent4Border}` : 'none',
              transition:'background 0.15s', WebkitTapHighlightColor:'transparent'}}>
            <span style={{fontSize:9, color:S.colors.textMuted, whiteSpace:'nowrap'}}>
              {isTrial ? 'AI: Free' : `AI: ${(AI_MODELS.find(m => m.id === (prefs?.aiModel || 'gpt-4o-mini'))?.name || 'GPT-4o Mini')}`}
            </span>
            {!isTrial && <span style={{fontSize:7, color:S.colors.textMuted}}>{<IconChevronDown size={8}/>}</span>}
          </button>
          {!audioEnabled && (
            <span style={{fontSize:8, fontWeight:700, padding:'1px 4px', borderRadius:3,
              background:S.colors.accent3Bg, color:S.colors.statusError, border:`1px solid ${S.colors.accent3Border}`}}>
              MUTED
            </span>
          )}
        </div>
      </div>

      {/* AI model picker dropdown */}
      {showAiPicker && (
        <>
          <div onClick={() => setShowAiPicker(false)}
            style={{position:'fixed', inset:0, zIndex:98, background:'transparent'}} />
          <div style={{position:'absolute', top:120, right:12, zIndex:100,
            background:S.colors.glassCard,
            border:`1px solid ${S.colors.cardBorder}`,
            borderRadius:12, padding:'4px 0', width:220, maxHeight:260, overflowY:'auto',
            boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            <div style={{padding:'6px 12px', fontSize:9, fontWeight:700, color:S.colors.textMuted,
              textTransform:'uppercase', letterSpacing:0.5, borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
              AI Translation Model
            </div>
            {AI_MODELS.filter(m => !m.ownKeyOnly || (useOwnKeys && apiKeyInputs?.[m.provider]?.trim())).map(m => (
              <button key={m.id} onClick={() => {
                savePrefs({...prefs, aiModel: m.id});
                setShowAiPicker(false);
              }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                width:'100%', padding:'8px 12px', background: m.id === (prefs?.aiModel || 'gpt-4o-mini') ? S.colors.accent4Bg : 'transparent',
                border:'none', cursor:'pointer', fontFamily:FONT, fontSize:11,
                color:S.colors.textPrimary, transition:'background 0.1s',
                gap:6}}>
                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:1}}>
                  <span style={{fontWeight:600}}>{m.name}</span>
                  <span style={{fontSize:9, color:S.colors.textMuted}}>{m.desc}</span>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:4, flexShrink:0}}>
                  <span style={{fontSize:8, color:S.colors.textTertiary}}>{m.cost}</span>
                  {m.id === (prefs?.aiModel || 'gpt-4o-mini') && (
                    <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Voice picker dropdown */}
      {showVoicePicker && (
        <>
          <div onClick={() => setShowVoicePicker(false)}
            style={{position:'fixed', inset:0, zIndex:98, background:'transparent'}} />
          <div style={{position:'absolute', top:120, left:12, zIndex:100,
            background:S.colors.glassCard,
            border:`1px solid ${S.colors.cardBorder}`,
            borderRadius:12, padding:'4px 0', width:220, maxHeight:320, overflowY:'auto',
            boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            {(() => {
              const ve = prefs.voiceEngine || 'auto';
              const activeEngine = ve === 'auto'
                ? (isTrial ? 'edge' : canUseElevenLabs ? 'elevenlabs' : 'openai')
                : ve;

              // OpenAI voices section
              if (activeEngine === 'openai') return (
                <>
                  <div style={{padding:'6px 12px', fontSize:9, fontWeight:700, color:S.colors.textMuted,
                    textTransform:'uppercase', letterSpacing:0.5, borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
                    Voce OpenAI
                  </div>
                  {VOICES.map(v => (
                    <button key={v} onClick={() => {
                      savePrefs({...prefs, voice: v});
                      setShowVoicePicker(false);
                    }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                      width:'100%', padding:'8px 12px',
                      background: v === (prefs.voice || 'nova') ? S.colors.accent4Bg : 'transparent',
                      border:'none', cursor:'pointer', fontFamily:FONT, fontSize:12,
                      color:S.colors.textPrimary, transition:'background 0.1s'}}>
                      <span style={{fontWeight:500, textTransform:'capitalize'}}>{v}</span>
                      {v === (prefs.voice || 'nova') && (
                        <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>
                      )}
                    </button>
                  ))}
                </>
              );

              // ElevenLabs voices section
              if (activeEngine === 'elevenlabs') return (
                <>
                  <div style={{padding:'6px 12px', fontSize:9, fontWeight:700, color:S.colors.textMuted,
                    textTransform:'uppercase', letterSpacing:0.5, borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
                    Voce ElevenLabs
                  </div>
                  {/* Cloned voice option */}
                  {clonedVoiceId && (
                    <button onClick={() => {
                      if (setSelectedELVoice) setSelectedELVoice(clonedVoiceId);
                      setShowVoicePicker(false);
                    }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                      width:'100%', padding:'8px 12px',
                      background: selectedELVoice === clonedVoiceId ? S.colors.accent4Bg : 'transparent',
                      border:'none', cursor:'pointer', fontFamily:FONT, fontSize:12,
                      color:S.colors.textPrimary, transition:'background 0.1s',
                      borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
                      <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:1}}>
                        <span style={{fontWeight:600}}>{'\uD83C\uDFA4'} {clonedVoiceName || 'La mia voce'}</span>
                        <span style={{fontSize:9, color:S.colors.accent4Border}}>Voce clonata</span>
                      </div>
                      {selectedELVoice === clonedVoiceId && <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>}
                    </button>
                  )}
                  {/* Auto (avatar-based) option */}
                  <button onClick={() => {
                    if (setSelectedELVoice) setSelectedELVoice('');
                    setShowVoicePicker(false);
                  }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                    width:'100%', padding:'8px 12px',
                    background: !selectedELVoice ? S.colors.accent4Bg : 'transparent',
                    border:'none', cursor:'pointer', fontFamily:FONT, fontSize:12,
                    color:S.colors.textPrimary, transition:'background 0.1s'}}>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:1}}>
                      <span style={{fontWeight:500}}>Auto (Avatar)</span>
                      <span style={{fontSize:9, color:S.colors.textMuted}}>Voce basata sull'avatar</span>
                    </div>
                    {!selectedELVoice && <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>}
                  </button>
                  {/* ElevenLabs voice list — grouped by gender */}
                  {(elevenLabsVoices || []).length > 0 && (() => {
                    const females = elevenLabsVoices.filter(v => v.gender === 'female');
                    const males = elevenLabsVoices.filter(v => v.gender === 'male');
                    const other = elevenLabsVoices.filter(v => v.gender !== 'female' && v.gender !== 'male');
                    const groups = [
                      { label: '\u2640 Femminile', voices: females },
                      { label: '\u2642 Maschile', voices: males },
                      ...(other.length > 0 ? [{ label: 'Altro', voices: other }] : []),
                    ];
                    return groups.map(g => g.voices.length > 0 && (
                      <div key={g.label}>
                        <div style={{padding:'4px 12px', fontSize:8, fontWeight:700, color:S.colors.textMuted,
                          textTransform:'uppercase', letterSpacing:0.5, background:S.colors.overlayBg,
                          borderTop:`1px solid ${S.colors.overlayBorder}`}}>
                          {g.label} ({g.voices.length})
                        </div>
                        {g.voices.map(v => (
                          <button key={v.id} onClick={() => {
                            if (setSelectedELVoice) setSelectedELVoice(v.id);
                            setShowVoicePicker(false);
                          }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                            width:'100%', padding:'6px 12px',
                            background: selectedELVoice === v.id ? S.colors.accent4Bg : 'transparent',
                            border:'none', cursor:'pointer', fontFamily:FONT, fontSize:11,
                            color:S.colors.textPrimary, transition:'background 0.1s'}}>
                            <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:0}}>
                              <span style={{fontWeight:500}}>{v.name}</span>
                              <span style={{fontSize:8, color:S.colors.textMuted}}>
                                {[v.accent, v.useCase].filter(Boolean).join(' \u2022 ')}
                              </span>
                            </div>
                            {selectedELVoice === v.id && <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>}
                          </button>
                        ))}
                      </div>
                    ));
                  })()}
                  {(!elevenLabsVoices || elevenLabsVoices.length === 0) && (
                    <div style={{padding:'10px 12px', fontSize:10, color:S.colors.textMuted, textAlign:'center'}}>
                      Caricamento voci...
                    </div>
                  )}
                </>
              );

              // Edge TTS voices section (male/female)
              return (
                <>
                  <div style={{padding:'6px 12px', fontSize:9, fontWeight:700, color:S.colors.textMuted,
                    textTransform:'uppercase', letterSpacing:0.5, borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
                    Voce Edge TTS
                  </div>
                  {[{id:'female', label:'Femminile', icon:'\u2640'}, {id:'male', label:'Maschile', icon:'\u2642'}].map(g => (
                    <button key={g.id} onClick={() => {
                      savePrefs({...prefs, edgeTtsVoiceGender: g.id});
                      setShowVoicePicker(false);
                    }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                      width:'100%', padding:'10px 12px',
                      background: (prefs.edgeTtsVoiceGender || 'female') === g.id ? S.colors.accent4Bg : 'transparent',
                      border:'none', cursor:'pointer', fontFamily:FONT, fontSize:13,
                      color:S.colors.textPrimary, transition:'background 0.1s'}}>
                      <span style={{fontWeight:500}}>{g.icon} {g.label}</span>
                      {(prefs.edgeTtsVoiceGender || 'female') === g.id && (
                        <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>
                      )}
                    </button>
                  ))}
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* Animations */}
      <style>{`
        @keyframes vtConnecting {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes vtBattPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes vtSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes vtSlideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* ── Incoming Call Banner (voice or video) ── */}
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
                  background:'#ef4444', color:'#fff', fontSize:13, fontWeight:600}}>
                Rifiuta
              </button>
              <button onClick={() => {
                webrtc.acceptIncomingCall();
                if (isVideo) { setShowVideoCall(true); setVideoFullscreen(true); }
                // Voice calls auto-open via the useEffect on webrtcState
              }}
                style={{padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer',
                  background:'#22c55e', color:'#fff', fontSize:13, fontWeight:600}}>
                Accetta
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Video Call (fullscreen + inline) — extracted component ── */}
      <VideoCallOverlay
        webrtc={webrtc}
        partner={partner}
        getSenderAvatar={getSenderAvatar}
        videoFullscreen={videoFullscreen}
        setVideoFullscreen={setVideoFullscreen}
        showVideoCall={showVideoCall}
        setShowVideoCall={setShowVideoCall}
        videoDucking={videoDucking}
        setVideoDucking={setVideoDucking}
        partnerVolume={partnerVolume}
        setPartnerVolume={setPartnerVolume}
        lastTranslationSubtitle={lastTranslationSubtitle}
        recording={recording}
        isListening={isListening}
        partnerSpeaking={partnerSpeaking}
        partnerTyping={partnerTyping}
        S={S}
      />

      {/* ── Voice Call Overlay ── */}
      {showVoiceCall && webrtc?.webrtcConnected && webrtc?.callType === 'voice' && (
        <VoiceCallOverlay
          webrtc={webrtc}
          partner={partner}
          getSenderAvatar={getSenderAvatar}
          S={S}
          partnerVolume={partnerVolume}
          setPartnerVolume={setPartnerVolume}
          partnerSpeaking={partnerSpeaking}
          partnerTyping={partnerTyping}
          interpreterActive={interpreterActive}
          setInterpreterActive={setInterpreterActive}
          interpreter={interpreter}
          onClose={() => setShowVoiceCall(false)}
          onUpgradeToVideo={() => {
            setShowVoiceCall(false);
            setShowVideoCall(true);
            setVideoFullscreen(true);
          }}
        />
      )}

      {/* ── Messages — extracted component ── */}
      <MessageList
        messages={messages}
        streamingMsg={streamingMsg}
        myName={myName}
        myLang={myLang}
        prefs={prefs}
        partner={partner}
        roomInfo={roomInfo}
        roomMode={roomMode}
        isHost={isHost}
        getTranslationForMe={getTranslationForMe}
        getSenderAvatar={getSenderAvatar}
        playMessage={playMessage}
        playingMsgId={playingMsgId}
        partnerSpeaking={partnerSpeaking}
        partnerTyping={partnerTyping}
        partnerLiveText={partnerLiveText}
        msgsEndRef={msgsEndRef}
        S={S}
        L={L}
        onMessageRead={onMessageRead}
      />

      {/* Captions Overlay — floating subtitle for partner live speech */}
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
          onChange={e => { setTextInput(e.target.value); if (e.target.value.trim()) sendTypingState(true); }}
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
          {sendingText ? '...' : '→'}
        </button>
      </div>

      {/* ═══ Talk bar — redesigned for clarity and ergonomics ═══ */}
      <div style={S.talkBar} role="toolbar" aria-label="Voice controls">
        {status && <div style={{fontSize:12, color:S.colors.accent3, marginBottom:6, fontWeight:500}}>{status}</div>}

        {(roomMode === 'conversation' || roomMode === 'classroom') && canTalk && (
          <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:16, padding:'4px 0'}}>
            {/* Cancel button (only when recording) */}
            {recording && (
              <button onClick={() => { vibrate(15); cancelRecording(); }}
                title="Annulla registrazione"
                style={{display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                  width:52, height:52, borderRadius:14, border:`2px solid ${S.colors.statusError}`,
                  background:'rgba(239,68,68,0.1)', color:S.colors.statusError,
                  cursor:'pointer', justifyContent:'center',
                  WebkitTapHighlightColor:'transparent', transition:'all 0.2s'}}>
                <span style={{fontSize:20}}>{'\u2716'}</span>
                <span style={{fontSize:7, fontWeight:700}}>ANNULLA</span>
              </button>
            )}
            {/* Live mode button */}
            <button onClick={async () => {
              const next = !liveMode;
              setLiveModeState(next);
              if (setLiveMode) await setLiveMode(next);
              vibrate(15);
            }}
              title={liveMode ? 'Riduzione rumore attiva' : 'Attiva riduzione rumore'}
              style={{display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                width:52, height:52, borderRadius:14,
                border: liveMode ? '2px solid #22c55e' : `2px solid ${S.colors.overlayBorder}`,
                background: liveMode ? 'rgba(34,197,94,0.12)' : S.colors.overlayBg,
                color: liveMode ? '#22c55e' : S.colors.textMuted,
                cursor:'pointer', justifyContent:'center',
                WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
                boxShadow: liveMode ? '0 0 12px rgba(34,197,94,0.25)' : 'none'}}>
              <span style={{fontSize:16, display:'flex'}}><IconMic size={16}/></span>
              <span style={{fontSize:7, fontWeight:700}}>LIVE</span>
            </button>
            {/* MAIN record button — hero element */}
            <button onClick={() => { vibrate(25); toggleRecording(); }}
              aria-label={recording ? 'Stop' : 'Registra'}
              style={{...S.talkBtn, width:72, height:72, fontSize:30,
                ...(recording ? {...S.talkBtnRec, animation:'vtRecordPulse 1.5s ease-in-out infinite'} : {})}}>
              {recording ? <IconStop size={28}/> : <IconMic size={28}/>}
            </button>
          </div>
        )}

        {roomMode === 'classroom' && !canTalk && (
          <div style={{color:S.colors.textMuted, fontSize:12, padding:10, textAlign:'center'}}>
            {<IconLock size={14}/>} {L('classroomDesc')}
          </div>
        )}

        {(roomMode === 'freetalk' || roomMode === 'simultaneous') && (
          <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:16, padding:'4px 0'}}>
            {/* Cancel button */}
            {recording && (
              <button onClick={() => { vibrate(15); cancelRecording(); }}
                title="Annulla registrazione"
                style={{display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                  width:52, height:52, borderRadius:14, border:`2px solid ${S.colors.statusError}`,
                  background:'rgba(239,68,68,0.1)', color:S.colors.statusError,
                  cursor:'pointer', justifyContent:'center',
                  WebkitTapHighlightColor:'transparent', transition:'all 0.2s'}}>
                <span style={{fontSize:20}}>{'\u2716'}</span>
                <span style={{fontSize:7, fontWeight:700}}>ANNULLA</span>
              </button>
            )}
            {/* VAD Audio Level Bar */}
            {isListening && typeof vadAudioLevel === 'number' && (
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:40}}>
                <div style={{width:6, height:40, borderRadius:3, background:S.colors.overlayBg || 'rgba(255,255,255,0.1)',
                  overflow:'hidden', position:'relative'}}>
                  <div style={{
                    position:'absolute', bottom:0, width:'100%', borderRadius:3,
                    height:`${Math.round(vadAudioLevel * 100)}%`,
                    background: vadAudioLevel > 0.5 ? '#4ade80' : vadAudioLevel > 0.15 ? '#667eea' : 'rgba(255,255,255,0.2)',
                    transition:'height 0.08s linear',
                  }} />
                </div>
                {vadSilenceCountdown !== null && vadSilenceCountdown > 0 && (
                  <span style={{fontSize:9, color:S.colors.accent3, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>
                    {vadSilenceCountdown}s
                  </span>
                )}
              </div>
            )}
            {/* MAIN free talk button — hero element */}
            <button onClick={() => { vibrate(25); isListening ? stopFreeTalk() : startFreeTalk(); }}
              aria-label={isListening ? 'Stop' : 'Avvia ascolto'}
              style={{...S.talkBtn, width:72, height:72, fontSize:30,
                ...(isListening ? S.talkBtnRec : {}),
                ...(recording ? {boxShadow:`0 0 0 8px ${S.colors.accent3Bg}, 0 0 0 18px ${S.colors.accent3Bg}33`} : {}),
                ...(roomMode === 'simultaneous' && isListening ? {background:S.colors.btnGradient,
                  boxShadow:`0 0 0 8px ${S.colors.accent3Bg}, 0 0 0 18px ${S.colors.accent3Bg}33`} : {})}}>
              {isListening ? (recording ? <IconRecord size={28}/> : <IconMic size={28}/>) : <IconMic size={28}/>}
            </button>
          </div>
        )}

        {/* Mode label + VAD sensitivity (compact row) */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:6, flexWrap:'wrap'}}>
          <span style={{fontSize:10, color:S.colors.textTertiary, fontWeight:500}}>
            {modeInfo.icon} {L(modeInfo.nameKey)}
            {(roomMode === 'freetalk' || roomMode === 'simultaneous') && isListening && (
              <span style={{color:S.colors.statusOk, marginLeft:4}}>LIVE</span>
            )}
          </span>
          {/* VAD Sensitivity — inline pills */}
          {(roomMode === 'freetalk' || roomMode === 'simultaneous') && !isListening && (
            <>
              <span style={{color:S.colors.overlayBorder}}>|</span>
              {[
                { id: 'quiet', short: 'Silenzio' },
                { id: 'normal', short: 'Normale' },
                { id: 'noisy', short: 'Rumore' },
                { id: 'street', short: 'Strada' },
              ].map(p => (
                <button key={p.id} onClick={() => setVadSensitivity(p.id)}
                  style={{padding:'2px 8px', borderRadius:8, fontSize:9, fontWeight:600,
                    border: vadSensitivity === p.id ? `1px solid ${S.colors.accent3Border}` : `1px solid ${S.colors.overlayBorder}`,
                    background: vadSensitivity === p.id ? S.colors.accent3Bg : 'transparent',
                    color: vadSensitivity === p.id ? S.colors.accent3 : S.colors.textMuted,
                    cursor:'pointer', WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                    fontFamily:FONT}}>
                  {p.short}
                </button>
              ))}
            </>
          )}
        </div>

        {isTrial && isHost && (
          <button onClick={() => { endChatAndSave(); setTimeout(() => setView('account'), 300); }}
            style={{marginTop:6, padding:'6px 16px', borderRadius:12, border:`1px solid ${S.colors.accent3Border}`,
              background:S.colors.accent3Bg, color:S.colors.textMuted, fontSize:11,
              cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent'}}>
            {<IconSparkles size={12}/>} {L('upgradeToPro')}
          </button>
        )}
      </div>

      <style>{`
        @keyframes vtPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes vtSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes vtRecordPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,157,0.5); }
          50% { box-shadow: 0 0 0 12px rgba(255,107,157,0); }
        }
        @keyframes vtCaptionFade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
});

export default RoomView;
