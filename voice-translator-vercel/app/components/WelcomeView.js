'use client';
import { useState } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import Carousel from './Carousel.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════
// WELCOME VIEW — Immersive onboarding
// Step 0: Hero + features showcase
// Step 1: Name
// Step 2: Avatar
// Step 3: Language
// Step 4: Voice + CTA
// ═══════════════════════════════════════

const STEPS = [
  { key:'hero' },
  { key:'name' },
  { key:'avatar' },
  { key:'lang' },
  { key:'voice' },
];

export default function WelcomeView({ L, S, prefs, setPrefs, savePrefs, joinCode, userToken, setView, setAuthStep, theme, setTheme }) {
  const [step, setStep] = useState(0);
  const C = S.colors;

  const selectedAvatarIdx = AVATARS.indexOf(prefs.avatar);
  const selectedLangIdx = LANGS.findIndex(l => l.code === prefs.lang);

  const canNext = step === 1 ? prefs.name.trim().length >= 2 : true;
  const isLast = step === STEPS.length - 1;

  function next() { if (canNext && step < STEPS.length - 1) setStep(step + 1); }
  function prev() { if (step > 0) setStep(step - 1); }

  // Features list for hero page
  const features = [
    { icon: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',
      title: L('featVoice') || 'Traduzione vocale', desc: L('featVoiceDesc') || 'Parla nella tua lingua, il partner sente nella sua',
      color: C.accent1 },
    { icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      title: L('featInstant') || 'Istantaneo', desc: L('featInstantDesc') || 'Traduzione in tempo reale con AI avanzata',
      color: C.accent2 },
    { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      title: L('featMulti') || '15+ lingue', desc: L('featMultiDesc') || 'Italiano, inglese, spagnolo, cinese e molto altro',
      color: C.accent4 },
    { icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
      title: L('featContexts') || '12 contesti', desc: L('featContextsDesc') || 'Medico, business, turismo, legale e altri',
      color: C.accent3 },
  ];

  // Inline SVG helper
  const SvgIcon = ({ d, size = 22, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );

  // Progress dots (hidden on hero)
  const dots = step > 0 ? (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:16}}>
      {STEPS.slice(1).map((s, i) => (
        <div key={s.key} onClick={() => { if (i + 1 <= step) setStep(i + 1); }}
          style={{cursor: i + 1 <= step ? 'pointer' : 'default', transition:'all 0.3s'}}>
          <div style={{width: (i + 1) === step ? 24 : 8, height:8, borderRadius:4, transition:'all 0.3s',
            background: (i + 1) < step ? C.accent4 : (i + 1) === step ? C.accent1 : C.textMuted,
            opacity: (i + 1) <= step ? 1 : 0.3}} />
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>

        {/* ═══════════════════════════════════════
            STEP 0: HERO — Features Showcase
           ═══════════════════════════════════════ */}
        {step === 0 && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:400}}>
            {/* Animated logo area */}
            <div style={{position:'relative', marginBottom:16, marginTop:8}}>
              <div style={{width:100, height:100, borderRadius:30, display:'flex', alignItems:'center', justifyContent:'center',
                background:`linear-gradient(135deg, ${C.accent1}30, ${C.accent2}20, ${C.accent4}15)`,
                boxShadow:`0 8px 40px ${C.accent1}20, 0 0 80px ${C.accent1}10`,
                animation:'vtHeroGlow 3s ease-in-out infinite'}}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
                  stroke={C.accent1} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <path d="M12 19v4M8 23h8" />
                </svg>
              </div>
              {/* Floating accent dots */}
              <div style={{position:'absolute', top:-4, right:-8, width:12, height:12, borderRadius:6,
                background:C.accent4, opacity:0.6, animation:'vtFloat 2.5s ease-in-out infinite'}} />
              <div style={{position:'absolute', bottom:8, left:-12, width:8, height:8, borderRadius:4,
                background:C.accent2, opacity:0.5, animation:'vtFloat 3s ease-in-out infinite 0.5s'}} />
              <div style={{position:'absolute', top:20, right:-16, width:6, height:6, borderRadius:3,
                background:C.accent3, opacity:0.4, animation:'vtFloat 2s ease-in-out infinite 1s'}} />
            </div>

            {/* Title */}
            <div style={{...S.title, fontSize:26, marginBottom:4, textAlign:'center'}}>VoiceTranslate</div>
            <div style={{fontSize:13, color:C.textSecondary, marginBottom:24, textAlign:'center', lineHeight:1.5, maxWidth:300}}>
              {L('heroSubtitle') || 'Il traduttore vocale che abbatte le barriere linguistiche in tempo reale'}
            </div>

            {/* Features grid */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%', marginBottom:24}}>
              {features.map((f, i) => (
                <div key={i} style={{padding:'16px 14px', borderRadius:18,
                  background:C.glassCard, border:`1px solid ${C.cardBorder}`,
                  backdropFilter:'blur(16px)', transition:'all 0.2s'}}>
                  <div style={{width:40, height:40, borderRadius:13, marginBottom:10,
                    background:`linear-gradient(135deg, ${f.color}20, ${f.color}08)`,
                    border:`1px solid ${f.color}22`,
                    display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <SvgIcon d={f.icon} size={20} color={f.color} />
                  </div>
                  <div style={{fontSize:13, fontWeight:700, color:C.textPrimary, marginBottom:3, lineHeight:1.3}}>
                    {f.title}
                  </div>
                  <div style={{fontSize:10, color:C.textTertiary, lineHeight:1.4}}>
                    {f.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* PRO Highlight Card */}
            <div style={{width:'100%', padding:'18px 16px', borderRadius:20, marginBottom:16,
              background:`linear-gradient(135deg, ${C.accent1}12, ${C.accent2}08)`,
              border:`1px solid ${C.accent1}25`,
              boxShadow:`0 4px 24px ${C.accent1}10`}}>
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
                <div style={{width:36, height:36, borderRadius:12,
                  background:`linear-gradient(135deg, ${C.accent1}, ${C.accent2})`,
                  display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <Icon name="star" size={18} color="#fff" />
                </div>
                <div>
                  <div style={{fontSize:14, fontWeight:800, color:C.textPrimary}}>
                    {L('proTitle') || 'VoiceTranslate PRO'}
                  </div>
                  <div style={{fontSize:10, color:C.textSecondary}}>
                    {L('proSubtitle') || 'Esperienza senza limiti'}
                  </div>
                </div>
              </div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {[
                  L('proBenefit1') || 'Voci AI naturali',
                  L('proBenefit2') || 'Nessun limite',
                  L('proBenefit3') || 'GPT-4 / Gemini',
                  L('proBenefit4') || 'ElevenLabs',
                ].map((b, i) => (
                  <span key={i} style={{fontSize:10, fontWeight:600, padding:'4px 10px', borderRadius:8,
                    background:`${C.accent1}15`, color:C.accent1, letterSpacing:0.2}}>
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA Buttons */}
            <button style={{
              width:'100%', padding:'16px', borderRadius:16, border:'none', cursor:'pointer',
              background:`linear-gradient(135deg, ${C.accent1}, ${C.accent2})`,
              color:'#fff', fontFamily:FONT, fontSize:16, fontWeight:800,
              letterSpacing:-0.3, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              boxShadow:`0 6px 28px ${C.accent1}40`,
              WebkitTapHighlightColor:'transparent', transition:'all 0.2s', marginBottom:10
            }} onClick={next}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.8 5.6 21.2 8 14 2 9.2h7.6L12 2z" />
              </svg>
              {L('heroStart') || 'Inizia ora'}
            </button>

            {!userToken && (
              <button style={{
                width:'100%', padding:'13px', borderRadius:14, cursor:'pointer',
                background:C.accent1Bg, border:`1px solid ${C.accent1Border}`,
                color:C.accent1, fontFamily:FONT, fontSize:13, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                WebkitTapHighlightColor:'transparent', transition:'all 0.2s'
              }} onClick={() => { savePrefs(prefs); setAuthStep('email'); setView('account'); }}>
                <Icon name="lock" size={15} color={C.accent1} />
                {L('heroSignIn') || 'Accedi a PRO'}
              </button>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
            STEPS 1-4: Setup wizard
           ═══════════════════════════════════════ */}
        {step > 0 && (
          <>
            {dots}

            <div style={{...S.card, padding:'22px 18px', position:'relative', overflow:'hidden', width:'100%', maxWidth:400}}>
              {/* Step counter */}
              <div style={{fontSize:10, color:C.textMuted, fontWeight:700, textAlign:'center',
                marginBottom:12, letterSpacing:1}}>
                {step} / {STEPS.length - 1}
              </div>

              {/* ─── STEP 1: NAME ─── */}
              {step === 1 && (
                <div>
                  <div style={{textAlign:'center', marginBottom:16}}>
                    <div style={{fontSize:16, fontWeight:700, color:C.textPrimary, letterSpacing:-0.3}}>
                      {L('welcomeNameTitle') || 'Come ti chiami?'}
                    </div>
                    <div style={{fontSize:12, color:C.textSecondary, marginTop:4}}>
                      {L('welcomeNameSub') || 'Il tuo nome sarà visibile al partner nella stanza'}
                    </div>
                  </div>
                  <input style={{...S.input, fontSize:18, textAlign:'center', padding:'14px 16px',
                    fontWeight:600, letterSpacing:-0.3}}
                    placeholder={L('namePlaceholder')} value={prefs.name}
                    onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20}
                    autoFocus />
                  {prefs.name.trim().length > 0 && prefs.name.trim().length < 2 && (
                    <div style={{fontSize:11, color:C.accent3, textAlign:'center', marginTop:8}}>
                      {L('nameMinChars') || 'Almeno 2 caratteri'}
                    </div>
                  )}
                </div>
              )}

              {/* ─── STEP 2: AVATAR ─── */}
              {step === 2 && (
                <div>
                  <div style={{textAlign:'center', marginBottom:16}}>
                    <div style={{fontSize:16, fontWeight:700, color:C.textPrimary}}>
                      {L('welcomeAvatarTitle') || 'Scegli il tuo avatar'}
                    </div>
                    <div style={{fontSize:12, color:C.textSecondary, marginTop:4}}>
                      {L('welcomeAvatarSub') || 'Il tuo personaggio nella conversazione'}
                    </div>
                  </div>
                  <div style={{display:'flex', justifyContent:'center', marginBottom:12}}>
                    <div style={{width:110, height:110, borderRadius:28, overflow:'hidden',
                      border:`3px solid ${C.accent1}`, boxShadow:`0 0 20px ${C.accent1Bg}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      background:C.accent1Bg}}>
                      <img src={prefs.avatar} alt="" style={{width:100, height:100, objectFit:'contain'}} />
                    </div>
                  </div>
                  <div style={{textAlign:'center', fontSize:14, fontWeight:700, color:C.accent1, marginBottom:12}}>
                    {AVATAR_NAMES[selectedAvatarIdx >= 0 ? selectedAvatarIdx : 0]}
                  </div>
                  <Carousel items={AVATARS}
                    selectedIndex={selectedAvatarIdx >= 0 ? selectedAvatarIdx : 0}
                    onSelect={(i) => setPrefs({...prefs, avatar: AVATARS[i]})}
                    itemWidth={90} gap={8}
                    renderItem={(avatar, i, isSelected) => (
                      <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                        <div style={{width:80, height:80, borderRadius:20, overflow:'hidden',
                          border: isSelected ? `2.5px solid ${C.accent1}` : '2.5px solid transparent',
                          background: isSelected ? C.accent1Bg : 'none',
                          display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s'}}>
                          <img src={avatar} alt={AVATAR_NAMES[i]} style={{width:70, height:70, objectFit:'contain'}} />
                        </div>
                        <span style={{fontSize:9, marginTop:3, color: isSelected ? C.accent1 : C.textSecondary,
                          fontWeight: isSelected ? 600 : 400, fontFamily:FONT}}>{AVATAR_NAMES[i]}</span>
                      </div>
                    )}
                  />
                </div>
              )}

              {/* ─── STEP 3: LANGUAGE ─── */}
              {step === 3 && (
                <div>
                  <div style={{textAlign:'center', marginBottom:16}}>
                    <div style={{fontSize:16, fontWeight:700, color:C.textPrimary}}>
                      {L('welcomeLangTitle') || 'Quale lingua parli?'}
                    </div>
                    <div style={{fontSize:12, color:C.textSecondary, marginTop:4}}>
                      {L('welcomeLangSub') || 'Puoi cambiarla in qualsiasi momento'}
                    </div>
                  </div>
                  <div style={{display:'flex', justifyContent:'center', marginBottom:8}}>
                    <div style={{fontSize:48}}>{LANGS[selectedLangIdx >= 0 ? selectedLangIdx : 0]?.flag}</div>
                  </div>
                  <div style={{textAlign:'center', fontSize:14, fontWeight:700, color:C.accent1, marginBottom:12}}>
                    {LANGS[selectedLangIdx >= 0 ? selectedLangIdx : 0]?.name}
                  </div>
                  <Carousel items={LANGS}
                    selectedIndex={selectedLangIdx >= 0 ? selectedLangIdx : 0}
                    onSelect={(i) => setPrefs({...prefs, lang: LANGS[i].code})}
                    itemWidth={72} gap={8}
                    renderItem={(lang, i, isSelected) => (
                      <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                        <div style={{width:52, height:52, borderRadius:26,
                          border: isSelected ? `2.5px solid ${C.accent1}` : '2.5px solid transparent',
                          background: isSelected ? C.accent1Bg : C.textMuted,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          transition:'all 0.2s', fontSize:26}}>
                          {lang.flag}
                        </div>
                        <span style={{fontSize:9, marginTop:3, maxWidth:68, overflow:'hidden',
                          textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center',
                          color: isSelected ? C.accent1 : C.textSecondary,
                          fontWeight: isSelected ? 600 : 400, fontFamily:FONT}}>{lang.name}</span>
                      </div>
                    )}
                  />
                </div>
              )}

              {/* ─── STEP 4: VOICE + CTA ─── */}
              {step === 4 && (
                <div>
                  <div style={{textAlign:'center', marginBottom:16}}>
                    <div style={{fontSize:16, fontWeight:700, color:C.textPrimary}}>
                      {L('welcomeVoiceTitle') || 'Scegli la voce AI'}
                    </div>
                    <div style={{fontSize:12, color:C.textSecondary, marginTop:4}}>
                      {L('welcomeVoiceSub') || 'La voce che leggerà le traduzioni'}
                    </div>
                  </div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginBottom:16}}>
                    {VOICES.map(v => {
                      const sel = prefs.voice === v;
                      return (
                        <button key={v} onClick={() => setPrefs({...prefs, voice:v})}
                          style={{padding:'10px 16px', borderRadius:12, cursor:'pointer',
                            fontFamily:FONT, fontSize:13, fontWeight: sel ? 700 : 500,
                            background: sel ? C.accent1Bg : C.overlayBg,
                            border: sel ? `1.5px solid ${C.accent1Border}` : `1px solid ${C.overlayBorder}`,
                            color: sel ? C.accent1 : C.textSecondary,
                            transition:'all 0.15s', WebkitTapHighlightColor:'transparent'}}>
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{fontSize:10, color:C.textTertiary, textAlign:'center', marginBottom:12}}>
                    {L('welcomeVoiceHint') || 'Le voci AI PRO sono molto più naturali della voce browser.'}
                  </div>
                </div>
              )}

              {/* ─── NAVIGATION BUTTONS ─── */}
              <div style={{display:'flex', gap:10, marginTop:16}}>
                <button onClick={prev} style={{flex:'0 0 48px', height:48, borderRadius:14, cursor:'pointer',
                  background:C.overlayBg, border:`1px solid ${C.overlayBorder}`,
                  color:C.textSecondary, fontSize:18, display:'flex', alignItems:'center',
                  justifyContent:'center', WebkitTapHighlightColor:'transparent'}}>
                  {'\u2190'}
                </button>
                {!isLast ? (
                  <button onClick={next} disabled={!canNext}
                    style={{flex:1, height:48, borderRadius:14, cursor: canNext ? 'pointer' : 'default',
                      background: canNext ? `linear-gradient(135deg, ${C.accent1} 0%, ${C.accent2} 100%)` : C.overlayBg,
                      border:'none', color: canNext ? '#fff' : C.textTertiary,
                      fontFamily:FONT, fontSize:15, fontWeight:700, letterSpacing:-0.3,
                      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                      opacity: canNext ? 1 : 0.5, transition:'all 0.2s',
                      WebkitTapHighlightColor:'transparent'}}>
                    {L('next') || 'Avanti'}
                    <span style={{fontSize:16}}>{'\u2192'}</span>
                  </button>
                ) : (
                  <div style={{flex:1, display:'flex', flexDirection:'column', gap:8}}>
                    {/* FREE button */}
                    <button style={{
                      width:'100%', padding:'14px 16px', borderRadius:14, border:'none', cursor:'pointer',
                      background:`linear-gradient(135deg, ${C.accent4} 0%, ${C.accent2} 100%)`,
                      color:'#0B0D1A', fontFamily:FONT,
                      display:'flex', alignItems:'center', gap:10,
                      WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
                      boxShadow:`0 4px 20px ${C.accent4Bg}`
                    }}
                      onClick={() => { savePrefs(prefs); if (joinCode) setView('join'); else setView('home'); }}>
                      <Icon name="zap" size={18} color="#0B0D1A" />
                      <div style={{flex:1, textAlign:'left'}}>
                        <div style={{fontWeight:800, fontSize:14}}>{L('startFreeMode') || 'Inizia Gratis'}</div>
                        <div style={{fontSize:10, opacity:0.7}}>{L('startFreeDesc') || 'Traduzioni base con voce browser'}</div>
                      </div>
                      <span style={{fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:6,
                        background:'rgba(0,0,0,0.12)', letterSpacing:0.5}}>FREE</span>
                    </button>
                    {/* PRO button */}
                    {!userToken && (
                      <button style={{
                        width:'100%', padding:'12px 16px', borderRadius:14, cursor:'pointer',
                        background:`linear-gradient(135deg, ${C.accent1}18, ${C.accent2}10)`,
                        border:`1px solid ${C.accent1Border}`,
                        color:C.textPrimary, fontFamily:FONT,
                        display:'flex', alignItems:'center', gap:10,
                        WebkitTapHighlightColor:'transparent', transition:'all 0.2s'
                      }}
                        onClick={() => { savePrefs(prefs); setAuthStep('email'); setView('account'); }}>
                        <Icon name="star" size={16} color={C.accent1} />
                        <div style={{flex:1, textAlign:'left'}}>
                          <div style={{fontWeight:700, fontSize:13}}>{L('signInPro') || 'Accedi a PRO'}</div>
                          <div style={{fontSize:10, color:C.textSecondary}}>
                            {L('signInProDesc') || 'Voci AI naturali, nessun limite'}
                          </div>
                        </div>
                        <span style={{fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:6,
                          background:C.accent1Bg, color:C.accent1, letterSpacing:0.5}}>PRO</span>
                      </button>
                    )}
                    {userToken && (
                      <button style={{
                        width:'100%', padding:'12px 16px', borderRadius:14, cursor:'pointer',
                        background:C.accent1Bg, border:`1px solid ${C.accent1Border}`,
                        color:C.accent1, fontFamily:FONT, fontSize:13, fontWeight:700, textAlign:'center',
                        WebkitTapHighlightColor:'transparent'
                      }}
                        onClick={() => { savePrefs(prefs); setView('home'); }}>
                        {L('letsStart') || 'Iniziamo'} (PRO)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>

      {/* Hero animations */}
      <style>{`
        @keyframes vtHeroGlow {
          0%, 100% { box-shadow: 0 8px 40px ${C.accent1}20, 0 0 80px ${C.accent1}10; }
          50% { box-shadow: 0 12px 50px ${C.accent1}35, 0 0 100px ${C.accent2}15; }
        }
        @keyframes vtFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
