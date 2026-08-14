'use client';
import BarraLivelloMicrofono from './BarraLivelloMicrofono.js';
import { memo, useState } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import { IconMic, IconRecord, IconLock, IconSparkles, IconHandRaise, IconSend, IconWaveform } from './Icons.js';
import { PALETTE } from '../lib/palette.js';

const TalkControls = memo(function TalkControls({
  L, S, roomMode, roomId, isHost, canTalk, modeInfo, isTrial,
  recording, isListening,
  toggleRecording, cancelRecording, startFreeTalk, stopFreeTalk,
  vadLivelloRef, vadSilenceCountdown, vadSensitivity, setVadSensitivity,
  liveMode, setLiveModeState, setLiveMode,
  status, webrtc, myName, roomInfo,
  endChatAndSave, setView,
}) {
  const [handRaising, setHandRaising] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [grantingSpeak, setGrantingSpeak] = useState(null);

  return (
    <div style={S.talkBar} role="toolbar" aria-label={L('voiceControls')}>
      {status && <div style={{fontSize:12, color:S.colors.accent3, marginBottom:6, fontWeight:500}}>{status}</div>}

      {(roomMode === 'conversation' || roomMode === 'classroom') && canTalk && (
        <>
        {/* ═══ INIZIO b.129 — un gesto solo, e si capisce cosa fa ═══
            PRIMA: tre pulsanti, tre colori, etichette da 7 pixel.
              · ANNULLA compariva solo mentre registravi → la fila si
                spostava sotto il dito a meta gesto;
              · RUMORE con un'onda: nessuno sa se accende il rumore o lo
                toglie. E comunque e un'impostazione, non un gesto da
                fare mentre si parla — spostata nel menu, dove sta il
                resto delle preferenze;
              · nessun segnale che stesse davvero ascoltando: premevi e
                speravi.
            ORA: un tasto grande, due stati, un contatore che si muove.
            Il posto dell'ANNULLA e sempre occupato, cosi niente salta.
            Due colori: neutro a riposo, accento mentre registra. */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:20, padding:'4px 0'}}>
          {/* Slot ANNULLA — larghezza riservata anche da fermo: la fila non si muove */}
          <div style={{width:56, display:'flex', justifyContent:'center'}}>
            {recording && (
              <button onClick={() => { vibrate(15); cancelRecording(); }}
                aria-label={L('cancelRecording')}
                style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
                  width:52, height:52, borderRadius:26,
                  border:'none', background:S.colors.overlayBg, color:S.colors.textMuted,
                  cursor:'pointer', WebkitTapHighlightColor:'transparent', transition:'background 0.15s'}}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                <span style={{fontSize:10, fontWeight:600, letterSpacing:0.2}}>{L('cancelWord')}</span>
              </button>
            )}
          </div>

          {/* Il gesto principale */}
          <button onClick={() => { vibrate(25); toggleRecording(); }}
            aria-label={recording ? L('sendVoiceMessage') : L('holdToSpeak')}
            style={{...S.talkBtn, width:84, height:84, borderRadius:42,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
              border:'none', cursor:'pointer', WebkitTapHighlightColor:'transparent',
              transition:'background 0.2s',
              ...(recording ? {
                background: S.colors.accent4Bg,
                color: S.colors.textPrimary,
                animation:'vtRecordPulse 1.5s ease-in-out infinite',
              } : {
                background: S.colors.overlayBg,
                color: S.colors.textPrimary,
              })}}>
            {recording ? <IconSend size={26}/> : <IconMic size={30}/>}
            <span style={{fontSize:11, fontWeight:600, letterSpacing:0.2}}>
              {recording ? L('sendBtn') : L('talkBtn')}
            </span>
          </button>

          {/* Slot simmetrico: tiene il microfono al centro esatto */}
          <div style={{width:56}} aria-hidden="true" />
        </div>

        {/* La riga che mancava: mentre registra, si vede che sta ascoltando.
            Senza, l'unico modo di sapere se il tasto aveva funzionato era
            parlare e sperare. */}
        {recording && (
          <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontSize:12, color:S.colors.textMuted, marginTop:6}} aria-live="polite">
            <span style={{width:7, height:7, borderRadius:4, background:S.colors.textPrimary,
              animation:'vtRecordPulse 1.2s ease-in-out infinite'}} />
            <span>{L('listeningTapSend')}</span>
          </div>
        )}
        {/* La riduzione rumore, con le PAROLE.
            Prima era un quadrato con un'onda e la scritta "RUMORE" da 7
            pixel: nessuno poteva sapere se accendeva il rumore o lo
            toglieva. Ora dice cosa fa, e sta sotto — e una preferenza,
            non un gesto da fare mentre si parla. */}
        {!recording && (
          <button onClick={async () => {
            const next = !liveMode;
            setLiveModeState(next);
            if (setLiveMode) await setLiveMode(next);
            vibrate(15);
          }}
            aria-pressed={liveMode}
            style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              margin:'8px auto 0', padding:'6px 14px', borderRadius:16,
              background: liveMode ? S.colors.accent4Bg : 'transparent',
              color: liveMode ? S.colors.textPrimary : S.colors.textMuted,
              border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
              WebkitTapHighlightColor:'transparent', transition:'background 0.15s, color 0.15s'}}>
            <span style={{width:8, height:8, borderRadius:4,
              background: liveMode ? 'currentColor' : 'transparent',
              border:`1.5px solid currentColor`, transition:'background 0.15s'}} />
            <span>{liveMode ? L('noiseReductionOn') : L('noiseReduction')}</span>
          </button>
        )}
        {/* ═══ FINE b.129 ═══ */}
        </>
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
              color: handRaised ? PALETTE.green : '#FFA500',
              fontSize: 14, fontWeight: 600, cursor: handRaised ? 'default' : 'pointer',
              fontFamily: FONT, transition: 'all 0.2s',
              opacity: handRaising ? 0.6 : 1,
            }}
          >
            <IconHandRaise size={18} /> {handRaising ? '...' : handRaised ? `✓ ${L('handRaised')}` : L('raiseHand')}
          </button>
          <span style={{ color: S.colors.textMuted, fontSize: 12 }}>
            <IconLock size={12} /> {L('waitingPermission')}
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
                color: PALETTE.green, fontSize: 12, fontWeight: 600, cursor: 'pointer',
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
              title={L('cancelRecording')}
              style={{display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                width:52, height:52, borderRadius:14, border:`2px solid ${S.colors.statusError}`,
                background:'rgba(239,68,68,0.1)', color:S.colors.statusError,
                cursor:'pointer', justifyContent:'center',
                WebkitTapHighlightColor:'transparent', transition:'all 0.2s'}}>
              <span style={{fontSize:20}}>{'\u2716'}</span>
              <span style={{fontSize:7, fontWeight:700}}>{L('cancelWord').toUpperCase()}</span>
            </button>
          )}
          {/* VAD Audio Level Bar */}
          {isListening && (
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:40}}>
              {/* b.108 — la barretta si disegna da sola leggendo un
                  riferimento: il livello non passa piu da React, quindi
                  non ridisegna la stanza sessanta volte al secondo. */}
              <BarraLivelloMicrofono livelloRef={vadLivelloRef} attiva={isListening} C={S.colors} />
              {vadSilenceCountdown !== null && vadSilenceCountdown > 0 && (
                <span style={{fontSize:9, color:S.colors.accent3, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>
                  {vadSilenceCountdown}s
                </span>
              )}
            </div>
          )}
          {/* MAIN free talk button */}
          <button onClick={() => { vibrate(25); isListening ? stopFreeTalk() : startFreeTalk(); }}
            aria-label={isListening ? L('stopWord') : L('startListeningAria')}
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

      {/* Non esiste nessun piano "Pro": esistono ricariche di minuti.
          Prima questo tasto prometteva un abbonamento e portava al profilo. */}
      {isTrial && isHost && (
        <button onClick={() => { endChatAndSave(); setTimeout(() => setView('credits'), 300); }}
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
