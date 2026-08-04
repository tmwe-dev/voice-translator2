import { FONT } from './constants.js';

// ========================================
// STYLES - Multi-theme support
// 5 themes: dark (P4 Manifesto purple), light, brown, orange, midnight
// HIGH CONTRAST: all text readable on dark backgrounds
// Design system: IntelliFlow-inspired ambient aesthetics
// ========================================

// ── Design Tokens (theme-independent) ──
export const tokens = {
  duration: { fast: '0.15s', normal: '0.25s', slow: '0.4s', ambient: '0.6s' },
  easing: {
    ease: 'cubic-bezier(0.4,0,0.2,1)',
    easeOut: 'cubic-bezier(0,0,0.2,1)',
    spring: 'cubic-bezier(0.175,0.885,0.32,1.275)',
    smooth: 'cubic-bezier(0.2,0.8,0.2,1)',
  },
  shadow: {
    xs: '0 1px 2px rgba(0,0,0,0.12)',
    sm: '0 2px 6px rgba(0,0,0,0.18)',
    md: '0 4px 16px rgba(0,0,0,0.22)',
    lg: '0 8px 32px rgba(0,0,0,0.28)',
    xl: '0 20px 60px -15px rgba(0,0,0,0.5)',
    glow: (color) => `0 0 24px ${color}35, 0 0 60px ${color}15`,
    innerGlow: (color) => `inset 0 1px 0 ${color}12`,
  },
  blur: { none: 'none', sm: 'blur(4px)', md: 'blur(12px)', lg: 'blur(24px)', xl: 'blur(40px)' },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 999 },
  // z-index scale — consistent layering across the app
  zIndex: { base: 0, card: 10, header: 20, dropdown: 30, modal: 40, nav: 50, sheet: 60, overlay: 70, toast: 80, max: 100 },
  // Touch targets — WCAG 2.2 minimum 44×44px, preferred 48×48px
  touch: { min: 44, preferred: 48, large: 56 },
  // Breakpoints — mobile-first
  breakpoint: { sm: 480, md: 768, lg: 1024, xl: 1280 },
  focus: (color) => ({
    ring: `0 0 0 2px ${color}40`,
    outline: `2px solid ${color}60`,
  }),
};

// ── CSS Keyframes (inject once via style tag) ──
export const keyframes = `
  @keyframes vtSpin { to { transform: rotate(360deg); } }
  @keyframes vtPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes vtFadeIn { from { opacity: 0; } to { opacity: 1; } }
  /* Dissolvenza fra le pagine: il contenuto entra, l'ambiente resta */
  @keyframes vtPagina { from { opacity: 0; transform: translateY(7px) scale(0.995); }
                        to { opacity: 1; transform: none; } }
  @keyframes vtSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes vtScaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
  @keyframes vtGlow { 0%,100% { box-shadow: 0 0 5px currentColor; } 50% { box-shadow: 0 0 20px currentColor; } }
  @keyframes vtShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes vtWave { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.5); } }
  @keyframes vtBreathe { 0%,100% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.06); opacity: 1; } }
  @keyframes vtRipple { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
  @keyframes vtRecordPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,80,80,0.4); } 50% { box-shadow: 0 0 0 14px rgba(255,80,80,0); } }
  @keyframes vtConnecting { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes vtSubtitleIn { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes vtGlowBorder { 0%,100% { border-color: rgba(139,92,246,0.3); } 50% { border-color: rgba(6,182,212,0.6); } }
  @keyframes vtFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes vtTypewriter { from { width: 0; } to { width: 100%; } }
  @keyframes vtOrbBreathe { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } }
  @keyframes vtAuroraShift { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(30deg); } }
`;

