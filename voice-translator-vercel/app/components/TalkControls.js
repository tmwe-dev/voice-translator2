'use client';
import { memo, useState } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import { IconMic, IconStop, IconRecord, IconLock, IconSparkles, IconHandRaise } from './Icons.js';

const TalkControls = memo(function TalkControls({
  L, S, roomMode, roomId, isHost, canTalk, modeInfo, isTrial,
  recording, isListening,
  toggleRecording, cancelRecording, startFreeTalk, stopFreeTalk,
  vadAudioLevel, vadSilenceCountdown, vadSensitivity, setVadSensitivity,
  liveMode, setLiveModeState, setLiveMode,
  status, webrtc, myName, roomInfo,
  endChatAndSave, setView,
}) {
  const [handRaising, setHandRaising] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [grantingSpeak, setGrantingSpeak] = useState(null);

  return (
    <div style={S.talkBar} role="toolbar" aria-label="Voice controls">
      {status && <div style={{fontSize:12, color:S.colors.accent3, marginBottom:6, fontWeight:500}}>{status}</div>}

      {(roomMode === 'conversation' || roomMode === 'classroom') && canTalk && (
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
          {/* MAIN record button */}
          <button onClick={() => { vibrate(25); toggleRecording(); }}
            aria-label={recording ? 'Stop' : 'Registra'}
            style={{...S.talkBtn, width:72, height:72, fontSize:30,
              ...(recording ? {...S.talkBtnRec, animation:'vtRecordPulse 1.5s ease-in-out infinite'} : {})}}>
            {recording ? <IconStop size={28}/> : <IconMic size={28}/>}
          </button>
        </div>
      )}

      {roomMode === 'classroom' && !canTalk && (
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:10}}>
          <button
            disabled={handRaising || handRaised}
            onClick={async () => {
              setHandRaising(true);
              const body = {
                action: 'raiseHand', roomId,
                raised: true,
                roomSessionToken: webrtc?.roomSessionTokenRef?.current || null,
                name: myName,
              };
              try {
                const res = await fetch('/api/room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                if (res.ok) {
                  vibrate(15);
                  setHandRaised(true);
                } else {
                  console.warn('[TalkControls] raiseHand server error:', res.status);
                }
              } catch (err) {
                console.error('[TalkControls] raiseHand failed:', err);
              } finally {
                setHandRaising(false);
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 14,
              background: handRaised ? 'rgba(34,197,94,0.15)' : 'rgba(255,165,0,0.15)',
              border: handRaised ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,165,0,0.3)',
              color: handRaised ? '#22c55e' : '#FFA500',
              fontSize: 14, fontWeight: 600, cursor: handRaised ? 'default' : 'pointer',
              fontFamily: FONT, transition: 'all 0.2s',
              opacity: handRaising ? 0.6 : 1,
            }}
          >
            <IconHandRaise size={18} /> {handRaising ? '...' : handRaised ? '✓ Mano alzata' : 'Alza la mano'}
          </button>
          <span style={{ color: S.colors.textMuted, fontSize: 12 }}>
            <IconLock size={12} /> In attesa del permesso
          </span>
        </div>
      )}
      {/* Host: show who raised hands */}
      {roomMode === 'classroom' && isHost && roomInfo?.members?.some(m => m.handRaised) && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 14px',
          background: 'rgba(255,165,0,0.08)', borderRadius: 12, margin: '0 10px 6px',
        }}>
          <span style={{ fontSize: 12, color: '#FFA500', fontWeight: 600 }}>{'\u270B'} Mani alzate:</span>
          {roomInfo.members.filter(m => m.handRaised).map(m => (
            <button key={m.name}
              disabled={grantingSpeak === m.name}
              onClick={async () => {
                setGrantingSpeak(m.name);
                const body = {
                  action: 'grantSpeak', roomId,
                  targetMember: m.name,
                  roomSessionToken: webrtc?.roomSessionTokenRef?.current || null,
                  name: myName,
                };
                try {
                  const res = await fetch('/api/room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                  if (res.ok) vibrate(15);
                  else console.warn('[TalkControls] grantSpeak server error:', res.status);
                } catch (err) {
                  console.error('[TalkControls] grantSpeak failed:', err);
                } finally {
                  setGrantingSpeak(null);
                }
              }}
              style={{
                padding: '3px 10px', borderRadius: 8,
                background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                color: '#22c55e', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              {'\u2713'} {m.name}
            </button>
          ))}
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
          {/* MAIN free talk button */}
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

      {/* Mode label + VAD sensitivity */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:6, flexWrap:'wrap'}}>
        <span style={{fontSize:10, color:S.colors.textTertiary, fontWeight:500}}>
          {modeInfo.icon} {L(modeInfo.nameKey)}
          {(roomMode === 'freetalk' || roomMode === 'simultaneous') && isListening && (
            <span style={{color:S.colors.statusOk, marginLeft:4}}>LIVE</span>
          )}
        </span>
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
  );
});

export default TalkControls;
