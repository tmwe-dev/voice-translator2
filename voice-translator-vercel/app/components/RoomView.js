'use client';
import { memo, useState } from 'react';
import { LANGS, MODES, CONTEXTS, FONT, getLang, vibrate, FREE_DAILY_LIMIT, AVATARS, AI_MODELS } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';

const RoomView = memo(function RoomView({ L, S, prefs, myLang, roomId, roomInfo, messages, streamingMsg,
  recording, isListening, partnerConnected, partnerSpeaking, partnerLiveText, partnerTyping,
  playingMsgId, audioEnabled, setAudioEnabled, isTrial, isTopPro, canUseElevenLabs,
  useOwnKeys, apiKeyInputs,
  showModeSelector,
  setShowModeSelector, textInput, setTextInput, sendingText, sendTextMessage, sendTypingState,
  toggleRecording, cancelRecording, startFreeTalk, stopFreeTalk, endChatAndSave, changeRoomMode, playMessage,
  unlockAudio, exportConversation, status, msgsEndRef,
  freeCharsUsed, freeLimitExceeded, freeResetTime, setView, setMyLang, savePrefs,
  syncLangChange, theme, setTheme }) {

  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showAiPicker, setShowAiPicker] = useState(false);

  const otherMembers = roomInfo?.members?.filter(m => m.name !== prefs.name) || [];
  const partner = otherMembers[0]; // Primary partner (for 1:1 backward compat)
  const myL = getLang(myLang);
  const otherL = partner ? getLang(partner.lang) : getLang('en');

  // Helper: get the best translation for the viewer's language from a message
  function getTranslationForMe(msg) {
    // Multi-lang: check translations object first
    if (msg.translations && msg.translations[myLang]) {
      return msg.translations[myLang];
    }
    // Backward compat: use single translated field
    return msg.translated || '';
  }

  // Helper: find avatar for a specific sender
  function getSenderAvatar(senderName) {
    const member = roomInfo?.members?.find(m => m.name === senderName);
    return member?.avatar || AVATARS[0];
  }
  const roomMode = roomInfo?.mode || 'conversation';
  const isHost = roomInfo?.host === prefs.name;
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
    setShowLangPicker(false);
  }

  return (
    <div style={S.roomPage}>
      {/* Header */}
      <div style={{...S.roomHeader, position:'relative'}}>
        <button style={S.backBtnSmall} onClick={endChatAndSave} title={L('endChat')}>{'\u2716'}</button>
        <div style={{position:'absolute', left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:8}}>
          <button onClick={() => setShowLangPicker(!showLangPicker)}
            style={{fontSize:18, background:'none', border:'none', cursor:'pointer', padding:'2px 6px',
              borderRadius:8, transition:'background 0.15s',
              outline: showLangPicker ? `2px solid ${S.colors.accent4Border}` : 'none'}}>
            {myL.flag}
          </button>
          <span style={{color:S.colors.textTertiary, fontSize:16}}>{'\u21C4'}</span>
          {otherMembers.length > 0 ? (
            <span style={{fontSize:18, display:'flex', gap:2}}>
              {[...new Set(otherMembers.map(m => getLang(m.lang).flag))].map((flag, i) => (
                <span key={i}>{flag}</span>
              ))}
            </span>
          ) : (
            <span style={{fontSize:18}}>{otherL.flag}</span>
          )}
        </div>
        <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:6}}>
          <button onClick={() => { if (!audioEnabled) unlockAudio(); setAudioEnabled(!audioEnabled); }}
            style={{...S.iconBtn, display:'flex', alignItems:'center', gap:3, width:'auto', padding:'0 8px',
              color: audioEnabled ? S.colors.statusOk : S.colors.statusError,
              background: audioEnabled ? S.colors.accent4Bg : S.colors.accent3Bg,
              border: audioEnabled ? `1px solid ${S.colors.accent4Border}` : `1px solid ${S.colors.accent3Border}`}}>
            <span style={{fontSize:13}}>{audioEnabled ? '\u{1F50A}' : '\u{1F512}'}</span>
            <span style={{fontSize:9, fontWeight:600}}>{audioEnabled ? 'AUTO' : 'PRIVACY'}</span>
          </button>
          <button onClick={exportConversation} title={L('exportConversation')}
            style={{...S.iconBtn, width:32, fontSize:13, background:S.colors.overlayBg,
              border:`1px solid ${S.colors.overlayBorder}`}}>
            {'\u{1F4CB}'}
          </button>
          {/* FREE tier battery indicator */}
          {isTrial && (() => {
            const pct = Math.min(100, (freeCharsUsed / FREE_DAILY_LIMIT) * 100);
            const remaining = 100 - pct;
            const battColor = freeLimitExceeded ? S.colors.statusError
              : remaining <= 20 ? S.colors.statusError
              : remaining <= 50 ? S.colors.statusWarning
              : S.colors.statusOk;
            const battGlow = freeLimitExceeded ? `0 0 6px ${S.colors.statusError}80`
              : remaining <= 20 ? `0 0 6px ${S.colors.statusError}66`
              : remaining <= 50 ? `0 0 4px ${S.colors.statusWarning}4d`
              : `0 0 4px ${S.colors.statusOk}4d`;
            return (
              <div title={freeLimitExceeded
                ? `${L('freeLimitReached') || 'Limite raggiunto'} — ${L('freeResetsIn') || 'Reset tra'} ${freeResetTime}`
                : `FREE: ${Math.round(freeCharsUsed/1000)}K / ${FREE_DAILY_LIMIT/1000}K`}
                style={{position:'relative', display:'flex', alignItems:'center', cursor:'default'}}>
                {/* Battery body */}
                <div style={{
                  width:26, height:14, borderRadius:3,
                  border:`1.5px solid ${battColor}`,
                  padding:1.5, display:'flex', alignItems:'stretch',
                  boxShadow: battGlow, transition:'all 0.4s ease',
                  position:'relative', overflow:'hidden', backgroundClip:'padding-box'
                }}>
                  {/* Fill level (inverted: full = green = lots remaining) */}
                  <div style={{
                    width: `${remaining}%`, height:'100%', borderRadius:1.5,
                    background: `linear-gradient(90deg, ${battColor}, ${battColor}ff)`,
                    transition:'width 0.5s ease, background 0.4s ease',
                    minWidth: remaining > 0 ? 2 : 0
                  }} />
                  {/* Animated pulse when low */}
                  {remaining <= 20 && remaining > 0 && (
                    <div style={{
                      position:'absolute', inset:0, borderRadius:1.5,
                      background: `${battColor}33`,
                      animation:'vtBattPulse 1.2s ease-in-out infinite'
                    }} />
                  )}
                </div>
                {/* Battery tip */}
                <div style={{
                  width:3, height:6, borderRadius:'0 2px 2px 0',
                  background: battColor, marginLeft:0.5,
                  opacity:0.7, transition:'background 0.4s ease'
                }} />
                {/* Percentage label below */}
                <span style={{
                  position:'absolute', top:16, left:'50%', transform:'translateX(-50%)',
                  fontSize:7, fontWeight:700, color: battColor,
                  whiteSpace:'nowrap', opacity:0.85, transition:'color 0.4s ease',
                  fontFamily:'monospace', letterSpacing:'-0.5px'
                }}>
                  {freeLimitExceeded ? '0%' : `${Math.round(remaining)}%`}
                </span>
              </div>
            );
          })()}
          <div style={{width:8, height:8, borderRadius:4,
            background:partnerConnected ? S.colors.statusOk : S.colors.statusError}} />
        </div>
      </div>

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
          {!isTrial && (
            <span style={{fontSize:8, color:S.colors.textMuted, fontWeight:500,
              padding:'1px 5px', borderRadius:4, background:S.colors.overlayBg,
              border:`1px solid ${S.colors.overlayBorder}`, whiteSpace:'nowrap'}}>
              {(prefs.voiceEngine || 'auto') === 'auto' ? 'AUTO' : (prefs.voiceEngine || '').toUpperCase()}
            </span>
          )}
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

      {/* Battery pulse animation */}
      <style>{`
        @keyframes vtBattPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>

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
          const isMine = m.sender === prefs.name;
          const translationForMe = getTranslationForMe(m);
          return (
            <div key={m.id || i} style={{display:'flex', gap:8,
              flexDirection:isMine ? 'row-reverse' : 'row', marginBottom:12, alignItems:'flex-end'}}>
              <AvatarImg src={isMine ? prefs.avatar : getSenderAvatar(m.sender)} size={56} style={{marginBottom:2}} />
              <div style={{maxWidth:'75%', display:'flex', flexDirection:'column',
                alignItems:isMine ? 'flex-end' : 'flex-start'}}>
                <div style={{fontSize:10, color:S.colors.textTertiary, marginBottom:3}}>
                  {isMine ? 'Tu' : m.sender}
                </div>
                <div style={{...S.bubble, ...(isMine ? S.bubbleMine : S.bubbleOther)}}>
                  <div style={{fontSize:14, fontWeight:500, lineHeight:1.5, color:S.colors.textPrimary}}>
                    {isMine ? m.original : translationForMe}
                  </div>
                  <div style={{fontSize:12, color:S.colors.textSecondary, marginTop:4, lineHeight:1.4}}>
                    {isMine ? translationForMe : m.original}
                  </div>
                </div>
                <button onClick={() => playMessage(m)}
                  style={{marginTop:2, padding:'2px 8px', borderRadius:8,
                    background:'transparent', border:'none', color:S.colors.textMuted,
                    fontSize:11, cursor:'pointer', WebkitTapHighlightColor:'transparent'}}>
                  {playingMsgId === m.id ? '\u{1F50A}' : '\u{25B6}\uFE0F'}
                </button>
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

      {/* Text input bar */}
      <div style={{display:'flex', gap:6, padding:'6px 10px', flexShrink:0,
        background:'rgba(0,0,0,0.15)', borderTop:`1px solid ${S.colors.overlayBorder}`}}>
        <input
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
          style={{width:38, height:38, borderRadius:'50%', border:'none', flexShrink:0,
            background: textInput.trim() ? S.colors.btnGradient : S.colors.overlayBg,
            color: textInput.trim() ? S.colors.textPrimary : S.colors.textMuted,
            fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            WebkitTapHighlightColor:'transparent', transition:'all 0.2s'}}>
          {sendingText ? '...' : '\u{27A4}'}
        </button>
      </div>

      {/* Talk bar */}
      <div style={S.talkBar}>
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
                style={{width:44, height:44, borderRadius:'50%', border:`2px solid ${S.colors.statusError}`,
                  background:S.colors.accent3Bg, color:S.colors.statusError, fontSize:18,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
                  boxShadow:`0 0 12px ${S.colors.statusError}33`}}>
                {'\u2716'}
              </button>
            )}
            <button onClick={() => { vibrate(25); toggleRecording(); }}
              style={{...S.talkBtn, ...(recording ? S.talkBtnRec : {})}}>
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
                style={{width:44, height:44, borderRadius:'50%', border:`2px solid ${S.colors.statusError}`,
                  background:S.colors.accent3Bg, color:S.colors.statusError, fontSize:18,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
                  boxShadow:`0 0 12px ${S.colors.statusError}33`}}>
                {'\u2716'}
              </button>
            )}
            <button onClick={() => { vibrate(25); isListening ? stopFreeTalk() : startFreeTalk(); }}
              style={{...S.talkBtn, ...(isListening ? S.talkBtnRec : {}),
                ...(recording ? {boxShadow:`0 0 0 8px ${S.colors.accent3Bg}, 0 0 0 18px ${S.colors.accent3Bg}33`} : {}),
                ...(roomMode === 'simultaneous' && isListening ? {background:S.colors.btnGradient,
                  boxShadow:`0 0 0 8px ${S.colors.accent3Bg}, 0 0 0 18px ${S.colors.accent3Bg}33`} : {})}}>
              {isListening ? (recording ? '\u{1F534}' : '\u{26A1}') : '\u{1F399}\uFE0F'}
            </button>
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
      `}</style>
    </div>
  );
});

export default RoomView;