export default function getStyles(theme = 'deep') {
  // Legacy ids → nuovi temi (chiamate dirette con vecchi id non devono rompersi)
  const LEGACY = { dark: 'deep', light: 'dawn', brown: 'ember', orange: 'ember' };
  if (LEGACY[theme]) theme = LEGACY[theme];
  // Scuri: tutti tranne Dawn. (Prima avorio/lilla/blubianco cadevano nel ramo
  // 'chiaro' e prendevano bordi/ombre sbagliati: contrasto rotto.)
  const isDark = theme !== 'dawn';

  // ── COLOR PALETTES ──
  const palettes = {
    // ═══ DEEP SPACE — blu notte, vetri, stelle ═══
    deep: {
      bgGradient: 'linear-gradient(168deg, #05070f 0%, #0a0f1f 45%, #101730 80%, #05070f 100%)',
      roomGradient: 'linear-gradient(168deg, #05070f 0%, #090e1d 45%, #0e1428 80%, #05070f 100%)',
      textPrimary: '#eef2ff',
      textSecondary: 'rgba(238,242,255,0.82)',
      textTertiary: 'rgba(238,242,255,0.66)',
      textMuted: 'rgba(238,242,255,0.42)',
      cardBg: 'rgba(140,170,255,0.06)',
      cardBorder: 'rgba(160,190,255,0.14)',
      inputBg: 'rgba(140,170,255,0.05)',
      inputBorder: 'rgba(160,190,255,0.16)',
      buttonOverlay: 'rgba(140,170,255,0.06)',
      headerBg: 'rgba(5,7,15,0.85)',
      headerBorder: 'rgba(160,190,255,0.10)',
      accent1: '#5b8cff',
      accent2: '#38e1ff',
      accent3: '#ff5470',
      accent4: '#3ddc84',
      accentGradient: 'linear-gradient(90deg, #5b8cff 0%, #38e1ff 100%)',
      btnGradient: 'linear-gradient(90deg, #5b8cff 0%, #38e1ff 100%)',
      btnGlow: '0 10px 34px -8px rgba(91,140,255,0.5), inset 0 1px 0 rgba(255,255,255,0.28)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.25), 0 20px 60px -18px rgba(0,0,0,0.6)',
      glassCard: 'rgba(140,170,255,0.06)',
      statusOk: '#3ddc84',
      statusError: '#ff5470',
      statusWarning: '#ffc44d',
      goldAccent: '#ffc44d',
      onlineColor: '#3ddc84',
      dividerColor: 'rgba(160,190,255,0.10)',
      overlayBg: 'rgba(140,170,255,0.04)',
      overlayBorder: 'rgba(160,190,255,0.12)',
      accent1Bg: 'rgba(91,140,255,0.12)',
      accent1Border: 'rgba(91,140,255,0.28)',
      accent2Bg: 'rgba(56,225,255,0.10)',
      accent2Border: 'rgba(56,225,255,0.24)',
      accent3Bg: 'rgba(255,84,112,0.10)',
      accent3Border: 'rgba(255,84,112,0.22)',
      accent4Bg: 'rgba(61,220,132,0.10)',
      accent4Border: 'rgba(61,220,132,0.22)',
      toggleOff: 'rgba(238,242,255,0.10)',
      popupBg: 'rgba(5,7,15,0.96)',
    },
    // ═══ EMBER — scuro caldo, orange e ambra ═══
    ember: {
      bgGradient: 'linear-gradient(168deg, #0d0805 0%, #170e08 45%, #241409 80%, #0d0805 100%)',
      roomGradient: 'linear-gradient(168deg, #0d0805 0%, #150d07 45%, #201207 80%, #0d0805 100%)',
      textPrimary: '#fff4ea',
      textSecondary: 'rgba(255,244,234,0.82)',
      textTertiary: 'rgba(255,244,234,0.66)',
      textMuted: 'rgba(255,244,234,0.42)',
      cardBg: 'rgba(255,180,120,0.06)',
      cardBorder: 'rgba(255,190,140,0.14)',
      inputBg: 'rgba(255,180,120,0.05)',
      inputBorder: 'rgba(255,190,140,0.16)',
      buttonOverlay: 'rgba(255,180,120,0.06)',
      headerBg: 'rgba(13,8,5,0.85)',
      headerBorder: 'rgba(255,190,140,0.10)',
      accent1: '#ff8a3d',
      accent2: '#ffc44d',
      accent3: '#ff5470',
      accent4: '#7cd97a',
      accentGradient: 'linear-gradient(90deg, #ff8a3d 0%, #ffc44d 100%)',
      btnGradient: 'linear-gradient(90deg, #ff8a3d 0%, #ffc44d 100%)',
      btnGlow: '0 10px 34px -8px rgba(255,138,61,0.45), inset 0 1px 0 rgba(255,255,255,0.28)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.25), 0 20px 60px -18px rgba(0,0,0,0.6)',
      glassCard: 'rgba(255,180,120,0.06)',
      statusOk: '#7cd97a',
      statusError: '#ff5470',
      statusWarning: '#ffc44d',
      goldAccent: '#ffc44d',
      onlineColor: '#7cd97a',
      dividerColor: 'rgba(255,190,140,0.10)',
      overlayBg: 'rgba(255,180,120,0.04)',
      overlayBorder: 'rgba(255,190,140,0.12)',
      accent1Bg: 'rgba(255,138,61,0.12)',
      accent1Border: 'rgba(255,138,61,0.28)',
      accent2Bg: 'rgba(255,196,77,0.10)',
      accent2Border: 'rgba(255,196,77,0.24)',
      accent3Bg: 'rgba(255,84,112,0.10)',
      accent3Border: 'rgba(255,84,112,0.22)',
      accent4Bg: 'rgba(124,217,122,0.10)',
      accent4Border: 'rgba(124,217,122,0.22)',
      toggleOff: 'rgba(255,244,234,0.10)',
      popupBg: 'rgba(13,8,5,0.96)',
    },
    // ═══ AVORIO — nero caldo, luce d'ambra (tono A dello sciame) ═══
    avorio: {
      bgGradient: 'linear-gradient(168deg, #070706 0%, #0c0b09 45%, #12100c 80%, #070706 100%)',
      roomGradient: 'linear-gradient(168deg, #070706 0%, #0b0a08 45%, #100e0b 80%, #070706 100%)',
      textPrimary: '#f2efe8',
      textSecondary: 'rgba(242,239,232,0.82)',
      textTertiary: 'rgba(242,239,232,0.66)',
      textMuted: 'rgba(242,239,232,0.42)',
      cardBg: 'rgba(242,239,232,0.05)',
      cardBorder: 'rgba(242,239,232,0.12)',
      inputBg: 'rgba(242,239,232,0.04)',
      inputBorder: 'rgba(242,239,232,0.14)',
      buttonOverlay: 'rgba(242,239,232,0.05)',
      headerBg: 'rgba(7,7,6,0.85)',
      headerBorder: 'rgba(242,239,232,0.09)',
      accent1: '#ffb454',
      accent2: '#ffd28a',
      accent3: '#ff5470',
      accent4: '#9ad97a',
      accentGradient: 'linear-gradient(90deg, #ffb454 0%, #ffd28a 100%)',
      btnGradient: 'linear-gradient(90deg, #ffb454 0%, #ffd28a 100%)',
      btnGlow: '0 10px 34px -8px rgba(255,180,84,0.45), inset 0 1px 0 rgba(255,255,255,0.28)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.25), 0 20px 60px -18px rgba(0,0,0,0.6)',
      glassCard: 'rgba(242,239,232,0.05)',
      statusOk: '#9ad97a',
      statusError: '#ff5470',
      statusWarning: '#ffc44d',
      goldAccent: '#ffb454',
      onlineColor: '#9ad97a',
      dividerColor: 'rgba(242,239,232,0.09)',
      overlayBg: 'rgba(242,239,232,0.04)',
      overlayBorder: 'rgba(242,239,232,0.11)',
      accent1Bg: 'rgba(255,180,84,0.12)',
      accent1Border: 'rgba(255,180,84,0.28)',
      accent2Bg: 'rgba(255,210,138,0.10)',
      accent2Border: 'rgba(255,210,138,0.24)',
      accent3Bg: 'rgba(255,84,112,0.10)',
      accent3Border: 'rgba(255,84,112,0.22)',
      accent4Bg: 'rgba(154,217,122,0.10)',
      accent4Border: 'rgba(154,217,122,0.22)',
      toggleOff: 'rgba(242,239,232,0.10)',
      popupBg: 'rgba(7,7,6,0.96)',
    },
    // ═══ LILLA — viola notte, lavanda (tono C dello sciame) ═══
    lilla: {
      bgGradient: 'linear-gradient(168deg, #070510 0%, #0c081c 45%, #130d2a 80%, #070510 100%)',
      roomGradient: 'linear-gradient(168deg, #070510 0%, #0b0719 45%, #100b24 80%, #070510 100%)',
      textPrimary: '#ece8f8',
      textSecondary: 'rgba(236,232,248,0.82)',
      textTertiary: 'rgba(236,232,248,0.66)',
      textMuted: 'rgba(236,232,248,0.42)',
      cardBg: 'rgba(201,184,245,0.06)',
      cardBorder: 'rgba(201,184,245,0.14)',
      inputBg: 'rgba(201,184,245,0.05)',
      inputBorder: 'rgba(201,184,245,0.16)',
      buttonOverlay: 'rgba(201,184,245,0.06)',
      headerBg: 'rgba(7,5,16,0.85)',
      headerBorder: 'rgba(201,184,245,0.10)',
      accent1: '#a78bfa',
      accent2: '#c9b8f5',
      accent3: '#ff5470',
      accent4: '#7ad9b8',
      accentGradient: 'linear-gradient(90deg, #a78bfa 0%, #c9b8f5 100%)',
      btnGradient: 'linear-gradient(90deg, #a78bfa 0%, #c9b8f5 100%)',
      btnGlow: '0 10px 34px -8px rgba(167,139,250,0.45), inset 0 1px 0 rgba(255,255,255,0.28)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.25), 0 20px 60px -18px rgba(0,0,0,0.6)',
      glassCard: 'rgba(201,184,245,0.06)',
      statusOk: '#7ad9b8',
      statusError: '#ff5470',
      statusWarning: '#ffc44d',
      goldAccent: '#ffc44d',
      onlineColor: '#7ad9b8',
      dividerColor: 'rgba(201,184,245,0.10)',
      overlayBg: 'rgba(201,184,245,0.04)',
      overlayBorder: 'rgba(201,184,245,0.12)',
      accent1Bg: 'rgba(167,139,250,0.12)',
      accent1Border: 'rgba(167,139,250,0.28)',
      accent2Bg: 'rgba(201,184,245,0.10)',
      accent2Border: 'rgba(201,184,245,0.24)',
      accent3Bg: 'rgba(255,84,112,0.10)',
      accent3Border: 'rgba(255,84,112,0.22)',
      accent4Bg: 'rgba(122,217,184,0.10)',
      accent4Border: 'rgba(122,217,184,0.22)',
      toggleOff: 'rgba(236,232,248,0.10)',
      popupBg: 'rgba(7,5,16,0.96)',
    },
    // ═══ BLU & BIANCO — ghiaccio su blu profondo (tono E dello sciame) ═══
    blubianco: {
      bgGradient: 'linear-gradient(168deg, #05070d 0%, #090e1a 45%, #0d1526 80%, #05070d 100%)',
      roomGradient: 'linear-gradient(168deg, #05070d 0%, #080d17 45%, #0b1220 80%, #05070d 100%)',
      textPrimary: '#f4f7fc',
      textSecondary: 'rgba(244,247,252,0.84)',
      textTertiary: 'rgba(244,247,252,0.66)',
      textMuted: 'rgba(244,247,252,0.42)',
      cardBg: 'rgba(244,247,252,0.055)',
      cardBorder: 'rgba(130,175,255,0.16)',
      inputBg: 'rgba(244,247,252,0.045)',
      inputBorder: 'rgba(130,175,255,0.18)',
      buttonOverlay: 'rgba(244,247,252,0.05)',
      headerBg: 'rgba(5,7,13,0.85)',
      headerBorder: 'rgba(130,175,255,0.11)',
      accent1: '#4d78d8',
      accent2: '#82afff',
      accent3: '#ff5470',
      accent4: '#3ddc84',
      accentGradient: 'linear-gradient(90deg, #4d78d8 0%, #82afff 100%)',
      btnGradient: 'linear-gradient(90deg, #4d78d8 0%, #82afff 100%)',
      btnGlow: '0 10px 34px -8px rgba(77,120,216,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.25), 0 20px 60px -18px rgba(0,0,0,0.6)',
      glassCard: 'rgba(244,247,252,0.055)',
      statusOk: '#3ddc84',
      statusError: '#ff5470',
      statusWarning: '#ffc44d',
      goldAccent: '#ffc44d',
      onlineColor: '#3ddc84',
      dividerColor: 'rgba(130,175,255,0.11)',
      overlayBg: 'rgba(244,247,252,0.04)',
      overlayBorder: 'rgba(130,175,255,0.13)',
      accent1Bg: 'rgba(77,120,216,0.13)',
      accent1Border: 'rgba(77,120,216,0.30)',
      accent2Bg: 'rgba(130,175,255,0.11)',
      accent2Border: 'rgba(130,175,255,0.26)',
      accent3Bg: 'rgba(255,84,112,0.10)',
      accent3Border: 'rgba(255,84,112,0.22)',
      accent4Bg: 'rgba(61,220,132,0.10)',
      accent4Border: 'rgba(61,220,132,0.22)',
      toggleOff: 'rgba(244,247,252,0.10)',
      popupBg: 'rgba(5,7,13,0.96)',
    },
    // ═══ DAWN — chiaro, aria e contrasto ═══
    dawn: {
      bgGradient: 'linear-gradient(168deg, #f7f8fc 0%, #eef0f7 45%, #e9ecf4 80%, #f4f5f9 100%)',
      roomGradient: 'linear-gradient(168deg, #fafbfe 0%, #f1f3f9 60%, #eceef6 100%)',
      textPrimary: '#10131c',
      textSecondary: 'rgba(16,19,28,0.80)',
      textTertiary: 'rgba(16,19,28,0.62)',
      textMuted: 'rgba(16,19,28,0.42)',
      cardBg: 'rgba(255,255,255,0.62)',
      cardBorder: 'rgba(16,19,28,0.09)',
      inputBg: 'rgba(255,255,255,0.72)',
      inputBorder: 'rgba(16,19,28,0.12)',
      buttonOverlay: 'rgba(255,255,255,0.72)',
      headerBg: 'rgba(247,248,252,0.88)',
      headerBorder: 'rgba(16,19,28,0.08)',
      accent1: '#3d63e8',
      accent2: '#00a8cc',
      accent3: '#e0344f',
      accent4: '#0f9d58',
      accentGradient: 'linear-gradient(90deg, #3d63e8 0%, #00a8cc 100%)',
      btnGradient: 'linear-gradient(90deg, #3d63e8 0%, #00a8cc 100%)',
      btnGlow: '0 10px 30px -8px rgba(61,99,232,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
      cardShadow: '0 2px 8px rgba(16,19,28,0.05), 0 18px 44px -18px rgba(60,80,160,0.22)',
      glassCard: 'rgba(255,255,255,0.62)',
      statusOk: '#0f9d58',
      statusError: '#e0344f',
      statusWarning: '#c98500',
      goldAccent: '#c98500',
      onlineColor: '#0f9d58',
      dividerColor: 'rgba(16,19,28,0.08)',
      overlayBg: 'rgba(16,19,28,0.04)',
      overlayBorder: 'rgba(16,19,28,0.10)',
      accent1Bg: 'rgba(61,99,232,0.09)',
      accent1Border: 'rgba(61,99,232,0.22)',
      accent2Bg: 'rgba(0,168,204,0.09)',
      accent2Border: 'rgba(0,168,204,0.22)',
      accent3Bg: 'rgba(224,52,79,0.08)',
      accent3Border: 'rgba(224,52,79,0.20)',
      accent4Bg: 'rgba(15,157,88,0.09)',
      accent4Border: 'rgba(15,157,88,0.20)',
      toggleOff: 'rgba(16,19,28,0.12)',
      popupBg: 'rgba(250,251,254,0.97)',
    },
  };

  const colors = palettes[theme] || palettes.deep;

  const S = {
    // === LAYOUT ===
    page: { position:'fixed', top:0, left:0, right:0, bottom:0,
      background: colors.bgGradient,
      color: colors.textPrimary, fontFamily:FONT, overflow:'hidden' },
    center: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:'100%', padding:'16px 16px', boxSizing:'border-box' },
    scrollCenter: { display:'flex', flexDirection:'column', alignItems:'center',
      height:'100%', padding:'12px 16px', boxSizing:'border-box',
      overflowY:'auto', WebkitOverflowScrolling:'touch' },

    // === TYPOGRAPHY ===
    title: { fontSize:28, fontWeight:300, letterSpacing:-1.2,
      background: colors.accentGradient,
      WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:4 },
    sub: { color: colors.textSecondary, fontSize:13, marginBottom:16, letterSpacing:0.2, fontWeight:400 },

    // === CARDS — float panel style ===
    card: { width:'100%', maxWidth:380, background: colors.glassCard, borderRadius:20,
      padding:'22px 20px', backdropFilter:'blur(40px) saturate(1.1)', WebkitBackdropFilter:'blur(40px) saturate(1.1)',
      border:`1px solid ${colors.cardBorder}`,
      boxShadow: colors.cardShadow },
    cardTitle: { fontSize:13, fontWeight:600, textAlign:'center', marginBottom:14,
      color: colors.textSecondary, letterSpacing:0.8, textTransform:'uppercase' },

    // === FORM ===
    field: { marginBottom:14 },
    label: { fontSize:9, fontWeight:600, letterSpacing:1.8, color: colors.accent1, marginBottom:6,
      textTransform:'uppercase', opacity: isDark ? 0.9 : 0.95 },
    input: { width:'100%', padding:'12px 16px', borderRadius:14, background: colors.inputBg,
      border: `1px solid ${colors.inputBorder}`, color: colors.textPrimary, fontSize:14, outline:'none',
      boxSizing:'border-box', fontFamily:FONT, transition:'border-color 0.3s, box-shadow 0.3s',
      backdropFilter:'blur(12px)', fontWeight:400 },
    select: { width:'100%', padding:'12px 16px', borderRadius:14, background: colors.inputBg,
      border: `1px solid ${colors.inputBorder}`, color: colors.textPrimary, fontSize:14, outline:'none',
      boxSizing:'border-box', fontFamily:FONT, backdropFilter:'blur(12px)' },

    // === BUTTONS ===
    btn: { width:'100%', padding:'14px', borderRadius:14, border:'none',
      background: colors.btnGradient, color:'#fff', fontSize:14, fontWeight:600,
      cursor:'pointer', textAlign:'center', fontFamily:FONT, letterSpacing:0.3,
      boxShadow: colors.btnGlow,
      transition:'transform 0.2s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.3s',
      WebkitTapHighlightColor:'transparent' },
    bigBtn: { width:'100%', maxWidth:380, display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
      borderRadius:18, border:`1px solid ${colors.cardBorder}`, cursor:'pointer', marginBottom:8,
      background: colors.glassCard, backdropFilter:'blur(30px) saturate(1.1)',
      boxShadow: colors.cardShadow,
      fontFamily:FONT, WebkitTapHighlightColor:'transparent',
      transition:'transform 0.3s cubic-bezier(0.2,0.8,0.2,1), border-color 0.3s',
      color: colors.textPrimary },
    settingsBtn: { padding:'8px 16px', borderRadius:12, background: colors.buttonOverlay,
      border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, fontSize:12, fontWeight:500,
      cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
      backdropFilter:'blur(12px)', transition:'all 0.2s', display:'flex', alignItems:'center', gap:6 },

    // === AVATAR ===
    avatarBtn: { width:52, height:52, borderRadius:16, border:'2px solid transparent',
      background:'none', fontSize:22, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
      WebkitTapHighlightColor:'transparent', transition:'all 0.3s cubic-bezier(0.2,0.8,0.2,1)', padding:0 },
    avatarSel: { borderColor: colors.accent1, background:`${colors.accent1}15`,
      boxShadow:`0 0 0 3px ${colors.accent1}25, 0 0 20px ${colors.accent1}12` },

    // === VOICE ===
    voiceBtn: { padding:'7px 16px', borderRadius:22, border: `1px solid ${colors.cardBorder}`,
      background: colors.buttonOverlay, color: colors.textSecondary, fontSize:12, cursor:'pointer',
      textTransform:'capitalize', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
      transition:'all 0.3s', fontWeight:500 },
    voiceSel: { borderColor: colors.accent1, background:`${colors.accent1}18`, color: colors.textPrimary,
      boxShadow:`0 0 16px ${colors.accent1}1A` },

    // === TOGGLE ===
    toggle: { width:44, height:24, borderRadius:12, border:'none', padding:2, cursor:'pointer',
      display:'flex', alignItems:'center', transition:'background 0.4s cubic-bezier(0.2,0.8,0.2,1)',
      WebkitTapHighlightColor:'transparent' },
    toggleDot: { width:20, height:20, borderRadius:10, background:'#fff', transition:'transform 0.4s cubic-bezier(0.2,0.8,0.2,1)',
      boxShadow:'0 1px 4px rgba(0,0,0,0.25)' },

    // === TOP BAR ===
    topBar: { display:'flex', alignItems:'center', gap:10, width:'100%', maxWidth:380, marginBottom:14, flexShrink:0 },
    backBtn: { width:36, height:36, borderRadius:12, background: colors.buttonOverlay,
      border: `1px solid ${colors.cardBorder}`, color: colors.textPrimary, fontSize:16, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT,
      WebkitTapHighlightColor:'transparent', backdropFilter:'blur(16px)', transition:'all 0.2s' },
    shareBtn: { padding:'8px 20px', borderRadius:12, border: `1px solid ${colors.cardBorder}`,
      background: colors.buttonOverlay, color: colors.textSecondary, fontSize:12, cursor:'pointer',
      fontFamily:FONT, WebkitTapHighlightColor:'transparent', backdropFilter:'blur(16px)', fontWeight:500 },
    statusMsg: { marginTop:8, fontSize:11, color: colors.accent3, textAlign:'center', fontWeight:600 },

    // === MODE BUTTONS ===
    modeBtn: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
      padding:'10px 6px', borderRadius:16, border: `1px solid ${colors.cardBorder}`,
      background: colors.buttonOverlay, color: colors.textSecondary, cursor:'pointer',
      WebkitTapHighlightColor:'transparent', transition:'all 0.3s cubic-bezier(0.2,0.8,0.2,1)', backdropFilter:'blur(12px)' },
    modeBtnSel: { borderColor:`${colors.accent1}40`, background:`${colors.accent1}12`, color: colors.textPrimary,
      boxShadow:`0 0 24px ${colors.accent1}18` },

    // === ROOM ===
    roomPage: { display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, right:0, bottom:0,
      background: colors.roomGradient,
      color: colors.textPrimary, fontFamily:FONT },
    roomHeader: { display:'flex', alignItems:'center', padding:'8px 12px', gap:8,
      background: colors.headerBg, borderBottom: `1px solid ${colors.headerBorder}`,
      flexShrink:0, backdropFilter:'blur(24px) saturate(1.1)' },
    backBtnSmall: { width:32, height:32, borderRadius:10, background:'transparent',
      border:'none', color: colors.textSecondary, fontSize:14, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      WebkitTapHighlightColor:'transparent', transition:'color 0.2s' },
    iconBtn: { height:32, borderRadius:10, background: colors.buttonOverlay,
      border: `1px solid ${colors.cardBorder}`, color: colors.textPrimary, fontSize:13, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      WebkitTapHighlightColor:'transparent', transition:'all 0.2s' },
    speakingBar: { display:'flex', alignItems:'center', gap:8, padding:'5px 14px',
      background:`${colors.accent1}0A`,
      borderBottom:`1px solid ${colors.accent1}12`,
      color: colors.accent1, fontSize:11, flexShrink:0, fontWeight:500 },
    speakingDots: { display:'flex', gap:3, alignItems:'center' },
    dot: { width:4, height:4, borderRadius:'50%', background: colors.accent1,
      animation:'vtPulse 1.2s infinite ease-in-out', display:'inline-block' },

    // === CHAT ===
    chatArea: { flex:1, overflowY:'auto', padding:'14px 12px', minHeight:0, WebkitOverflowScrolling:'touch' },
    // ── Nuvolette di VETRO (spec sciame) ──
    // La MIA: grigio-nero fumé, neutra su ogni tema.
    // La SUA: vetro tinto col colore del tema (violetto/lilla, orange/terra…).
    // Sfumatura diagonale + blur + filo di luce sul bordo alto + ombra doppia.
    bubble: { padding:'12px 15px 13px', borderRadius:18, position:'relative',
      backdropFilter:'blur(18px) saturate(1.3)', WebkitBackdropFilter:'blur(18px) saturate(1.3)' },
    bubbleMine: {
      background: isDark
        ? 'linear-gradient(210deg, rgba(255,255,255,0.085), rgba(10,10,12,0.55) 70%)'
        : 'linear-gradient(210deg, rgba(255,255,255,0.9), rgba(16,19,28,0.06) 160%)',
      border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(16,19,28,0.10)',
      borderBottomRightRadius:6,
      boxShadow: isDark
        ? '0 10px 26px -14px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.10)'
        : '0 8px 22px -12px rgba(16,19,28,0.18), inset 0 1px 0 rgba(255,255,255,0.8)' },
    bubbleOther: {
      background: `linear-gradient(150deg, ${colors.accent1}33, ${colors.accent1}12 65%)`,
      border: `1px solid ${colors.accent1}47`,
      borderBottomLeftRadius:6,
      boxShadow: `0 10px 30px -14px ${colors.accent1}73, 0 2px 6px rgba(0,0,0,${isDark ? 0.35 : 0.08}), inset 0 1px 0 rgba(255,255,255,${isDark ? 0.14 : 0.5})` },

    // === TALK BAR ===
    talkBar: { flexShrink:0, padding:'8px 16px 16px', display:'flex', flexDirection:'column', alignItems:'center',
      background:'transparent' },
    talkBtn: { display:'flex', alignItems:'center', justifyContent:'center',
      width:58, height:58, borderRadius:'50%', border:`2px solid ${colors.cardBorder}`,
      background: `${colors.accent1}0C`,
      color: colors.textPrimary, fontSize:24, cursor:'pointer', touchAction:'manipulation',
      WebkitTapHighlightColor:'transparent', transition:'all 0.3s cubic-bezier(0.2,0.8,0.2,1)',
      boxShadow: isDark ? `0 0 24px ${colors.accent1}12` : 'none' },
    talkBtnRec: { color: colors.accent3, fontSize:26, borderColor: colors.accent3,
      background:`${colors.accent3}14`,
      boxShadow:`0 0 0 7px ${colors.accent3}14, 0 0 36px ${colors.accent3}1A` },

    // ── Shared UI tokens for new IA ──
    // These replace local C objects in HomeView, HistoryView, etc.
    createBtnGrad: colors.btnGradient,
    createBtnGlow: colors.btnGlow,
    tabBg: `${colors.accent1}08`,
    tabBorder: `${colors.accent1}15`,
    tabActiveBg: `${colors.accent1}14`,
    tabActiveBorder: `${colors.accent1}30`,
    tabActiveColor: colors.accent1,

    // Expose colors for components that need direct access
    colors,
  };

  return S;
}
