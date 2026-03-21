'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════
// WELCOME VIEW — Mix Proposal (2 Steps + Auth Modal)
// Step 0: Language + Name (combined)
// Step 1: Avatar + Tier (combined) + Auth modal overlay
// ═══════════════════════════════════════════════

const STEPS = [
  { key: 'langName' },
  { key: 'avatarTier' },
];

export default function WelcomeView({ L, S, prefs, setPrefs, savePrefs, joinCode, userToken, setView, setAuthStep, theme, setTheme,
  sendAuthCode, verifyAuthCodeFn, loginWithGoogle, loginWithApple,
  authStep, authEmail, setAuthEmail, authCode, setAuthCode, authLoading, authTestCode, pendingReferralCode }) {
  const [step, setStep] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState('free');
  const [entered, setEntered] = useState(false);
  const [authError, setAuthError] = useState('');
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
    neon1: '#26D9B0', neon2: '#8B6AFF', neon3: '#FF6B6B', neon4: '#26D9B0',
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

  // Fallback: open Google OAuth in popup when One Tap SDK fails
  const googleOAuthPopup = useCallback(() => {
    const clientId = typeof window !== 'undefined' ? window.__VT_GOOGLE_CLIENT_ID : '';
    if (!clientId) return false;
    const redirectUri = `${window.location.origin}/api/auth/google-callback`;
    const scope = 'email profile openid';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=select_account`;
    const w = 500, h = 600;
    const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
    window.open(url, 'googleOAuth', `width=${w},height=${h},left=${left},top=${top}`);
    return true;
  }, []);

  // Initialize Google Sign-In when auth modal is shown
  useEffect(() => {
    if (!showAuthModal) return;
    initGoogleSignIn();
    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogleSignIn();
        clearInterval(checkInterval);
      }
    }, 500);
    return () => clearInterval(checkInterval);
  }, [showAuthModal, initGoogleSignIn]);

  // Auto-detect language from navigator on first load (only if no saved prefs)
  const autoDetectedRef = useRef(false);
  useEffect(() => {
    if (autoDetectedRef.current) return;
    autoDetectedRef.current = true;
    try {
      const saved = localStorage.getItem('vt-prefs');
      if (saved) return; // User already has saved prefs, don't override
    } catch {}
    const browserLang = (navigator.language || 'en').split('-')[0];
    const matchedLang = LANGS.find(l => l.code === browserLang);
    if (matchedLang) {
      setPrefs(p => ({ ...p, lang: matchedLang.code }));
    }
  }, []);

  // When auth completes (authStep === 'choose'), finish welcome
  useEffect(() => {
    if (authStep === 'choose' && showAuthModal) {
      setShowAuthModal(false);
      finishWelcome();
    }
  }, [authStep]);

  useEffect(() => {
    setEntered(false);
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, [step]);

  const selectedAvatarIdx = AVATARS.indexOf(prefs.avatar);
  const selectedLangIdx = LANGS.findIndex(l => l.code === prefs.lang);

  const canNextStep0 = prefs.name.trim().length >= 2;
  const isLast = step === STEPS.length - 1;

  function finishWelcome() {
    try {
      savePrefs(prefs);
      if (joinCode) {
        setView('join');
      } else {
        setView('home');
      }
    } catch (e) {
      console.error('[Welcome] Error completing:', e);
      setView('home');
    }
  }

  function next() {
    if (step === 0 && !canNextStep0) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  // ── Stagger animation helper ──
  const stagger = (i, base = 0) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
    transition: `all 0.55s cubic-bezier(0.16, 1, 0.3, 1) ${base + i * 0.07}s`,
  });

  // Popular languages for initial grid (top 8)
  const popularLangs = ['it', 'en', 'es', 'fr', 'de', 'th', 'zh', 'ja'].map(code => LANGS.find(l => l.code === code)).filter(Boolean);
  const [showAllLangs, setShowAllLangs] = useState(false);
  const displayLangs = showAllLangs ? LANGS : popularLangs;

  // Progress dots (2 dots only)
  const dots = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
      {STEPS.map((s, i) => (
        <div key={s.key}>
          <div style={{
            width: i === step ? 28 : 10,
            height: 10,
            borderRadius: 5,
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            background: i < step
              ? `linear-gradient(135deg, ${D.neon4}, ${D.neon2})`
              : i === step
                ? `linear-gradient(135deg, ${D.neon1}, ${D.neon2})`
                : 'rgba(255,255,255,0.06)',
            boxShadow: i === step ? `0 0 14px ${D.neon1}55, 0 0 4px ${D.neon2}30` : 'none',
          }} />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: `linear-gradient(165deg, ${D.bg1} 0%, ${D.bg2} 30%, ${D.bg3} 60%, ${D.bg1} 100%)`,
      color: D.text, fontFamily: FONT, overflow: 'hidden',
    }}>

      {/* ═══ MESH GRADIENT BACKGROUND ═══ */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {/* Primary orb — neon purple/blue */}
        <div style={{
          position: 'absolute', top: '-18%', right: '-20%',
          width: '75vw', height: '75vw', maxWidth: 550, maxHeight: 550,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${D.neon1}25, ${D.neon2}10, transparent 65%)`,
          filter: 'blur(80px)',
          animation: 'vtOrb1 9s ease-in-out infinite',
        }} />
        {/* Secondary orb — green/pink warm glow */}
        <div style={{
          position: 'absolute', bottom: '-12%', left: '-18%',
          width: '65vw', height: '65vw', maxWidth: 480, maxHeight: 480,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${D.neon4}18, ${D.neon3}0A, transparent 65%)`,
          filter: 'blur(70px)',
          animation: 'vtOrb2 11s ease-in-out infinite',
        }} />
        {/* Center floating accent */}
        <div style={{
          position: 'absolute', top: '40%', left: '50%',
          width: '45vw', height: '45vw', maxWidth: 350, maxHeight: 350,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${D.neon2}12, transparent 65%)`,
          filter: 'blur(90px)',
          animation: 'vtOrb3 13s ease-in-out infinite',
          transform: 'translateX(-50%)',
        }} />
        {/* Extra subtle top-left accent */}
        <div style={{
          position: 'absolute', top: '8%', left: '8%',
          width: '25vw', height: '25vw', maxWidth: 180, maxHeight: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${D.neon3}0C, transparent 70%)`,
          filter: 'blur(50px)',
          animation: 'vtOrb1 16s ease-in-out infinite reverse',
        }} />
        {/* Noise texture overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat', backgroundSize: '256px 256px',
        }} />
        {/* Vignette overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }} />
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        height: '100%', padding: '12px 16px', boxSizing: 'border-box',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        position: 'relative', zIndex: 1,
      }}>

        {/* Progress dots */}
        {dots}

        {/* ═══════════════════════════════════════
            STEP 0: LANGUAGE + NAME
           ═══════════════════════════════════════ */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 420, padding: '0 8px' }}>

            {/* Title */}
            <div style={{
              fontSize: 24, fontWeight: 800, marginBottom: 24, textAlign: 'center',
              ...stagger(0),
            }}>
              {Lf('welcomeStep0Title', 'Dove sei?')}
            </div>

            {/* Language Grid — Popular + More */}
            <div style={{
              width: '100%', marginBottom: 24,
              ...stagger(1),
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: D.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                {Lf('selectLanguage', 'Seleziona lingua')}
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
                marginBottom: showAllLangs ? 16 : 0,
              }}>
                {displayLangs.map((lang, idx) => {
                  const isSelected = lang.code === prefs.lang;
                  return (
                    <button key={lang.code}
                      onClick={() => {
                        setPrefs({ ...prefs, lang: lang.code });
                        setShowAllLangs(false);
                      }}
                      style={{
                        padding: 12, borderRadius: 14, border: isSelected ? `2px solid ${D.neon1}` : '2px solid rgba(255,255,255,0.06)',
                        background: isSelected ? `linear-gradient(135deg, ${D.neon1}15, ${D.neon2}05)` : 'rgba(255,255,255,0.02)',
                        color: isSelected ? D.neon1 : D.text,
                        fontFamily: FONT, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: isSelected ? `0 4px 12px ${D.neon1}18` : 'none',
                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                        WebkitTapHighlightColor: 'transparent',
                      }}>
                      <span style={{ fontSize: 24 }}>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  );
                })}
              </div>

              {!showAllLangs && displayLangs.length < LANGS.length && (
                <button onClick={() => setShowAllLangs(true)}
                  style={{
                    width: '100%', padding: 12, borderRadius: 14,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: D.textSoft, fontFamily: FONT, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.3s',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  {Lf('showMoreLanguages', '+ Mostra tutte')}
                </button>
              )}
            </div>

            {/* Name Input */}
            <div style={{
              width: '100%', marginBottom: 24,
              ...stagger(2),
            }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: D.textMuted, marginBottom: 10, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
                {Lf('enterYourName', 'Qual è il tuo nome?')}
              </label>
              <input
                type="text"
                value={prefs.name}
                onChange={(e) => setPrefs({ ...prefs, name: e.target.value })}
                placeholder={Lf('nameInputPlaceholder', 'Es. Marco')}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${D.glassBorder}`,
                  color: D.text, fontFamily: FONT, fontSize: 15,
                  transition: 'all 0.3s',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                  e.target.style.borderColor = D.neon1 + '40';
                  e.target.style.boxShadow = `0 0 16px ${D.neon1}15`;
                }}
                onBlur={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.03)';
                  e.target.style.borderColor = D.glassBorder;
                  e.target.style.boxShadow = 'none';
                }}
              />
              {prefs.name.trim().length > 0 && prefs.name.trim().length < 2 && (
                <div style={{ fontSize: 11, color: D.neon3, marginTop: 8 }}>
                  {Lf('nameMinLength', 'Minimo 2 caratteri')}
                </div>
              )}
            </div>

            {/* CTA Button — Avanti */}
            <button onClick={next} disabled={!canNextStep0}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, cursor: canNextStep0 ? 'pointer' : 'default',
                background: canNextStep0 ? `linear-gradient(135deg, ${D.neon1}, ${D.neon2})` : 'rgba(255,255,255,0.04)',
                border: 'none', color: canNextStep0 ? '#fff' : D.textMuted,
                fontFamily: FONT, fontSize: 16, fontWeight: 700, letterSpacing: -0.3,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: canNextStep0 ? 1 : 0.5,
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: canNextStep0 ? `0 6px 22px ${D.neon1}30, inset 0 1px 0 rgba(255,255,255,0.18)` : 'none',
                position: 'relative', overflow: 'hidden',
                ...stagger(3),
              }}>
              {canNextStep0 && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.10) 50%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  animation: 'vtBtnShimmer 2.5s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{Lf('next', 'Avanti')}</span>
              <span style={{ fontSize: 18, position: 'relative', zIndex: 1 }}>→</span>
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════
            STEP 1: AVATAR + TIER
           ═══════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 420, padding: '0 8px' }}>

            {/* Title */}
            <div style={{
              fontSize: 24, fontWeight: 800, marginBottom: 24, textAlign: 'center',
              ...stagger(0),
            }}>
              {Lf('welcomeStep1Title', 'Chi sei?')}
            </div>

            {/* Avatar Selection — Horizontal Scrollable Row */}
            <div style={{
              width: '100%', marginBottom: 24,
              ...stagger(1),
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: D.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                {Lf('selectAvatar', 'Seleziona avatar')}
              </div>

              <div style={{
                display: 'flex', gap: 12, overflowX: 'auto', overflowY: 'hidden',
                paddingBottom: 8, WebkitOverflowScrolling: 'touch',
                scrollBehavior: 'smooth',
              }}>
                {AVATARS.map((avatar, idx) => {
                  const isSelected = avatar === prefs.avatar;
                  return (
                    <button key={idx}
                      onClick={() => setPrefs({ ...prefs, avatar })}
                      style={{
                        width: 64, height: 64, borderRadius: 16, cursor: 'pointer',
                        border: isSelected ? `2px solid ${D.neon1}` : '2px solid rgba(255,255,255,0.06)',
                        background: isSelected ? `linear-gradient(135deg, ${D.neon1}15, ${D.neon2}05)` : 'rgba(255,255,255,0.02)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: isSelected ? `0 4px 12px ${D.neon1}18` : 'none',
                        transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                        flexShrink: 0,
                        WebkitTapHighlightColor: 'transparent',
                      }}>
                      <AvatarImg avatar={avatar} size={48} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ═══ FREE FOR ALL: nessun tier, bottone diretto ═══ */}
            <div style={{
              width: '100%', marginBottom: 18,
              ...stagger(2),
            }}>
              <div style={{
                padding: '14px 16px', borderRadius: 14, marginBottom: 12,
                background: `linear-gradient(135deg, ${D.neon4}15, ${D.neon1}10)`,
                border: `1px solid ${D.neon4}30`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: D.neon4, marginBottom: 2 }}>
                  {'✨'} Tutto gratuito e illimitato
                </div>
                <div style={{ fontSize: 11, color: D.textMuted }}>
                  Voci AI premium, ElevenLabs, traduzioni illimitate
                </div>
              </div>

              })}
            </div>

            {/* CTA Button — FREE FOR ALL: sempre visibile */}
            <div style={{
              width: '100%',
              ...stagger(3),
            }}>
              <button onClick={finishWelcome}
                style={{
                  width: '100%', padding: '16px', borderRadius: 14, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${D.neon4}, ${D.neon4}dd)`,
                  border: 'none', color: '#000',
                  fontFamily: FONT, fontSize: 16, fontWeight: 700, letterSpacing: -0.3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: `0 6px 22px ${D.neon4}40, inset 0 1px 0 rgba(255,255,255,0.18)`,
                  position: 'relative', overflow: 'hidden',
                }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  animation: 'vtBtnShimmer 2.5s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
                <span style={{ position: 'relative', zIndex: 1 }}>🎯 {Lf('startTranslating', 'Inizia a Tradurre')}</span>
              </button>
            </div>

            {/* Back button */}
            <button onClick={prev}
              style={{
                marginTop: 12, padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: D.textSoft, fontFamily: FONT, fontSize: 14, fontWeight: 500,
                transition: 'all 0.3s',
                WebkitTapHighlightColor: 'transparent',
              }}>
              ← {Lf('back', 'Indietro')}
            </button>
          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════
          AUTH MODAL OVERLAY
         ═══════════════════════════════════════ */}
      {showAuthModal && (
        <>
          {/* Semi-transparent backdrop */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 100,
            animation: 'vtFadeIn 0.3s ease-out',
          }} onClick={() => {
            setShowAuthModal(false);
            setAuthError('');
          }} />

          {/* Glass modal */}
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '90%', maxWidth: 360,
            padding: '28px 24px', borderRadius: 20,
            background: `linear-gradient(135deg, ${D.glass}, rgba(10,12,28,0.9))`,
            border: `1px solid ${D.glassBorder}`,
            backdropFilter: 'blur(48px) saturate(180%)',
            WebkitBackdropFilter: 'blur(48px) saturate(180%)',
            boxShadow: `0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
            zIndex: 101,
            animation: 'vtSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            maxHeight: '90vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }} onClick={(e) => e.stopPropagation()}>

            {/* Close button */}
            <button onClick={() => {
              setShowAuthModal(false);
              setAuthError('');
            }}
              style={{
                position: 'absolute', top: 14, right: 14,
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: D.textSoft, fontSize: 18,
                cursor: 'pointer',
                transition: 'all 0.3s',
                WebkitTapHighlightColor: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              ✕
            </button>

            {/* Title */}
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: D.text, textAlign: 'center' }}>
              {Lf('authTitle', 'Attiva il tuo piano')}
            </div>
            <div style={{ fontSize: 12, color: D.textMuted, marginBottom: 20, textAlign: 'center' }}>
              {Lf('authSubtitle', 'Accedi o crea un account')}
            </div>

            {/* Auth Step: Email Input */}
            {(authStep === 'email' || authStep === undefined) && (
              <div>
                {/* Email Input */}
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder={Lf('emailPlaceholder', 'your@email.com')}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${D.glassBorder}`,
                    color: D.text, fontFamily: FONT, fontSize: 14,
                    transition: 'all 0.3s',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.05)';
                    e.target.style.borderColor = D.neon1 + '40';
                  }}
                  onBlur={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.03)';
                    e.target.style.borderColor = D.glassBorder;
                  }}
                />

                {/* Send Code Button */}
                <button onClick={async () => {
                  setAuthError('');
                  if (!authEmail || !authEmail.trim() || !authEmail.includes('@')) {
                    setAuthError(Lf('invalidEmail', 'Inserisci un indirizzo email valido'));
                    return;
                  }
                  const ok = await sendAuthCode();
                  if (!ok) setAuthError(Lf('sendCodeError', 'Errore nell\'invio del codice. Riprova.'));
                }} disabled={authLoading || !authEmail.trim()}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12, marginBottom: 16, cursor: authLoading || !authEmail.trim() ? 'default' : 'pointer',
                    background: authLoading || !authEmail.trim()
                      ? 'rgba(255,255,255,0.04)'
                      : `linear-gradient(135deg, ${D.neon1}, ${D.neon2})`,
                    border: 'none', color: authLoading || !authEmail.trim() ? D.textMuted : '#fff',
                    fontFamily: FONT, fontSize: 14, fontWeight: 700,
                    opacity: authLoading || !authEmail.trim() ? 0.5 : 1,
                    transition: 'all 0.3s',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  {authLoading ? Lf('sending', 'Invio...') : Lf('sendCode', 'Invia Codice')}
                </button>

                {authError && (
                  <div style={{ fontSize: 11, color: D.neon3, marginBottom: 14, textAlign: 'center' }}>
                    {authError}
                  </div>
                )}

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                  <span style={{ fontSize: 12, color: D.textMuted }}>o</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                </div>

                {/* Google Sign-In */}
                <button onClick={() => {
                  setAuthError('');
                  const clientId = typeof window !== 'undefined' ? window.__VT_GOOGLE_CLIENT_ID : '';
                  if (!clientId) {
                    setAuthError(Lf('googleNotConfigured', 'Google Sign-In non ancora configurato. Usa il login con email.'));
                    return;
                  }
                  // Try One Tap SDK first
                  initGoogleSignIn();
                  if (window.google?.accounts?.id) {
                    window.google.accounts.id.prompt((notification) => {
                      // If One Tap is dismissed or not displayed, use popup fallback
                      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        console.log('[Auth] One Tap unavailable, using OAuth popup');
                        googleOAuthPopup();
                      }
                    });
                  } else {
                    // SDK not loaded — use popup OAuth redirect
                    console.log('[Auth] Google SDK not loaded, using OAuth popup');
                    if (!googleOAuthPopup()) {
                      setAuthError(Lf('googleNotConfigured', 'Google Sign-In non disponibile. Usa il login con email.'));
                    }
                  }
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

                {/* Apple Sign-In — hidden until app is published on App Store */}
                {typeof window !== 'undefined' && window.__VT_APPLE_CLIENT_ID ? (
                <button onClick={async () => {
                  setAuthError('');
                  if (typeof window !== 'undefined' && window.AppleID?.auth) {
                    try {
                      const response = await window.AppleID.auth.signIn();
                      if (response) await loginWithApple(response, pendingReferralCode);
                    } catch (e) {
                      if (e.error !== 'popup_closed_by_user') {
                        setAuthError(Lf('appleError', 'Errore Apple Sign-In. Riprova.'));
                      }
                    }
                  } else {
                    const script = document.createElement('script');
                    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
                    script.async = true;
                    script.onload = async () => {
                      const clientId = window.__VT_APPLE_CLIENT_ID;
                      if (!clientId) { setAuthError(Lf('appleNotConfigured', 'Apple Sign-In non configurato')); return; }
                      window.AppleID.auth.init({ clientId, scope: 'name email', redirectURI: window.location.origin, usePopup: true });
                      try {
                        const response = await window.AppleID.auth.signIn();
                        if (response) await loginWithApple(response, pendingReferralCode);
                      } catch (e) {
                        if (e.error !== 'popup_closed_by_user') setAuthError(Lf('appleError', 'Errore Apple Sign-In. Riprova.'));
                      }
                    };
                    document.head.appendChild(script);
                  }
                }} disabled={authLoading}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 14, cursor: 'pointer', marginBottom: 18,
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
                ) : null}

                {/* Continue Free Link */}
                <button onClick={() => {
                  setShowAuthModal(false);
                  setSelectedTier('free');
                }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12,
                    background: 'transparent', border: 'none',
                    color: D.neon4, fontFamily: FONT, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.3s',
                    WebkitTapHighlightColor: 'transparent',
                    textDecoration: 'underline',
                  }}>
                  {Lf('continueFreePath', '→ Continua gratis')}
                </button>
              </div>
            )}

            {/* Auth Step: Code Verification */}
            {authStep === 'code' && (
              <div>
                <div style={{ fontSize: 13, color: D.textSoft, marginBottom: 12, textAlign: 'center' }}>
                  {Lf('sentTo', 'Codice inviato a')} <strong>{authEmail}</strong>
                </div>

                {authTestCode && (
                  <div style={{fontSize: 13, color: D.neon4, textAlign: 'center', marginBottom: 12,
                    padding: '8px 12px', background: `${D.neon4}12`, borderRadius: 12}}>
                    Test code: <strong>{authTestCode}</strong>
                  </div>
                )}

                {/* Code Input */}
                <input
                  type="text"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value.slice(0, 6).toUpperCase())}
                  placeholder="000000"
                  maxLength={6}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 12,
                    textAlign: 'center', fontSize: 20, fontWeight: 700, letterSpacing: 4,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${D.glassBorder}`,
                    color: D.text, fontFamily: 'monospace',
                    transition: 'all 0.3s',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.05)';
                    e.target.style.borderColor = D.neon1 + '40';
                  }}
                  onBlur={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.03)';
                    e.target.style.borderColor = D.glassBorder;
                  }}
                />

                {/* Verify Button */}
                <button onClick={async () => {
                  setAuthError('');
                  const ok = await verifyAuthCodeFn();
                  if (!ok) setAuthError(Lf('verifyError', 'Codice non valido o scaduto. Riprova.'));
                }} disabled={authLoading || authCode.length < 6}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12, marginBottom: 16, cursor: authLoading || authCode.length !== 6 ? 'default' : 'pointer',
                    background: authLoading || authCode.length !== 6
                      ? 'rgba(255,255,255,0.04)'
                      : `linear-gradient(135deg, ${D.neon1}, ${D.neon2})`,
                    border: 'none', color: authLoading || authCode.length !== 6 ? D.textMuted : '#fff',
                    fontFamily: FONT, fontSize: 14, fontWeight: 700,
                    opacity: authLoading || authCode.length !== 6 ? 0.5 : 1,
                    transition: 'all 0.3s',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  {authLoading ? Lf('verifying', 'Verifica...') : Lf('verify', 'Verifica')}
                </button>

                {authError && (
                  <div style={{ fontSize: 11, color: D.neon3, marginBottom: 14, textAlign: 'center' }}>
                    {authError}
                  </div>
                )}

                {/* Change Email Link */}
                <button onClick={() => {
                  setAuthStep('email');
                  setAuthError('');
                }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12,
                    background: 'transparent', border: 'none',
                    color: D.neon4, fontFamily: FONT, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.3s',
                    WebkitTapHighlightColor: 'transparent',
                    textDecoration: 'underline',
                  }}>
                  {Lf('changeEmail', '← Cambia email')}
                </button>
              </div>
            )}

          </div>
        </>
      )}

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
        @keyframes vtWave {
          0%, 100% { transform: scaleY(0.4); opacity: 0.4; }
          50% { transform: scaleY(1); opacity: 0.8; }
        }
        @keyframes vtBtnShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes vtFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes vtSlideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </div>
  );
}
