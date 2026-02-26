'use client';
import { memo } from 'react';
import { LANGS, APP_URL } from '../lib/constants.js';

const LobbyView = memo(function LobbyView({ L, S, roomId, roomInfo, partnerConnected, inviteLang, setInviteLang,
  shareRoom, leaveRoom, unlockAudio, setView, theme, setTheme }) {
  const qrUrl = roomId ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${APP_URL}?room=${roomId}&lang=${inviteLang}`)}` : '';

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
            <div style={{fontSize:30, fontWeight:700, letterSpacing:8, color:S.colors.accent3}}>{roomId}</div>
          </div>
          <div style={{textAlign:'center', marginBottom:14}}>
            <img src={qrUrl} alt="QR" style={{width:150, height:150, borderRadius:14, background:'#fff', padding:8}} />
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
