'use client';
import { useState } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import Carousel from './Carousel.js';
import Icon from './Icon.js';

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
                style={{background:'none', border:'none', color:'rgba(232,234,255,0.5)', fontSize:11, cursor:'pointer', fontFamily:FONT, padding:'2px 6px'}}>
                {showAvatarDropdown ? '\u2715' : '\u25BC lista'}
              </button>
            </div>
            {showAvatarDropdown ? (
              <div style={{display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center'}}>
                {AVATARS.map((a, i) => (
                  <button key={a} onClick={() => { setPrefs({...prefs, avatar:a}); setShowAvatarDropdown(false); }}
                    style={{...S.avatarBtn, width:60, height:74, ...(prefs.avatar===a ? S.avatarSel : {}), padding:2, flexDirection:'column'}}>
                    <img src={a} alt={AVATAR_NAMES[i]} style={{width:46, height:46, objectFit:'contain', borderRadius:12}} />
                    <span style={{fontSize:9, marginTop:2, color:'rgba(232,234,255,0.6)'}}>{AVATAR_NAMES[i]}</span>
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
                      border: isSelected ? '3px solid #6C63FF' : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 0 3px rgba(108,99,255,0.2), 0 0 16px rgba(108,99,255,0.1)' : 'none',
                      background: isSelected ? 'rgba(108,99,255,0.08)' : 'none',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition: 'all 0.2s'
                    }}>
                      <img src={avatar} alt={AVATAR_NAMES[i]} style={{width:60, height:60, objectFit:'contain'}} />
                    </div>
                    <span style={{
                      fontSize:10, marginTop:4, textAlign:'center',
                      color: isSelected ? '#6C63FF' : 'rgba(232,234,255,0.5)',
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
                style={{background:'none', border:'none', color:'rgba(232,234,255,0.5)', fontSize:11, cursor:'pointer', fontFamily:FONT, padding:'2px 6px'}}>
                {showLangDropdown ? '\u2715' : '\u25BC lista'}
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
                      border: isSelected ? '3px solid #6C63FF' : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 0 3px rgba(108,99,255,0.2), 0 0 16px rgba(108,99,255,0.1)' : 'none',
                      background: isSelected ? 'rgba(108,99,255,0.08)' : 'rgba(232,234,255,0.04)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition: 'all 0.2s', fontSize: 28
                    }}>
                      {lang.flag}
                    </div>
                    <span style={{
                      fontSize:9, marginTop:4, textAlign:'center', maxWidth:76, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap',
                      color: isSelected ? '#6C63FF' : 'rgba(232,234,255,0.5)',
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

          {/* === TWO CLEAR CTA BUTTONS === */}

          {/* 1) FREE - Main prominent button */}
          <button style={{
            width:'100%', padding:'14px 16px', borderRadius:16, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg, #00FF94 0%, #00D2FF 100%)',
            color:'#0B0D1A', fontFamily:FONT, marginTop:14,
            display:'flex', alignItems:'center', gap:12,
            opacity: prefs.name.trim() ? 1 : 0.4,
            WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
            boxShadow:'0 4px 20px rgba(0,255,148,0.25)'
          }}
            disabled={!prefs.name.trim()}
            onClick={() => {
              savePrefs(prefs);
              if (joinCode) { setView('join'); }
              else { setView('home'); }
            }}>
            <div style={{width:38, height:38, borderRadius:12,
              background:'rgba(0,0,0,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <Icon name="zap" size={20} color="#0B0D1A" />
            </div>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontWeight:800, fontSize:15}}>{L('startFreeMode')}</div>
              <div style={{fontSize:10, opacity:0.7, marginTop:1}}>{L('startFreeDesc')}</div>
            </div>
            <span style={{fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:8,
              background:'rgba(0,0,0,0.12)', letterSpacing:0.5}}>FREE</span>
          </button>

          {/* 2) PRO / Sign In - Secondary button */}
          {!userToken && (
            <button style={{
              width:'100%', padding:'12px 16px', borderRadius:16, cursor:'pointer',
              background:'rgba(108,99,255,0.1)', border:'1px solid rgba(108,99,255,0.25)',
              color:'#E8EAFF', fontFamily:FONT, marginTop:8,
              display:'flex', alignItems:'center', gap:12,
              opacity: prefs.name.trim() ? 1 : 0.4,
              WebkitTapHighlightColor:'transparent', transition:'all 0.2s'
            }}
              disabled={!prefs.name.trim()}
              onClick={() => {
                savePrefs(prefs);
                setAuthStep('email');
                setView('account');
              }}>
              <div style={{width:38, height:38, borderRadius:12,
                background:'rgba(108,99,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                <Icon name="lock" size={18} color="#6C63FF" />
              </div>
              <div style={{flex:1, textAlign:'left'}}>
                <div style={{fontWeight:700, fontSize:14}}>{L('signInPro')}</div>
                <div style={{fontSize:10, color:'rgba(232,234,255,0.5)', marginTop:1}}>{L('signInProDesc')}</div>
              </div>
              <span style={{fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:8,
                background:'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(0,210,255,0.15))',
                color:'#6C63FF', letterSpacing:0.5}}>PRO</span>
            </button>
          )}

          {/* If already logged in, just show one "Go" button */}
          {userToken && (
            <button style={{
              width:'100%', padding:'12px 16px', borderRadius:16, cursor:'pointer',
              background:'rgba(108,99,255,0.1)', border:'1px solid rgba(108,99,255,0.25)',
              color:'#6C63FF', fontFamily:FONT, marginTop:8,
              fontSize:13, fontWeight:700, textAlign:'center',
              opacity: prefs.name.trim() ? 1 : 0.4,
              WebkitTapHighlightColor:'transparent', transition:'all 0.2s'
            }}
              disabled={!prefs.name.trim()}
              onClick={() => { savePrefs(prefs); setView('home'); }}>
              {L('letsStart')} (PRO)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
