'use client';
import { useState, useRef } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import Carousel from './Carousel.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════
// WELCOME VIEW — Premium Onboarding
// Step 0: Hero + features + PRO tiers
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
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredTier, setHoveredTier] = useState(null);
  const C = S.colors;
  const isDark = theme === 'dark' || theme === 'brown' || theme === 'orange';

  const selectedAvatarIdx = AVATARS.indexOf(prefs.avatar);
  const selectedLangIdx = LANGS.findIndex(l => l.code === prefs.lang);

  const canNext = step === 1 ? prefs.name.trim().length >= 2 : true;
  const isLast = step === STEPS.length - 1;

  function next() { if (canNext && step < STEPS.length - 1) setStep(step + 1); }
  function prev() { if (step > 0) setStep(step - 1); }

  // ── Premium 3D-style SVG icons with fills & depth ──
  const featureIcons = {
    voice: (color) => (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="vg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect x="9" y="1" width="6" height="14" rx="3" fill="url(#vg1)" stroke={color} strokeWidth="1.5" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M12 19v3M9 22h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="8" r="1.5" fill={color} opacity="0.4" />
      </svg>
    ),
    instant: (color) => (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="ig1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="url(#ig1)" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M13 2L3 14h9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      </svg>
    ),
    multilang: (color) => (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="mg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#mg1)" stroke={color} strokeWidth="1.3" />
        <ellipse cx="12" cy="12" rx="4.5" ry="10" stroke={color} strokeWidth="1" opacity="0.5" fill="none" />
        <path d="M2 12h20M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10c-2.5-3-4-6.5-4-10s1.5-7 4-10z" stroke={color} strokeWidth="0.8" opacity="0.35" fill="none" />
        <path d="M2 12h20" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    contexts: (color) => (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="cg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="3" fill="url(#cg1)" stroke={color} strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" fill={color} opacity="0.15" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </svg>
    ),
  };

  // ── Features data ──
  const features = [
    { iconKey: 'voice', title: L('featVoice') || 'Traduzione vocale',
      desc: L('featVoiceDesc') || 'Parla nella tua lingua, il partner sente nella sua', color: C.accent1 },
    { iconKey: 'instant', title: L('featInstant') || 'Istantaneo',
      desc: L('featInstantDesc') || 'Traduzione in tempo reale con AI avanzata', color: C.accent2 },
    { iconKey: 'multilang', title: L('featMulti') || '15+ lingue',
      desc: L('featMultiDesc') || 'Italiano, inglese, spagnolo, cinese e molto altro', color: C.accent4 },
    { iconKey: 'contexts', title: L('featContexts') || '12 contesti',
      desc: L('featContextsDesc') || 'Medico, business, turismo, legale e altri', color: C.accent3 },
  ];

  // ── Tier data for PRO scaling section ──
  const tiers = [
    { key: 'free', label: 'FREE', badge: '\u26A1', badgeColor: C.accent4,
      color: C.accent4, borderColor: C.accent4Border, bgColor: C.accent4Bg,
      features: [
        L('tierFreeF1') || 'Voce browser base',
        L('tierFreeF2') || '50 traduzioni/giorno',
        L('tierFreeF3') || 'Contesti limitati',
      ],
      tagline: L('tierFreeTag') || 'Perfetto per iniziare',
    },
    { key: 'starter', label: 'STARTER', badge: '\u2B50', badgeColor: C.accent1,
      color: C.accent1, borderColor: C.accent1Border, bgColor: C.accent1Bg,
      features: [
        L('tierStarterF1') || 'Voci AI OpenAI',
        L('tierStarterF2') || '500 traduzioni/giorno',
        L('tierStarterF3') || 'Tutti i contesti',
        L('tierStarterF4') || 'Cronologia completa',
      ],
      tagline: L('tierStarterTag') || 'Per uso quotidiano',
    },
    { key: 'pro', label: 'PRO', badge: '\uD83C\uDFC6', badgeColor: C.goldAccent,
      color: C.goldAccent, borderColor: `${C.goldAccent}40`, bgColor: `${C.goldAccent}12`,
      features: [
        L('tierProF1') || 'Voci ElevenLabs premium',
        L('tierProF2') || 'Traduzioni illimitate',
        L('tierProF3') || 'Usa le TUE API keys',
        L('tierProF4') || 'GPT-4o / Gemini Pro',
        L('tierProF5') || 'Supporto prioritario',
      ],
      tagline: L('tierProTag') || 'Massima libertà e qualità',
      isPro: true,
    },
  ];

  // Glass card style generator
  const glassCard = (isHovered, accentColor) => ({
    padding: '18px 16px',
    borderRadius: 20,
    background: isDark
      ? `rgba(255,255,255,${isHovered ? 0.08 : 0.04})`
      : `rgba(255,255,255,${isHovered ? 0.92 : 0.75})`,
    border: `1px solid ${isHovered ? (accentColor || C.accent1) + '40' : C.cardBorder}`,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: isHovered
      ? (isDark
          ? `0 8px 32px ${(accentColor || C.accent1)}25, 0 0 0 1px ${(accentColor || C.accent1)}15, inset 0 1px 0 rgba(255,255,255,0.08)`
          : `0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px ${(accentColor || C.accent1)}20, inset 0 1px 0 rgba(255,255,255,0.9)`)
      : (isDark
          ? '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
          : '0 2px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)'),
    transform: isHovered ? 'scale(1.03) translateY(-2px)' : 'scale(1) translateY(0)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'default',
  });

  // Progress dots
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
            STEP 0: HERO — Premium Glass Showcase
           ═══════════════════════════════════════ */}
        {step === 0 && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:420, padding:'0 4px'}}>

            {/* ── Animated Logo ── */}
            <div style={{position:'relative', marginBottom:20, marginTop:8}}>
              <div style={{width:96, height:96, borderRadius:28, display:'flex', alignItems:'center', justifyContent:'center',
                background: isDark
                  ? `linear-gradient(135deg, ${C.accent1}28, ${C.accent2}18, ${C.accent4}12)`
                  : `linear-gradient(135deg, ${C.accent1}18, ${C.accent2}12, ${C.accent4}08)`,
                boxShadow: isDark
                  ? `0 8px 40px ${C.accent1}22, 0 0 80px ${C.accent1}10`
                  : `0 8px 30px ${C.accent1}15, 0 0 60px ${C.accent1}06`,
                animation:'vtHeroGlow 3s ease-in-out infinite'}}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="logoG" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={C.accent1} />
                      <stop offset="100%" stopColor={C.accent2} />
                    </linearGradient>
                  </defs>
                  <rect x="9" y="1" width="6" height="14" rx="3" fill="url(#logoG)" opacity="0.2" stroke="url(#logoG)" strokeWidth="1.5" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="url(#logoG)" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M12 19v4M8 23h8" stroke="url(#logoG)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              {/* Floating particles */}
              <div style={{position:'absolute', top:-6, right:-10, width:14, height:14, borderRadius:7,
                background:C.accent4, opacity:0.6, animation:'vtFloat 2.5s ease-in-out infinite'}} />
              <div style={{position:'absolute', bottom:6, left:-14, width:10, height:10, borderRadius:5,
                background:C.accent2, opacity:0.5, animation:'vtFloat 3s ease-in-out infinite 0.5s'}} />
              <div style={{position:'absolute', top:18, right:-18, width:7, height:7, borderRadius:4,
                background:C.accent3, opacity:0.45, animation:'vtFloat 2s ease-in-out infinite 1s'}} />
              <div style={{position:'absolute', bottom:-4, right:10, width:5, height:5, borderRadius:3,
                background:C.accent1, opacity:0.35, animation:'vtFloat 2.8s ease-in-out infinite 0.3s'}} />
            </div>

            {/* ── Title ── */}
            <div style={{...S.title, fontSize:28, marginBottom:4, textAlign:'center',
              background:`linear-gradient(135deg, ${C.textPrimary}, ${C.accent1})`,
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text'}}>
              VoiceTranslate
            </div>
            <div style={{fontSize:13, color:C.textSecondary, marginBottom:28, textAlign:'center', lineHeight:1.5, maxWidth:310}}>
              {L('heroSubtitle') || 'Il traduttore vocale che abbatte le barriere linguistiche in tempo reale'}
            </div>

            {/* ── Features Grid — Glass Morphism Cards ── */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, width:'100%', marginBottom:28}}>
              {features.map((f, i) => (
                <div key={i}
                  onMouseEnter={() => setHoveredCard(i)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={glassCard(hoveredCard === i, f.color)}>
                  <div style={{width:44, height:44, borderRadius:14, marginBottom:12,
                    background: isDark
                      ? `linear-gradient(135deg, ${f.color}22, ${f.color}08)`
                      : `linear-gradient(135deg, ${f.color}18, ${f.color}06)`,
                    border:`1px solid ${f.color}${hoveredCard === i ? '35' : '18'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all 0.3s',
                    boxShadow: hoveredCard === i ? `0 4px 16px ${f.color}20` : 'none'}}>
                    {featureIcons[f.iconKey](f.color)}
                  </div>
                  <div style={{fontSize:13, fontWeight:700, color:C.textPrimary, marginBottom:4, lineHeight:1.3}}>
                    {f.title}
                  </div>
                  <div style={{fontSize:10.5, color:C.textTertiary, lineHeight:1.45}}>
                    {f.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Vertical Tier Scaling — FREE → STARTER → PRO ── */}
            <div style={{width:'100%', marginBottom:24}}>
              <div style={{textAlign:'center', marginBottom:16}}>
                <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, textTransform:'uppercase',
                  color:C.textMuted, marginBottom:6}}>
                  {L('tierScaleLabel') || 'SCALA VERSO LA QUALITÀ'}
                </div>
                {/* Vertical arrow indicator */}
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:4}}>
                  <div style={{width:24, height:1, background:C.dividerColor}} />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent1} strokeWidth="2" strokeLinecap="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                  <div style={{width:24, height:1, background:C.dividerColor}} />
                </div>
              </div>

              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {tiers.map((tier, i) => {
                  const isH = hoveredTier === i;
                  const isPro = tier.isPro;
                  return (
                    <div key={tier.key}
                      onMouseEnter={() => setHoveredTier(i)}
                      onMouseLeave={() => setHoveredTier(null)}
                      style={{
                        padding: isPro ? '20px 18px' : '14px 16px',
                        borderRadius: isPro ? 22 : 18,
                        background: isDark
                          ? isPro
                            ? `linear-gradient(135deg, ${C.goldAccent}10, ${C.accent1}08, ${C.accent2}06)`
                            : `rgba(255,255,255,${isH ? 0.07 : 0.04})`
                          : isPro
                            ? `linear-gradient(135deg, ${C.goldAccent}08, ${C.accent1}05, rgba(255,255,255,0.9))`
                            : `rgba(255,255,255,${isH ? 0.88 : 0.7})`,
                        border: `1px solid ${isPro
                          ? (isH ? `${C.goldAccent}50` : `${C.goldAccent}30`)
                          : (isH ? tier.color + '40' : C.cardBorder)}`,
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        boxShadow: isH
                          ? (isPro
                              ? `0 8px 32px ${C.goldAccent}20, 0 0 0 1px ${C.goldAccent}12`
                              : `0 6px 24px ${tier.color}15, 0 0 0 1px ${tier.color}10`)
                          : (isPro
                              ? `0 4px 20px ${C.goldAccent}10`
                              : '0 2px 8px rgba(0,0,0,0.06)'),
                        transform: isH ? 'scale(1.015) translateY(-1px)' : 'scale(1)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}>
                      {/* PRO shimmer effect */}
                      {isPro && (
                        <div style={{position:'absolute', top:0, right:0, width:80, height:'100%',
                          background:`linear-gradient(90deg, transparent, ${C.goldAccent}05, transparent)`,
                          animation:'vtShimmer 3s ease-in-out infinite', pointerEvents:'none'}} />
                      )}

                      <div style={{display:'flex', alignItems:'flex-start', gap:14, position:'relative', zIndex:1}}>
                        {/* Tier badge */}
                        <div style={{width:isPro ? 48 : 40, height:isPro ? 48 : 40, borderRadius:isPro ? 16 : 13,
                          background: isDark
                            ? `linear-gradient(135deg, ${tier.color}25, ${tier.color}10)`
                            : `linear-gradient(135deg, ${tier.color}18, ${tier.color}06)`,
                          border:`1px solid ${tier.color}${isH ? '40' : '22'}`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize: isPro ? 22 : 18, flexShrink:0,
                          boxShadow: isH ? `0 4px 12px ${tier.color}20` : 'none',
                          transition:'all 0.3s'}}>
                          {tier.badge}
                        </div>

                        <div style={{flex:1, minWidth:0}}>
                          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                            <span style={{fontSize:isPro ? 15 : 13, fontWeight:800, color:tier.color, letterSpacing:isPro ? 1 : 0.5}}>
                              {tier.label}
                            </span>
                            {isPro && (
                              <span style={{fontSize:8, fontWeight:800, padding:'2px 8px', borderRadius:6,
                                background:`linear-gradient(135deg, ${C.goldAccent}25, ${C.accent1}15)`,
                                color:C.goldAccent, letterSpacing:1, textTransform:'uppercase',
                                border:`1px solid ${C.goldAccent}25`}}>
                                {'\u2605'} PREMIUM
                              </span>
                            )}
                          </div>
                          <div style={{fontSize:11, color:C.textTertiary, marginBottom:8, fontStyle:'italic'}}>
                            {tier.tagline}
                          </div>
                          <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                            {tier.features.map((feat, fi) => (
                              <span key={fi} style={{fontSize:9.5, fontWeight:600, padding:'3px 9px', borderRadius:7,
                                background: isDark ? `${tier.color}12` : `${tier.color}10`,
                                color: isDark ? tier.color : tier.color,
                                border:`1px solid ${tier.color}15`,
                                letterSpacing:0.1}}>
                                {feat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Freedom / Sponsor Message ── */}
            <div style={{width:'100%', padding:'16px 18px', borderRadius:18, marginBottom:20,
              background: isDark
                ? `linear-gradient(135deg, ${C.accent1}08, ${C.accent2}05)`
                : `linear-gradient(135deg, ${C.accent1}06, ${C.accent2}04, rgba(255,255,255,0.8))`,
              border:`1px solid ${C.accent1}18`,
              backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)'}}>
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
                <div style={{width:32, height:32, borderRadius:10,
                  background:`linear-gradient(135deg, ${C.accent2}20, ${C.accent4}15)`,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent2} strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" />
                  </svg>
                </div>
                <div style={{fontSize:13, fontWeight:700, color:C.textPrimary}}>
                  {L('freedomTitle') || 'La tua libertà, le tue regole'}
                </div>
              </div>
              <div style={{fontSize:11.5, color:C.textSecondary, lineHeight:1.6, marginBottom:8}}>
                {L('freedomDesc') || 'Con PRO puoi usare le tue API keys personali (OpenAI, ElevenLabs) o pagare solo per quello che usi. Noi ti facilitiamo la vita.'}
              </div>
              <div style={{display:'flex', alignItems:'center', gap:6}}>
                <div style={{width:20, height:20, borderRadius:6,
                  background:C.accent4Bg, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.accent4} strokeWidth="2.5" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <span style={{fontSize:11, color:C.accent4, fontWeight:700}}>
                  {L('freeSponsored') || 'Uso FREE sponsorizzato — inizia subito senza costi'}
                </span>
              </div>
            </div>

            {/* ── CTA Buttons ── */}
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
                <Icon name="star" size={15} color={C.accent1} />
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

      {/* Animations */}
      <style>{`
        @keyframes vtHeroGlow {
          0%, 100% { box-shadow: 0 8px 40px ${C.accent1}20, 0 0 80px ${C.accent1}10; }
          50% { box-shadow: 0 12px 50px ${C.accent1}35, 0 0 100px ${C.accent2}15; }
        }
        @keyframes vtFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes vtShimmer {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
