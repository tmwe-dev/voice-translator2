'use client';
import { useState } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import Carousel from './Carousel.js';
import Icon from './Icon.js';

const STEPS = [
  { key:'name', icon:'\u{270D}\uFE0F' },
  { key:'avatar', icon:'\u{1F464}' },
  { key:'lang', icon:'\u{1F310}' },
  { key:'voice', icon:'\u{1F3A4}' },
];

export default function WelcomeView({ L, S, prefs, setPrefs, savePrefs, joinCode, userToken, setView, setAuthStep, theme, setTheme }) {
  const [step, setStep] = useState(0);
  const themeS = typeof S === 'object' && S.colors ? S : null;

  const selectedAvatarIdx = AVATARS.indexOf(prefs.avatar);
  const selectedLangIdx = LANGS.findIndex(l => l.code === prefs.lang);

  const canNext = step === 0 ? prefs.name.trim().length >= 2 : true;
  const isLast = step === STEPS.length - 1;

  function next() { if (canNext && step < STEPS.length - 1) setStep(step + 1); }
  function prev() { if (step > 0) setStep(step - 1); }

  // Progress dots
  const dots = (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:20}}>
      {STEPS.map((s, i) => (
        <div key={s.key} onClick={() => { if (i < step || (i <= step)) setStep(i); }}
          style={{display:'flex', alignItems:'center', gap:4, cursor: i <= step ? 'pointer' : 'default',
            opacity: i <= step ? 1 : 0.35, transition:'all 0.3s'}}>
          <div style={{width: i === step ? 28 : 8, height:8, borderRadius:4, transition:'all 0.3s',
            background: i < step ? S.colors.accent4 : i === step ? S.colors.accent1 : S.colors.textMuted}} />
        </div>
      ))}
    </div>
  );

  // Step label
  const stepLabel = (title, subtitle) => (
    <div style={{textAlign:'center', marginBottom:16}}>
      <div style={{fontSize:16, fontWeight:700, color:S.colors.textPrimary, letterSpacing:-0.3}}>{title}</div>
      {subtitle && <div style={{fontSize:12, color:S.colors.textSecondary, marginTop:4}}>{subtitle}</div>}
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        {/* Header */}
        <div style={{fontSize:36, marginBottom:4}}>{'\u{1F30D}'}</div>
        <div style={{...S.title, fontSize:22, marginBottom:2}}>{L('appName')}</div>
        <div style={{...S.sub, fontSize:12, marginBottom:16}}>{L('appSubtitle')}</div>

        {dots}

        <div style={{...S.card, padding:'20px 18px', position:'relative', overflow:'hidden'}}>
          {/* Step counter */}
          <div style={{fontSize:10, color:S.colors.textTertiary, fontWeight:700, textAlign:'center',
            marginBottom:12, letterSpacing:1}}>
            {step + 1} / {STEPS.length}
          </div>

          {/* ─── STEP 0: NAME ─── */}
          {step === 0 && (
            <div>
              {stepLabel(
                L('welcomeNameTitle') || 'Come ti chiami?',
                L('welcomeNameSub') || 'Il tuo nome sarà visibile al partner nella stanza'
              )}
              <input style={{...S.input, fontSize:18, textAlign:'center', padding:'14px 16px',
                fontWeight:600, letterSpacing:-0.3}}
                placeholder={L('namePlaceholder')} value={prefs.name}
                onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20}
                autoFocus />
              {prefs.name.trim().length > 0 && prefs.name.trim().length < 2 && (
                <div style={{fontSize:11, color:S.colors.accent3, textAlign:'center', marginTop:8}}>
                  {L('nameMinChars') || 'Almeno 2 caratteri'}
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 1: AVATAR ─── */}
          {step === 1 && (
            <div>
              {stepLabel(
                L('welcomeAvatarTitle') || 'Scegli il tuo avatar',
                L('welcomeAvatarSub') || 'Il tuo personaggio nella conversazione'
              )}
              {/* Current selection preview */}
              <div style={{display:'flex', justifyContent:'center', marginBottom:12}}>
                <div style={{width:110, height:110, borderRadius:28, overflow:'hidden',
                  border:`3px solid ${S.colors.accent1}`, boxShadow:`0 0 20px ${S.colors.accent1Bg}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:S.colors.accent1Bg}}>
                  <img src={prefs.avatar} alt="" style={{width:100, height:100, objectFit:'contain'}} />
                </div>
              </div>
              <div style={{textAlign:'center', fontSize:14, fontWeight:700, color:S.colors.accent1, marginBottom:12}}>
                {AVATAR_NAMES[selectedAvatarIdx >= 0 ? selectedAvatarIdx : 0]}
              </div>
              <Carousel
                items={AVATARS}
                selectedIndex={selectedAvatarIdx >= 0 ? selectedAvatarIdx : 0}
                onSelect={(i) => setPrefs({...prefs, avatar: AVATARS[i]})}
                itemWidth={90}
                gap={8}
                renderItem={(avatar, i, isSelected) => (
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <div style={{
                      width:80, height:80, borderRadius:20, overflow:'hidden',
                      border: isSelected ? `2.5px solid ${S.colors.accent1}` : '2.5px solid transparent',
                      background: isSelected ? S.colors.accent1Bg : 'none',
                      display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s'
                    }}>
                      <img src={avatar} alt={AVATAR_NAMES[i]} style={{width:70, height:70, objectFit:'contain'}} />
                    </div>
                    <span style={{fontSize:9, marginTop:3, color: isSelected ? S.colors.accent1 : S.colors.textSecondary,
                      fontWeight: isSelected ? 600 : 400, fontFamily:FONT}}>{AVATAR_NAMES[i]}</span>
                  </div>
                )}
              />
            </div>
          )}

          {/* ─── STEP 2: LANGUAGE ─── */}
          {step === 2 && (
            <div>
              {stepLabel(
                L('welcomeLangTitle') || 'Quale lingua parli?',
                L('welcomeLangSub') || 'Puoi cambiarla in qualsiasi momento'
              )}
              {/* Current flag preview */}
              <div style={{display:'flex', justifyContent:'center', marginBottom:8}}>
                <div style={{fontSize:48}}>
                  {LANGS[selectedLangIdx >= 0 ? selectedLangIdx : 0]?.flag}
                </div>
              </div>
              <div style={{textAlign:'center', fontSize:14, fontWeight:700, color:S.colors.accent1, marginBottom:12}}>
                {LANGS[selectedLangIdx >= 0 ? selectedLangIdx : 0]?.name}
              </div>
              <Carousel
                items={LANGS}
                selectedIndex={selectedLangIdx >= 0 ? selectedLangIdx : 0}
                onSelect={(i) => setPrefs({...prefs, lang: LANGS[i].code})}
                itemWidth={72}
                gap={8}
                renderItem={(lang, i, isSelected) => (
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <div style={{
                      width:52, height:52, borderRadius:26,
                      border: isSelected ? `2.5px solid ${S.colors.accent1}` : '2.5px solid transparent',
                      background: isSelected ? S.colors.accent1Bg : S.colors.textMuted,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.2s', fontSize:26
                    }}>
                      {lang.flag}
                    </div>
                    <span style={{fontSize:9, marginTop:3, maxWidth:68, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center',
                      color: isSelected ? S.colors.accent1 : S.colors.textSecondary,
                      fontWeight: isSelected ? 600 : 400, fontFamily:FONT}}>{lang.name}</span>
                  </div>
                )}
              />
            </div>
          )}

          {/* ─── STEP 3: VOICE + CTA ─── */}
          {step === 3 && (
            <div>
              {stepLabel(
                L('welcomeVoiceTitle') || 'Scegli la voce AI',
                L('welcomeVoiceSub') || 'La voce che leggerà le traduzioni (modificabile dopo)'
              )}
              <div style={{display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginBottom:16}}>
                {VOICES.map(v => {
                  const sel = prefs.voice === v;
                  return (
                    <button key={v} onClick={() => setPrefs({...prefs, voice:v})}
                      style={{padding:'10px 16px', borderRadius:12, cursor:'pointer',
                        fontFamily:FONT, fontSize:13, fontWeight: sel ? 700 : 500,
                        background: sel ? S.colors.accent1Bg : S.colors.overlayBg,
                        border: sel ? `1.5px solid ${S.colors.accent1Border}` : `1px solid ${S.colors.overlayBorder}`,
                        color: sel ? S.colors.accent1 : S.colors.textSecondary,
                        transition:'all 0.15s', WebkitTapHighlightColor:'transparent'}}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  );
                })}
              </div>
              <div style={{fontSize:10, color:S.colors.textTertiary, textAlign:'center', marginBottom:16}}>
                {L('welcomeVoiceHint') || 'Le voci AI sono disponibili con account PRO. La modalità FREE usa la voce del browser.'}
              </div>
            </div>
          )}

          {/* ─── NAVIGATION BUTTONS ─── */}
          <div style={{display:'flex', gap:10, marginTop:16}}>
            {step > 0 && (
              <button onClick={prev} style={{flex:'0 0 48px', height:48, borderRadius:14, cursor:'pointer',
                background:S.colors.overlayBg, border:`1px solid ${S.colors.overlayBorder}`,
                color:S.colors.textSecondary, fontSize:18, display:'flex', alignItems:'center',
                justifyContent:'center', WebkitTapHighlightColor:'transparent'}}>
                {'\u2190'}
              </button>
            )}
            {!isLast ? (
              <button onClick={next} disabled={!canNext}
                style={{flex:1, height:48, borderRadius:14, cursor: canNext ? 'pointer' : 'default',
                  background: canNext ? `linear-gradient(135deg, ${S.colors.accent1} 0%, ${S.colors.accent2} 100%)` : S.colors.overlayBg,
                  border:'none', color: canNext ? S.colors.textPrimary : S.colors.textTertiary,
                  fontFamily:FONT, fontSize:15, fontWeight:700, letterSpacing:-0.3,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  opacity: canNext ? 1 : 0.5, transition:'all 0.2s',
                  WebkitTapHighlightColor:'transparent'}}>
                {L('next') || 'Avanti'}
                <span style={{fontSize:16}}>{'\u2192'}</span>
              </button>
            ) : (
              /* FINAL STEP: CTA buttons */
              <div style={{flex:1, display:'flex', flexDirection:'column', gap:8}}>
                {/* FREE button */}
                <button style={{
                  width:'100%', padding:'14px 16px', borderRadius:14, border:'none', cursor:'pointer',
                  background:`linear-gradient(135deg, ${S.colors.accent4} 0%, ${S.colors.accent2} 100%)`,
                  color:'#0B0D1A', fontFamily:FONT,
                  display:'flex', alignItems:'center', gap:10,
                  WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
                  boxShadow:`0 4px 20px ${S.colors.accent4Bg}`
                }}
                  onClick={() => {
                    savePrefs(prefs);
                    if (joinCode) setView('join');
                    else setView('home');
                  }}>
                  <Icon name="zap" size={18} color="#0B0D1A" />
                  <div style={{flex:1, textAlign:'left'}}>
                    <div style={{fontWeight:800, fontSize:14}}>{L('startFreeMode')}</div>
                    <div style={{fontSize:10, opacity:0.7}}>{L('startFreeDesc')}</div>
                  </div>
                  <span style={{fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:6,
                    background:'rgba(0,0,0,0.12)', letterSpacing:0.5}}>FREE</span>
                </button>

                {/* PRO button */}
                {!userToken && (
                  <button style={{
                    width:'100%', padding:'12px 16px', borderRadius:14, cursor:'pointer',
                    background:S.colors.accent1Bg, border:`1px solid ${S.colors.accent1Border}`,
                    color:S.colors.textPrimary, fontFamily:FONT,
                    display:'flex', alignItems:'center', gap:10,
                    WebkitTapHighlightColor:'transparent', transition:'all 0.2s'
                  }}
                    onClick={() => {
                      savePrefs(prefs);
                      setAuthStep('email');
                      setView('account');
                    }}>
                    <Icon name="lock" size={16} color={S.colors.accent1} />
                    <div style={{flex:1, textAlign:'left'}}>
                      <div style={{fontWeight:700, fontSize:13}}>{L('signInPro')}</div>
                      <div style={{fontSize:10, color:S.colors.textSecondary}}>
                        {L('signInProDesc')}
                      </div>
                    </div>
                    <span style={{fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:6,
                      background:S.colors.accent1Bg, color:S.colors.accent1, letterSpacing:0.5}}>PRO</span>
                  </button>
                )}

                {/* Already logged in */}
                {userToken && (
                  <button style={{
                    width:'100%', padding:'12px 16px', borderRadius:14, cursor:'pointer',
                    background:S.colors.accent1Bg, border:`1px solid ${S.colors.accent1Border}`,
                    color:S.colors.accent1, fontFamily:FONT, fontSize:13, fontWeight:700, textAlign:'center',
                    WebkitTapHighlightColor:'transparent'
                  }}
                    onClick={() => { savePrefs(prefs); setView('home'); }}>
                    {L('letsStart')} (PRO)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
