'use client';
import { useState, useRef, useEffect } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import Carousel from './Carousel.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════
// WELCOME VIEW — Immersive 3D Onboarding
// Step 0: Hero with animated orbs & emotional CTA
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
  const [entered, setEntered] = useState(false);
  const C = S.colors;
  const isDark = theme === 'dark' || theme === 'brown' || theme === 'orange';

  // Helper: L() returns the key itself when not found in i18n — this helper uses the fallback instead
  const Lf = (key, fallback) => { const v = L(key); return (v && v !== key) ? v : fallback; };

  // Trigger entrance animation on mount and step change
  useEffect(() => {
    setEntered(false);
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, [step]);

  const selectedAvatarIdx = AVATARS.indexOf(prefs.avatar);
  const selectedLangIdx = LANGS.findIndex(l => l.code === prefs.lang);

  const canNext = step === 1 ? prefs.name.trim().length >= 2 : true;
  const isLast = step === STEPS.length - 1;

  function next() { if (canNext && step < STEPS.length - 1) setStep(step + 1); }
  function prev() { if (step > 0) setStep(step - 1); }

  // ── Stagger delay helper ──
  const stagger = (i, base = 0) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.96)',
    transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${base + i * 0.08}s`,
  });

  // ── Features data with emoji icons (much more alive than SVG) ──
  const features = [
    { emoji: '\uD83C\uDFA4', title: Lf('featVoice', 'Traduzione vocale'),
      desc: Lf('featVoiceDesc', 'Parla nella tua lingua, il partner sente nella sua'), color: C.accent1 },
    { emoji: '\u26A1', title: Lf('featInstant', 'Istantaneo'),
      desc: Lf('featInstantDesc', 'Traduzione in tempo reale con AI avanzata'), color: C.accent2 },
    { emoji: '\uD83C\uDF0D', title: Lf('featMulti', '15+ lingue'),
      desc: Lf('featMultiDesc', 'Italiano, inglese, spagnolo, cinese e molto altro'), color: C.accent4 },
    { emoji: '\uD83C\uDFAF', title: Lf('featContexts', '12 contesti'),
      desc: Lf('featContextsDesc', 'Medico, business, turismo, legale e altri'), color: C.accent3 },
  ];

  // ── Tier data ──
  const tiers = [
    { key: 'free', label: 'FREE', emoji: '\u26A1', color: C.accent4,
      features: [
        Lf('tierFreeF1', 'Voce browser base'),
        Lf('tierFreeF2', '50 traduzioni/giorno'),
        Lf('tierFreeF3', 'Contesti limitati'),
      ],
      tagline: Lf('tierFreeTag', 'Perfetto per iniziare'),
    },
    { key: 'starter', label: 'STARTER', emoji: '\uD83D\uDE80', color: C.accent1,
      features: [
        Lf('tierStarterF1', 'Voci AI OpenAI'),
        Lf('tierStarterF2', '500 traduzioni/giorno'),
        Lf('tierStarterF3', 'Tutti i contesti'),
        Lf('tierStarterF4', 'Cronologia completa'),
      ],
      tagline: Lf('tierStarterTag', 'Per uso quotidiano'),
    },
    { key: 'pro', label: 'PRO', emoji: '\uD83D\uDC8E', color: C.goldAccent,
      features: [
        Lf('tierProF1', 'Voci ElevenLabs premium'),
        Lf('tierProF2', 'Traduzioni illimitate'),
        Lf('tierProF3', 'Usa le TUE API keys'),
        Lf('tierProF4', 'GPT-4o / Gemini Pro'),
        Lf('tierProF5', 'Supporto prioritario'),
      ],
      tagline: Lf('tierProTag', 'Massima libertà e qualità'),
      isPro: true,
    },
  ];

  // ── 3D Glass Card ──
  const glassCard = (isHovered, accentColor, i) => ({
    padding: '20px 16px',
    borderRadius: 24,
    background: isDark
      ? `rgba(255,255,255,${isHovered ? 0.10 : 0.05})`
      : `rgba(255,255,255,${isHovered ? 0.95 : 0.80})`,
    border: `1px solid ${isHovered ? (accentColor || C.accent1) + '55' : 'rgba(255,255,255,0.15)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isHovered
      ? `0 20px 60px ${(accentColor || C.accent1)}30, 0 0 0 1px ${(accentColor || C.accent1)}20, inset 0 1px 0 rgba(255,255,255,${isDark?'0.12':'0.9'})`
      : `0 8px 32px rgba(0,0,0,${isDark?'0.4':'0.06'}), inset 0 1px 0 rgba(255,255,255,${isDark?'0.06':'0.7'})`,
    transform: isHovered
      ? 'perspective(800px) rotateX(-2deg) rotateY(2deg) scale(1.04) translateY(-4px)'
      : 'perspective(800px) rotateX(0) rotateY(0) scale(1) translateY(0)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: 'default',
    position: 'relative',
    overflow: 'hidden',
    ...stagger(i, 0.2),
  });

  // Progress dots
  const dots = step > 0 ? (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:20}}>
      {STEPS.slice(1).map((s, i) => (
        <div key={s.key} onClick={() => { if (i + 1 <= step) setStep(i + 1); }}
          style={{cursor: i + 1 <= step ? 'pointer' : 'default', transition:'all 0.4s'}}>
          <div style={{
            width: (i + 1) === step ? 28 : 10,
            height: 10,
            borderRadius: 5,
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            background: (i + 1) < step
              ? `linear-gradient(135deg, ${C.accent4}, ${C.accent2})`
              : (i + 1) === step
                ? `linear-gradient(135deg, ${C.accent1}, ${C.accent2})`
                : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
            boxShadow: (i + 1) === step ? `0 0 12px ${C.accent1}50` : 'none',
          }} />
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div style={{...S.page}}>

      {/* ═══ BACKGROUND ORB EFFECTS — Always visible ═══ */}
      <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, pointerEvents:'none', zIndex:0, overflow:'hidden'}}>
        {/* Main gradient orb - top right */}
        <div style={{
          position:'absolute', top:'-15%', right:'-20%',
          width:'70vw', height:'70vw', maxWidth:500, maxHeight:500,
          borderRadius:'50%',
          background: `radial-gradient(circle, ${C.accent1}${isDark?'25':'18'}, ${C.accent2}${isDark?'12':'08'}, transparent 70%)`,
          filter: 'blur(60px)',
          animation: 'vtOrb1 8s ease-in-out infinite',
        }} />
        {/* Secondary orb - bottom left */}
        <div style={{
          position:'absolute', bottom:'-10%', left:'-15%',
          width:'60vw', height:'60vw', maxWidth:400, maxHeight:400,
          borderRadius:'50%',
          background: `radial-gradient(circle, ${C.accent4}${isDark?'20':'12'}, ${C.accent3}${isDark?'10':'06'}, transparent 70%)`,
          filter: 'blur(50px)',
          animation: 'vtOrb2 10s ease-in-out infinite',
        }} />
        {/* Accent orb - center */}
        <div style={{
          position:'absolute', top:'40%', left:'50%',
          width:'40vw', height:'40vw', maxWidth:300, maxHeight:300,
          borderRadius:'50%',
          background: `radial-gradient(circle, ${C.accent2}${isDark?'15':'08'}, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'vtOrb3 12s ease-in-out infinite',
          transform: 'translateX(-50%)',
        }} />
      </div>

      <div style={{...S.scrollCenter, position:'relative', zIndex:1}}>

        {/* ═══════════════════════════════════════
            STEP 0: HERO — Immersive 3D Experience
           ═══════════════════════════════════════ */}
        {step === 0 && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:420, padding:'0 8px'}}>

            {/* ── 3D Animated Logo Orb ── */}
            <div style={{
              position:'relative', marginBottom:24, marginTop:12,
              ...stagger(0),
            }}>
              {/* Outer glow ring */}
              <div style={{
                position:'absolute', top:-16, left:-16, right:-16, bottom:-16,
                borderRadius:'50%',
                background: `conic-gradient(from 0deg, ${C.accent1}00, ${C.accent1}30, ${C.accent2}30, ${C.accent4}20, ${C.accent3}15, ${C.accent1}00)`,
                animation: 'vtSpin 6s linear infinite',
                filter: 'blur(12px)',
                opacity: 0.7,
              }} />
              {/* Inner logo container */}
              <div style={{
                width: 110, height: 110, borderRadius: '50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                background: isDark
                  ? `radial-gradient(circle at 35% 35%, ${C.accent1}35, ${C.accent2}18, rgba(20,20,40,0.9))`
                  : `radial-gradient(circle at 35% 35%, ${C.accent1}22, ${C.accent2}12, rgba(255,255,255,0.95))`,
                boxShadow: isDark
                  ? `0 0 60px ${C.accent1}30, 0 0 120px ${C.accent2}15, inset 0 -4px 12px ${C.accent1}15, inset 0 4px 8px rgba(255,255,255,0.08)`
                  : `0 0 40px ${C.accent1}20, 0 0 80px ${C.accent2}10, inset 0 -4px 12px ${C.accent1}08, inset 0 4px 8px rgba(255,255,255,0.6)`,
                border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.5)'}`,
                animation: 'vtLogoFloat 4s ease-in-out infinite',
                position: 'relative',
                zIndex: 2,
              }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="heroLogoG" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={C.accent1} />
                      <stop offset="50%" stopColor={C.accent2} />
                      <stop offset="100%" stopColor={C.accent1} />
                    </linearGradient>
                    <filter id="heroGlow">
                      <feGaussianBlur stdDeviation="1.5" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <g filter="url(#heroGlow)">
                    <rect x="9" y="1" width="6" height="14" rx="3" fill="url(#heroLogoG)" opacity="0.4" stroke="url(#heroLogoG)" strokeWidth="1.5" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="url(#heroLogoG)" strokeWidth="2" strokeLinecap="round" />
                    <path d="M12 19v4M8 23h8" stroke="url(#heroLogoG)" strokeWidth="1.5" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
              {/* Orbiting particles */}
              <div style={{position:'absolute', top:0, left:0, right:0, bottom:0, animation:'vtSpin 8s linear infinite', pointerEvents:'none'}}>
                <div style={{position:'absolute', top:-8, left:'50%', width:10, height:10, borderRadius:'50%',
                  background:`radial-gradient(circle, ${C.accent4}, ${C.accent4}00)`,
                  boxShadow:`0 0 12px ${C.accent4}80`}} />
              </div>
              <div style={{position:'absolute', top:0, left:0, right:0, bottom:0, animation:'vtSpin 12s linear infinite reverse', pointerEvents:'none'}}>
                <div style={{position:'absolute', bottom:-5, left:'50%', width:7, height:7, borderRadius:'50%',
                  background:`radial-gradient(circle, ${C.accent3}, ${C.accent3}00)`,
                  boxShadow:`0 0 10px ${C.accent3}60`}} />
              </div>
              <div style={{position:'absolute', top:0, left:0, right:0, bottom:0, animation:'vtSpin 15s linear infinite', pointerEvents:'none'}}>
                <div style={{position:'absolute', top:'50%', right:-12, width:6, height:6, borderRadius:'50%',
                  background:`radial-gradient(circle, ${C.accent2}, ${C.accent2}00)`,
                  boxShadow:`0 0 8px ${C.accent2}50`}} />
              </div>
            </div>

            {/* ── Title with gradient shimmer ── */}
            <div style={{
              ...S.title, fontSize: 32, marginBottom: 6, textAlign: 'center',
              background: `linear-gradient(135deg, ${C.textPrimary} 0%, ${C.accent1} 40%, ${C.accent2} 60%, ${C.textPrimary} 100%)`,
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              animation: 'vtTitleShimmer 4s ease-in-out infinite',
              letterSpacing: -1,
              ...stagger(1),
            }}>
              VoiceTranslate
            </div>
            <div style={{
              fontSize: 14, color: C.textSecondary, marginBottom: 32, textAlign: 'center',
              lineHeight: 1.6, maxWidth: 320, fontWeight: 500,
              ...stagger(2),
            }}>
              {Lf('heroSubtitle', 'Il traduttore vocale che abbatte le barriere linguistiche in tempo reale')}
            </div>

            {/* ── Animated sound wave divider ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
              marginBottom: 28, height: 20,
              ...stagger(3, 0.1),
            }}>
              {[0.3, 0.6, 1, 0.7, 1, 0.8, 0.5, 1, 0.6, 0.4, 0.8, 1, 0.5].map((h, i) => (
                <div key={i} style={{
                  width: 3, borderRadius: 2,
                  background: `linear-gradient(to top, ${C.accent1}, ${C.accent2})`,
                  opacity: 0.6,
                  animation: `vtWave 1.2s ease-in-out ${i * 0.08}s infinite`,
                  height: h * 18,
                }} />
              ))}
            </div>

            {/* ── Features Grid — 3D Glass Cards with Perspective ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
              width: '100%', marginBottom: 32,
              perspective: '1000px',
            }}>
              {features.map((f, i) => (
                <div key={i}
                  onMouseEnter={() => setHoveredCard(i)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onTouchStart={() => setHoveredCard(i)}
                  onTouchEnd={() => setTimeout(() => setHoveredCard(null), 300)}
                  onClick={next}
                  style={{...glassCard(hoveredCard === i, f.color, i), cursor: 'pointer'}}>
                  {/* Hover glow effect */}
                  {hoveredCard === i && (
                    <div style={{
                      position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
                      background: `radial-gradient(circle at 50% 80%, ${f.color}18, transparent 60%)`,
                      pointerEvents: 'none',
                    }} />
                  )}
                  {/* 3D Emoji icon with glow */}
                  <div style={{
                    width: 52, height: 52, borderRadius: 16, marginBottom: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28,
                    background: isDark
                      ? `linear-gradient(145deg, ${f.color}20, ${f.color}08)`
                      : `linear-gradient(145deg, ${f.color}15, ${f.color}05)`,
                    boxShadow: hoveredCard === i
                      ? `0 8px 24px ${f.color}30, inset 0 1px 0 rgba(255,255,255,${isDark?'0.1':'0.5'})`
                      : `0 4px 12px ${f.color}12, inset 0 1px 0 rgba(255,255,255,${isDark?'0.06':'0.4'})`,
                    border: `1px solid ${f.color}${hoveredCard === i ? '40' : '18'}`,
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: hoveredCard === i ? 'scale(1.1) rotate(-3deg)' : 'scale(1) rotate(0deg)',
                    position: 'relative', zIndex: 1,
                  }}>
                    {f.emoji}
                  </div>
                  <div style={{
                    fontSize: 13.5, fontWeight: 700, color: C.textPrimary,
                    marginBottom: 5, lineHeight: 1.3, position: 'relative', zIndex: 1,
                  }}>
                    {f.title}
                  </div>
                  <div style={{
                    fontSize: 11, color: C.textTertiary, lineHeight: 1.5,
                    position: 'relative', zIndex: 1,
                  }}>
                    {f.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Tier Scaling — Layered 3D Stack ── */}
            <div style={{width: '100%', marginBottom: 28}}>
              <div style={{
                textAlign: 'center', marginBottom: 18,
                ...stagger(0, 0.5),
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
                  background: `linear-gradient(135deg, ${C.textMuted}, ${C.accent1})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  marginBottom: 8,
                }}>
                  {Lf('tierScaleLabel', 'SCALA VERSO LA QUALITÀ')}
                </div>
                {/* Animated arrow */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <div style={{width: 30, height: 1, background: `linear-gradient(to right, transparent, ${C.accent1}40)`}} />
                  <div style={{animation: 'vtArrowBounce 2s ease-in-out infinite'}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <defs>
                        <linearGradient id="arrowG" x1="0%" y1="100%" x2="0%" y2="0%">
                          <stop offset="0%" stopColor={C.accent2} />
                          <stop offset="100%" stopColor={C.accent1} />
                        </linearGradient>
                      </defs>
                      <path d="M12 19V5M5 12l7-7 7 7" stroke="url(#arrowG)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={{width: 30, height: 1, background: `linear-gradient(to left, transparent, ${C.accent1}40)`}} />
                </div>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 12, perspective: '800px'}}>
                {tiers.map((tier, i) => {
                  const isH = hoveredTier === i;
                  const isPro = tier.isPro;
                  return (
                    <div key={tier.key}
                      onMouseEnter={() => setHoveredTier(i)}
                      onMouseLeave={() => setHoveredTier(null)}
                      onClick={() => {
                        // Tap tier → auto-advance to setup wizard
                        if (tier.isPro && !userToken) {
                          // PRO without login → go to auth
                          savePrefs(prefs); setAuthStep('email'); setView('account');
                        } else {
                          next();
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: isPro ? '22px 20px' : '16px 18px',
                        borderRadius: isPro ? 24 : 20,
                        background: isDark
                          ? isPro
                            ? `linear-gradient(135deg, ${C.goldAccent}12, ${C.accent1}08, rgba(30,30,50,0.8))`
                            : `rgba(255,255,255,${isH ? 0.08 : 0.04})`
                          : isPro
                            ? `linear-gradient(135deg, ${C.goldAccent}10, ${C.accent1}06, rgba(255,255,255,0.92))`
                            : `rgba(255,255,255,${isH ? 0.90 : 0.72})`,
                        border: `1px solid ${isPro
                          ? (isH ? `${C.goldAccent}60` : `${C.goldAccent}30`)
                          : (isH ? tier.color + '45' : 'rgba(255,255,255,0.12)')}`,
                        backdropFilter: 'blur(20px) saturate(150%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                        boxShadow: isH
                          ? (isPro
                              ? `0 16px 48px ${C.goldAccent}25, 0 0 0 1px ${C.goldAccent}15, inset 0 1px 0 rgba(255,255,255,0.1)`
                              : `0 12px 36px ${tier.color}18, 0 0 0 1px ${tier.color}12, inset 0 1px 0 rgba(255,255,255,0.08)`)
                          : (isPro
                              ? `0 6px 24px ${C.goldAccent}12, inset 0 1px 0 rgba(255,255,255,0.06)`
                              : `0 4px 16px rgba(0,0,0,${isDark?'0.2':'0.04'}), inset 0 1px 0 rgba(255,255,255,${isDark?'0.04':'0.6'})`),
                        transform: isH
                          ? 'perspective(600px) rotateX(-1deg) scale(1.02) translateY(-3px)'
                          : 'perspective(600px) rotateX(0) scale(1) translateY(0)',
                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        position: 'relative',
                        overflow: 'hidden',
                        ...stagger(i, 0.6),
                      }}>
                      {/* PRO animated shimmer */}
                      {isPro && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                          background: `linear-gradient(105deg, transparent 40%, ${C.goldAccent}08 50%, transparent 60%)`,
                          backgroundSize: '200% 100%',
                          animation: 'vtProShimmer 3s ease-in-out infinite',
                          pointerEvents: 'none',
                        }} />
                      )}

                      <div style={{display: 'flex', alignItems: 'flex-start', gap: 16, position: 'relative', zIndex: 1}}>
                        {/* 3D Emoji badge */}
                        <div style={{
                          width: isPro ? 54 : 44, height: isPro ? 54 : 44,
                          borderRadius: isPro ? 18 : 14,
                          background: isDark
                            ? `linear-gradient(145deg, ${tier.color}25, ${tier.color}08)`
                            : `linear-gradient(145deg, ${tier.color}20, ${tier.color}06)`,
                          border: `1px solid ${tier.color}${isH ? '45' : '20'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: isPro ? 26 : 22, flexShrink: 0,
                          boxShadow: isH
                            ? `0 8px 20px ${tier.color}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                            : `0 4px 10px ${tier.color}10`,
                          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                          transform: isH ? 'scale(1.08) rotate(-5deg)' : 'scale(1)',
                        }}>
                          {tier.emoji}
                        </div>

                        <div style={{flex: 1, minWidth: 0}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5}}>
                            <span style={{
                              fontSize: isPro ? 16 : 14, fontWeight: 800,
                              color: tier.color, letterSpacing: isPro ? 1.5 : 0.8,
                            }}>
                              {tier.label}
                            </span>
                            {isPro && (
                              <span style={{
                                fontSize: 8, fontWeight: 800, padding: '3px 10px', borderRadius: 8,
                                background: `linear-gradient(135deg, ${C.goldAccent}30, ${C.accent1}18)`,
                                color: C.goldAccent, letterSpacing: 1.5, textTransform: 'uppercase',
                                border: `1px solid ${C.goldAccent}30`,
                                boxShadow: `0 2px 8px ${C.goldAccent}15`,
                              }}>
                                PREMIUM
                              </span>
                            )}
                          </div>
                          <div style={{fontSize: 11.5, color: C.textTertiary, marginBottom: 10, fontStyle: 'italic'}}>
                            {tier.tagline}
                          </div>
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: 5}}>
                            {tier.features.map((feat, fi) => (
                              <span key={fi} style={{
                                fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                                background: isDark ? `${tier.color}14` : `${tier.color}10`,
                                color: tier.color,
                                border: `1px solid ${tier.color}18`,
                                letterSpacing: 0.1,
                              }}>
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

            {/* ── Freedom / Sponsor — Glass Panel ── */}
            <div style={{
              width: '100%', padding: '18px 20px', borderRadius: 22, marginBottom: 24,
              background: isDark
                ? `linear-gradient(135deg, ${C.accent1}08, ${C.accent2}05, rgba(20,20,40,0.6))`
                : `linear-gradient(135deg, ${C.accent1}06, ${C.accent2}04, rgba(255,255,255,0.85))`,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)'}`,
              backdropFilter: 'blur(16px) saturate(150%)',
              WebkitBackdropFilter: 'blur(16px) saturate(150%)',
              boxShadow: `0 8px 32px rgba(0,0,0,${isDark ? '0.3' : '0.05'})`,
              ...stagger(0, 0.8),
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12}}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: `linear-gradient(135deg, ${C.accent2}22, ${C.accent4}15)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 20,
                  boxShadow: `0 4px 12px ${C.accent2}15`,
                }}>
                  {'\uD83D\uDD13'}
                </div>
                <div style={{fontSize: 14, fontWeight: 700, color: C.textPrimary}}>
                  {Lf('freedomTitle', 'La tua libertà, le tue regole')}
                </div>
              </div>
              <div style={{fontSize: 12, color: C.textSecondary, lineHeight: 1.65, marginBottom: 10}}>
                {Lf('freedomDesc', 'Con PRO puoi usare le tue API keys personali (OpenAI, ElevenLabs) o pagare solo per quello che usi. Noi ti facilitiamo la vita.')}
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <span style={{fontSize: 16}}>{'✅'}</span>
                <span style={{fontSize: 11.5, color: C.accent4, fontWeight: 700}}>
                  {Lf('freeSponsored', 'Uso FREE sponsorizzato — inizia subito senza costi')}
                </span>
              </div>
            </div>

            {/* ── CTA Buttons — 3D gradient with glow ── */}
            <div style={{width: '100%', ...stagger(1, 0.9)}}>
              <button style={{
                width: '100%', padding: '18px', borderRadius: 18, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${C.accent1}, ${C.accent2})`,
                color: '#fff', fontFamily: FONT, fontSize: 17, fontWeight: 800,
                letterSpacing: -0.3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                boxShadow: `0 8px 32px ${C.accent1}45, 0 2px 8px ${C.accent2}30, inset 0 1px 0 rgba(255,255,255,0.25)`,
                WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative', overflow: 'hidden',
              }} onClick={next}>
                {/* Button shimmer */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  animation: 'vtBtnShimmer 2.5s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
                <span style={{fontSize: 22, position: 'relative', zIndex: 1}}>{'\u2728'}</span>
                <span style={{position: 'relative', zIndex: 1}}>{Lf('heroStart', 'Inizia ora')}</span>
              </button>

              {!userToken && (
                <button style={{
                  width: '100%', padding: '15px', borderRadius: 16, cursor: 'pointer', marginTop: 10,
                  background: isDark ? `rgba(255,255,255,0.05)` : `rgba(255,255,255,0.7)`,
                  border: `1px solid ${C.accent1}30`,
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: C.accent1, fontFamily: FONT, fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'all 0.3s',
                  boxShadow: `0 4px 16px rgba(0,0,0,${isDark ? '0.2' : '0.04'})`,
                }} onClick={() => { savePrefs(prefs); setAuthStep('email'); setView('account'); }}>
                  <span style={{fontSize: 16}}>{'\u2B50'}</span>
                  {Lf('heroSignIn', 'Accedi a PRO')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            STEPS 1-4: Setup wizard
           ═══════════════════════════════════════ */}
        {step > 0 && (
          <>
            {dots}

            <div style={{
              ...S.card, padding: '24px 20px', position: 'relative', overflow: 'hidden',
              width: '100%', maxWidth: 400,
              borderRadius: 24,
              backdropFilter: 'blur(20px) saturate(150%)',
              WebkitBackdropFilter: 'blur(20px) saturate(150%)',
              boxShadow: `0 12px 40px rgba(0,0,0,${isDark ? '0.4' : '0.08'}), inset 0 1px 0 rgba(255,255,255,${isDark ? '0.06' : '0.7'})`,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)'}`,
              ...stagger(0),
            }}>
              {/* Step counter */}
              <div style={{
                fontSize: 10, color: C.textMuted, fontWeight: 700, textAlign: 'center',
                marginBottom: 14, letterSpacing: 1.5,
                background: `linear-gradient(135deg, ${C.textMuted}, ${C.accent1})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {step} / {STEPS.length - 1}
              </div>

              {/* ─── STEP 1: NAME ─── */}
              {step === 1 && (
                <div style={stagger(1)}>
                  <div style={{textAlign: 'center', marginBottom: 18}}>
                    <div style={{fontSize: 22, marginBottom: 6}}>{'\uD83D\uDC4B'}</div>
                    <div style={{fontSize: 17, fontWeight: 700, color: C.textPrimary, letterSpacing: -0.3}}>
                      {Lf('welcomeNameTitle', 'Come ti chiami?')}
                    </div>
                    <div style={{fontSize: 12, color: C.textSecondary, marginTop: 5}}>
                      {Lf('welcomeNameSub', 'Il tuo nome sarà visibile al partner nella stanza')}
                    </div>
                  </div>
                  <input style={{
                    ...S.input, fontSize: 20, textAlign: 'center', padding: '16px 18px',
                    fontWeight: 600, letterSpacing: -0.3, borderRadius: 16,
                    boxShadow: `0 4px 16px rgba(0,0,0,${isDark ? '0.2' : '0.04'}), inset 0 1px 0 rgba(255,255,255,${isDark ? '0.06' : '0.5'})`,
                  }}
                    placeholder={L('namePlaceholder')} value={prefs.name}
                    onChange={e => setPrefs({...prefs, name: e.target.value})} maxLength={20}
                    autoFocus />
                  {prefs.name.trim().length > 0 && prefs.name.trim().length < 2 && (
                    <div style={{fontSize: 11, color: C.accent3, textAlign: 'center', marginTop: 10}}>
                      {Lf('nameMinChars', 'Almeno 2 caratteri')}
                    </div>
                  )}
                </div>
              )}

              {/* ─── STEP 2: AVATAR ─── */}
              {step === 2 && (
                <div style={stagger(1)}>
                  <div style={{textAlign: 'center', marginBottom: 18}}>
                    <div style={{fontSize: 17, fontWeight: 700, color: C.textPrimary}}>
                      {Lf('welcomeAvatarTitle', 'Scegli il tuo avatar')}
                    </div>
                    <div style={{fontSize: 12, color: C.textSecondary, marginTop: 5}}>
                      {Lf('welcomeAvatarSub', 'Il tuo personaggio nella conversazione')}
                    </div>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'center', marginBottom: 14}}>
                    <div style={{
                      width: 120, height: 120, borderRadius: 32, overflow: 'hidden',
                      border: `3px solid ${C.accent1}`,
                      boxShadow: `0 0 30px ${C.accent1}30, 0 8px 24px rgba(0,0,0,0.1)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `linear-gradient(135deg, ${C.accent1}15, ${C.accent2}08)`,
                    }}>
                      <img src={prefs.avatar} alt="" style={{width: 108, height: 108, objectFit: 'contain'}} />
                    </div>
                  </div>
                  <div style={{textAlign: 'center', fontSize: 15, fontWeight: 700, color: C.accent1, marginBottom: 14}}>
                    {AVATAR_NAMES[selectedAvatarIdx >= 0 ? selectedAvatarIdx : 0]}
                  </div>
                  <Carousel items={AVATARS}
                    selectedIndex={selectedAvatarIdx >= 0 ? selectedAvatarIdx : 0}
                    onSelect={(i) => setPrefs({...prefs, avatar: AVATARS[i]})}
                    itemWidth={90} gap={8}
                    renderItem={(avatar, i, isSelected) => (
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                        <div style={{
                          width: 80, height: 80, borderRadius: 22, overflow: 'hidden',
                          border: isSelected ? `2.5px solid ${C.accent1}` : '2.5px solid transparent',
                          background: isSelected ? `linear-gradient(135deg, ${C.accent1}15, ${C.accent2}08)` : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                          boxShadow: isSelected ? `0 4px 16px ${C.accent1}25` : 'none',
                        }}>
                          <img src={avatar} alt={AVATAR_NAMES[i]} style={{width: 70, height: 70, objectFit: 'contain'}} />
                        </div>
                        <span style={{fontSize: 9, marginTop: 4, color: isSelected ? C.accent1 : C.textSecondary,
                          fontWeight: isSelected ? 700 : 400, fontFamily: FONT}}>{AVATAR_NAMES[i]}</span>
                      </div>
                    )}
                  />
                </div>
              )}

              {/* ─── STEP 3: LANGUAGE ─── */}
              {step === 3 && (
                <div style={stagger(1)}>
                  <div style={{textAlign: 'center', marginBottom: 18}}>
                    <div style={{fontSize: 17, fontWeight: 700, color: C.textPrimary}}>
                      {Lf('welcomeLangTitle', 'Quale lingua parli?')}
                    </div>
                    <div style={{fontSize: 12, color: C.textSecondary, marginTop: 5}}>
                      {Lf('welcomeLangSub', 'Puoi cambiarla in qualsiasi momento')}
                    </div>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'center', marginBottom: 10}}>
                    <div style={{
                      fontSize: 54,
                      filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))',
                      animation: 'vtLogoFloat 3s ease-in-out infinite',
                    }}>
                      {LANGS[selectedLangIdx >= 0 ? selectedLangIdx : 0]?.flag}
                    </div>
                  </div>
                  <div style={{textAlign: 'center', fontSize: 15, fontWeight: 700, color: C.accent1, marginBottom: 14}}>
                    {LANGS[selectedLangIdx >= 0 ? selectedLangIdx : 0]?.name}
                  </div>
                  <Carousel items={LANGS}
                    selectedIndex={selectedLangIdx >= 0 ? selectedLangIdx : 0}
                    onSelect={(i) => setPrefs({...prefs, lang: LANGS[i].code})}
                    itemWidth={72} gap={8}
                    renderItem={(lang, i, isSelected) => (
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                        <div style={{
                          width: 54, height: 54, borderRadius: 27,
                          border: isSelected ? `2.5px solid ${C.accent1}` : '2.5px solid transparent',
                          background: isSelected
                            ? `linear-gradient(135deg, ${C.accent1}15, ${C.accent2}08)`
                            : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', fontSize: 28,
                          transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                          boxShadow: isSelected ? `0 4px 14px ${C.accent1}20` : 'none',
                        }}>
                          {lang.flag}
                        </div>
                        <span style={{fontSize: 9, marginTop: 4, maxWidth: 68, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center',
                          color: isSelected ? C.accent1 : C.textSecondary,
                          fontWeight: isSelected ? 700 : 400, fontFamily: FONT}}>{lang.name}</span>
                      </div>
                    )}
                  />
                </div>
              )}

              {/* ─── STEP 4: VOICE + CTA ─── */}
              {step === 4 && (
                <div style={stagger(1)}>
                  <div style={{textAlign: 'center', marginBottom: 18}}>
                    <div style={{fontSize: 22, marginBottom: 6}}>{'\uD83C\uDFA7'}</div>
                    <div style={{fontSize: 17, fontWeight: 700, color: C.textPrimary}}>
                      {Lf('welcomeVoiceTitle', 'Scegli la voce AI')}
                    </div>
                    <div style={{fontSize: 12, color: C.textSecondary, marginTop: 5}}>
                      {Lf('welcomeVoiceSub', 'La voce che leggerà le traduzioni')}
                    </div>
                  </div>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 18}}>
                    {VOICES.map(v => {
                      const sel = prefs.voice === v;
                      return (
                        <button key={v} onClick={() => setPrefs({...prefs, voice: v})}
                          style={{
                            padding: '12px 18px', borderRadius: 14, cursor: 'pointer',
                            fontFamily: FONT, fontSize: 14, fontWeight: sel ? 700 : 500,
                            background: sel
                              ? `linear-gradient(135deg, ${C.accent1}20, ${C.accent2}12)`
                              : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                            border: sel ? `1.5px solid ${C.accent1}40` : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                            color: sel ? C.accent1 : C.textSecondary,
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            WebkitTapHighlightColor: 'transparent',
                            transform: sel ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: sel ? `0 4px 16px ${C.accent1}20` : 'none',
                          }}>
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{fontSize: 11, color: C.textTertiary, textAlign: 'center', marginBottom: 14, lineHeight: 1.5}}>
                    {Lf('welcomeVoiceHint', 'Le voci AI PRO sono molto più naturali della voce browser.')}
                  </div>
                </div>
              )}

              {/* ─── NAVIGATION BUTTONS ─── */}
              <div style={{display: 'flex', gap: 10, marginTop: 18, ...stagger(2)}}>
                <button onClick={prev} style={{
                  flex: '0 0 52px', height: 52, borderRadius: 16, cursor: 'pointer',
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
                  color: C.textSecondary, fontSize: 20, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', WebkitTapHighlightColor: 'transparent',
                  transition: 'all 0.3s',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                }}>
                  {'\u2190'}
                </button>
                {!isLast ? (
                  <button onClick={next} disabled={!canNext}
                    style={{
                      flex: 1, height: 52, borderRadius: 16, cursor: canNext ? 'pointer' : 'default',
                      background: canNext ? `linear-gradient(135deg, ${C.accent1}, ${C.accent2})` : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: 'none', color: canNext ? '#fff' : C.textTertiary,
                      fontFamily: FONT, fontSize: 16, fontWeight: 700, letterSpacing: -0.3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: canNext ? 1 : 0.5,
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: canNext ? `0 6px 24px ${C.accent1}35, inset 0 1px 0 rgba(255,255,255,0.2)` : 'none',
                      position: 'relative', overflow: 'hidden',
                    }}>
                    {canNext && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)',
                        backgroundSize: '200% 100%',
                        animation: 'vtBtnShimmer 2.5s ease-in-out infinite',
                        pointerEvents: 'none',
                      }} />
                    )}
                    <span style={{position: 'relative', zIndex: 1}}>{Lf('next', 'Avanti')}</span>
                    <span style={{fontSize: 18, position: 'relative', zIndex: 1}}>{'\u2192'}</span>
                  </button>
                ) : (
                  <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 8}}>
                    {/* FREE button */}
                    <button style={{
                      width: '100%', padding: '16px 18px', borderRadius: 16, border: 'none', cursor: 'pointer',
                      background: `linear-gradient(135deg, ${C.accent4}, ${C.accent2})`,
                      color: '#0B0D1A', fontFamily: FONT,
                      display: 'flex', alignItems: 'center', gap: 12,
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: `0 6px 24px ${C.accent4}35, inset 0 1px 0 rgba(255,255,255,0.3)`,
                      position: 'relative', overflow: 'hidden',
                    }}
                      onClick={() => { try { savePrefs(prefs); if (joinCode) setView('join'); else setView('home'); } catch(e) { console.error('[Welcome] Error completing:', e); setView('home'); } }}>
                      <span style={{fontSize: 20, position: 'relative', zIndex: 1}}>{'\u26A1'}</span>
                      <div style={{flex: 1, textAlign: 'left', position: 'relative', zIndex: 1}}>
                        <div style={{fontWeight: 800, fontSize: 15}}>{Lf('startFreeMode', 'Inizia Gratis')}</div>
                        <div style={{fontSize: 10.5, opacity: 0.7}}>{Lf('startFreeDesc', 'Traduzioni base con voce browser')}</div>
                      </div>
                      <span style={{fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 7,
                        background: 'rgba(0,0,0,0.12)', letterSpacing: 0.5, position: 'relative', zIndex: 1}}>FREE</span>
                    </button>
                    {/* PRO button */}
                    {!userToken && (
                      <button style={{
                        width: '100%', padding: '14px 18px', borderRadius: 16, cursor: 'pointer',
                        background: isDark ? `rgba(255,255,255,0.05)` : `rgba(255,255,255,0.7)`,
                        border: `1px solid ${C.accent1}30`,
                        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        color: C.textPrimary, fontFamily: FONT,
                        display: 'flex', alignItems: 'center', gap: 12,
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'all 0.3s',
                        boxShadow: `0 4px 16px rgba(0,0,0,${isDark ? '0.2' : '0.04'})`,
                      }}
                        onClick={() => { try { savePrefs(prefs); setAuthStep('email'); setView('account'); } catch(e) { console.error('[Welcome] PRO error:', e); } }}>
                        <span style={{fontSize: 18}}>{'\u2B50'}</span>
                        <div style={{flex: 1, textAlign: 'left'}}>
                          <div style={{fontWeight: 700, fontSize: 14}}>{Lf('signInPro', 'Accedi a PRO')}</div>
                          <div style={{fontSize: 10.5, color: C.textSecondary}}>
                            {Lf('signInProDesc', 'Voci AI naturali, nessun limite')}
                          </div>
                        </div>
                        <span style={{fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 7,
                          background: `linear-gradient(135deg, ${C.accent1}20, ${C.accent2}12)`,
                          color: C.accent1, letterSpacing: 0.5}}>PRO</span>
                      </button>
                    )}
                    {userToken && (
                      <button style={{
                        width: '100%', padding: '14px 18px', borderRadius: 16, cursor: 'pointer',
                        background: `linear-gradient(135deg, ${C.accent1}15, ${C.accent2}08)`,
                        border: `1px solid ${C.accent1}30`,
                        color: C.accent1, fontFamily: FONT, fontSize: 14, fontWeight: 700, textAlign: 'center',
                        WebkitTapHighlightColor: 'transparent',
                        boxShadow: `0 4px 16px ${C.accent1}15`,
                      }}
                        onClick={() => { try { savePrefs(prefs); setView('home'); } catch(e) { console.error('[Welcome] PRO start error:', e); setView('home'); } }}>
                        {Lf('letsStart', 'Iniziamo')} (PRO)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>

      {/* ═══ ANIMATIONS ═══ */}
      <style>{`
        @keyframes vtOrb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 20px) scale(1.1); }
          66% { transform: translate(20px, -15px) scale(0.95); }
        }
        @keyframes vtOrb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(25px, -20px) scale(1.08); }
          70% { transform: translate(-15px, 25px) scale(0.92); }
        }
        @keyframes vtOrb3 {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.5; }
          50% { transform: translateX(-50%) scale(1.2); opacity: 0.8; }
        }
        @keyframes vtSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes vtLogoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes vtTitleShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes vtWave {
          0%, 100% { transform: scaleY(0.4); opacity: 0.4; }
          50% { transform: scaleY(1); opacity: 0.8; }
        }
        @keyframes vtArrowBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes vtProShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes vtBtnShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
