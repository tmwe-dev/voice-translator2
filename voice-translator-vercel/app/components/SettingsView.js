'use client';
import { memo } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, THEMES } from '../lib/constants.js';

const SettingsView = memo(function SettingsView({ L, S, prefs, setPrefs, savePrefs, setView, isTrial, isTopPro,
  setIsTopPro, useOwnKeys, apiKeyInputs, platformHasEL, elevenLabsVoices, selectedELVoice,
  setSelectedELVoice, setElevenLabsVoices, userToken, userTokenRef, userAccount, logout, status, theme, setTheme }) {
  // SettingsView receives 18+ props and re-renders frequently during preference changes
  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView('home')}>{'←'}</button>
          <span style={{fontWeight:600, fontSize:17}}>{L('settings')}</span>
        </div>
        <div style={S.card}>
          <div style={S.field}>
            <div style={S.label}>{L('name')}</div>
            <input style={S.input} value={prefs.name}
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
            <div style={S.label}>{L('voiceTranslation')} (OpenAI)</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
              {VOICES.map(v => (
                <button key={v} onClick={() => setPrefs({...prefs, voice:v})}
                  style={{...S.voiceBtn, ...(prefs.voice===v ? S.voiceSel : {})}}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* TOP PRO toggle */}
          {!isTrial && ((useOwnKeys && apiKeyInputs.elevenlabs) || platformHasEL) && (
            <div style={S.field}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <span style={{...S.label, marginBottom:0, color:'#ffd700'}}>{'⭐'} TOP PRO (ElevenLabs)</span>
                <button onClick={() => setIsTopPro(!isTopPro)}
                  style={{...S.toggle, background:isTopPro ? '#ffd700' : '#333'}}>
                  <div style={{...S.toggleDot, transform:isTopPro ? 'translateX(20px)' : 'translateX(0)'}} />
                </button>
              </div>
              {!useOwnKeys && platformHasEL && (
                <div style={{fontSize:11, color:'#999', marginTop:4}}>
                  ElevenLabs via piattaforma (costo ~20x TTS standard)
                </div>
              )}
            </div>
          )}

          {/* ElevenLabs voice selection */}
          {isTopPro && elevenLabsVoices.length > 0 && (
            <div style={S.field}>
              <div style={S.label}>{L('elevenLabsVoice')}</div>
              <select style={S.select} value={selectedELVoice}
                onChange={e => setSelectedELVoice(e.target.value)}>
                <option value="">{L('autoVoice')}</option>
                {elevenLabsVoices.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.category})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isTopPro && elevenLabsVoices.length === 0 && (
            <button style={{...S.settingsBtn, marginTop:4, color:'#ffd700', borderColor:'rgba(255,215,0,0.2)'}}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/tts-elevenlabs?action=voices&token=${userTokenRef.current || ''}`);
                  if (res.ok) {
                    const data = await res.json();
                    setElevenLabsVoices(data.voices || []);
                  }
                } catch(e) { console.error('Failed to load voices:', e); }
              }}>
              {L('loadVoices')}
            </button>
          )}

          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{...S.label, marginBottom:0}}>{L('autoplayTranslation')}</span>
              <button onClick={() => setPrefs({...prefs, autoPlay:!prefs.autoPlay})}
                style={{...S.toggle, background:prefs.autoPlay ? '#e94560' : '#333'}}>
                <div style={{...S.toggleDot, transform:prefs.autoPlay ? 'translateX(20px)' : 'translateX(0)'}} />
              </button>
            </div>
          </div>

          {/* Theme toggle */}
          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{...S.label, marginBottom:0}}>{L('theme') || 'Theme'}</span>
              <button onClick={() => setTheme(theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK)}
                style={{...S.toggle, background:theme === THEMES.DARK ? '#333' : '#ffd700'}}>
                <div style={{...S.toggleDot, transform:theme === THEMES.DARK ? 'translateX(0)' : 'translateX(20px)'}} />
              </button>
              <span style={{fontSize:14, marginLeft:8}}>{theme === THEMES.DARK ? '🌙' : '☀️'}</span>
            </div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:4}}>
              {theme === THEMES.DARK ? 'Dark Mode' : 'Light Mode'}
            </div>
          </div>

          <button style={{...S.btn, marginTop:12}} onClick={() => { savePrefs(prefs); setView('home'); }}>
            OK
          </button>
          {userToken && (
            <div style={{marginTop:20, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.3)', marginBottom:8}}>
                Account: {userAccount?.email || ''}
              </div>
              <button style={{...S.settingsBtn, color:'#f5576c', borderColor:'rgba(245,87,108,0.2)'}}
                onClick={logout}>
                {L('logoutAccount')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default SettingsView;