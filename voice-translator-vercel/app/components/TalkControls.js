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
  // b.248 — IL GETTONE DI STANZA ARRIVAVA DA UN POSTO CHE NON ESISTE.
  // raiseHand e grantSpeak leggevano webrtc?.roomSessionTokenRef?.current,
  // ma useWebRTC RICEVE roomSessionTokenRef come parametro e non lo espone
  // nel proprio return (vedi il return di useWebRTC.js): quel percorso era
  // sempre undefined, il ripiego `|| null` mandava roomSessionToken: null
  // a /api/room, e resolveIdentity rispondeva 401. Alzare la mano e
  // concedere la parola non funzionavano MAI. Il gettone ora arriva come
  // prop dalla catena che lo possiede gia (page.js -> RoomView), la stessa
  // che serve reazioni, moderazione e stanza video.
  roomSessionToken,
}) {
  const [handRaising, setHandRaising] = useState(false);
  const [grantingSpeak, setGrantingSpeak] = useState(null);
  // b.157 — audit dei setting: "handRaised" locale era uno stato SOLO
  // ottimistico, mai riletto dal server dopo il primo click. Se l'host
  // concedeva la parola a un ALTRO studente (grantSpeaking abbassa
  // tutte le mani, redisLua.js), quello studente restava con il
  // pulsante disabilitato e la spunta verde per sempre — non poteva
  // piu alzare la mano una seconda volta nella stessa sessione, pur
  // essendo di nuovo con la mano abbassata sul server. Ora si legge il
  // proprio membro in roomInfo, aggiornato dal polling (useRoomPolling,
  // ogni 1.5-3s) e da Realtime.
  const myHandRaised = !!roomInfo?.members?.find(m => m.name === myName)?.handRaised;

  return (
    // ═══ INIZIO b.173 — microfono-eroe, centrato (template C) ═══
    // COSA: il contenitore torna centrato e a piena larghezza: il
    // microfono e i suoi extra (riduzione rumore, modalita, sensibilita,
    // ricarica) si dispongono in colonna centrata sotto la chat, non piu
    // compressi a destra del campo di testo (v.154).
    // PERCHE: richiesta esplicita — la parte bassa "non e allineata, non
    // e messa in modo funzionale"; template C scelto: "il microfono e
    // l'eroe". Nessun gesto/handler toccato: solo allineamento.
    <div style={{...S.talkBar, alignItems:'center', flexShrink:0, width:'100%', padding:'2px 10px 0'}}
      role="toolbar" aria-label={L('voiceControls')}>
      {status && <div style={{fontSize:11, color:S.colors.accent3, marginBottom:4, fontWeight:500, textAlign:'center'}}>{status}</div>}

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
            Due colori: neutro a riposo, accento mentre registra.
            v.154 — il tasto e piu piccolo (56 invece di 84) e la fila
            e allineata a destra: sta accanto al campo di scrittura,
            non piu al centro di una barra a se stante. */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'4px 0'}}>
          {/* Slot ANNULLA — larghezza riservata anche da fermo: la fila non si muove */}
          {recording && (
            <button onClick={() => { vibrate(15); cancelRecording(); }}
              aria-label={L('cancelRecording')}
              style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                width:40, height:40, borderRadius:20,
                border:'none', background:S.colors.overlayBg, color:S.colors.textMuted,
                cursor:'pointer', WebkitTapHighlightColor:'transparent', transition:'background 0.15s'}}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}

          {/* Il gesto principale */}
          {/* b.192 — il campionamento parte alla PRESSIONE, non al rilascio.
              Prima era onClick (pointerUp): fra il tocco e l'avvio del
              riconoscimento passava il tempo del rilascio, e la prima
              parola si perdeva. Con onPointerDown la registrazione comincia
              nell'istante in cui il dito tocca — preciso e immediato, come
              promette la scritta "Tieni premuto per parlare". Il mic e gia
              caldo (requestMicEarly all'unlock), quindi cattura subito.
              onPointerDown e comunque un gesto valido per il browser. */}
          <button onPointerDown={(e) => { e.preventDefault(); vibrate(25); toggleRecording(); }}
            aria-label={recording ? L('sendVoiceMessage') : L('holdToSpeak')}
            style={{...S.talkBtn, width:64, height:64, borderRadius:32,
              display:'flex', alignItems:'center', justifyContent:'center',
              border:'none', cursor:'pointer', WebkitTapHighlightColor:'transparent',
              transition:'background 0.2s, box-shadow 0.2s', flexShrink:0,
              ...(recording ? {
                background: S.colors.accent4Bg,
                color: S.colors.textPrimary,
                boxShadow:`0 0 0 8px ${S.colors.accent4Bg}22, 0 10px 26px rgba(0,0,0,0.35)`,
                animation:'vtRecordPulse 1.5s ease-in-out infinite',
              } : {
                background: S.colors.btnGradient,
                color: S.colors.textPrimary,
                boxShadow:`0 0 0 8px ${S.colors.accent3Bg}, 0 12px 28px rgba(0,0,0,0.35)`,
              })}}>
            {recording ? <IconSend size={26}/> : <IconMic size={28}/>}
          </button>
        </div>
        {/* Suggerimento "tieni premuto per parlare", come nel template C */}
        {!recording && (
          <div style={{fontSize:11, color:S.colors.textMuted, fontWeight:600, marginTop:7, textAlign:'center'}}>
            {L('holdToSpeak')}
          </div>
        )}

        {/* La riga che mancava: mentre registra, si vede che sta ascoltando.
            Senza, l'unico modo di sapere se il tasto aveva funzionato era
            parlare e sperare. */}
        {recording && (
          <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontSize:11, color:S.colors.textMuted, marginTop:4}} aria-live="polite">
            <span>{L('listeningTapSend')}</span>
            <span style={{width:7, height:7, borderRadius:4, background:S.colors.textPrimary,
              animation:'vtRecordPulse 1.2s ease-in-out infinite'}} />
          </div>
        )}
        {/* La riduzione rumore, con le PAROLE.
            Prima era un quadrato con un'onda e la scritta "RUMORE" da 7
            pixel: nessuno poteva sapere se accendeva il rumore o lo
            toglieva. Ora dice cosa fa, e sta sotto-a-destra — e una
            preferenza, non un gesto da fare mentre si parla. */}
        {!recording && (
          <button onClick={async () => {
            const next = !liveMode;
            setLiveModeState(next);
            if (setLiveMode) await setLiveMode(next);
            vibrate(15);
          }}
            aria-pressed={liveMode}
            style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              margin:'8px auto 0', padding:'4px 10px', borderRadius:14,
              background: liveMode ? S.colors.accent4Bg : 'transparent',
              color: liveMode ? S.colors.textPrimary : S.colors.textMuted,
              border:'none', cursor:'pointer', fontSize:10.5, fontWeight:500,
              WebkitTapHighlightColor:'transparent', transition:'background 0.15s, color 0.15s'}}>
            <span style={{width:7, height:7, borderRadius:4,
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
            disabled={handRaising || myHandRaised}
            onClick={async () => {
              setHandRaising(true);
              const body = {
                action: 'raiseHand', roomId,
                raised: true,
                roomSessionToken: roomSessionToken || null,
                name: myName,
              };
              try {
                const res = await fetch('/api/room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                if (res.ok) {
                  vibrate(15);
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
              background: myHandRaised ? 'rgba(34,197,94,0.15)' : 'rgba(255,165,0,0.15)',
              border: myHandRaised ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,165,0,0.3)',
              color: myHandRaised ? PALETTE.green : '#FFA500',
              fontSize: 14, fontWeight: 600, cursor: myHandRaised ? 'default' : 'pointer',
              fontFamily: FONT, transition: 'all 0.2s',
              opacity: handRaising ? 0.6 : 1,
            }}
          >
            <IconHandRaise size={18} /> {handRaising ? '...' : myHandRaised ? `✓ ${L('handRaised')}` : L('raiseHand')}
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
                  roomSessionToken: roomSessionToken || null,
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
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'4px 0'}}>
          {/* Cancel button */}
          {recording && (
            <button onClick={() => { vibrate(15); cancelRecording(); }}
              title={L('cancelRecording')}
              style={{display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                width:36, height:36, borderRadius:12, border:`2px solid ${S.colors.statusError}`,
                background:'rgba(239,68,68,0.1)', color:S.colors.statusError,
                cursor:'pointer', justifyContent:'center',
                WebkitTapHighlightColor:'transparent', transition:'all 0.2s'}}>
              <span style={{fontSize:15}}>{'\u2716'}</span>
            </button>
          )}
          {/* VAD Audio Level Bar */}
          {isListening && (
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:32}}>
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
            style={{...S.talkBtn, width:64, height:64, fontSize:22,
              ...(isListening ? S.talkBtnRec : {}),
              ...(recording ? {boxShadow:`0 0 0 6px ${S.colors.accent3Bg}, 0 0 0 12px ${S.colors.accent3Bg}33`} : {}),
              ...(roomMode === 'simultaneous' && isListening ? {background:S.colors.btnGradient,
                boxShadow:`0 0 0 6px ${S.colors.accent3Bg}, 0 0 0 12px ${S.colors.accent3Bg}33`} : {})}}>
            {isListening ? (recording ? <IconRecord size={22}/> : <IconMic size={22}/>) : <IconMic size={22}/>}
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
              /* b.158 — CONFERMATO, difetto di prodotto: VAD_PRESETS.auto
                 (constants.js) esiste da tempo, si autotara sul rumore
                 ambientale (vedi calibraRumore.js), ma non compariva mai
                 qui: nessuno poteva mai selezionarlo. Aggiunto come prima
                 opzione. */
              { id: 'auto', short: 'Auto' },
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
