'use client';
import { memo, useState } from 'react';
import { LANGS, MODES, CONTEXTS, FONT, getLang, vibrate, FREE_DAILY_LIMIT, AVATARS } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';

const RoomView = memo(function RoomView({ L, S, prefs, myLang, roomId, roomInfo, messages, streamingMsg,
  recording, isListening, partnerConnected, partnerSpeaking, partnerLiveText, partnerTyping,
  playingMsgId, audioEnabled, setAudioEnabled, isTrial, isTopPro, showModeSelector,
  setShowModeSelector, textInput, setTextInput, sendingText, sendTextMessage, sendTypingState,
  toggleRecording, startFreeTalk, stopFreeTalk, endChatAndSave, changeRoomMode, playMessage,
  unlockAudio, exportConversation, status, msgsEndRef,
  freeCharsUsed, freeLimitExceeded, freeResetTime, setView, setMyLang, savePrefs, theme, setTheme }) {

  const [showLangPicker, setShowLangPicker] = useState(false);

  const partner = roomInfo?.members?.find(m => m.name !== prefs.name);
  const myL = getLang(myLang);
  const otherL = partner ? getLang(partner.lang) : getLang('en');
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
              outline: showLangPicker ? '2px solid rgba(78,205,196,0.5)' : 'none'}}>
            {myL.flag}
          </button>
          <span style={{color:'rgba(255,255,255,0.55)', fontSize:16}}>{'\u21C4'}</span>
          <span style={{fontSize:18}}>{otherL.flag}</span>
        </div>
        <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:6}}>
          <button onClick={() => { if (!audioEnabled) unlockAudio(); setAudioEnabled(!audioEnabled); }}
            style={{...S.iconBtn, display:'flex', alignItems:'center', gap:3, width:'auto', padding:'0 8px',
              color: audioEnabled ? '#4ecdc4' : '#ff6b6b',
              background: audioEnabled ? 'rgba(78,205,196,0.08)' : 'rgba(255,107,107,0.08)',
              border: audioEnabled ? '1px solid rgba(78,205,196,0.2)' : '1px solid rgba(255,107,107,0.2)'}}>
            <span style={{fontSize:13}}>{audioEnabled ? '\u{1F50A}' : '\u{1F512}'}</span>
            <span style={{fontSize:9, fontWeight:600}}>{audioEnabled ? 'AUTO' : 'PRIVACY'}</span>
          </button>
          <button onClick={exportConversation} title={L('exportConversation')}
            style={{...S.iconBtn, width:32, fontSize:13, background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.06)'}}>
            {'\u{1F4CB}'}
          </button>
          {/* FREE tier battery indicator */}
          {isTrial && (() => {
            const pct = Math.min(100, (freeCharsUsed / FREE_DAILY_LIMIT) * 100);
            const remaining = 100 - pct;
            const battColor = freeLimitExceeded ? '#ff4444'
              : remaining <= 20 ? '#ff4444'
              : remaining <= 50 ? '#ffaa00'
              : '#44dd66';
            const battGlow = freeLimitExceeded ? '0 0 6px rgba(255,68,68,0.5)'
              : remaining <= 20 ? '0 0 6px rgba(255,68,68,0.4)'
              : remaining <= 50 ? '0 0 4px rgba(255,170,0,0.3)'
              : '0 0 4px rgba(68,221,102,0.3)';
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
                  position:'relative', overflow:'hidden'
                }}>
                  {/* Fill level (inverted: full = green = lots remaining) */}
                  <div style={{
                    width: `${remaining}%`, height:'100%', borderRadius:1.5,
                    background: `linear-gradient(90deg, ${battColor}cc, ${battColor})`,
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
            background:partnerConnected ? '#4ecdc4' : '#ff6b6b'}} />
        </div>
      </div>

      {/* Language picker dropdown */}
      {showLangPicker && (
        <div style={{position:'absolute', top:48, left:'50%', transform:'translateX(-50%)', zIndex:100,
          background: theme === 'dark' ? '#1a1a2e' : '#fff',
          border: theme === 'dark' ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.15)',
          borderRadius:14, padding:'6px 0', maxHeight:280, overflowY:'auto', width:200,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => handleLangChange(l.code)}
              style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 14px',
                background: l.code === myLang ? (theme === 'dark' ? 'rgba(78,205,196,0.15)' : 'rgba(78,205,196,0.1)') : 'transparent',
                border:'none', cursor:'pointer', fontFamily:FONT, fontSize:13,
                color: theme === 'dark' ? '#fff' : '#333',
                transition:'background 0.1s'}}>
              <span style={{fontSize:18}}>{l.flag}</span>
              <span>{l.name}</span>
              {l.code === myLang && <span style={{marginLeft:'auto', color:'#4ecdc4', fontSize:14}}>{'\u2713'}</span>}
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
      <div style={{padding:'5px 12px', background:'rgba(255,255,255,0.02)',
        borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center',
        justifyContent:'space-between', flexShrink:0}}>
        <button onClick={() => isHost && setShowModeSelector(!showModeSelector)}
          style={{background:'none', border:'none', padding:0, cursor:isHost ? 'pointer' : 'default',
            display:'flex', alignItems:'center', gap:4, WebkitTapHighlightColor:'transparent'}}>
          <span style={{fontSize:11, color:'rgba(255,255,255,0.45)'}}>
            {modeInfo.icon} {L(modeInfo.nameKey)}
            {roomCtx.id !== 'general' && <span style={{marginLeft:4}}>{roomCtx.icon} {L(roomCtx.nameKey)}</span>}
          </span>
          {isHost && <span style={{fontSize:9, color:'rgba(255,255,255,0.25)'}}>{'\u25BC'}</span>}
          {!isHost && roomMode === 'classroom' && (
            <span style={{fontSize:10, color:'rgba(255,255,255,0.55)'}}>
              {' \u2022 '}{roomInfo?.host || 'Host'} presenta
            </span>
          )}
        </button>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          {isHost && (
            <span style={{fontSize:8, fontWeight:700, letterSpacing:0.5, padding:'2px 6px', borderRadius:6,
              background: isTrial ? 'rgba(78,205,196,0.15)' : isTopPro ? 'rgba(255,215,0,0.15)' : 'rgba(245,87,108,0.15)',
              color: isTrial ? '#4ecdc4' : isTopPro ? '#ffd700' : '#f5576c',
              border: `1px solid ${isTrial ? 'rgba(78,205,196,0.25)' : isTopPro ? 'rgba(255,215,0,0.25)' : 'rgba(245,87,108,0.25)'}`}}>
              {isTrial ? 'FREE' : isTopPro ? 'TOP PRO' : 'PRO'}
            </span>
          )}
          {isHost && !isTrial && (
            <>
              <span style={{fontSize:10, color:'rgba(255,255,255,0.55)', fontFamily:'monospace'}}>
                ${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(3)}
              </span>
              <span style={{fontSize:9, color:'rgba(255,255,255,0.2)'}}>
                {msgCount} msg
              </span>
            </>
          )}
        </div>
      </div>

      {/* Mode selector dropdown */}
      {showModeSelector && isHost && (
        <div style={{padding:'8px 12px', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(10px)',
          borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0}}>
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

      {/* Voice engine + AI info bar */}
      <div style={{padding:'3px 12px', background:'rgba(108,99,255,0.04)',
        borderBottom:'1px solid rgba(255,255,255,0.04)', display:'flex', alignItems:'center',
        justifyContent:'space-between', flexShrink:0, gap:6}}>
        <div style={{display:'flex', alignItems:'center', gap:6, minWidth:0}}>
          <span style={{fontSize:9, color:'rgba(255,255,255,0.58)', fontWeight:600, whiteSpace:'nowrap'}}>
            {isTrial ? '\u{1F50A} Browser Voice' : isTopPro ? '\u{1F3A4} ElevenLabs' : `\u{1F3A4} OpenAI`}
          </span>
          {!isTrial && (
            <span style={{fontSize:9, color:'rgba(255,255,255,0.50)', fontWeight:500,
              padding:'1px 5px', borderRadius:4, background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.06)', whiteSpace:'nowrap'}}>
              {isTopPro ? 'Multilingual v2' : (prefs.voice || 'nova')}
            </span>
          )}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <span style={{fontSize:9, color:'rgba(255,255,255,0.50)', whiteSpace:'nowrap'}}>
            {isTrial ? 'AI: Free API' : `AI: ${(prefs?.aiModel || 'gpt-4o-mini').toUpperCase()}`}
          </span>
          {!audioEnabled && (
            <span style={{fontSize:8, fontWeight:700, padding:'1px 4px', borderRadius:3,
              background:'rgba(255,107,107,0.12)', color:'#ff6b6b', border:'1px solid rgba(255,107,107,0.2)'}}>
              MUTED
            </span>
          )}
        </div>
      </div>

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
          <div style={{textAlign:'center', color:'rgba(255,255,255,0.25)', marginTop:60, fontSize:13, lineHeight:1.6}}>
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
          return (
            <div key={m.id || i} style={{display:'flex', gap:8,
              flexDirection:isMine ? 'row-reverse' : 'row', marginBottom:12, alignItems:'flex-end'}}>
              <AvatarImg src={isMine ? prefs.avatar : (partner?.avatar || AVATARS[0])} size={36} style={{marginBottom:2}} />
              <div style={{maxWidth:'75%', display:'flex', flexDirection:'column',
                alignItems:isMine ? 'flex-end' : 'flex-start'}}>
                <div style={{fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:3}}>
                  {isMine ? 'Tu' : m.sender}
                </div>
                <div style={{...S.bubble, ...(isMine ? S.bubbleMine : S.bubbleOther)}}>
                  <div style={{fontSize:14, fontWeight:500, lineHeight:1.5, color:'rgba(255,255,255,0.95)'}}>
                    {isMine ? m.original : m.translated}
                  </div>
                  <div style={{fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:4, lineHeight:1.4}}>
                    {isMine ? m.translated : m.original}
                  </div>
                </div>
                <button onClick={() => playMessage(m)}
                  style={{marginTop:2, padding:'2px 8px', borderRadius:8,
                    background:'transparent', border:'none', color:'rgba(255,255,255,0.35)',
                    fontSize:11, cursor:'pointer', WebkitTapHighlightColor:'transparent'}}>
                  {playingMsgId === m.id ? '\u{1F50A}' : '\u{25B6}\uFE0F'}
                </button>
              </div>
            </div>
          );
        })}
        {/* Streaming live bubble */}
        {streamingMsg && streamingMsg.original && (
          <div style={{display:'flex', gap:8, flexDirection:'row-reverse', marginBottom:12, alignItems:'flex-end'}}>
            <AvatarImg src={prefs.avatar} size={36} style={{marginBottom:2}} />
            <div style={{maxWidth:'75%', display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
              <div style={{fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:3, display:'flex', alignItems:'center', gap:4}}>
                <span>Tu</span>
                <span style={{display:'inline-block', width:6, height:6, borderRadius:3, background:'#f5576c',
                  animation:'vtPulse 1.2s infinite ease-in-out'}} />
                <span style={{color:'#f5576c', fontSize:9, fontWeight:600}}>LIVE</span>
              </div>
              <div style={{...S.bubble, ...S.bubbleMine, border:'1px solid rgba(245,87,108,0.2)'}}>
                <div style={{fontSize:14, fontWeight:500, lineHeight:1.5, color:'rgba(255,255,255,0.95)'}}>
                  {streamingMsg.original}
                </div>
                {streamingMsg.translated ? (
                  <div style={{fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:4, lineHeight:1.4,
                    borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:4}}>
                    {streamingMsg.translated}
                  </div>
                ) : (
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:4, fontStyle:'italic'}}>
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
            margin:'4px 0 8px', borderRadius:14, background:'rgba(245,87,108,0.06)',
            border:'1px solid rgba(245,87,108,0.1)'}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={S.speakingDots}>
                <span style={{...S.dot, animationDelay:'0s'}}/>
                <span style={{...S.dot, animationDelay:'0.2s'}}/>
                <span style={{...S.dot, animationDelay:'0.4s'}}/>
              </div>
              <span style={{fontSize:12, color:'#f5576c'}}>
                {partner?.name} {partnerSpeaking ? '\u{1F399}\uFE0F' : '\u{2328}\uFE0F'}...
              </span>
            </div>
            {partnerLiveText && (
              <div style={{fontSize:13, color:'rgba(255,255,255,0.65)', padding:'4px 8px',
                background:'rgba(255,255,255,0.04)', borderRadius:10, lineHeight:1.4,
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
        background:'rgba(0,0,0,0.15)', borderTop:'1px solid rgba(255,255,255,0.05)'}}>
        <input
          style={{flex:1, padding:'8px 12px', borderRadius:20, background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:14, outline:'none',
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
            background: textInput.trim() ? 'linear-gradient(135deg, #e94560, #c23152)' : 'rgba(255,255,255,0.06)',
            color: textInput.trim() ? '#fff' : 'rgba(255,255,255,0.55)',
            fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            WebkitTapHighlightColor:'transparent', transition:'all 0.2s'}}>
          {sendingText ? '...' : '\u{27A4}'}
        </button>
      </div>

      {/* Talk bar */}
      <div style={S.talkBar}>
        {status && <div style={{fontSize:11, color:'#e94560', marginBottom:4}}>{status}</div>}
        <div style={{fontSize:9, color:'rgba(255,255,255,0.55)', marginBottom:4, textTransform:'uppercase', letterSpacing:1}}>
          {modeInfo.icon} {L(modeInfo.nameKey)}
          {(roomMode === 'freetalk' || roomMode === 'simultaneous') && isListening && (
            <span style={{color:'#4ecdc4', marginLeft:6}}>{'\u{1F7E2}'} LIVE</span>
          )}
        </div>

        {(roomMode === 'conversation' || roomMode === 'classroom') && canTalk && (
          <button onClick={() => { vibrate(25); toggleRecording(); }}
            style={{...S.talkBtn, ...(recording ? S.talkBtnRec : {})}}>
            {recording ? '\u{23F9}\uFE0F' : '\u{1F399}\uFE0F'}
          </button>
        )}

        {roomMode === 'classroom' && !canTalk && (
          <div style={{color:'rgba(255,255,255,0.25)', fontSize:11, padding:8}}>
            {'\u{1F512}'} {L('classroomDesc')}
          </div>
        )}

        {(roomMode === 'freetalk' || roomMode === 'simultaneous') && (
          <button onClick={() => { vibrate(25); isListening ? stopFreeTalk() : startFreeTalk(); }}
            style={{...S.talkBtn, ...(isListening ? S.talkBtnRec : {}),
              ...(recording ? {boxShadow:'0 0 0 8px rgba(233,69,96,0.15), 0 0 0 18px rgba(233,69,96,0.06)'} : {}),
              ...(roomMode === 'simultaneous' && isListening ? {background:'linear-gradient(135deg, #e94560, #ff6b35)',
                boxShadow:'0 0 0 8px rgba(255,107,53,0.15), 0 0 0 18px rgba(255,107,53,0.06)'} : {})}}>
            {isListening ? (recording ? '\u{1F534}' : '\u{26A1}') : '\u{1F399}\uFE0F'}
          </button>
        )}

        {isTrial && isHost && (
          <button onClick={() => { endChatAndSave(); setTimeout(() => setView('account'), 300); }}
            style={{marginTop:4, padding:'4px 14px', borderRadius:10, border:'1px solid rgba(245,87,108,0.2)',
              background:'rgba(245,87,108,0.06)', color:'rgba(255,255,255,0.5)', fontSize:10,
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
