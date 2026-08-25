'use client';
import { memo, useState, useEffect, useRef } from 'react';
import { LANGS, APP_URL, FONT } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';
import Icon from './Icon.js';
import { disegnaQR } from '../lib/codiceQR.js';

const LobbyView = memo(function LobbyView({ roomId, roomInfo, partnerConnected, inviteLang, setInviteLang,
  shareRoom, leaveRoom, unlockAudio, perVideo = false }) {
  const { L, S, setView, theme, setTheme } = useApp();

  const canvasRef = useRef(null);
  const [qrReady, setQrReady] = useState(false);

  // Generate QR code client-side using canvas
  useEffect(() => {
    if (!roomId || !canvasRef.current) return;
    const url = `${APP_URL}?room=${roomId}&lang=${inviteLang}`;
    let cancelled = false;

    // b.483 — il codice lo disegna app/lib/codiceQR.js, che e l'unico
    // posto dove si decide come si disegna un QR in questa applicazione.
    // Prima ogni schermata se lo scriveva da se, e infatti quello del
    // tassista era finito verde su blu scuro.
    disegnaQR(canvasRef.current, url, 180, 2).then((fatto) => {
      if (!cancelled) setQrReady(fatto);
    });

    return () => { cancelled = true; };
  }, [roomId, inviteLang]);

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={leaveRoom}>{'\u2190'}</button>
          <span style={{fontWeight:600, fontSize:17}}>{L('yourRoom')}</span>
        </div>
        <div style={S.card}>
          <div style={{textAlign:'center', marginBottom:16}}>
            <div style={S.label}>{L('code')}</div>
            <div style={{fontSize:30, fontWeight: 600, letterSpacing:8, color:S.colors.accent2}}>{roomId}</div>
          </div>
          <div style={{textAlign:'center', marginBottom:14, position:'relative'}}>
            <canvas ref={canvasRef}
              style={{borderRadius:14, background:'#fff', padding:8, display:'block', margin:'0 auto',
                maxWidth:180, maxHeight:180, opacity: qrReady ? 1 : 0, transition:'opacity .25s'}} />
            {/* b.90 — prima si vedeva un rettangolo BIANCO vuoto finche il
                codice non era disegnato: sembrava un QR rotto. */}
            {/* b.482 — l'attesa era scritta a mano in italiano: chi apriva
                l'invito in un'altra lingua leggeva una frase che non
                capiva. Ora viene dal pacchetto lingua come tutto il resto. */}
            {!qrReady && (
              <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center',
                color:S.colors.textMuted, fontSize:12}}>
                {L('preparingInvite')}
              </div>
            )}
            {/* b.482 — l'indirizzo di ripiego tiene SEMPRE il suo posto ad
                altezza fissa: prima compariva e spariva insieme al codice e
                tutto quello che sta sotto saltava su e giu. */}
            <div style={{fontSize:11, color:S.colors.textMuted, marginTop:6, height:14, overflow:'hidden'}}>
              {!qrReady ? `${APP_URL}?room=${roomId}` : ''}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={S.label}>{L('inviteLangLabel')}</div>
            {/* b.482 — la tendina e un bersaglio da toccare: sotto i 44 punti
                di altezza il dito sbaglia. */}
            <select style={{...S.select, fontSize:14, minHeight:44}} value={inviteLang} onChange={e => setInviteLang(e.target.value)}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
          <div style={{textAlign:'center', marginBottom:12}}>
            <button style={S.shareBtn} onClick={shareRoom}>{L('shareLink')}</button>
          </div>

          {/* b.461, ordine di Luca: «non deve proporre stanza video: le
              stanze partono normali come testo e si seleziona la camera
              all'interno della pagina chat». Via il tasto «Entra nella
              stanza video» che stava qui.
              Il motivo e giusto: da questa scheda non si e ancora in due —
              c'e il codice e si aspetta qualcuno. Proporre il video PRIMA
              che arrivi significa chiedere di scegliere il modo di parlare
              a chi non ha ancora nessuno con cui parlare. La stanza si apre
              come testo, che e quello che serve sempre; la telecamera si
              accende dentro, quando c'e davvero qualcuno dall'altra parte.
              La schermata video resta e resta raggiungibile: cambia solo
              che non si sceglie da qui. */}
          {/* ── INIZIO b.90 — "Videochiamata" apriva questa identica schermata ──
              Due voci diverse in Home portavano allo stesso posto, senza una
              parola sul video. Ora almeno si dice cosa succede dopo. */}
          {perVideo && !partnerConnected && (
            <div style={{
              textAlign:'center', fontSize:12.5, lineHeight:1.5, marginBottom:12,
              padding:'10px 20px', borderRadius:12,
              background:`${S.colors.accent1}12`, border:`1px solid ${S.colors.accent1}25`,
              color:S.colors.textSecondary,
            }}>
              {L('guestThenCall')}
            </div>
          )}
          {/* ── FINE b.90 ── */}
          {/* b.482 — la spunta era un carattere di quelli che il telefono
              puo disegnare come emoji: qui le figure vengono dal nostro
              foglio di icone, cosi restano uguali su ogni apparecchio. */}
          <div style={{textAlign:'center', color:S.colors.textMuted, fontSize:13, marginBottom:12}}>
            {partnerConnected
              ? <span style={{color:S.colors.accent2}}>{roomInfo?.members?.[1]?.name} <Icon name="check" size={14} color={S.colors.accent2} style={{verticalAlign:'-2px'}} /></span>
              : <span>{L('waitingForPartner')}</span>}
          </div>
          {partnerConnected && (
            <button style={S.btn} onClick={() => { unlockAudio(); setView('room'); }}>
              {L('letsStart')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default LobbyView;
