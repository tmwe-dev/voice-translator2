'use client';
import { memo, useState, useRef, useEffect } from 'react';
import { LANGS, MODES, CONTEXTS, FONT, getLang, vibrate, FREE_DAILY_LIMIT, AVATARS, AI_MODELS, VOICES } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import ConnectionQuality from './ConnectionQuality.js';

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
  realtimeConnected, webrtc, isHostVerified, verifiedName }) {

  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showAiPicker, setShowAiPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [showExitMenu, setShowExitMenu] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showDuckingPanel, setShowDuckingPanel] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [videoDucking, setVideoDucking] = useState(false); // auto-ducking during video call
  const [lastTranslationSubtitle, setLastTranslationSubtitle] = useState(null); // { text, ts }
  const subtitleTimerRef = useRef(null);

  // Video refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Auto-open video panel when call connects (not on incoming request)
  useEffect(() => {
    if (webrtc?.webrtcState === 'connected' && !showVideoCall) {
      setShowVideoCall(true);
      setVideoFullscreen(true);
    }
  }, [webrtc?.webrtcState]);

  // Auto-enable ducking when in video call and languages are different
  useEffect(() => {
    if (webrtc?.webrtcConnected && partner && partner.lang !== myLang) {
      setVideoDucking(true);
    }
  }, [webrtc?.webrtcConnected, partner?.lang, myLang]);

  // Auto-disable ducking when video call ends
  useEffect(() => {
    if (!webrtc?.webrtcConnected) {
      setVideoDucking(false);
      setVideoFullscreen(false);
    }
  }, [webrtc?.webrtcConnected]);

  // Show translation subtitle when last message from partner has translation
  useEffect(() => {
    if (!videoFullscreen || !messages.length) return;
    const lastPartnerMsg = [...messages].reverse().find(m => m.sender !== myName);
    if (!lastPartnerMsg) return;
    const translationText = getTranslationForMe(lastPartnerMsg);
    const hasTranslation = !!(lastPartnerMsg.translated || (lastPartnerMsg.translations && Object.keys(lastPartnerMsg.translations).length > 0));
    if (hasTranslation && translationText) {
      setLastTranslationSubtitle({ text: translationText, original: lastPartnerMsg.original, ts: lastPartnerMsg.timestamp });
      // Clear after 8 seconds
      if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
      subtitleTimerRef.current = setTimeout(() => setLastTranslationSubtitle(null), 8000);
    }
  }, [messages, videoFullscreen]);

  // Attach video streams to DOM elements
  useEffect(() => {
    if (localVideoRef.current && webrtc?.localStream) {
      localVideoRef.current.srcObject = webrtc.localStream;
    }
  }, [webrtc?.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && webrtc?.remoteStream) {
      remoteVideoRef.current.srcObject = webrtc.remoteStream;
    }
  }, [webrtc?.remoteStream]);

  const myName = verifiedName || prefs.name;
  const otherMembers = roomInfo?.members?.filter(m => m.name !== myName) || [];
  const partner = otherMembers[0]; // Primary partner (for 1:1 backward compat)
  const myL = getLang(myLang);
  const otherL = partner ? getLang(partner.lang) : getLang('en');

  // Helper: get the best translation for the viewer's language from a message
  function getTranslationForMe(msg) {
    // Multi-lang: check translations object first
    if (msg.translations && msg.translations[myLang]) {
      return msg.translations[myLang];
    }
    // If the message was originally in MY language, show the original text
    if (msg.sourceLang === myLang && msg.original) {
      return msg.original;
    }
    // Backward compat: use single translated field only if targetLang matches myLang
    if (msg.targetLang === myLang && msg.translated) {
      return msg.translated;
    }
    // Last resort: show translated (may be wrong lang) or original
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
      {/* ═══ Header ═══ */}
      <div style={{...S.roomHeader, position:'relative', flexWrap:'nowrap', gap:4, padding:'6px 8px'}} role="banner">
        {/* ── Left: Close button ── */}
        <div style={{position:'relative', flexShrink:0}}>
          <button style={S.backBtnSmall} onClick={() => setShowExitMenu(!showExitMenu)} title={L('endChat')}>{'\u2716'}</button>
          {showExitMenu && (
            <div style={{position:'absolute', top:'100%', left:0, zIndex:100, marginTop:4,
              background:S.colors.overlayBg2 || S.colors.overlayBg, border:`1px solid ${S.colors.overlayBorder}`,
              borderRadius:12, padding:4, minWidth:180, backdropFilter:'blur(12px)',
              boxShadow:'0 8px 32px rgba(0,0,0,0.3)'}}>
              <button onClick={() => { setShowExitMenu(false); if (leaveRoomTemporary) leaveRoomTemporary(); }}
                style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 14px',
                  background:'none', border:'none', cursor:'pointer', borderRadius:8, color:S.colors.textPrimary,
                  fontSize:13, fontWeight:600, textAlign:'left'}}>
                <span>{'\u{1F6AA}'}</span> {L('leaveTemp') || 'Esci temporaneamente'}
              </button>
              <button onClick={() => { setShowExitMenu(false); endChatAndSave(); }}
                style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 14px',
                  background:'none', border:'none', cursor:'pointer', borderRadius:8, color:S.colors.statusError || '#FF6B6B',
                  fontSize:13, fontWeight:600, textAlign:'left'}}>
                <span>{'\u{1F4BE}'}</span> {L('closeArchive') || 'Chiudi e archivia'}
              </button>
            </div>
          )}
        </div>

        {/* ── Center: Language flags (flex:1 centered, no absolute) ── */}
        <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, minWidth:0}}>
          <button onClick={() => setShowLangPicker(!showLangPicker)}
            style={{fontSize:18, background:'none', border:'none', cursor:'pointer', padding:'2px 6px',
              borderRadius:8, transition:'background 0.15s', flexShrink:0,
              outline: showLangPicker ? `2px solid ${S.colors.accent4Border}` : 'none'}}>
            {myL.flag}
          </button>
          <span style={{color:S.colors.textTertiary, fontSize:14, flexShrink:0}}>{'\u21C4'}</span>
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

        {/* ── Right: Primary actions (compact for mobile) ── */}
        <div style={{display:'flex', alignItems:'center', gap:3, flexShrink:0}}>
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
              style={{...S.iconBtn, width:28, height:28, fontSize:13,
                background: showVideoCall ? S.colors.accent4Bg : S.colors.overlayBg,
                border: showVideoCall ? `1px solid ${S.colors.accent4Border}` : `1px solid ${S.colors.overlayBorder}`}}>
              {showVideoCall ? '\u{1F4F9}' : '\u{1F4F7}'}
            </button>
          )}
          {/* Audio toggle */}
          <button onClick={() => { if (!audioEnabled) unlockAudio(); setAudioEnabled(!audioEnabled); }}
            style={{...S.iconBtn, width:28, height:28, fontSize:13,
              color: audioEnabled ? S.colors.statusOk : S.colors.statusError,
              background: audioEnabled ? S.colors.accent4Bg : S.colors.accent3Bg,
              border: audioEnabled ? `1px solid ${S.colors.accent4Border}` : `1px solid ${S.colors.accent3Border}`}}>
            {audioEnabled ? '\u{1F50A}' : '\u{1F507}'}
          </button>
          {/* More menu button — includes connection quality + partner status */}
          <div style={{position:'relative', flexShrink:0}}>
            <button onClick={() => setShowMoreMenu(!showMoreMenu)}
              style={{...S.iconBtn, width:28, height:28, fontSize:14, fontWeight:700, letterSpacing:1,
                background: showMoreMenu ? S.colors.accent4Bg : S.colors.overlayBg,
                border: showMoreMenu ? `1px solid ${S.colors.accent4Border}` : `1px solid ${S.colors.overlayBorder}`,
                position:'relative'}}>
              {'\u22EF'}
              {/* Partner status dot overlaid on menu button */}
              <div style={{position:'absolute', top:-1, right:-1, width:7, height:7, borderRadius:4,
                background: partnerConnected ? S.colors.statusOk : S.colors.statusError,
                border:'1px solid rgba(0,0,0,0.3)'}} />
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
                  {showCaptions && <span style={{marginLeft:'auto', color:S.colors.statusOk}}>{'\u2713'}</span>}
                </button>
                {/* Export */}
                <button onClick={() => { exportConversation(); setShowMoreMenu(false); }}
                  style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px',
                    background:'none', border:'none', cursor:'pointer', borderRadius:8, color:S.colors.textPrimary,
                    fontSize:13, fontWeight:500, textAlign:'left'}}>
                  <span style={{fontSize:15, width:24, textAlign:'center'}}>{'\u{1F4CB}'}</span>
                  <span>{L('exportConversation') || 'Esporta conversazione'}</span>
                </button>
                {/* Audio Ducking */}
                <div style={{padding:'8px 12px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                    <span style={{fontSize:15, width:24, textAlign:'center'}}>{'\u{1F3B5}'}</span>
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
                        <span style={{fontSize:15, width:24, textAlign:'center'}}>{'\u{1F50B}'}</span>
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
      {(showMoreMenu || showExitMenu) && (
        <div onClick={() => { setShowMoreMenu(false); setShowExitMenu(false); }}
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
              {l.code === myLang && <span style={{marginLeft:'auto', color:S.colors.statusOk, fontSize:14}}>{'\u2713'}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close lang picker */}
      {showLangPicker && (
        <div onClick={() => setShowLangPicker(false)}
          style={{position:'fixed', inset:0, zIndex:99, background:'transparent'}} />
      )}

      {/* Mode bar + Cost */}
      <div style={{padding:'5px 12px', background:S.colors.overlayBg,
        borderBottom:`1px solid ${S.colors.overlayBorder}`, display:'flex', alignItems:'center',
        justifyContent:'space-between', flexShrink:0}}>
        <button onClick={() => isHost && setShowModeSelector(!showModeSelector)}
          style={{background:'none', border:'none', padding:0, cursor:isHost ? 'pointer' : 'default',
            display:'flex', alignItems:'center', gap:4, WebkitTapHighlightColor:'transparent'}}>
          <span style={{fontSize:11, color:S.colors.textMuted}}>
            {modeInfo.icon} {L(modeInfo.nameKey)}
            {roomCtx.id !== 'general' && <span style={{marginLeft:4}}>{roomCtx.icon} {L(roomCtx.nameKey)}</span>}
          </span>
          {isHost && <span style={{fontSize:9, color:S.colors.textMuted}}>{'\u25BC'}</span>}
          {!isHost && roomMode === 'classroom' && (
            <span style={{fontSize:10, color:S.colors.textTertiary}}>
              {' \u2022 '}{roomInfo?.host || 'Host'} presenta
            </span>
          )}
        </button>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          {isHost && (
            <span style={{fontSize:8, fontWeight:700, letterSpacing:0.5, padding:'2px 6px', borderRadius:6,
              background: isTrial ? S.colors.accent4Bg : isTopPro ? `${S.colors.goldAccent}26` : S.colors.accent3Bg,
              color: isTrial ? S.colors.statusOk : isTopPro ? S.colors.goldAccent : S.colors.accent3,
              border: `1px solid ${isTrial ? S.colors.accent4Border : isTopPro ? `${S.colors.goldAccent}40` : S.colors.accent3Border}`}}>
              {isTrial ? 'FREE' : isTopPro ? 'TOP PRO' : 'PRO'}
            </span>
          )}
          {isHost && !isTrial && (
            <>
              <span style={{fontSize:10, color:S.colors.textTertiary, fontFamily:'monospace'}}>
                ${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(3)}
              </span>
              <span style={{fontSize:9, color:S.colors.textMuted}}>
                {msgCount} msg
              </span>
            </>
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
                ? (isTrial ? '\u{1F50A} Edge TTS' : canUseElevenLabs ? '\u{1F3A4} ElevenLabs' : '\u{1F3A4} OpenAI')
                : ve === 'elevenlabs' ? '\u{1F3A4} ElevenLabs'
                : ve === 'openai' ? '\u{1F3A4} OpenAI'
                : '\u{1F50A} Edge TTS';
              return (
                <span style={{fontSize:9, color:S.colors.textSecondary, fontWeight:600, whiteSpace:'nowrap'}}>
                  {engineLabel}
                  {!isTrial && <span style={{fontSize:7, color:S.colors.textMuted, marginLeft:2}}>{'\u25BC'}</span>}
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
            {!isTrial && <span style={{fontSize:6, marginLeft:2}}>{'\u25BC'}</span>}
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
            {!isTrial && <span style={{fontSize:7, color:S.colors.textMuted}}>{'\u25BC'}</span>}
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
                    <span style={{color:S.colors.statusOk, fontSize:12}}>{'\u2713'}</span>
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
                        <span style={{color:S.colors.statusOk, fontSize:12}}>{'\u2713'}</span>
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
                      {selectedELVoice === clonedVoiceId && <span style={{color:S.colors.statusOk, fontSize:12}}>{'\u2713'}</span>}
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
                    {!selectedELVoice && <span style={{color:S.colors.statusOk, fontSize:12}}>{'\u2713'}</span>}
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
                            {selectedELVoice === v.id && <span style={{color:S.colors.statusOk, fontSize:12}}>{'\u2713'}</span>}
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
                        <span style={{color:S.colors.statusOk, fontSize:12}}>{'\u2713'}</span>
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

      {/* ── Incoming Call Banner ── */}
      {webrtc?.incomingCall && (
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
                {webrtc.incomingCall.from} {L('callIncoming') || 'ti sta chiamando'}
              </div>
              <div style={{color:'#94a3b8', fontSize:11, marginTop:2}}>Video call in arrivo</div>
            </div>
          </div>
          <div style={{display:'flex', gap:10}}>
            <button onClick={() => webrtc.declineIncomingCall()}
              style={{padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer',
                background:'#ef4444', color:'#fff', fontSize:13, fontWeight:600}}>
              Rifiuta
            </button>
            <button onClick={() => { webrtc.acceptIncomingCall(); setShowVideoCall(true); setVideoFullscreen(true); }}
              style={{padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer',
                background:'#22c55e', color:'#fff', fontSize:13, fontWeight:600}}>
              Accetta
            </button>
          </div>
        </div>
      )}

      {/* ── Fullscreen Video Call ── */}
      {videoFullscreen && webrtc?.webrtcConnected && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:200,
          background:'#000', display:'flex', flexDirection:'column',
        }}>
          {/* Remote video (full screen) */}
          <div style={{flex:1, position:'relative', overflow:'hidden'}}>
            {webrtc.remoteVideoActive && webrtc.remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline
                style={{width:'100%', height:'100%', objectFit:'cover'}} />
            ) : (
              <div style={{width:'100%', height:'100%', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:16, background:'#0a0a0a'}}>
                <AvatarImg src={partner ? getSenderAvatar(partner.name) : null} size={96} />
                <span style={{color:'#94a3b8', fontSize:16, fontWeight:500}}>
                  {partner?.name || 'Partner'} - Camera off
                </span>
              </div>
            )}

            {/* Local video PiP (top-right) */}
            {webrtc.localStream && webrtc.videoEnabled && (
              <div style={{position:'absolute', top:50, right:16, width:120, height:90,
                borderRadius:12, overflow:'hidden', border:'2px solid rgba(255,255,255,0.2)',
                boxShadow:'0 4px 20px rgba(0,0,0,0.6)'}}>
                <video ref={localVideoRef} autoPlay playsInline muted
                  style={{width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)'}} />
              </div>
            )}

            {/* Status bar (top-left) */}
            <div style={{position:'absolute', top:16, left:16, display:'flex', alignItems:'center', gap:8,
              padding:'6px 14px', borderRadius:24, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)'}}>
              <div style={{width:8, height:8, borderRadius:4, background:'#4ade80'}} />
              <span style={{fontSize:12, color:'#fff', fontWeight:600}}>P2P</span>
              {partner && <span style={{fontSize:12, color:'#94a3b8'}}>{partner.name}</span>}
            </div>

            {/* Ducking toggle (top-right, above PiP) */}
            <button onClick={() => setVideoDucking(!videoDucking)}
              style={{position:'absolute', top:16, right:16, padding:'6px 12px', borderRadius:20,
                background: videoDucking ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.15)',
                border:'none', cursor:'pointer', color:'#fff', fontSize:11, fontWeight:500,
                backdropFilter:'blur(4px)', display:'flex', alignItems:'center', gap:6}}>
              {videoDucking ? '\u{1F509}' : '\u{1F50A}'} {videoDucking ? 'Ducking ON' : 'Ducking OFF'}
            </button>

            {/* ── Translation subtitle overlay (bottom) ── */}
            {lastTranslationSubtitle && (
              <div style={{
                position:'absolute', bottom:100, left:16, right:16,
                background:'linear-gradient(to top, rgba(255,255,255,0.95), rgba(245,245,245,0.92))',
                borderRadius:16, padding:'14px 20px',
                boxShadow:'0 -4px 20px rgba(0,0,0,0.3)', backdropFilter:'blur(12px)',
                animation:'vtSlideUp 0.3s ease-out',
              }}>
                <div style={{fontSize:15, fontWeight:600, color:'#1e3a5f', lineHeight:1.5}}>
                  {lastTranslationSubtitle.text}
                </div>
                {lastTranslationSubtitle.original && (
                  <div style={{fontSize:11, color:'#64748b', marginTop:4}}>
                    {lastTranslationSubtitle.original}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Video call controls (bottom bar) */}
          <div style={{
            padding:'16px 0 32px', display:'flex', justifyContent:'center', gap:16,
            background:'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7))',
          }}>
            <button onClick={() => webrtc.toggleVideo()}
              style={{width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
                background: webrtc.videoEnabled ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.3)',
                color:'#fff', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center'}}>
              {webrtc.videoEnabled ? '\u{1F4F7}' : '\u{1F6AB}'}
            </button>
            <button onClick={() => webrtc.toggleAudio()}
              style={{width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
                background: webrtc.audioEnabled ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.3)',
                color:'#fff', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center'}}>
              {webrtc.audioEnabled ? '\u{1F3A4}' : '\u{1F507}'}
            </button>
            <button onClick={() => webrtc.flipCamera()}
              style={{width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
                background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:20,
                display:'flex', alignItems:'center', justifyContent:'center'}}>
              {'\u{1F504}'}
            </button>
            <button onClick={() => setVideoFullscreen(false)}
              style={{width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
                background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:20,
                display:'flex', alignItems:'center', justifyContent:'center'}}>
              {'\u{2B07}\uFE0F'}
            </button>
            <button onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
              style={{width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
                background:'#ef4444', color:'#fff', fontSize:20,
                display:'flex', alignItems:'center', justifyContent:'center'}}>
              {'\u{1F4F5}'}
            </button>
          </div>
        </div>
      )}

      {/* Video Call Panel (inline, non-fullscreen) */}
      {showVideoCall && !videoFullscreen && webrtc && (
        <div style={{position:'relative', flexShrink:0, background:'#000',
          borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
          {/* Remote video (full width) */}
          <div style={{position:'relative', width:'100%', height:240, background:'#111'}}>
            {webrtc.remoteVideoActive && webrtc.remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline
                style={{width:'100%', height:'100%', objectFit:'cover'}} />
            ) : (
              <div style={{width:'100%', height:'100%', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:8}}>
                <AvatarImg src={partner ? getSenderAvatar(partner.name) : null} size={64} />
                <span style={{color:S.colors.textMuted, fontSize:12}}>
                  {webrtc.webrtcState === 'connecting' ? 'Connessione...'
                    : webrtc.webrtcConnected ? (partner?.name || 'Partner') + ' - Camera off'
                    : 'In attesa di connessione...'}
                </span>
              </div>
            )}
            {/* Local video (picture-in-picture) */}
            {webrtc.localStream && webrtc.videoEnabled && (
              <div style={{position:'absolute', bottom:8, right:8, width:100, height:75,
                borderRadius:10, overflow:'hidden', border:`2px solid ${S.colors.accent4Border}`,
                boxShadow:'0 4px 12px rgba(0,0,0,0.5)'}}>
                <video ref={localVideoRef} autoPlay playsInline muted
                  style={{width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)'}} />
              </div>
            )}
            {/* WebRTC state badge */}
            <div style={{position:'absolute', top:8, left:8, display:'flex', alignItems:'center', gap:6,
              padding:'4px 10px', borderRadius:20, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)'}}>
              <div style={{width:8, height:8, borderRadius:4,
                background: webrtc.webrtcConnected ? S.colors.statusOk
                  : webrtc.webrtcState === 'connecting' ? S.colors.statusWarning
                  : S.colors.statusError}} />
              <span style={{fontSize:10, color:'#fff', fontWeight:600}}>
                {webrtc.webrtcConnected ? 'P2P' : webrtc.webrtcState === 'connecting' ? '...' : 'OFF'}
              </span>
            </div>
          </div>
          {/* Video controls */}
          <div style={{display:'flex', justifyContent:'center', gap:12, padding:'8px 0',
            background:'rgba(0,0,0,0.85)'}}>
            <button onClick={() => webrtc.toggleVideo()}
              style={{width:40, height:40, borderRadius:'50%', border:'none', cursor:'pointer',
                background: webrtc.videoEnabled ? S.colors.accent4Bg : 'rgba(255,255,255,0.12)',
                color: webrtc.videoEnabled ? S.colors.statusOk : S.colors.textMuted,
                fontSize:16, display:'flex', alignItems:'center', justifyContent:'center'}}>
              {webrtc.videoEnabled ? '\u{1F4F7}' : '\u{1F6AB}'}
            </button>
            <button onClick={() => webrtc.flipCamera()}
              style={{width:40, height:40, borderRadius:'50%', border:'none', cursor:'pointer',
                background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:16,
                display:'flex', alignItems:'center', justifyContent:'center'}}>
              {'\u{1F504}'}
            </button>
            <button onClick={() => setVideoFullscreen(true)}
              style={{width:40, height:40, borderRadius:'50%', border:'none', cursor:'pointer',
                background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:16,
                display:'flex', alignItems:'center', justifyContent:'center'}}>
              {'\u{2B06}\uFE0F'}
            </button>
            <button onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
              style={{width:40, height:40, borderRadius:'50%', border:'none', cursor:'pointer',
                background:S.colors.statusError, color:'#fff', fontSize:16,
                display:'flex', alignItems:'center', justifyContent:'center'}}>
              {'\u{1F4F5}'}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={S.chatArea}>
        {messages.length === 0 && (
          <div style={{textAlign:'center', color:S.colors.textMuted, marginTop:60, fontSize:13, lineHeight:1.6}}>
            {L('speakNow')}{'\n'}
            {roomMode === 'freetalk' ? L('freeTalkDesc')
              : roomMode === 'simultaneous' ? L('simultaneousDesc')
              : roomMode === 'classroom' && !isHost
                ? `${roomInfo?.host || 'Host'} - ${L('classroomDesc')}`
                : L('conversationDesc')}
          </div>
        )}
        {messages.map((m, i) => {
          const isMine = m.sender === myName;
          const translationForMe = getTranslationForMe(m);
          const hasTranslation = !!(m.translated || (m.translations && Object.keys(m.translations).length > 0));
          const pendingTranslation = !hasTranslation && m.original;
          return (
            <div key={m._stableKey || m.id || `${m.sender}-${m.timestamp}-${i}`} style={{display:'flex', gap:8,
              flexDirection:isMine ? 'row-reverse' : 'row', marginBottom:12, alignItems:'flex-end',
              animation:'vtSlideIn 0.25s ease-out'}}>
              <AvatarImg src={isMine ? prefs.avatar : getSenderAvatar(m.sender)} size={56} style={{marginBottom:2}} />
              <div style={{maxWidth:'75%', display:'flex', flexDirection:'column',
                alignItems:isMine ? 'flex-end' : 'flex-start'}}>
                <div style={{fontSize:10, color:S.colors.textTertiary, marginBottom:3}}>
                  {isMine ? 'Tu' : m.sender}
                </div>
                <div style={{...S.bubble, ...(isMine ? S.bubbleMine : S.bubbleOther)}}>
                  {/* Primary line: original for sender, translation for receiver */}
                  <div style={{fontSize:14, fontWeight:500, lineHeight:1.5, color:S.colors.textPrimary}}>
                    {isMine ? m.original : (hasTranslation ? translationForMe : m.original)}
                  </div>
                  {/* Secondary line: translation for sender, original for receiver */}
                  {pendingTranslation ? (
                    <div style={{fontSize:11, color:S.colors.textMuted, marginTop:4, fontStyle:'italic'}}>
                      {L('translating') || 'Traducendo...'}
                    </div>
                  ) : (
                    <div style={{fontSize:12, color:S.colors.textSecondary, marginTop:4, lineHeight:1.4}}>
                      {isMine ? translationForMe : m.original}
                    </div>
                  )}
                </div>
                {hasTranslation && (
                  <button onClick={() => playMessage(m)}
                    style={{marginTop:2, padding:'2px 8px', borderRadius:8,
                      background:'transparent', border:'none', color:S.colors.textMuted,
                      fontSize:11, cursor:'pointer', WebkitTapHighlightColor:'transparent'}}>
                    {playingMsgId === m.id ? '\u{1F50A}' : '\u{25B6}\uFE0F'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {/* Streaming live bubble — FASE 1C: dedup with last polled message */}
        {streamingMsg && streamingMsg.original && !(messages.length > 0 && messages[messages.length - 1].sender === prefs.name && messages[messages.length - 1].original === streamingMsg.original.trim()) && (
          <div style={{display:'flex', gap:8, flexDirection:'row-reverse', marginBottom:12, alignItems:'flex-end'}}>
            <AvatarImg src={prefs.avatar} size={56} style={{marginBottom:2}} />
            <div style={{maxWidth:'75%', display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
              <div style={{fontSize:10, color:S.colors.textTertiary, marginBottom:3, display:'flex', alignItems:'center', gap:4}}>
                <span>Tu</span>
                <span style={{display:'inline-block', width:6, height:6, borderRadius:3, background:S.colors.accent3,
                  animation:'vtPulse 1.2s infinite ease-in-out'}} />
                <span style={{color:S.colors.accent3, fontSize:9, fontWeight:600}}>LIVE</span>
              </div>
              <div style={{...S.bubble, ...S.bubbleMine, border:`1px solid ${S.colors.accent3Border}`}}>
                <div style={{fontSize:14, fontWeight:500, lineHeight:1.5, color:S.colors.textPrimary}}>
                  {streamingMsg.original}
                </div>
                {streamingMsg.translated ? (
                  <div style={{fontSize:12, color:S.colors.textSecondary, marginTop:4, lineHeight:1.4,
                    borderTop:`1px solid ${S.colors.dividerColor}`, paddingTop:4}}>
                    {streamingMsg.translated}
                  </div>
                ) : (
                  <div style={{fontSize:11, color:S.colors.textMuted, marginTop:4, fontStyle:'italic'}}>
                    {L('translating')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Partner speaking/typing indicator */}
        {(partnerSpeaking || partnerTyping) && (
          <div style={{display:'flex', flexDirection:'column', gap:4, padding:'6px 10px',
            margin:'4px 0 8px', borderRadius:14, background:S.colors.accent3Bg,
            border:`1px solid ${S.colors.accent3Border}`}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={S.speakingDots}>
                <span style={{...S.dot, animationDelay:'0s'}}/>
                <span style={{...S.dot, animationDelay:'0.2s'}}/>
                <span style={{...S.dot, animationDelay:'0.4s'}}/>
              </div>
              <span style={{fontSize:12, color:S.colors.accent3}}>
                {partner?.name} {partnerSpeaking ? '\u{1F399}\uFE0F' : '\u{2328}\uFE0F'}...
              </span>
            </div>
            {partnerLiveText && (
              <div style={{fontSize:13, color:S.colors.textSecondary, padding:'4px 8px',
                background:S.colors.overlayBg, borderRadius:10, lineHeight:1.4,
                fontStyle:'italic', maxHeight:60, overflow:'hidden'}}>
                {partnerLiveText}
              </div>
            )}
          </div>
        )}
        <div ref={msgsEndRef} />
      </div>

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
              {partner?.name} {partnerSpeaking ? '\u{1F399}\uFE0F' : '\u{2328}\uFE0F'}
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
          {sendingText ? '...' : '\u{27A4}'}
        </button>
      </div>

      {/* Talk bar */}
      <div style={S.talkBar} role="toolbar" aria-label="Voice controls">
        {status && <div style={{fontSize:11, color:S.colors.accent3, marginBottom:4}}>{status}</div>}
        <div style={{fontSize:9, color:S.colors.textTertiary, marginBottom:4, textTransform:'uppercase', letterSpacing:1}}>
          {modeInfo.icon} {L(modeInfo.nameKey)}
          {(roomMode === 'freetalk' || roomMode === 'simultaneous') && isListening && (
            <span style={{color:S.colors.statusOk, marginLeft:6}}>{'\u{1F7E2}'} LIVE</span>
          )}
        </div>

        {(roomMode === 'conversation' || roomMode === 'classroom') && canTalk && (
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            {recording && (
              <button onClick={() => { vibrate(15); cancelRecording(); }}
                title="Annulla"
                aria-label={L('cancel') || 'Cancel recording'}
                style={{width:44, height:44, borderRadius:'50%', border:`2px solid ${S.colors.statusError}`,
                  background:S.colors.accent3Bg, color:S.colors.statusError, fontSize:18,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
                  boxShadow:`0 0 12px ${S.colors.statusError}33`}}>
                {'\u2716'}
              </button>
            )}
            <button onClick={() => { vibrate(25); toggleRecording(); }}
              aria-label={recording ? (L('stopRecording') || 'Stop recording') : (L('startRecording') || 'Start recording')}
              style={{...S.talkBtn, ...(recording ? S.talkBtnRec : {}),
                ...(recording ? {animation:'vtRecordPulse 1.5s ease-in-out infinite'} : {})}}>
              {recording ? '\u{23F9}\uFE0F' : '\u{1F399}\uFE0F'}
            </button>
          </div>
        )}

        {roomMode === 'classroom' && !canTalk && (
          <div style={{color:S.colors.textMuted, fontSize:11, padding:8}}>
            {'\u{1F512}'} {L('classroomDesc')}
          </div>
        )}

        {(roomMode === 'freetalk' || roomMode === 'simultaneous') && (
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            {recording && (
              <button onClick={() => { vibrate(15); cancelRecording(); }}
                title="Annulla"
                aria-label={L('cancel') || 'Cancel recording'}
                style={{width:44, height:44, borderRadius:'50%', border:`2px solid ${S.colors.statusError}`,
                  background:S.colors.accent3Bg, color:S.colors.statusError, fontSize:18,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
                  boxShadow:`0 0 12px ${S.colors.statusError}33`}}>
                {'\u2716'}
              </button>
            )}
            {/* VAD Audio Level Bar */}
            {isListening && typeof vadAudioLevel === 'number' && (
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:40}}
                role="meter" aria-label="Microphone level" aria-valuenow={Math.round(vadAudioLevel * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div style={{width:6, height:36, borderRadius:3, background:S.colors.overlayBg || 'rgba(255,255,255,0.1)',
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
            <button onClick={() => { vibrate(25); isListening ? stopFreeTalk() : startFreeTalk(); }}
              aria-label={isListening ? (L('stopFreeTalk') || 'Stop free talk') : (L('startFreeTalk') || 'Start free talk')}
              style={{...S.talkBtn, ...(isListening ? S.talkBtnRec : {}),
                ...(recording ? {boxShadow:`0 0 0 8px ${S.colors.accent3Bg}, 0 0 0 18px ${S.colors.accent3Bg}33`} : {}),
                ...(roomMode === 'simultaneous' && isListening ? {background:S.colors.btnGradient,
                  boxShadow:`0 0 0 8px ${S.colors.accent3Bg}, 0 0 0 18px ${S.colors.accent3Bg}33`} : {})}}>
              {isListening ? (recording ? '\u{1F534}' : '\u{26A1}') : '\u{1F399}\uFE0F'}
            </button>
          </div>
        )}
        {/* VAD Sensitivity selector — shown in FreeTalk/Simultaneous modes */}
        {(roomMode === 'freetalk' || roomMode === 'simultaneous') && !isListening && (
          <div style={{display:'flex', alignItems:'center', gap:4, marginTop:4}}>
            <span style={{fontSize:8, color:S.colors.textMuted, marginRight:2}}>{'\u{1F399}'} Sensibilit\u00E0:</span>
            {[
              { id: 'quiet', label: '\u{1F910} Silenzio', short: 'Silenzio' },
              { id: 'normal', label: '\u{1F3E0} Normale', short: 'Normale' },
              { id: 'noisy', label: '\u{1F4E2} Rumore', short: 'Rumore' },
              { id: 'street', label: '\u{1F6A6} Strada', short: 'Strada' },
            ].map(p => (
              <button key={p.id} onClick={() => setVadSensitivity(p.id)}
                style={{padding:'2px 6px', borderRadius:6, fontSize:8, fontWeight:600,
                  border: vadSensitivity === p.id ? `1px solid ${S.colors.accent3Border}` : `1px solid ${S.colors.overlayBorder}`,
                  background: vadSensitivity === p.id ? S.colors.accent3Bg : 'transparent',
                  color: vadSensitivity === p.id ? S.colors.accent3 : S.colors.textMuted,
                  cursor:'pointer', WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
                  fontFamily:FONT}}>
                {p.short}
              </button>
            ))}
          </div>
        )}

        {isTrial && isHost && (
          <button onClick={() => { endChatAndSave(); setTimeout(() => setView('account'), 300); }}
            style={{marginTop:4, padding:'4px 14px', borderRadius:10, border:`1px solid ${S.colors.accent3Border}`,
              background:S.colors.accent3Bg, color:S.colors.textMuted, fontSize:10,
              cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent'}}>
            {'\u2728'} {L('upgradeToPro')}
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
