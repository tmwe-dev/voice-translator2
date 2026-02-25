'use client';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';

export default function WelcomeView({ L, S, prefs, setPrefs, savePrefs, joinCode, userToken, setView, setAuthStep, theme, setTheme }) {
  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={{fontSize:42, marginBottom:8}}>{'\u{1F30D}'}</div>
        <div style={S.title}>{L('appName')}</div>
        <div style={S.sub}>{L('appSubtitle')}</div>
        <div style={S.card}>
          <div style={S.cardTitle}>{L('configProfile')}</div>
          <div style={S.field}>
            <div style={S.label}>{L('name')}</div>
            <input style={S.input} placeholder={L('namePlaceholder')} value={prefs.name}
              onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20} />
          </div>
          <div style={S.field}>
            <div style={S.label}>{L('avatar')}</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {AVATARS.map((a,i) => (
                <button key={a} onClick={() => setPrefs({...prefs, avatar:a})}
                  style={{...S.avatarBtn, ...(prefs.avatar===a ? S.avatarSel : {}), padding:2}}>
                  <img src={a} alt={AVATAR_NAMES[i]} style={{width:46, height:46, objectFit:'contain'}} />
                </button>
              ))}
            </div>
          </div>
          <div style={S.field}>
            <div style={S.label}>{L('yourLang')}</div>
            <select style={S.select} value={prefs.lang}
              onChange={e => setPrefs({...prefs, lang:e.target.value})}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
          <div style={S.field}>
            <div style={S.label}>{L('voiceTranslation')}</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
              {VOICES.map(v => (
                <button key={v} onClick={() => setPrefs({...prefs, voice:v})}
                  style={{...S.voiceBtn, ...(prefs.voice===v ? S.voiceSel : {})}}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <button style={{...S.btn, marginTop:12, opacity:prefs.name.trim()?1:0.4}}
            disabled={!prefs.name.trim()}
            onClick={() => {
              savePrefs(prefs);
              if (joinCode) { setView('join'); }
              else if (userToken) { setView('home'); }
              else { setAuthStep('email'); setView('account'); }
            }}>
            {L('letsStart')}
          </button>
          {!joinCode && (
            <button style={{marginTop:10, background:'none', border:'none', color:'rgba(255,255,255,0.35)',
              fontSize:12, cursor:'pointer', fontFamily:FONT, padding:8}}
              onClick={() => { savePrefs(prefs); setView('home'); }}>
              {L('continueAsGuest')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
