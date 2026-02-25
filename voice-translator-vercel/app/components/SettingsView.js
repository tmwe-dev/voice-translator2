'use client';
import { memo, useState } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, THEMES, FONT } from '../lib/constants.js';
import Carousel from './Carousel.js';

const SettingsView = memo(function SettingsView({ L, S, prefs, setPrefs, savePrefs, setView, isTrial, isTopPro,
  setIsTopPro, useOwnKeys, apiKeyInputs, platformHasEL, elevenLabsVoices, selectedELVoice,
  setSelectedELVoice, setElevenLabsVoices, userToken, userTokenRef, userAccount, logout, status, theme, setTheme }) {

  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);

  const selectedAvatarIdx = AVATARS.indexOf(prefs.avatar);
  const selectedLangIdx = LANGS.findIndex(l => l.code === prefs.lang);

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

          {/* Avatar carousel */}
          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={S.label}>{L('avatar')}</div>
              <button onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
                style={{background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:11, cursor:'pointer', fontFamily:FONT, padding:'2px 6px'}}>
                {showAvatarDropdown ? '✕' : '▼ lista'}
              </button>
            </div>
            {showAvatarDropdown ? (
              <div style={{display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center'}}>
                {AVATARS.map((a, i) => (
                  <button key={a} onClick={() => { setPrefs({...prefs, avatar:a}); setShowAvatarDropdown(false); }}
                    style={{...S.avatarBtn, width:60, height:74, ...(prefs.avatar===a ? S.avatarSel : {}), padding:2, flexDirection:'column'}}>
                    <img src={a} alt={AVATAR_NAMES[i]} style={{width:46, height:46, objectFit:'contain', borderRadius:12}} />
                    <span style={{fontSize:9, marginTop:2, color:'rgba(255,255,255,0.6)'}}>{AVATAR_NAMES[i]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Carousel
                items={AVATARS}
                selectedIndex={selectedAvatarIdx >= 0 ? selectedAvatarIdx : 0}
                onSelect={(i) => setPrefs({...prefs, avatar: AVATARS[i]})}
                itemWidth={80}
                gap={8}
                renderItem={(avatar, i, isSelected) => (
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <div style={{
                      width:70, height:70, borderRadius:18, overflow:'hidden',
                      border: isSelected ? '3px solid #f5576c' : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 0 3px rgba(245,87,108,0.2)' : 'none',
                      background: isSelected ? 'rgba(245,87,108,0.08)' : 'none',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition: 'all 0.2s'
                    }}>
                      <img src={avatar} alt={AVATAR_NAMES[i]} style={{width:60, height:60, objectFit:'contain'}} />
                    </div>
                    <span style={{
                      fontSize:10, marginTop:4, textAlign:'center',
                      color: isSelected ? '#f5576c' : 'rgba(255,255,255,0.5)',
                      fontWeight: isSelected ? 600 : 400, fontFamily: FONT
                    }}>{AVATAR_NAMES[i]}</span>
                  </div>
                )}
              />
            )}
          </div>

          {/* Language carousel */}
          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={S.label}>{L('yourLang')}</div>
              <button onClick={() => setShowLangDropdown(!showLangDropdown)}
                style={{background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:11, cursor:'pointer', fontFamily:FONT, padding:'2px 6px'}}>
                {showLangDropdown ? '✕' : '▼ lista'}
              </button>
            </div>
            {showLangDropdown ? (
              <select style={S.select} value={prefs.lang}
                onChange={e => { setPrefs({...prefs, lang:e.target.value}); setShowLangDropdown(false); }}>
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
            ) : (
              <Carousel
                items={LANGS}
                selectedIndex={selectedLangIdx >= 0 ? selectedLangIdx : 0}
                onSelect={(i) => setPrefs({...prefs, lang: LANGS[i].code})}
                itemWidth={80}
                gap={8}
                renderItem={(lang, i, isSelected) => (
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <div style={{
                      width:56, height:56, borderRadius:28, overflow:'hidden',
                      border: isSelected ? '3px solid #f5576c' : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 0 3px rgba(245,87,108,0.2)' : 'none',
                      background: isSelected ? 'rgba(245,87,108,0.08)' : 'rgba(255,255,255,0.05)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition: 'all 0.2s', fontSize: 28
                    }}>
                      {lang.flag}
                    </div>
                    <span style={{
                      fontSize:9, marginTop:4, textAlign:'center', maxWidth:76, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap',
                      color: isSelected ? '#f5576c' : 'rgba(255,255,255,0.5)',
                      fontWeight: isSelected ? 600 : 400, fontFamily: FONT
                    }}>{lang.name}</span>
                  </div>
                )}
              />
            )}
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
