import { FONT } from './constants.js';

// ========================================
// STYLES - Multi-theme support
// 5 themes: dark (ambient teal), light, brown, orange, midnight
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
  @keyframes vtGlowBorder { 0%,100% { border-color: rgba(38,217,176,0.3); } 50% { border-color: rgba(139,106,255,0.6); } }
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
      // ── Ultra-dark ambient background ──
      bgGradient: 'linear-gradient(160deg, #060810 0%, #0A0E1A 30%, #0D1020 60%, #080A14 100%)',
      roomGradient: 'linear-gradient(160deg, #050710 0%, #090D18 30%, #0C0F1E 60%, #070912 100%)',
      // ── High-contrast text hierarchy — ALWAYS readable ──
      textPrimary: '#F2F4F7',
      textSecondary: 'rgba(242,244,247,0.90)',
      textTertiary: 'rgba(242,244,247,0.75)',
      textMuted: 'rgba(242,244,247,0.60)',
      // ── Glassmorphism surfaces ──
      cardBg: 'rgba(14,18,32,0.55)',
      cardBorder: 'rgba(255,255,255,0.05)',
      inputBg: 'rgba(14,18,32,0.6)',
      inputBorder: 'rgba(255,255,255,0.07)',
      buttonOverlay: 'rgba(255,255,255,0.04)',
      headerBg: 'rgba(6,8,16,0.85)',
      headerBorder: 'rgba(255,255,255,0.04)',
      // ── Accent colors: Teal primary, Purple secondary, Warm tertiary ──
      accent1: '#26D9B0',  // Teal — primary actions
      accent2: '#8B6AFF',  // Purple — secondary
      accent3: '#FF6B6B',  // Warm red — recording, errors
      accent4: '#26D9B0',  // Teal — success
      accentGradient: 'linear-gradient(135deg, #26D9B0 0%, #8B6AFF 50%, #E8924A 100%)',
      btnGradient: 'linear-gradient(135deg, #26D9B0 0%, #1EB898 50%, #178F78 100%)',
      btnGlow: '0 4px 28px rgba(38,217,176,0.35), 0 0 60px rgba(38,217,176,0.08)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.2), 0 20px 60px -15px rgba(0,0,0,0.5)',
      glassCard: 'rgba(12,16,30,0.65)',
      // ── Semantic ──
      statusOk: '#26D9B0',
      statusError: '#FF6B6B',
      statusWarning: '#E8924A',
      goldAccent: '#E8924A',
      onlineColor: '#26D9B0',
      dividerColor: 'rgba(255,255,255,0.04)',
      overlayBg: 'rgba(255,255,255,0.03)',
      overlayBorder: 'rgba(255,255,255,0.05)',
      accent1Bg: 'rgba(38,217,176,0.10)',
      accent1Border: 'rgba(38,217,176,0.20)',
      accent2Bg: 'rgba(139,106,255,0.10)',
      accent2Border: 'rgba(139,106,255,0.20)',
      accent3Bg: 'rgba(255,107,107,0.10)',
      accent3Border: 'rgba(255,107,107,0.20)',
      accent4Bg: 'rgba(38,217,176,0.10)',
      accent4Border: 'rgba(38,217,176,0.20)',
      toggleOff: 'rgba(255,255,255,0.08)',
      popupBg: 'rgba(10,14,26,0.96)',
    },
    light: {
      bgGradient: 'linear-gradient(135deg, #F0F4F8 0%, #E8EDF5 50%, #F2F0F8 100%)',
      roomGradient: 'linear-gradient(135deg, #F5F7FA 0%, #EBEEF5 100%)',
      textPrimary: '#1A1D2E',
      textSecondary: 'rgba(26,29,46,0.75)',
      textTertiary: 'rgba(26,29,46,0.55)',
      textMuted: 'rgba(26,29,46,0.40)',
      cardBg: 'rgba(255,255,255,0.78)',
      cardBorder: 'rgba(38,217,176,0.15)',
      inputBg: 'rgba(255,255,255,0.7)',
      inputBorder: 'rgba(38,217,176,0.12)',
      buttonOverlay: 'rgba(255,255,255,0.8)',
      headerBg: 'rgba(240,244,248,0.92)',
      headerBorder: 'rgba(38,217,176,0.10)',
      accent1: '#1AA886',
      accent2: '#6B52D9',
      accent3: '#E05252',
      accent4: '#1AA886',
      accentGradient: 'linear-gradient(135deg, #1AA886 0%, #6B52D9 50%, #C97838 100%)',
      btnGradient: 'linear-gradient(135deg, #1AA886 0%, #158A6F 100%)',
      btnGlow: '0 4px 20px rgba(26,168,134,0.25)',
      cardShadow: '0 4px 24px rgba(26,168,134,0.06), 0 1px 0 rgba(255,255,255,0.9)',
      glassCard: 'rgba(255,255,255,0.7)',
      statusOk: '#1AA886',
      statusError: '#E05252',
      statusWarning: '#C97838',
      goldAccent: '#C97838',
      onlineColor: '#1AA886',
      dividerColor: 'rgba(38,217,176,0.10)',
      overlayBg: 'rgba(26,29,46,0.04)',
      overlayBorder: 'rgba(26,29,46,0.10)',
      accent1Bg: 'rgba(26,168,134,0.08)',
      accent1Border: 'rgba(26,168,134,0.18)',
      accent2Bg: 'rgba(107,82,217,0.08)',
      accent2Border: 'rgba(107,82,217,0.18)',
      accent3Bg: 'rgba(224,82,82,0.08)',
      accent3Border: 'rgba(224,82,82,0.18)',
      accent4Bg: 'rgba(26,168,134,0.08)',
      accent4Border: 'rgba(26,168,134,0.18)',
      toggleOff: 'rgba(26,29,46,0.12)',
      popupBg: 'rgba(245,247,250,0.97)',
    },
    brown: {
      bgGradient: 'linear-gradient(160deg, #110D08 0%, #1E160E 30%, #2A1F14 60%, #110D08 100%)',
      roomGradient: 'linear-gradient(160deg, #0E0B07 0%, #1A130C 30%, #251C12 60%, #110D08 100%)',
      textPrimary: '#F5EDE4',
      textSecondary: 'rgba(245,237,228,0.90)',
      textTertiary: 'rgba(245,237,228,0.75)',
      textMuted: 'rgba(245,237,228,0.60)',
      cardBg: 'rgba(30,22,14,0.55)',
      cardBorder: 'rgba(255,220,180,0.06)',
      inputBg: 'rgba(30,22,14,0.6)',
      inputBorder: 'rgba(255,220,180,0.08)',
      buttonOverlay: 'rgba(255,220,180,0.04)',
      headerBg: 'rgba(14,11,7,0.85)',
      headerBorder: 'rgba(255,220,180,0.05)',
      accent1: '#D4A06A',
      accent2: '#E8B87A',
      accent3: '#FF8A65',
      accent4: '#A5D6A7',
      accentGradient: 'linear-gradient(135deg, #D4A06A 0%, #E8B87A 50%, #A5D6A7 100%)',
      btnGradient: 'linear-gradient(135deg, #D4A06A 0%, #B8864E 50%, #9C7040 100%)',
      btnGlow: '0 4px 24px rgba(212,160,106,0.30), 0 0 40px rgba(212,160,106,0.08)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.2), 0 20px 60px -15px rgba(0,0,0,0.5)',
      glassCard: 'rgba(28,20,12,0.65)',
      statusOk: '#A5D6A7',
      statusError: '#FF8A65',
      statusWarning: '#E8B87A',
      goldAccent: '#E8B87A',
      onlineColor: '#A5D6A7',
      dividerColor: 'rgba(255,220,180,0.05)',
      overlayBg: 'rgba(255,220,180,0.03)',
      overlayBorder: 'rgba(255,220,180,0.06)',
      accent1Bg: 'rgba(212,160,106,0.10)',
      accent1Border: 'rgba(212,160,106,0.22)',
      accent2Bg: 'rgba(232,184,122,0.10)',
      accent2Border: 'rgba(232,184,122,0.20)',
      accent3Bg: 'rgba(255,138,101,0.10)',
      accent3Border: 'rgba(255,138,101,0.20)',
      accent4Bg: 'rgba(165,214,167,0.10)',
      accent4Border: 'rgba(165,214,167,0.20)',
      toggleOff: 'rgba(255,220,180,0.08)',
      popupBg: 'rgba(22,16,10,0.96)',
    },
    orange: {
      bgGradient: 'linear-gradient(160deg, #120A04 0%, #1E1008 30%, #2A160A 60%, #120A04 100%)',
      roomGradient: 'linear-gradient(160deg, #100904 0%, #1A0E06 30%, #261408 60%, #120A04 100%)',
      textPrimary: '#F8F0E8',
      textSecondary: 'rgba(248,240,232,0.90)',
      textTertiary: 'rgba(248,240,232,0.75)',
      textMuted: 'rgba(248,240,232,0.60)',
      cardBg: 'rgba(30,16,8,0.55)',
      cardBorder: 'rgba(255,160,60,0.06)',
      inputBg: 'rgba(30,16,8,0.6)',
      inputBorder: 'rgba(255,160,60,0.08)',
      buttonOverlay: 'rgba(255,150,50,0.04)',
      headerBg: 'rgba(14,8,3,0.85)',
      headerBorder: 'rgba(255,160,60,0.05)',
      accent1: '#FF8C00',
      accent2: '#FFB347',
      accent3: '#FF6347',
      accent4: '#7CFC00',
      accentGradient: 'linear-gradient(135deg, #FF8C00 0%, #FFB347 50%, #7CFC00 100%)',
      btnGradient: 'linear-gradient(135deg, #FF8C00 0%, #E67A00 50%, #CC6C00 100%)',
      btnGlow: '0 4px 24px rgba(255,140,0,0.35), 0 0 40px rgba(255,140,0,0.08)',
      cardShadow: '0 0 0 0.5px rgba(0,0,0,0.2), 0 20px 60px -15px rgba(0,0,0,0.5)',
      glassCard: 'rgba(28,14,5,0.65)',
      statusOk: '#7CFC00',
      statusError: '#FF6347',
      statusWarning: '#FFB347',
      goldAccent: '#FFB347',
      onlineColor: '#7CFC00',
      dividerColor: 'rgba(255,160,60,0.05)',
      overlayBg: 'rgba(255,150,50,0.03)',
      overlayBorder: 'rgba(255,150,50,0.06)',
      accent1Bg: 'rgba(255,140,0,0.10)',
      accent1Border: 'rgba(255,140,0,0.22)',
      accent2Bg: 'rgba(255,179,71,0.10)',
      accent2Border: 'rgba(255,179,71,0.20)',
      accent3Bg: 'rgba(255,99,71,0.10)',
      accent3Border: 'rgba(255,99,71,0.20)',
      accent4Bg: 'rgba(124,252,0,0.10)',
      accent4Border: 'rgba(124,252,0,0.20)',
      toggleOff: 'rgba(255,150,50,0.08)',
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
