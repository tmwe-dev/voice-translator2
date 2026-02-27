'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import Carousel from './Carousel.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════
// WELCOME VIEW — Premium Dark Immersive Onboarding
// Step 0: Hero with mesh gradient & floating glass
// Step 1: Auth (new)
// Step 2: Name
// Step 3: Avatar
// Step 4: Language
// Step 5: Voice + CTA
// ═══════════════════════════════════════════════

const STEPS = [
  { key:'hero' },
  { key:'auth' },
  { key:'name' },
  { key:'avatar' },
  { key:'lang' },
  { key:'voice' },
];

export default function WelcomeView({ L, S, prefs, setPrefs, savePrefs, joinCode, userToken, setView, setAuthStep, theme, setTheme,
  sendAuthCode, verifyAuthCodeFn, loginWithGoogle, loginWithApple,
  authStep, authEmail, setAuthEmail, authCode, setAuthCode, authLoading, authTestCode, pendingReferralCode }) {
  const [step, setStep] = useState(0);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredTier, setHoveredTier] = useState(null);
  const [entered, setEntered] = useState(false);
  const C = S.colors;

  // Force dark palette for welcome — premium dark experience
  const D = {
    bg1: '#06080F', bg2: '#0A0E1F', bg3: '#0F1332',
    surface: 'rgba(12,15,35,0.75)',
    surfaceHover: 'rgba(18,22,52,0.85)',
    glass: 'rgba(255,255,255,0.03)',
    glassHover: 'rgba(255,255,255,0.06)',
    glassBorder: 'rgba(255,255,255,0.06)',
    glassBorderHover: 'rgba(255,255,255,0.12)',
    neon1: '#7B73FF', neon2: '#00D2FF', neon3: '#FF6B9D', neon4: '#00FF94',
    gold: '#FFD700',
    text: '#FFFFFF',
    textSoft: 'rgba(255,255,255,0.75)',
    textMuted: 'rgba(255,255,255,0.50)',
    textDim: 'rgba(255,255,255,0.30)',
  };

  const Lf = (key, fallback) => { const v = L(key); return (v && v !== key) ? v : fallback; };

  const googleInitRef = useRef(false);

  const initGoogleSignIn = useCallback(() => {
    if (googleInitRef.current) return;
    const clientId = typeof window !== 'undefined' ? window.__VT_GOOGLE_CLIENT_ID : '';
    if (!clientId || !window.google?.accounts?.id) return;
    googleInitRef.current = true;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (response.credential) {
          await loginWithGoogle(response.credential, pendingReferralCode);
        }
      }
    });
  }, [loginWithGoogle, pendingReferralCode]);

  useEffect(() => {
    if (step !== 1) return; // Only init when on auth step
    initGoogleSignIn();
    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogleSignIn();
        clearInterval(checkInterval);
      }
    }, 500);
    return () => clearInterval(checkInterval);
  }, [step, initGoogleSignIn]);

  // Auto-advance when auth completes
  useEffect(() => {
    if (authStep === 'choose' && step === 1) {
      setStep(2); // advance to name step
    }
  }, [authStep, step]);

  useEffect(() => {
    setEntered(false);
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, [step]);

  const selectedAvatarIdx = AVATARS.indexOf(prefs.avatar);
  const selectedLangIdx = LANGS.findIndex(l => l.code === prefs.lang);

  const canNext = step === 2 ? prefs.name.trim().length >= 2 : true;
  const isLast = step === STEPS.length - 1;

  function next() { if (canNext && step < STEPS.length - 1) setStep(step + 1); }
  function prev() { if (step > 0) setStep(step - 1); }

  // ── Stagger animation helper ──
  const stagger = (i, base = 0) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
    transition: `all 0.55s cubic-bezier(0.16, 1, 0.3, 1) ${base + i * 0.07}s`,
  });

  // ── Features ──
  const features = [
    { emoji: '\uD83C\uDFA4', title: Lf('featVoice', 'Traduzione vocale'),
      desc: Lf('featVoiceDesc', 'Parla nella tua lingua, il partner sente nella sua'), color: D.neon1 },
    { emoji: '\u26A1', title: Lf('featInstant', 'Istantaneo'),
      desc: Lf('featInstantDesc', 'Traduzione in tempo reale con AI avanzata'), color: D.neon2 },
    { emoji: '\uD83C\uDF0D', title: Lf('featMulti', '15+ lingue'),
      desc: Lf('featMultiDesc', 'Italiano, inglese, spagnolo, cinese e molto altro'), color: D.neon4 },
    { emoji: '\uD83C\uDFAF', title: Lf('featContexts', '12 contesti'),
      desc: Lf('featContextsDesc', 'Medico, business, turismo, legale e altri'), color: D.neon3 },
  ];

  // ── Tiers ──
  const tiers = [
    { key: 'free', label: 'FREE', emoji: '\u26A1', color: D.neon4,
      features: [
        Lf('tierFreeF1', 'Voce browser base'),
        Lf('tierFreeF2', '50 traduzioni/giorno'),
        Lf('tierFreeF3', 'Contesti limitati'),
      ],
      tagline: Lf('tierFreeTag', 'Perfetto per iniziare'),
    },
    { key: 'starter', label: 'STARTER', emoji: '\uD83D\uDE80', color: D.neon1,
      features: [
        Lf('tierStarterF1', 'Voci AI OpenAI'),
        Lf('tierStarterF2', '500 traduzioni/giorno'),
        Lf('tierStarterF3', 'Tutti i contesti'),
        Lf('tierStarterF4', 'Cronologia completa'),
      ],
      tagline: Lf('tierStarterTag', 'Per uso quotidiano'),
    },
    { key: 'pro', label: 'PRO', emoji: '\uD83D\uDC8E', color: D.gold,
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

  // ── Glassmorphism card factory ──
  const glassCard = (isHovered, accent, i) => ({
    padding: '20px 16px',
    borderRadius: 20,
    background: isHovered ? D.glassHover : D.glass,
    border: `1px solid ${isHovered ? accent + '35' : D.glassBorder}`,
    backdropFilter: 'blur(48px) saturate(180%)',
    WebkitBackdropFilter: 'blur(48px) saturate(180%)',
    boxShadow: isHovered
      ? `0 24px 48px rgba(0,0,0,0.6), 0 0 40px ${accent}12, inset 0 1px 0 rgba(255,255,255,0.06)`
      : `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
    transform: isHovered
      ? 'perspective(800px) rotateX(-2deg) scale(1.04) translateY(-4px)'
      : 'perspective(800px) scale(1)',
    transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    ...stagger(i, 0.2),
  });

  // Progress dots
  const dots = step > 0 ? (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:20}}>
      {STEPS.slice(1).map((s, i) => (
        <div key={s.key} onClick={() => { if (i + 1 <= step) setStep(i + 1); }}
          style={{cursor: i + 1 <= step ? 'pointer' : 'default'}}>
          <div style={{
            width: (i + 1) === step ? 28 : 10,
            height: 10,
            borderRadius: 5,
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            background: (i + 1) < step
              ? `linear-gradient(135deg, ${D.neon4}, ${D.neon2})`
              : (i + 1) === step
                ? `linear-gradient(135deg, ${D.neon1}, ${D.neon2})`
                : 'rgba(255,255,255,0.06)',
            boxShadow: (i + 1) === step ? `0 0 14px ${D.neon1}55, 0 0 4px ${D.neon2}30` : 'none',
          }} />
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      background: `linear-gradient(165deg, ${D.bg1} 0%, ${D.bg2} 30%, ${D.bg3} 60%, ${D.bg1} 100%)`,
      color: D.text, fontFamily: FONT, overflow:'hidden',
    }}>

      {/* ═══ MESH GRADIENT BACKGROUND ═══ */}
      <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, pointerEvents:'none', zIndex:0, overflow:'hidden'}}>
        {/* Primary orb — neon purple/blue */}
        <div style={{
          position:'absolute', top:'-18%', right:'-20%',
          width:'75vw', height:'75vw', maxWidth:550, maxHeight:550,
          borderRadius:'50%',
          background: `radial-gradient(circle, ${D.neon1}25, ${D.neon2}10, transparent 65%)`,
          filter: 'blur(80px)',
          animation: 'vtOrb1 9s ease-in-out infinite',
        }} />
        {/* Secondary orb — green/pink warm glow */}
        <div style={{
          position:'absolute', bottom:'-12%', left:'-18%',
          width:'65vw', height:'65vw', maxWidth:480, maxHeight:480,
          borderRadius:'50%',
          background: `radial-gradient(circle, ${D.neon4}18, ${D.neon3}0A, transparent 65%)`,
          filter: 'blur(70px)',
          animation: 'vtOrb2 11s ease-in-out infinite',
        }} />
        {/* Center floating accent */}
        <div style={{
          position:'absolute', top:'40%', left:'50%',
          width:'45vw', height:'45vw', maxWidth:350, maxHeight:350,
          borderRadius:'50%',
          background: `radial-gradient(circle, ${D.neon2}12, transparent 65%)`,
          filter: 'blur(90px)',
          animation: 'vtOrb3 13s ease-in-out infinite',
          transform: 'translateX(-50%)',
        }} />
        {/* Extra subtle top-left accent */}
        <div style={{
          position:'absolute', top:'8%', left:'8%',
          width:'25vw', height:'25vw', maxWidth:180, maxHeight:180,
          borderRadius:'50%',
          background: `radial-gradient(circle, ${D.neon3}0C, transparent 70%)`,
          filter: 'blur(50px)',
          animation: 'vtOrb1 16s ease-in-out infinite reverse',
        }} />
        {/* Noise texture overlay */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, bottom:0,
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat', backgroundSize: '256px 256px',
        }} />
        {/* Vignette overlay */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, bottom:0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }} />
      </div>

      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        height:'100%', padding:'12px 16px', boxSizing:'border-box',
        overflowY:'auto', WebkitOverflowScrolling:'touch',
        position:'relative', zIndex:1,
      }}>

        {/* ═══════════════════════════════════════
            STEP 0: HERO — Premium Dark Experience
           ═══════════════════════════════════════ */}
        {step === 0 && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:420, padding:'0 8px'}}>

            {/* ── Animated Logo Orb with neon ring ── */}
            <div style={{
              position:'relative', marginBottom:28, marginTop:16,
              ...stagger(0),
            }}>
              {/* Rotating neon ring */}
              <div style={{
                position:'absolute', top:-18, left:-18, right:-18, bottom:-18,
                borderRadius:'50%',
                background: `conic-gradient(from 0deg, ${D.neon1}00, ${D.neon1}28, ${D.neon2}25, ${D.neon4}18, ${D.neon3}12, ${D.neon1}00)`,
                animation: 'vtSpin 7s linear infinite',
                filter: 'blur(14px)',
                opacity: 0.65,
              }} />
              {/* Logo sphere */}
              <div style={{
                width: 108, height: 108, borderRadius: '50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                background: `radial-gradient(circle at 35% 35%, ${D.neon1}28, ${D.neon2}10, rgba(8,10,22,0.95))`,
                boxShadow: `0 0 50px ${D.neon1}30, 0 0 100px ${D.neon2}15, 0 0 180px ${D.neon1}06, inset 0 -4px 14px ${D.neon1}15, inset 0 4px 8px rgba(255,255,255,0.04)`,
                border: '1.5px solid rgba(255,255,255,0.06)',
                animation: 'vtLogoFloat 4s ease-in-out infinite',
                position: 'relative', zIndex: 2,
              }}>
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="heroLogoG" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={D.neon1} />
                      <stop offset="50%" stopColor={D.neon2} />
                      <stop offset="100%" stopColor={D.neon1} />
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
              <div style={{position:'absolute', top:0, left:0, right:0, bottom:0, animation:'vtSpin 9s linear infinite', pointerEvents:'none'}}>
                <div style={{position:'absolute', top:-7, left:'50%', width:8, height:8, borderRadius:'50%',
                  background:`radial-gradient(circle, ${D.neon4}, ${D.neon4}00)`,
                  boxShadow:`0 0 10px ${D.neon4}70`}} />
              </div>
              <div style={{position:'absolute', top:0, left:0, right:0, bottom:0, animation:'vtSpin 13s linear infinite reverse', pointerEvents:'none'}}>
                <div style={{position:'absolute', bottom:-4, left:'50%', width:6, height:6, borderRadius:'50%',
                  background:`radial-gradient(circle, ${D.neon3}, ${D.neon3}00)`,
                  boxShadow:`0 0 8px ${D.neon3}55`}} />
              </div>
            </div>

            {/* ── App title with animated gradient ── */}
            <div style={{
              fontSize: 34, fontWeight: 800, marginBottom: 6, textAlign: 'center',
              background: `linear-gradient(135deg, #fff 0%, ${D.neon1} 35%, ${D.neon2} 65%, #fff 100%)`,
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              animation: 'vtTitleShimmer 4s ease-in-out infinite',
              letterSpacing: -1.2,
              ...stagger(1),
            }}>
              VoiceTranslate
            </div>
            <div style={{
              fontSize: 14, color: D.textSoft, marginBottom: 36, textAlign: 'center',
              lineHeight: 1.65, maxWidth: 310, fontWeight: 500,
              ...stagger(2),
            }}>
              {Lf('heroSubtitle', 'Il traduttore vocale che abbatte le barriere linguistiche in tempo reale')}
            </div>

            {/* ── Sound wave divider ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
              marginBottom: 30, height: 20,
              ...stagger(3, 0.1),
            }}>
              {[0.3, 0.6, 1, 0.7, 1, 0.8, 0.5, 1, 0.6, 0.4, 0.8, 1, 0.5].map((h, i) => (
                <div key={i} style={{
                  width: 3, borderRadius: 2,
                  background: `linear-gradient(to top, ${D.neon1}, ${D.neon2})`,
                  opacity: 0.5,
                  animation: `vtWave 1.2s ease-in-out ${i * 0.08}s infinite`,
                  height: h * 18,
                }} />
              ))}
            </div>

            {/* ── Features Grid — Glass Cards ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              width: '100%', marginBottom: 36,
              perspective: '1000px',
            }}>
              {features.map((f, i) => (
                <div key={i}
                  onMouseEnter={() => setHoveredCard(i)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onTouchStart={() => setHoveredCard(i)}
                  onTouchEnd={() => setTimeout(() => setHoveredCard(null), 300)}
                  onClick={next}
                  style={glassCard(hoveredCard === i, f.color, i)}>
                  {/* Hover glow */}
                  {hoveredCard === i && (
                    <div style={{
                      position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
                      background: `radial-gradient(circle at 50% 80%, ${f.color}14, transparent 55%)`,
                      pointerEvents: 'none',
                    }} />
                  )}
                  {/* Icon */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, marginBottom: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26,
                    background: `linear-gradient(145deg, ${f.color}18, ${f.color}06)`,
                    boxShadow: hoveredCard === i
                      ? `0 8px 20px ${f.color}28, inset 0 1px 0 rgba(255,255,255,0.08)`
                      : `0 4px 10px ${f.color}0C`,
                    border: `1px solid ${f.color}${hoveredCard === i ? '30' : '12'}`,
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: hoveredCard === i ? 'scale(1.1) rotate(-3deg)' : 'scale(1)',
                    position: 'relative', zIndex: 1,
                  }}>
                    {f.emoji}
                  </div>
                  <div style={{fontSize: 13, fontWeight: 700, color: D.text, marginBottom: 4, lineHeight: 1.3, position: 'relative', zIndex: 1}}>
                    {f.title}
                  </div>
                  <div style={{fontSize: 10.5, color: D.textMuted, lineHeight: 1.5, position: 'relative', zIndex: 1}}>
                    {f.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Tier Scaling — Layered Glass Cards ── */}
            <div style={{width: '100%', marginBottom: 28}}>
              <div style={{
                textAlign: 'center', marginBottom: 16,
                ...stagger(0, 0.5),
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
                  background: `linear-gradient(135deg, ${D.textDim}, ${D.neon1})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  marginBottom: 8,
                }}>
                  {Lf('tierScaleLabel', 'SCALA VERSO LA QUALITÀ')}
                </div>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}>
                  <div style={{width: 28, height: 1, background: `linear-gradient(to right, transparent, ${D.neon1}30)`}} />
                  <div style={{animation: 'vtArrowBounce 2s ease-in-out infinite'}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <defs>
                        <linearGradient id="arrowG" x1="0%" y1="100%" x2="0%" y2="0%">
                          <stop offset="0%" stopColor={D.neon2} />
                          <stop offset="100%" stopColor={D.neon1} />
                        </linearGradient>
                      </defs>
                      <path d="M12 19V5M5 12l7-7 7 7" stroke="url(#arrowG)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={{width: 28, height: 1, background: `linear-gradient(to left, transparent, ${D.neon1}30)`}} />
                </div>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 10, perspective: '800px'}}>
                {tiers.map((tier, i) => {
                  const isH = hoveredTier === i;
                  const isPro = tier.isPro;
                  return (
                    <div key={tier.key}
                      onMouseEnter={() => setHoveredTier(i)}
                      onMouseLeave={() => setHoveredTier(null)}
                      onClick={() => {
                        if (tier.isPro && !userToken) {
                          savePrefs(prefs); setAuthStep('email'); setView('account');
                        } else {
                          next();
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: isPro ? '20px 18px' : '14px 16px',
                        borderRadius: isPro ? 20 : 16,
                        background: isPro
                          ? `linear-gradient(135deg, ${D.gold}08, ${D.neon1}04, rgba(10,12,28,0.85))`
                          : isH ? D.glassHover : D.glass,
                        border: `1px solid ${isPro
                          ? (isH ? D.gold + '40' : D.gold + '18')
                          : (isH ? tier.color + '30' : D.glassBorder)}`,
                        backdropFilter: 'blur(48px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(48px) saturate(180%)',
                        boxShadow: isH
                          ? (isPro
                              ? `0 16px 44px ${D.gold}18, 0 0 32px ${D.gold}06, inset 0 1px 0 rgba(255,255,255,0.06)`
                              : `0 12px 32px ${tier.color}10, 0 0 24px ${tier.color}05, inset 0 1px 0 rgba(255,255,255,0.04)`)
                          : (isPro
                              ? `0 6px 20px ${D.gold}0A, inset 0 1px 0 rgba(255,255,255,0.03)`
                              : `0 4px 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.02)`),
                        transform: isH ? 'perspective(600px) rotateX(-1deg) scale(1.02) translateY(-3px)' : 'perspective(600px) scale(1)',
                        transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                        position: 'relative', overflow: 'hidden',
                        ...stagger(i, 0.6),
                      }}>
                      {/* PRO shimmer line */}
                      {isPro && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                          background: `linear-gradient(105deg, transparent 40%, ${D.gold}06 50%, transparent 60%)`,
                          backgroundSize: '200% 100%',
                          animation: 'vtProShimmer 3s ease-in-out infinite',
                          pointerEvents: 'none',
                        }} />
                      )}
                      <div style={{display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative', zIndex: 1}}>
                        {/* Emoji badge */}
                        <div style={{
                          width: isPro ? 50 : 42, height: isPro ? 50 : 42,
                          borderRadius: isPro ? 16 : 13,
                          background: `linear-gradient(145deg, ${tier.color}1A, ${tier.color}06)`,
                          border: `1px solid ${tier.color}${isH ? '35' : '15'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: isPro ? 24 : 20, flexShrink: 0,
                          boxShadow: isH ? `0 6px 16px ${tier.color}20` : `0 3px 8px ${tier.color}0A`,
                          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                          transform: isH ? 'scale(1.06) rotate(-4deg)' : 'scale(1)',
                        }}>
                          {tier.emoji}
                        </div>
                        <div style={{flex: 1, minWidth: 0}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4}}>
                            <span style={{fontSize: isPro ? 15 : 13, fontWeight: 800, color: tier.color, letterSpacing: isPro ? 1.5 : 0.8}}>
                              {tier.label}
                            </span>
                            {isPro && (
                              <span style={{
                                fontSize: 7, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                                background: `linear-gradient(135deg, ${D.gold}25, ${D.neon1}12)`,
                                color: D.gold, letterSpacing: 1.5, textTransform: 'uppercase',
                                border: `1px solid ${D.gold}25`,
                              }}>
                                PREMIUM
                              </span>
                            )}
                          </div>
                          <div style={{fontSize: 11, color: D.textMuted, marginBottom: 8, fontStyle: 'italic'}}>
                            {tier.tagline}
                          </div>
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: 4}}>
                            {tier.features.map((feat, fi) => (
                              <span key={fi} style={{
                                fontSize: 9.5, fontWeight: 600, padding: '3px 9px', borderRadius: 7,
                                background: `${tier.color}0C`,
                                color: tier.color,
                                border: `1px solid ${tier.color}14`,
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

            {/* ── Freedom panel — Deep glass ── */}
            <div style={{
              width: '100%', padding: '16px 18px', borderRadius: 18, marginBottom: 24,
              background: `linear-gradient(135deg, ${D.neon1}04, ${D.neon2}03, rgba(8,10,22,0.7))`,
              border: `1px solid ${D.glassBorder}`,
              backdropFilter: 'blur(48px) saturate(180%)',
              WebkitBackdropFilter: 'blur(48px) saturate(180%)',
              boxShadow: `0 8px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.025)`,
              ...stagger(0, 0.8),
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10}}>
                <div style={{
                  width: 34, height: 34, borderRadius: 11,
                  background: `linear-gradient(135deg, ${D.neon2}18, ${D.neon4}0C)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 18,
                  boxShadow: `0 4px 10px ${D.neon2}12`,
                }}>
                  {'\uD83D\uDD13'}
                </div>
                <div style={{fontSize: 13.5, fontWeight: 700, color: D.text}}>
                  {Lf('freedomTitle', 'La tua libertà, le tue regole')}
                </div>
              </div>
              <div style={{fontSize: 11.5, color: D.textSoft, lineHeight: 1.65, marginBottom: 8}}>
                {Lf('freedomDesc', 'Con PRO puoi usare le tue API keys personali (OpenAI, ElevenLabs) o pagare solo per quello che usi. Noi ti facilitiamo la vita.')}
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 7}}>
                <span style={{fontSize: 15}}>{'✅'}</span>
                <span style={{fontSize: 11, color: D.neon4, fontWeight: 700}}>
                  {Lf('freeSponsored', 'Uso FREE sponsorizzato — inizia subito senza costi')}
                </span>
              </div>
            </div>

            {/* ── CTA Buttons — Neon glow ── */}
            <div style={{width: '100%', ...stagger(1, 0.9)}}>
              <button style={{
                width: '100%', padding: '17px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${D.neon1}, ${D.neon2})`,
                color: '#fff', fontFamily: FONT, fontSize: 17, fontWeight: 800,
                letterSpacing: -0.3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                boxShadow: `0 8px 28px ${D.neon1}38, 0 4px 14px ${D.neon2}20, 0 0 50px ${D.neon1}10, inset 0 1px 0 rgba(255,255,255,0.18)`,
                WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative', overflow: 'hidden',
              }} onClick={next}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.13) 50%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  animation: 'vtBtnShimmer 2.5s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
                <span style={{fontSize: 22, position: 'relative', zIndex: 1}}>{'\u2728'}</span>
                <span style={{position: 'relative', zIndex: 1}}>{Lf('heroStart', 'Inizia ora')}</span>
              </button>

            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            STEPS 1-4: Setup wizard — Dark Glass
           ═══════════════════════════════════════ */}
        {step > 0 && (
          <>
            {dots}

            <div style={{
              width: '100%', maxWidth: 400, padding: '24px 20px',
              borderRadius: 22, position: 'relative', overflow: 'hidden',
              background: `linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008))`,
              backdropFilter: 'blur(48px) saturate(180%)',
              WebkitBackdropFilter: 'blur(48px) saturate(180%)',
              boxShadow: `0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)`,
              border: `1px solid ${D.glassBorder}`,
              ...stagger(0),
            }}>
              {/* Step counter */}
              <div style={{
                fontSize: 10, fontWeight: 700, textAlign: 'center',
                marginBottom: 14, letterSpacing: 1.5,
                background: `linear-gradient(135deg, ${D.textDim}, ${D.neon1})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {step} / {STEPS.length - 1}
              </div>

              {/* ─── STEP 1: AUTH ─── */}
              {step === 1 && (
                <div style={stagger(1)}>
                  <div style={{textAlign: 'center', marginBottom: 18}}>
                    <div style={{fontSize: 22, marginBottom: 6}}>{'\uD83D\uDD13'}</div>
                    <div style={{fontSize: 17, fontWeight: 700, color: D.text}}>
                      {Lf('welcomeAuthTitle', 'Crea il tuo account')}
                    </div>
                    <div style={{fontSize: 12, color: D.textSoft, marginTop: 5}}>
                      {Lf('welcomeAuthSub', 'Salva i tuoi progressi e sblocca tutte le funzionalità')}
                    </div>
                  </div>

                  {authStep !== 'code' ? (
                    <>
                      {/* Email input */}
                      <div style={{marginBottom: 12}}>
                        <input type="email" placeholder="your@email.com"
                          value={authEmail || ''} onChange={e => setAuthEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendAuthCode()}
                          style={{
                            width: '100%', padding: '14px 16px', borderRadius: 14, border: `1px solid ${D.glassBorderHover}`,
                            background: 'rgba(255,255,255,0.04)', color: D.text, fontFamily: FONT, fontSize: 15,
                            outline: 'none', boxSizing: 'border-box', textAlign: 'center',
                            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                          }} />
                      </div>
                      <button onClick={sendAuthCode} disabled={authLoading}
                        style={{
                          width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: authLoading ? 'default' : 'pointer',
                          background: `linear-gradient(135deg, ${D.neon1}, ${D.neon2})`,
                          color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 700,
                          opacity: authLoading ? 0.6 : 1, transition: 'all 0.2s',
                          boxShadow: `0 4px 16px ${D.neon1}30`,
                        }}>
                        {authLoading ? (Lf('sending', 'Invio...')) : (Lf('sendCode', 'Invia codice'))}
                      </button>

                      {/* Divider */}
                      <div style={{display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0'}}>
                        <div style={{flex: 1, height: 1, background: D.glassBorderHover}} />
                        <div style={{fontSize: 10, color: D.textMuted, fontWeight: 600}}>{Lf('or', 'oppure')}</div>
                        <div style={{flex: 1, height: 1, background: D.glassBorderHover}} />
                      </div>

                      {/* Google Sign-In */}
                      <button onClick={() => {
                        const clientId = typeof window !== 'undefined' ? window.__VT_GOOGLE_CLIENT_ID : '';
                        if (!clientId) return;
                        initGoogleSignIn();
                        if (window.google?.accounts?.id) window.google.accounts.id.prompt();
                      }} disabled={authLoading}
                        style={{
                          width: '100%', padding: '12px 16px', borderRadius: 14, cursor: 'pointer', marginBottom: 8,
                          background: 'rgba(255,255,255,0.04)', border: `1px solid ${D.glassBorderHover}`,
                          color: D.text, fontFamily: FONT, fontSize: 14, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                          opacity: authLoading ? 0.5 : 1, transition: 'all 0.2s',
                        }}>
                        <svg width="18" height="18" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>{Lf('loginGoogle', 'Continua con Google')}</span>
                      </button>

                      {/* Apple Sign-In */}
                      <button onClick={async () => {
                        if (typeof window !== 'undefined' && window.AppleID?.auth) {
                          try {
                            const response = await window.AppleID.auth.signIn();
                            if (response) await loginWithApple(response, pendingReferralCode);
                          } catch (e) {
                            if (e.error !== 'popup_closed_by_user') console.error('Apple Sign-In error:', e);
                          }
                        } else {
                          const script = document.createElement('script');
                          script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
                          script.async = true;
                          script.onload = async () => {
                            const clientId = window.__VT_APPLE_CLIENT_ID;
                            if (!clientId) return;
                            window.AppleID.auth.init({ clientId, scope: 'name email', redirectURI: window.location.origin, usePopup: true });
                            try {
                              const response = await window.AppleID.auth.signIn();
                              if (response) await loginWithApple(response, pendingReferralCode);
                            } catch (e) {
                              if (e.error !== 'popup_closed_by_user') console.error('Apple Sign-In error:', e);
                            }
                          };
                          document.head.appendChild(script);
                        }
                      }} disabled={authLoading}
                        style={{
                          width: '100%', padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                          background: 'rgba(255,255,255,0.04)', border: `1px solid ${D.glassBorderHover}`,
                          color: D.text, fontFamily: FONT, fontSize: 14, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                          opacity: authLoading ? 0.5 : 1, transition: 'all 0.2s',
                        }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                        <span>{Lf('loginApple', 'Continua con Apple')}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Code verification */}
                      <div style={{fontSize: 12, color: D.textSoft, textAlign: 'center', marginBottom: 12}}>
                        {Lf('sentTo', 'Codice inviato a')} {authEmail}
                      </div>
                      {authTestCode && (
                        <div style={{fontSize: 13, color: D.neon4, textAlign: 'center', marginBottom: 12,
                          padding: '8px 12px', background: `${D.neon4}12`, borderRadius: 12}}>
                          Test code: <strong>{authTestCode}</strong>
                        </div>
                      )}
                      <input placeholder="000000" value={authCode || ''} maxLength={6}
                        onChange={e => setAuthCode(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={e => e.key === 'Enter' && verifyAuthCodeFn()}
                        style={{
                          width: '100%', padding: '14px 16px', borderRadius: 14, border: `1px solid ${D.glassBorderHover}`,
                          background: 'rgba(255,255,255,0.04)', color: D.text, fontFamily: FONT, fontSize: 24,
                          outline: 'none', boxSizing: 'border-box', textAlign: 'center', letterSpacing: 8,
                          marginBottom: 12,
                        }} />
                      <button onClick={verifyAuthCodeFn} disabled={authLoading}
                        style={{
                          width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: authLoading ? 'default' : 'pointer',
                          background: `linear-gradient(135deg, ${D.neon1}, ${D.neon2})`,
                          color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 700,
                          opacity: authLoading ? 0.6 : 1, transition: 'all 0.2s',
                          boxShadow: `0 4px 16px ${D.neon1}30`,
                        }}>
                        {authLoading ? (Lf('verifying', 'Verifico...')) : (Lf('verify', 'Verifica'))}
                      </button>
                      <button onClick={() => { setAuthStep('email'); setAuthCode(''); }}
                        style={{
                          marginTop: 8, background: 'none', border: 'none', color: D.textMuted,
                          fontSize: 12, cursor: 'pointer', fontFamily: FONT, padding: 8, width: '100%', textAlign: 'center',
                        }}>
                        {Lf('changeEmail', 'Cambia email')}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ─── STEP 2: NAME ─── */}
              {step === 2 && (
                <div style={stagger(1)}>
                  <div style={{textAlign: 'center', marginBottom: 18}}>
                    <div style={{fontSize: 22, marginBottom: 6}}>{'\uD83D\uDC4B'}</div>
                    <div style={{fontSize: 17, fontWeight: 700, color: D.text, letterSpacing: -0.3}}>
                      {Lf('welcomeNameTitle', 'Come ti chiami?')}
                    </div>
                    <div style={{fontSize: 12, color: D.textSoft, marginTop: 5}}>
                      {Lf('welcomeNameSub', 'Il tuo nome sarà visibile al partner nella stanza')}
                    </div>
                  </div>
                  <input style={{
                    width:'100%', fontSize: 20, textAlign: 'center', padding: '16px 18px',
                    fontWeight: 600, letterSpacing: -0.3, borderRadius: 16,
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    color: D.text, fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
                    boxShadow: `0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)`,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                    placeholder={L('namePlaceholder')} value={prefs.name}
                    onChange={e => setPrefs({...prefs, name: e.target.value})} maxLength={20}
                    autoFocus
                    onFocus={e => { e.target.style.borderColor = D.neon1 + '40'; e.target.style.boxShadow = `0 4px 16px rgba(0,0,0,0.2), 0 0 20px ${D.neon1}15`; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)'; }}
                  />
                  {prefs.name.trim().length > 0 && prefs.name.trim().length < 2 && (
                    <div style={{fontSize: 11, color: D.neon3, textAlign: 'center', marginTop: 10}}>
                      {Lf('nameMinChars', 'Almeno 2 caratteri')}
                    </div>
                  )}
                </div>
              )}

              {/* ─── STEP 3: AVATAR ─── */}
              {step === 3 && (
                <div style={stagger(1)}>
                  <div style={{textAlign: 'center', marginBottom: 18}}>
                    <div style={{fontSize: 17, fontWeight: 700, color: D.text}}>
                      {Lf('welcomeAvatarTitle', 'Scegli il tuo avatar')}
                    </div>
                    <div style={{fontSize: 12, color: D.textSoft, marginTop: 5}}>
                      {Lf('welcomeAvatarSub', 'Il tuo personaggio nella conversazione')}
                    </div>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'center', marginBottom: 14}}>
                    <div style={{
                      width: 120, height: 120, borderRadius: 32, overflow: 'hidden',
                      border: `3px solid ${D.neon1}`,
                      boxShadow: `0 0 30px ${D.neon1}25, 0 8px 24px rgba(0,0,0,0.3)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `linear-gradient(135deg, ${D.neon1}10, ${D.neon2}06)`,
                    }}>
                      <img src={prefs.avatar} alt="" style={{width: 108, height: 108, objectFit: 'contain'}} />
                    </div>
                  </div>
                  <div style={{textAlign: 'center', fontSize: 15, fontWeight: 700, color: D.neon1, marginBottom: 14}}>
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
                          border: isSelected ? `2.5px solid ${D.neon1}` : '2.5px solid transparent',
                          background: isSelected ? `linear-gradient(135deg, ${D.neon1}12, ${D.neon2}06)` : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                          boxShadow: isSelected ? `0 4px 16px ${D.neon1}20` : 'none',
                        }}>
                          <img src={avatar} alt={AVATAR_NAMES[i]} style={{width: 70, height: 70, objectFit: 'contain'}} />
                        </div>
                        <span style={{fontSize: 9, marginTop: 4, color: isSelected ? D.neon1 : D.textSoft,
                          fontWeight: isSelected ? 700 : 400, fontFamily: FONT}}>{AVATAR_NAMES[i]}</span>
                      </div>
                    )}
                  />
                </div>
              )}

              {/* ─── STEP 4: LANGUAGE ─── */}
              {step === 4 && (
                <div style={stagger(1)}>
                  <div style={{textAlign: 'center', marginBottom: 18}}>
                    <div style={{fontSize: 17, fontWeight: 700, color: D.text}}>
                      {Lf('welcomeLangTitle', 'Quale lingua parli?')}
                    </div>
                    <div style={{fontSize: 12, color: D.textSoft, marginTop: 5}}>
                      {Lf('welcomeLangSub', 'Puoi cambiarla in qualsiasi momento')}
                    </div>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'center', marginBottom: 10}}>
                    <div style={{
                      fontSize: 54,
                      filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
                      animation: 'vtLogoFloat 3s ease-in-out infinite',
                    }}>
                      {LANGS[selectedLangIdx >= 0 ? selectedLangIdx : 0]?.flag}
                    </div>
                  </div>
                  <div style={{textAlign: 'center', fontSize: 15, fontWeight: 700, color: D.neon1, marginBottom: 14}}>
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
                          border: isSelected ? `2.5px solid ${D.neon1}` : '2.5px solid transparent',
                          background: isSelected ? `linear-gradient(135deg, ${D.neon1}12, ${D.neon2}06)` : 'rgba(255,255,255,0.04)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', fontSize: 28,
                          transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                          boxShadow: isSelected ? `0 4px 14px ${D.neon1}18` : 'none',
                        }}>
                          {lang.flag}
                        </div>
                        <span style={{fontSize: 9, marginTop: 4, maxWidth: 68, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center',
                          color: isSelected ? D.neon1 : D.textSoft,
                          fontWeight: isSelected ? 700 : 400, fontFamily: FONT}}>{lang.name}</span>
                      </div>
                    )}
                  />
                </div>
              )}

              {/* ─── STEP 5: VOICE + CTA ─── */}
              {step === 5 && (
                <div style={stagger(1)}>
                  <div style={{textAlign: 'center', marginBottom: 18}}>
                    <div style={{fontSize: 22, marginBottom: 6}}>{'\uD83C\uDFA7'}</div>
                    <div style={{fontSize: 17, fontWeight: 700, color: D.text}}>
                      {Lf('welcomeVoiceTitle', 'Scegli la voce AI')}
                    </div>
                    <div style={{fontSize: 12, color: D.textSoft, marginTop: 5}}>
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
                            background: sel ? `linear-gradient(135deg, ${D.neon1}18, ${D.neon2}0A)` : 'rgba(255,255,255,0.03)',
                            border: sel ? `1.5px solid ${D.neon1}35` : '1px solid rgba(255,255,255,0.06)',
                            color: sel ? D.neon1 : D.textSoft,
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            WebkitTapHighlightColor: 'transparent',
                            transform: sel ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: sel ? `0 4px 16px ${D.neon1}18` : 'none',
                          }}>
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{fontSize: 11, color: D.textMuted, textAlign: 'center', marginBottom: 14, lineHeight: 1.5}}>
                    {Lf('welcomeVoiceHint', 'Le voci AI PRO sono molto più naturali della voce browser.')}
                  </div>
                </div>
              )}

              {/* ─── NAVIGATION BUTTONS ─── */}
              <div style={{display: 'flex', gap: 10, marginTop: 18, ...stagger(2)}}>
                <button onClick={prev} style={{
                  flex: '0 0 52px', height: 52, borderRadius: 16, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: D.textSoft, fontSize: 20, display: 'flex', alignItems: 'center',
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
                      background: canNext ? `linear-gradient(135deg, ${D.neon1}, ${D.neon2})` : 'rgba(255,255,255,0.04)',
                      border: 'none', color: canNext ? '#fff' : D.textMuted,
                      fontFamily: FONT, fontSize: 16, fontWeight: 700, letterSpacing: -0.3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: canNext ? 1 : 0.5,
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: canNext ? `0 6px 22px ${D.neon1}30, inset 0 1px 0 rgba(255,255,255,0.18)` : 'none',
                      position: 'relative', overflow: 'hidden',
                    }}>
                    {canNext && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.10) 50%, transparent 60%)',
                        backgroundSize: '200% 100%',
                        animation: 'vtBtnShimmer 2.5s ease-in-out infinite',
                        pointerEvents: 'none',
                      }} />
                    )}
                    <span style={{position: 'relative', zIndex: 1}}>{step === 1 ? Lf('tryFree', 'Prova gratis') : Lf('next', 'Avanti')}</span>
                    <span style={{fontSize: 18, position: 'relative', zIndex: 1}}>{'\u2192'}</span>
                  </button>
                ) : (
                  <button style={{
                    flex: 1, height: 52, borderRadius: 16, cursor: 'pointer',
                    background: `linear-gradient(135deg, ${D.neon1}, ${D.neon2})`,
                    border: 'none', color: '#fff',
                    fontFamily: FONT, fontSize: 16, fontWeight: 700, letterSpacing: -0.3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    WebkitTapHighlightColor: 'transparent',
                    boxShadow: `0 6px 22px ${D.neon1}30, inset 0 1px 0 rgba(255,255,255,0.18)`,
                    position: 'relative', overflow: 'hidden',
                  }}
                    onClick={() => { try { savePrefs(prefs); if (joinCode) setView('join'); else setView('home'); } catch(e) { console.error('[Welcome] Error completing:', e); setView('home'); } }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                      background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.10) 50%, transparent 60%)',
                      backgroundSize: '200% 100%',
                      animation: 'vtBtnShimmer 2.5s ease-in-out infinite',
                      pointerEvents: 'none',
                    }} />
                    <span style={{fontSize: 20, position: 'relative', zIndex: 1}}>{'\u2728'}</span>
                    <span style={{position: 'relative', zIndex: 1}}>{Lf('letsStart', 'Iniziamo!')}</span>
                  </button>
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
