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

export default function getStyles(theme = 'dark') {
  const isDark = theme === 'dark' || theme === 'brown' || theme === 'orange';

  // ── COLOR PALETTES ──
  const palettes = {
    dark: {
      // ── P4 Manifesto ultra-dark background ──
      bgGradient: 'linear-gradient(160deg, #09090b 0%, #111113 30%, #18181b 60%, #09090b 100%)',
      roomGradient: 'linear-gradient(160deg, #09090b 0%, #0f0f12 30%, #16161a 60%, #09090b 100%)',
      // ── High-contrast text hierarchy — ALWAYS readable ──
      textPrimary: '#fafafa',
      textSecondary: 'rgba(250,250,250,0.90)',
      textTertiary: 'rgba(250,250,250,0.75)',
      textMuted: 'rgba(250,250,250,0.60)',
      // ── Glassmorphism surfaces ──
      cardBg: 'rgba(17,17,19,0.55)',
      cardBorder: 'rgba(250,250,250,0.05)',
      inputBg: 'rgba(17,17,19,0.6)',
      inputBorder: 'rgba(250,250,250,0.07)',
      buttonOverlay: 'rgba(250,250,250,0.04)',
      headerBg: 'rgba(9,9,11,0.85)',
      headerBorder: 'rgba(250,250,250,0.04)',
      // ── Accent colors: Purple primary, Cyan secondary, Red/Green semantic ──
      accent1: '#8b5cf6',  // Purple — primary actions (P4)
      accent2: '#06b6d4',  // Cyan — secondary (P4)
      accent3: '#ef4444',  // Red — recording, errors (P4)
      accent4: '#22c55e',  // Green — success (P4)
      accentGradient: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
      btnGradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      btnGlow: '0 4px 28px rgba(139,92,246,0.35), 0 0 60px rgba(139,92,246,0.08)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.2), 0 20px 60px -15px rgba(0,0,0,0.5)',
      glassCard: 'rgba(17,17,19,0.65)',
      // ── Semantic ──
      statusOk: '#22c55e',
      statusError: '#ef4444',
      statusWarning: '#f59e0b',
      goldAccent: '#f59e0b',
      onlineColor: '#22c55e',
      dividerColor: 'rgba(250,250,250,0.04)',
      overlayBg: 'rgba(250,250,250,0.03)',
      overlayBorder: 'rgba(250,250,250,0.05)',
      accent1Bg: 'rgba(139,92,246,0.10)',
      accent1Border: 'rgba(139,92,246,0.20)',
      accent2Bg: 'rgba(6,182,212,0.10)',
      accent2Border: 'rgba(6,182,212,0.20)',
      accent3Bg: 'rgba(239,68,68,0.10)',
      accent3Border: 'rgba(239,68,68,0.20)',
      accent4Bg: 'rgba(34,197,94,0.10)',
      accent4Border: 'rgba(34,197,94,0.20)',
      toggleOff: 'rgba(250,250,250,0.08)',
      popupBg: 'rgba(9,9,11,0.96)',
    },
    light: {
      bgGradient: 'linear-gradient(135deg, #f8f8fa 0%, #f5f3ff 50%, #faf8ff 100%)',
      roomGradient: 'linear-gradient(135deg, #fafbfc 0%, #f7f5ff 100%)',
      textPrimary: '#1a1a1a',
      textSecondary: 'rgba(26,26,26,0.75)',
      textTertiary: 'rgba(26,26,26,0.55)',
      textMuted: 'rgba(26,26,26,0.40)',
      cardBg: 'rgba(255,255,255,0.78)',
      cardBorder: 'rgba(139,92,246,0.15)',
      inputBg: 'rgba(255,255,255,0.7)',
      inputBorder: 'rgba(139,92,246,0.12)',
      buttonOverlay: 'rgba(255,255,255,0.8)',
      headerBg: 'rgba(250,250,252,0.92)',
      headerBorder: 'rgba(139,92,246,0.10)',
      accent1: '#7c3aed',
      accent2: '#0891b2',
      accent3: '#dc2626',
      accent4: '#16a34a',
      accentGradient: 'linear-gradient(135deg, #7c3aed 0%, #0891b2 100%)',
      btnGradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
      btnGlow: '0 4px 20px rgba(124,58,237,0.25)',
      cardShadow: '0 4px 24px rgba(124,58,237,0.06), 0 1px 0 rgba(255,255,255,0.9)',
      glassCard: 'rgba(255,255,255,0.7)',
      statusOk: '#16a34a',
      statusError: '#dc2626',
      statusWarning: '#d97706',
      goldAccent: '#d97706',
      onlineColor: '#16a34a',
      dividerColor: 'rgba(139,92,246,0.10)',
      overlayBg: 'rgba(26,26,26,0.04)',
      overlayBorder: 'rgba(26,26,26,0.10)',
      accent1Bg: 'rgba(124,58,237,0.08)',
      accent1Border: 'rgba(124,58,237,0.18)',
      accent2Bg: 'rgba(8,145,178,0.08)',
      accent2Border: 'rgba(8,145,178,0.18)',
      accent3Bg: 'rgba(220,38,38,0.08)',
      accent3Border: 'rgba(220,38,38,0.18)',
      accent4Bg: 'rgba(22,163,74,0.08)',
      accent4Border: 'rgba(22,163,74,0.18)',
      toggleOff: 'rgba(26,26,26,0.12)',
      popupBg: 'rgba(250,250,252,0.97)',
    },
    brown: {
      bgGradient: 'linear-gradient(160deg, #110d08 0%, #1e160e 30%, #2a1f14 60%, #110d08 100%)',
      roomGradient: 'linear-gradient(160deg, #0e0b07 0%, #1a130c 30%, #251c12 60%, #110d08 100%)',
      textPrimary: '#f5ede4',
      textSecondary: 'rgba(245,237,228,0.90)',
      textTertiary: 'rgba(245,237,228,0.75)',
      textMuted: 'rgba(245,237,228,0.60)',
      cardBg: 'rgba(30,22,14,0.55)',
      cardBorder: 'rgba(245,237,228,0.06)',
      inputBg: 'rgba(30,22,14,0.6)',
      inputBorder: 'rgba(245,237,228,0.08)',
      buttonOverlay: 'rgba(245,237,228,0.04)',
      headerBg: 'rgba(14,11,7,0.85)',
      headerBorder: 'rgba(245,237,228,0.05)',
      accent1: '#a78bfa',
      accent2: '#22d3ee',
      accent3: '#f97316',
      accent4: '#86efac',
      accentGradient: 'linear-gradient(135deg, #a78bfa 0%, #22d3ee 100%)',
      btnGradient: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
      btnGlow: '0 4px 24px rgba(167,139,250,0.30), 0 0 40px rgba(167,139,250,0.08)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.2), 0 20px 60px -15px rgba(0,0,0,0.5)',
      glassCard: 'rgba(28,20,12,0.65)',
      statusOk: '#86efac',
      statusError: '#f97316',
      statusWarning: '#f59e0b',
      goldAccent: '#f59e0b',
      onlineColor: '#86efac',
      dividerColor: 'rgba(245,237,228,0.05)',
      overlayBg: 'rgba(245,237,228,0.03)',
      overlayBorder: 'rgba(245,237,228,0.06)',
      accent1Bg: 'rgba(167,139,250,0.10)',
      accent1Border: 'rgba(167,139,250,0.22)',
      accent2Bg: 'rgba(34,211,238,0.10)',
      accent2Border: 'rgba(34,211,238,0.20)',
      accent3Bg: 'rgba(249,115,22,0.10)',
      accent3Border: 'rgba(249,115,22,0.20)',
      accent4Bg: 'rgba(134,239,172,0.10)',
      accent4Border: 'rgba(134,239,172,0.20)',
      toggleOff: 'rgba(245,237,228,0.08)',
      popupBg: 'rgba(22,16,10,0.96)',
    },
    orange: {
      bgGradient: 'linear-gradient(160deg, #120a04 0%, #1e1008 30%, #2a160a 60%, #120a04 100%)',
      roomGradient: 'linear-gradient(160deg, #100904 0%, #1a0e06 30%, #261408 60%, #120a04 100%)',
      textPrimary: '#f8f0e8',
      textSecondary: 'rgba(248,240,232,0.90)',
      textTertiary: 'rgba(248,240,232,0.75)',
      textMuted: 'rgba(248,240,232,0.60)',
      cardBg: 'rgba(30,16,8,0.55)',
      cardBorder: 'rgba(248,240,232,0.06)',
      inputBg: 'rgba(30,16,8,0.6)',
      inputBorder: 'rgba(248,240,232,0.08)',
      buttonOverlay: 'rgba(248,240,232,0.04)',
      headerBg: 'rgba(14,8,3,0.85)',
      headerBorder: 'rgba(248,240,232,0.05)',
      accent1: '#fbbf24',
      accent2: '#60a5fa',
      accent3: '#f87171',
      accent4: '#4ade80',
      accentGradient: 'linear-gradient(135deg, #fbbf24 0%, #60a5fa 100%)',
      btnGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      btnGlow: '0 4px 24px rgba(251,191,36,0.35), 0 0 40px rgba(251,191,36,0.08)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.2), 0 20px 60px -15px rgba(0,0,0,0.5)',
      glassCard: 'rgba(28,14,5,0.65)',
      statusOk: '#4ade80',
      statusError: '#f87171',
      statusWarning: '#fbbf24',
      goldAccent: '#fbbf24',
      onlineColor: '#4ade80',
      dividerColor: 'rgba(248,240,232,0.05)',
      overlayBg: 'rgba(248,240,232,0.03)',
      overlayBorder: 'rgba(248,240,232,0.06)',
      accent1Bg: 'rgba(251,191,36,0.10)',
      accent1Border: 'rgba(251,191,36,0.22)',
      accent2Bg: 'rgba(96,165,250,0.10)',
      accent2Border: 'rgba(96,165,250,0.20)',
      accent3Bg: 'rgba(248,113,113,0.10)',
      accent3Border: 'rgba(248,113,113,0.20)',
      accent4Bg: 'rgba(74,222,128,0.10)',
      accent4Border: 'rgba(74,222,128,0.20)',
      toggleOff: 'rgba(248,240,232,0.08)',
      popupBg: 'rgba(18,10,4,0.96)',
    },
  };

  const colors = palettes[theme] || palettes.dark;

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
    bubble: { padding:'11px 15px', borderRadius:18, position:'relative',
      backdropFilter:'blur(20px)',
      border: `1px solid ${isDark ? colors.cardBorder : 'rgba(38,217,176,0.08)'}` },
    bubbleMine: { background: `${colors.accent1}14`, borderBottomRightRadius:4,
      boxShadow:`0 2px 20px ${colors.accent1}10` },
    bubbleOther: { background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderBottomLeftRadius:4,
      boxShadow: isDark ? '0 2px 16px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.05)' },

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

    // Expose colors for components that need direct access
    colors,
  };

  return S;
}
