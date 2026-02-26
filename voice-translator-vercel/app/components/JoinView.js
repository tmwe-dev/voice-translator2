'use client';
import { useState } from 'react';
import { LANGS, FONT } from '../lib/constants.js';
import { t } from '../lib/i18n.js';

export default function JoinView({ L, S, prefs, setPrefs, savePrefs, myLang, setMyLang, joinCode,
  setJoinCode, inviteMsgLang, setInviteMsgLang, handleJoinRoom, setView, userToken, setAuthStep,
  status, theme, setTheme }) {
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const iL = inviteMsgLang || prefs.lang || 'en';
  const tI = (key) => t(iL, key);

  return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => { window.history.replaceState({}, '', window.location.pathname); setView('home'); setJoinCode(''); setInviteMsgLang(null); }}>{'\u2190'}</button>
          <span style={{fontWeight:600, fontSize:17}}>{inviteMsgLang ? tI('inviteTitle') : L('joinRoom')}</span>
        </div>
        <div style={S.card}>
          {inviteMsgLang && (
            <div style={{textAlign:'center', marginBottom:18, padding:'12px 8px', background:S.colors.accent2Bg, borderRadius:12}}>
              <div style={{fontSize:28, marginBottom:8}}>{'\u{1F30D}\u{1F399}\uFE0F'}</div>
              <div style={{fontSize:15, color:S.colors.textPrimary, lineHeight:1.5, marginBottom:4, fontWeight:600}}>{tI('inviteWelcome')}</div>
              <div style={{fontSize:13, color:S.colors.textSecondary, lineHeight:1.4}}>{tI('inviteInstructions')}</div>
            </div>
          )}
          <div style={S.field}>
            <div style={S.label}>{inviteMsgLang ? tI('name') : L('name')}</div>
            <input style={S.input} placeholder={inviteMsgLang ? tI('namePlaceholder') : L('namePlaceholder')} value={prefs.name}
              onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20} />
          </div>
          {!inviteMsgLang && (
            <div style={S.field}>
              <div style={S.label}>{L('roomCode')}</div>
              <input style={{...S.input, textAlign:'center', fontSize:22, letterSpacing:6, textTransform:'uppercase'}}
                placeholder="ABC123" value={joinCode} maxLength={6}
                onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} />
            </div>
          )}
          <div style={S.field}>
            <div style={S.label}>{inviteMsgLang ? tI('yourLang') : L('yourLang')}</div>
            <select style={S.select} value={myLang} onChange={e => { setMyLang(e.target.value); setPrefs(p => ({...p, lang: e.target.value})); }}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
          <button style={{...S.btn, marginTop:12, opacity:(joinCode.length>=4 && prefs.name.trim())?1:0.4}}
            disabled={joinCode.length<4 || !prefs.name.trim()} onClick={() => { savePrefs(prefs); handleJoinRoom(); }}>
            {inviteMsgLang ? tI('inviteJoinBtn') : L('enterRoom')}
          </button>
          {inviteMsgLang && !userToken && (
            <button style={{marginTop:10, background:'none', border:'none', color:S.colors.textMuted,
              fontSize:12, cursor:'pointer', fontFamily:FONT, padding:8, textDecoration:'underline'}}
              onClick={() => setShowInvitePopup(true)}>
              {tI('inviteInfoLink')}
            </button>
          )}
          {status && <div style={S.statusMsg}>{status}</div>}
        </div>
      </div>
      {showInvitePopup && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}
          onClick={() => setShowInvitePopup(false)}>
          <div style={{background:S.colors.glassCard, borderRadius:18, padding:'28px 22px', maxWidth:360, width:'100%', boxShadow:S.colors.cardShadow}}
            onClick={e => e.stopPropagation()}>
            <div style={{fontSize:32, textAlign:'center', marginBottom:12}}>{'\u{1F30D}\u{1F399}\uFE0F'}</div>
            <div style={{fontSize:18, fontWeight:700, color:S.colors.textPrimary, textAlign:'center', marginBottom:12}}>{tI('invitePopupTitle')}</div>
            <div style={{fontSize:14, color:S.colors.textSecondary, lineHeight:1.6, marginBottom:16}}>{tI('invitePopupDesc')}</div>
            <div style={{fontSize:13, color:S.colors.textTertiary, lineHeight:1.5, marginBottom:16, padding:'10px 12px', background:S.colors.accent2Bg, borderRadius:10}}>
              {tI('invitePopupFeatures')}
            </div>
            <div style={{display:'flex', gap:8}}>
              <button style={{...S.btn, flex:1, fontSize:13}} onClick={() => { setShowInvitePopup(false); setView('account'); setAuthStep('email'); }}>
                {tI('invitePopupCreateAccount')}
              </button>
              <button style={{flex:1, padding:'10px 14px', borderRadius:12, border:`1px solid ${S.colors.overlayBorder}`,
                background:'transparent', color:S.colors.textPrimary, fontSize:13, cursor:'pointer', fontFamily:FONT}}
                onClick={() => setShowInvitePopup(false)}>
                {tI('invitePopupJoinNow')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
