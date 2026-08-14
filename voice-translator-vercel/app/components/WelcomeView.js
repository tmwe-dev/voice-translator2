'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import { getPaese } from '../lib/paesi.js';
import AvatarImg from './AvatarImg.js';
import Icon from './Icon.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import Sciame from './Sciame.js';
import { IconGlobe, IconMic, IconBattery } from './Icons.js';

// ═══════════════════════════════════════════════════════════
// WELCOME VIEW — Redesign v2.0
//
// 3-phase progressive onboarding:
//   Phase 0: HERO — Value proposition + Google Sign-In + Skip
//   Phase 1: SETUP — Nome (il paese e gia scelto: qui si riepiloga)
//   Phase 2: PROFILE — Avatar selection + Start
//
// b.136 — la fase 1 chiedeva anche la lingua. Non piu: la lingua nasce
// dal paese, e il paese si sceglie in SceltaPaeseView che gira PRIMA
// di questa schermata. Qui resta il nome, che nessun'altra schermata sa.
//
// Design: Dark ambient glassmorphism, floating orbs,
//         gradient text, staggered animations
// ═══════════════════════════════════════════════════════════

export default function WelcomeView({ joinCode, userToken, setAuthStep,
  sendAuthCode, verifyAuthCodeFn, loginWithGoogle, loginWithApple,
  authStep, authEmail, setAuthEmail, authCode, setAuthCode, authLoading, authTestCode, pendingReferralCode }) {
  const { L, S, prefs, setPrefs, savePrefs, setView, theme, setTheme } = useApp();
  const [phase, setPhase] = useState(0);
  const [entered, setEntered] = useState(false);
  const [authError, setAuthError] = useState('');
  // Codice regalo/voucher: lo teniamo da parte e la batteria lo riscatta dopo il login
  const [codicePromo, setCodicePromo] = useState('');

  // ── Palette derivata dal TEMA attivo (Spatial Design) — non più hardcoded ──
  const tc = S.colors || {};
  const isDawn = theme === 'dawn';
  const D = {
    bg1: isDawn ? '#f7f8fc' : '#05070f',
    bg2: isDawn ? '#eef0f7' : '#0a0f1f',
    bg3: isDawn ? '#e9ecf4' : '#101730',
    surface: isDawn ? 'rgba(255,255,255,0.75)' : 'rgba(10,15,31,0.75)',
    glass: tc.cardBg || 'rgba(255,255,255,0.03)',
    glassBorder: tc.cardBorder || 'rgba(255,255,255,0.06)',
    neon1: tc.accent1 || PALETTE.teal,
    neon2: tc.accent2 || PALETTE.violet,
    neon3: tc.statusError || PALETTE.coral,
    neon4: tc.goldAccent || '#E8924A',
    text: tc.textPrimary || '#FFFFFF',
    textSoft: tc.textSecondary || 'rgba(255,255,255,0.75)',
    textMuted: tc.textTertiary || 'rgba(255,255,255,0.50)',
    textDim: tc.textMuted || 'rgba(255,255,255,0.30)',
  };

  // b.139 — c'era `Lf(chiave, ripiego)`: quando la chiave mancava usciva il
  // RIPIEGO, scritto in italiano. Chi apriva la pagina in coreano leggeva
  // 'Configurazione rapida'. Le chiavi ora ci sono tutte e 15: il ripiego
  // non serve piu, e tenerlo avrebbe solo nascosto la prossima chiave persa.

  // ── Google Auth ──
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

  const googleOAuthPopup = useCallback(() => {
    const clientId = typeof window !== 'undefined' ? window.__VT_GOOGLE_CLIENT_ID : '';
    if (!clientId || !window.google?.accounts?.oauth2) return false;
    try {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: 'email profile openid',
        ux_mode: 'popup',
        callback: async (response) => {
          if (response.code) {
            try {
              const res = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: response.code, referralCode: pendingReferralCode }),
              });
              const data = await res.json();
              if (data.ok && loginWithGoogle) {
                // Reuse the same post-login handler by simulating credential flow result
                window.postMessage({ type: 'google-oauth-result', data }, '*');
              }
            } catch (e) { console.error('Google code exchange error:', e); }
          }
        },
      });
      client.requestCode();
      return true;
    } catch (e) {
      console.error('initCodeClient error:', e);
      return false;
    }
  }, [pendingReferralCode, loginWithGoogle]);

  useEffect(() => {
    initGoogleSignIn();
    const t = setInterval(() => {
      if (window.google?.accounts?.id) { initGoogleSignIn(); clearInterval(t); }
    }, 500);
    return () => clearInterval(t);
  }, [initGoogleSignIn]);

  // b.136 — QUI C'ERA L'INDOVINELLO DELLA LINGUA, ed e stato tolto.
  //
  // Leggeva `navigator.language`, tagliava via la regione ("it-IT" ->
  // "it") e ci scriveva `prefs.lang`. Due difetti: buttava via proprio
  // l'informazione piu utile — la regione, che dice il PAESE — e
  // impostava una lingua sola per due mestieri diversi.
  //
  // Adesso lo fa SceltaPaeseView, che gira prima di questa schermata e
  // usa regione e fuso orario insieme. Quando si arriva qui il paese e
  // gia scelto: questa schermata non lo tocca piu, lo mostra soltanto.

  // Transition animation on phase change
  useEffect(() => {
    setEntered(false);
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, [phase]);

  // When auth completes, skip to setup
  useEffect(() => {
    if (authStep === 'choose' && phase === 0) {
      setPhase(1);
    }
  }, [authStep]);

  const canNextSetup = prefs.name.trim().length >= 2;

  function finishWelcome() {
    savePrefs(prefs);
    setView(joinCode ? 'join' : 'home');
  }

  // Stagger animation
  const stagger = (i, base = 0) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
    transition: `all 0.55s cubic-bezier(0.16, 1, 0.3, 1) ${base + i * 0.08}s`,
  });

  // Il paese scelto un attimo prima: qui si mostra, non si ri-chiede.
  const paese = getPaese(prefs.country);
  const linguaParlata = getLang(prefs.lang);

  // Feature pills — icone MONO a filo sottile, mai emoji
  const features = [
    { icon: <IconGlobe size={19} />, text: L('featureTranslate'), color: D.neon1 },
    { icon: <IconMic size={19} />, text: L('featureVoices'), color: D.neon2 },
    { icon: <IconBattery size={19} />, text: L('featureFree'), color: D.neon4 },
  ];

  // Progress indicator
  const progressBar = (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: i === phase ? 32 : 10, height: 6, borderRadius: 3,
          background: i <= phase
            ? `linear-gradient(90deg, ${D.neon1}, ${D.neon2})`
            : 'rgba(255,255,255,0.06)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: i === phase ? `0 0 12px ${D.neon1}40` : 'none',
        }} />
      ))}
    </div>
  );

  // ── CTA Button component ──
  const CTAButton = ({ onClick, disabled, children, secondary }) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: '100%', padding: secondary ? '14px' : '16px', borderRadius: 16,
        cursor: disabled ? 'default' : 'pointer',
        background: disabled ? 'rgba(255,255,255,0.04)'
          : secondary ? 'rgba(255,255,255,0.04)'
          : `linear-gradient(135deg, ${D.neon1}, ${D.neon2})`,
        border: secondary ? `1.5px solid ${D.glassBorder}` : 'none',
        color: disabled ? D.textMuted : secondary ? D.textSoft : '#fff',
        fontFamily: FONT, fontSize: secondary ? 14 : 16, fontWeight: 700,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        WebkitTapHighlightColor: 'transparent',
        boxShadow: (!disabled && !secondary) ? `0 6px 24px ${D.neon1}30, inset 0 1px 0 rgba(255,255,255,0.15)` : 'none',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
      {!disabled && !secondary && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.10) 50%, transparent 60%)',
          backgroundSize: '200% 100%', animation: 'vtBtnShimmer 2.5s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}
      <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>{children}</span>
    </button>
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: `linear-gradient(165deg, ${D.bg1} 0%, ${D.bg2} 30%, ${D.bg3} 60%, ${D.bg1} 100%)`,
      color: D.text, fontFamily: FONT, overflow: 'hidden',
    }}>

      {/* ═══ LO SCIAME — il mondo di granelli che accoglie ═══
          fase 0 = sfera (il mondo) · fase 1 = elica (il nome)
          fase 2 = anello (la scelta). Sostituisce gli orb sfocati. */}
      <Sciame modo="vivo" fase={Math.min(phase, 2)} />
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {/* Noise + Vignette */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat', backgroundSize: '256px',
        }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }} />
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        height: '100%', padding: '16px 20px', boxSizing: 'border-box',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        position: 'relative', zIndex: 1,
      }}>

        {/* Progress */}
        {progressBar}

        {/* ═══════════════════════════════════════════════
            PHASE 0: HERO — Value Proposition + Auth
           ═══════════════════════════════════════════════ */}
        {phase === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            width: '100%', maxWidth: 400, flex: 1, justifyContent: 'center',
            marginTop: -20,
          }}>

            {/* Logo / App Name */}
            <div style={{
              fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
              color: D.neon1, marginBottom: 16,
              ...stagger(0),
            }}>
              BARTALK
            </div>

            {/* Hero Title with gradient */}
            <div style={{
              fontSize: 32, fontWeight: 900, textAlign: 'center', lineHeight: 1.15,
              letterSpacing: -0.5, marginBottom: 12,
              background: `linear-gradient(135deg, ${D.text} 0%, ${D.neon1} 50%, ${D.neon2} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              ...stagger(1),
            }}>
              {L('heroTitle')}
            </div>

            {/* Subtitle */}
            <div style={{
              fontSize: 15, color: D.textSoft, textAlign: 'center', lineHeight: 1.5,
              marginBottom: 32, maxWidth: 320,
              ...stagger(2),
            }}>
              {L('heroSubtitle')}
            </div>

            {/* Feature pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginBottom: 36 }}>
              {features.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${f.color}18`,
                  ...stagger(3 + i),
                }}>
                  <span style={{ lineHeight: 0, color: f.color, display: 'flex' }}>{f.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: D.textSoft }}>{f.text}</span>
                </div>
              ))}
            </div>

            {/* Google Sign-In Button */}
            <div style={{ width: '100%', marginBottom: 12, ...stagger(6) }}>
              <CTAButton onClick={() => {
                try {
                  if (window.google?.accounts?.id) {
                    window.google.accounts.id.prompt((notification) => {
                      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        googleOAuthPopup();
                      }
                    });
                  } else {
                    googleOAuthPopup();
                  }
                } catch { googleOAuthPopup(); }
              }}>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                {L('continueWithGoogle')}
              </CTAButton>
            </div>

            {/* Skip — Continue without account */}
            <div style={{ width: '100%', ...stagger(7) }}>
              <CTAButton secondary onClick={() => setPhase(1)}>
                {L('continueWithoutAccount')}
              </CTAButton>
            </div>

            {/* Le lingue: i NOMI, non le bandierine — sobrio e leggibile */}
            <div style={{
              display: 'flex', gap: '7px 14px', justifyContent: 'center', flexWrap: 'wrap',
              marginTop: 34, maxWidth: 400, ...stagger(8),
            }}>
              {['Italiano','English','Español','Français','Deutsch','ไทย','中文','日本語','한국어','Português','العربية','Русский'].map((nome, i) => (
                <span key={i} style={{
                  fontSize: 11.5, fontWeight: 600, color: D.textDim, letterSpacing: 0.2,
                  opacity: 0.55,
                }}>{nome}</span>
              ))}
              <span style={{ fontSize: 11.5, fontWeight: 700, color: D.neon2, opacity: 0.8 }}>
                +33 altre
              </span>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            PHASE 1: SETUP — Language + Name
           ═══════════════════════════════════════════════ */}
        {phase === 1 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            width: '100%', maxWidth: 420, padding: '0 4px',
          }}>
            {/* Back */}
            <button onClick={() => setPhase(0)}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: D.textMuted,
                cursor: 'pointer', fontFamily: FONT, fontSize: 14, marginBottom: 8, padding: '4px 0',
                WebkitTapHighlightColor: 'transparent', ...stagger(0) }}>
              {'←'} {L('backWord')}
            </button>

            {/* Title */}
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, textAlign: 'center', ...stagger(0) }}>
              {L('setupTitle')}
            </div>
            <div style={{ fontSize: 13, color: D.textMuted, marginBottom: 24, textAlign: 'center', ...stagger(1) }}>
              {L('setupSubtitle')}
            </div>

            {/* ── b.136 · QUI C'ERA UN SECONDO SELETTORE DI LINGUA ──
                Una griglia di dodici bandierine che scriveva `prefs.lang`
                e nient'altro: il paese non lo sapeva, e la lingua
                dell'interfaccia nemmeno. Chiedere due volte la stessa
                cosa in due schermate di fila, con due esiti diversi, e
                il modo piu sicuro di farle divergere.
                Ora si mostra cosa e stato scelto un attimo prima, con la
                via per tornare indietro se ci si e sbagliati. */}
            <button onClick={() => setView('paese')}
              style={{ width: '100%', marginBottom: 20, padding: '13px 15px', borderRadius: 16,
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.glassBorder}`,
                fontFamily: FONT, WebkitTapHighlightColor: 'transparent', ...stagger(2) }}>
              <span style={{ fontSize: 27, lineHeight: 1 }}>{paese?.bandiera || linguaParlata.flag}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2,
                  textTransform: 'uppercase', color: D.textMuted }}>
                  {L('countryLabel')}
                </span>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: D.text, marginTop: 2 }}>
                  {paese?.nome || linguaParlata.name}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: D.textMuted, marginTop: 2 }}>
                  {linguaParlata.name}
                </span>
              </span>
              {/* Una freccia e non una parola: qui non c'e una chiave
                  "cambia" in quindici lingue, e inventarne una a meta
                  sarebbe tornare al problema di partenza. */}
              <span aria-hidden="true" style={{ fontSize: 20, fontWeight: 700, color: D.neon1, flexShrink: 0, lineHeight: 1 }}>
                {'›'}
              </span>
            </button>

            {/* Name Input */}
            <div style={{ width: '100%', marginBottom: 24, ...stagger(3) }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {L('yourName')}
              </div>
              <input type="text" value={prefs.name}
                onChange={(e) => setPrefs({ ...prefs, name: e.target.value })}
                placeholder={L('nameExample')}
                maxLength={20}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 14, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${D.glassBorder}`,
                  color: D.text, fontFamily: FONT, fontSize: 15, outline: 'none',
                  transition: 'all 0.3s',
                }}
                onFocus={(e) => { e.target.style.borderColor = D.neon1 + '40'; e.target.style.boxShadow = `0 0 16px ${D.neon1}15`; }}
                onBlur={(e) => { e.target.style.borderColor = D.glassBorder; e.target.style.boxShadow = 'none'; }}
              />
              {prefs.name.trim().length > 0 && prefs.name.trim().length < 2 && (
                <div style={{ fontSize: 11, color: D.neon3, marginTop: 6 }}>{L('minChars')}</div>
              )}
            </div>

            {/* Next */}
            <div style={{ width: '100%', ...stagger(4) }}>
              <CTAButton onClick={() => setPhase(2)} disabled={!canNextSetup}>
                {L('next')} <span style={{ fontSize: 18 }}>{'→'}</span>
              </CTAButton>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            PHASE 2: PROFILE — Avatar + Start
           ═══════════════════════════════════════════════ */}
        {phase === 2 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            width: '100%', maxWidth: 420, padding: '0 4px',
          }}>
            {/* Back */}
            <button onClick={() => setPhase(1)}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: D.textMuted,
                cursor: 'pointer', fontFamily: FONT, fontSize: 14, marginBottom: 8, padding: '4px 0',
                WebkitTapHighlightColor: 'transparent', ...stagger(0) }}>
              {'←'} {L('backWord')}
            </button>

            {/* Greeting */}
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, textAlign: 'center', ...stagger(0) }}>
              {L('heyName').replace('{x}', prefs.name)}
            </div>
            <div style={{ fontSize: 13, color: D.textMuted, marginBottom: 24, textAlign: 'center', ...stagger(1) }}>
              {L('chooseAvatar')}
            </div>

            {/* Avatar Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
              width: '100%', marginBottom: 32,
              ...stagger(2),
            }}>
              {AVATARS.map((avatar, idx) => {
                const isSel = avatar === prefs.avatar;
                return (
                  <button key={idx} onClick={() => setPrefs({ ...prefs, avatar })}
                    style={{
                      aspectRatio: '1', borderRadius: 18, cursor: 'pointer',
                      border: isSel ? `2.5px solid ${D.neon1}` : '2.5px solid rgba(255,255,255,0.05)',
                      background: isSel ? `${D.neon1}12` : 'rgba(255,255,255,0.02)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: isSel ? `0 4px 16px ${D.neon1}20, 0 0 0 4px ${D.neon1}08` : 'none',
                      transform: isSel ? 'scale(1.06)' : 'scale(1)',
                      WebkitTapHighlightColor: 'transparent', padding: 8,
                    }}>
                    <AvatarImg avatar={avatar} size={48} />
                    <span style={{ fontSize: 9, color: isSel ? D.neon1 : D.textDim, fontWeight: 600, marginTop: 2 }}>
                      {AVATAR_NAMES[idx]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Summary card */}
            <div style={{
              width: '100%', padding: '16px 18px', borderRadius: 16,
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.glassBorder}`,
              marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14,
              ...stagger(3),
            }}>
              <AvatarImg avatar={prefs.avatar} size={44} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{prefs.name}</div>
                <div style={{ fontSize: 12, color: D.textMuted }}>
                  {paese?.bandiera || linguaParlata.flag} {paese?.nome || linguaParlata.name}
                </div>
              </div>
            </div>

            {/* Hai un codice regalo? (voucher — riscattato appena entri) */}
            <div style={{ width: '100%', marginBottom: 18, ...stagger(4) }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: D.textMuted, marginBottom: 6 }}>
                {L('haveCode')}
              </div>
              <input
                value={codicePromo}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  setCodicePromo(v);
                  try {
                    if (v.trim()) localStorage.setItem('vt-voucher-pendente', v.trim());
                    else localStorage.removeItem('vt-voucher-pendente');
                  } catch { /* memoria del browser piena o navigazione privata: si prosegue senza salvare */ }
                }}
                placeholder={L('codePlaceholder')}
                aria-label={L('giftCodeAria')}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 14,
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 700, letterSpacing: 1,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.glassBorder}`,
                  color: D.text, outline: 'none',
                }} />
            </div>

            {/* Start Button */}
            <div style={{ width: '100%', ...stagger(5) }}>
              <CTAButton onClick={finishWelcome}>
                {L('startUsing')} {''}
              </CTAButton>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ANIMATIONS ═══ */}
      <style>{`
        @keyframes vtOrb1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-15px,20px) scale(1.03); } 66% { transform: translate(10px,-15px) scale(0.97); } }
        @keyframes vtOrb2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,-25px) scale(1.04); } }
        @keyframes vtOrb3 { 0%,100% { transform: translateX(-50%) scale(1); opacity:0.6; } 50% { transform: translateX(-50%) translateY(-15px) scale(1.05); opacity:0.9; } }
        @keyframes vtBtnShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  );
}
