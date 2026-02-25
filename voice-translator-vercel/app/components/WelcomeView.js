'use client';
import { useState } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import Carousel from './Carousel.js';

export default function WelcomeView({ L, S, prefs, setPrefs, savePrefs, joinCode, userToken, setView, setAuthStep, theme, setTheme }) {
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);

  const selectedAvatarIdx = AVATARS.indexOf(prefs.avatar);
  const selectedLangIdx = LANGS.findIndex(l => l.code === prefs.lang);

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
