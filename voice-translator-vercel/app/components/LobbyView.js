'use client';
import { memo, useState, useEffect, useRef } from 'react';
import { LANGS, APP_URL, FONT } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';

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

    import('qrcode').then(QRCode => {
      if (cancelled) return;
      QRCode.toCanvas(canvasRef.current, url, {
        width: 180,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }, (err) => {
        if (!err && !cancelled) setQrReady(true);
      });
    }).catch(() => {
      // Fallback: if qrcode lib fails, show the invite URL text
      if (!cancelled) setQrReady(false);
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
            <div style={{fontSize:30, fontWeight:700, letterSpacing:8, color:S.colors.accent2}}>{roomId}</div>
          </div>
          <div style={{textAlign:'center', marginBottom:14, position:'relative'}}>
            <canvas ref={canvasRef}
              style={{borderRadius:14, background:'#fff', padding:8, display:'block', margin:'0 auto',
                maxWidth:180, maxHeight:180, opacity: qrReady ? 1 : 0, transition:'opacity .25s'}} />
            {/* b.90 — prima si vedeva un rettangolo BIANCO vuoto finche il
                codice non era disegnato: sembrava un QR rotto. */}
            {!qrReady && (
              <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center',
                color:S.colors.textMuted, fontSize:12}}>
                Preparo il codice…
              </div>
            )}
            {!qrReady && (
              <div style={{fontSize:11, color:S.colors.textMuted, marginTop:6}}>
                {`${APP_URL}?room=${roomId}`}
              </div>
            )}
          </div>
          <div style={{marginBottom:12}}>
            <div style={S.label}>{L('inviteLangLabel')}</div>
            <select style={{...S.select, fontSize:14}} value={inviteLang} onChange={e => setInviteLang(e.target.value)}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
          <div style={{textAlign:'center', marginBottom:12}}>
            <button style={S.shareBtn} onClick={shareRoom}>{L('shareLink')}</button>
          </div>

          {/* ── b.104 · la porta per la stanza video ──
              b.271 — diceva "Entra in video di gruppo · Fino a 8 persone"
              dentro il riquadro di un invito a UNA persona: prometteva una
              cosa diversa da quella che stava succedendo, ed era in
              italiano per tutti. Ora dice dove si entra e chi ci si trova,
              nella lingua di chi legge.
              In b.102 questo pulsante stava FUORI da LobbyView, appiccicato
              dopo. Il collaudo dal vivo lo ha bocciato: esisteva nel DOM,
              ma la schermata della stanza gli passava sopra e nessuno
              poteva toccarlo. Un pulsante che c'e ma non si preme non
              esiste. Ora sta dentro la scheda, sotto "Condividi link". */}
          <div style={{textAlign:'center', marginBottom:12}}>
            <button
              onClick={() => { unlockAudio?.(); setView('stanza-video'); }}
              style={{
                width:'100%', padding:'12px 16px', borderRadius:13, cursor:'pointer',
                background:'transparent', border:`1px solid ${S.colors.accent1}55`,
                color:S.colors.accent1, fontSize:14, fontWeight:800, fontFamily:FONT,
              }}>
              {L('enterVideoRoom')}
            </button>
            <div style={{fontSize:11, color:S.colors.textMuted, marginTop:5, lineHeight:1.4}}>
              {L('videoRoomHint')}
            </div>
          </div>
          {/* ── INIZIO b.90 — "Videochiamata" apriva questa identica schermata ──
              Due voci diverse in Home portavano allo stesso posto, senza una
              parola sul video. Ora almeno si dice cosa succede dopo. */}
          {perVideo && !partnerConnected && (
            <div style={{
              textAlign:'center', fontSize:12.5, lineHeight:1.5, marginBottom:12,
              padding:'10px 12px', borderRadius:12,
              background:`${S.colors.accent1}12`, border:`1px solid ${S.colors.accent1}25`,
              color:S.colors.textSecondary,
            }}>
              {L('guestThenCall')}
            </div>
          )}
          {/* ── FINE b.90 ── */}
          <div style={{textAlign:'center', color:S.colors.textMuted, fontSize:13, marginBottom:12}}>
            {partnerConnected
              ? <span style={{color:S.colors.accent2}}>{roomInfo?.members?.[1]?.name} {'\u2714'}</span>
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
