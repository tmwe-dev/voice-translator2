'use client';
import { memo, useState } from 'react';
import { LANGS, FONT, getLang, FREE_DAILY_LIMIT } from '../lib/constants.js';
import ConnectionQuality from './ConnectionQuality.js';
import { TaxiButton } from './TaxiMode.js';
import { IconBack, IconCamera, IconVolume, IconVolumeOff, IconSettings, IconCheck,
  IconClipboard, IconMusic, IconArchive, IconBattery, IconSwap, IconChevronDown, IconBrainAI } from './Icons.js';

const RoomHeader = memo(function RoomHeader({
  L, S, myLang, myL, otherL, otherMembers, partner,
  showLangPicker, setShowLangPicker, handleLangChange,
  audioEnabled, setAudioEnabled, unlockAudio,
  webrtc, partnerConnected, realtimeConnected,
  showVideoCall, setShowVideoCall, videoFullscreen, setVideoFullscreen,
  setShowVoiceCall,
  showCaptions, setShowCaptions,
  exportConversation,
  messages, setShowChatActions,
  duckingLevel, setDuckingLevel,
  isTrial, freeCharsUsed, freeLimitExceeded, freeResetTime,
  endChatAndSave, leaveRoomTemporary,
  taxiVisible, setTaxiVisible, setTaxiData, myName,
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <>
      {/* ═══ Header ═══ */}
      <div style={{...S.roomHeader, position:'relative', flexWrap:'nowrap', gap:4, padding:'6px 8px'}} role="banner">
        {/* ── Left: Back button ── */}
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

        {/* ── Center: Language flags ── */}
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
                webrtc.initiateConnection(false);
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
          {/* Taxi Mode toggle */}
          {setTaxiVisible && (
            <TaxiButton
              onClick={() => {
                const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
                if (lastMsg) {
                  const original = lastMsg.original || '';
                  const translated = lastMsg.translated || '';
                  const fromLang = lastMsg.sourceLang || myLang;
                  const toLang = lastMsg.targetLang || 'en';
                  if (setTaxiData) setTaxiData({ original, translated, fromLang, toLang });
                }
                setTaxiVisible(true);
              }}
              S={S}
            />
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
                {/* Connection quality */}
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
                {/* Chat AI Actions */}
                {messages.length >= 3 && (
                  <button onClick={() => { setShowChatActions(true); setShowMoreMenu(false); }}
                    style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px',
                      background:'none', border:'none', cursor:'pointer', borderRadius:8, color:S.colors.textPrimary,
                      fontSize:13, fontWeight:500, textAlign:'left'}}>
                    <span style={{fontSize:15, width:24, textAlign:'center'}}><IconBrainAI size={15}/></span>
                    <span>AI Actions</span>
                  </button>
                )}
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
                      <div style={{marginTop:6, height:4, borderRadius:2, background:`${S.colors.overlayBorder}`,
                        overflow:'hidden'}}>
                        <div style={{height:'100%', borderRadius:2, width:`${remaining}%`,
                          background:battColor, transition:'width 0.5s ease'}} />
                      </div>
                      <div style={{fontSize:9, color:S.colors.textMuted, marginTop:4}}>
                        {Math.round(freeCharsUsed/1000)}K / {FREE_DAILY_LIMIT/1000}K caratteri
                        {freeResetTime && ` • Reset: ${freeResetTime}`}
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
      {showLangPicker && (
        <div onClick={() => setShowLangPicker(false)}
          style={{position:'fixed', inset:0, zIndex:99, background:'transparent'}} />
      )}
    </>
  );
});

export default RoomHeader;
