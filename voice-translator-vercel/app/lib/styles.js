import { FONT } from './constants.js';

// ========================================
// STYLES - Cosmic Space Theme
// Dynamic, modern, luminous UI
// ========================================
export default function getStyles(theme = 'dark') {
  const isDark = theme === 'dark';

  const colors = isDark ? {
    bgGradient: 'linear-gradient(135deg, #0B0D1A 0%, #111638 35%, #1B1145 65%, #0D0F24 100%)',
    roomGradient: 'linear-gradient(160deg, #080A15 0%, #0F1235 30%, #181050 60%, #0D0F24 100%)',
    textPrimary: '#E8EAFF',
    textSecondary: 'rgba(232,234,255,0.55)',
    textTertiary: 'rgba(232,234,255,0.35)',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(120,130,255,0.12)',
    inputBg: 'rgba(255,255,255,0.04)',
    inputBorder: 'rgba(120,130,255,0.1)',
    buttonOverlay: 'rgba(255,255,255,0.03)',
    headerBg: 'rgba(8,10,20,0.85)',
    headerBorder: 'rgba(120,130,255,0.08)',
    accent1: '#6C63FF',  // Electric purple
    accent2: '#00D2FF',  // Cyan neon
    accent3: '#FF6B9D',  // Pink neon
    accent4: '#00FF94',  // Green neon
    accentGradient: 'linear-gradient(135deg, #6C63FF 0%, #00D2FF 50%, #00FF94 100%)',
    btnGradient: 'linear-gradient(135deg, #6C63FF 0%, #5A52E0 50%, #4A3FD4 100%)',
    btnGlow: '0 4px 24px rgba(108,99,255,0.4), 0 0 60px rgba(108,99,255,0.12)',
    cardShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
    glassCard: 'rgba(15,18,53,0.65)',
  } : {
    bgGradient: 'linear-gradient(135deg, #F0F2FF 0%, #E8EDFF 50%, #F5F0FF 100%)',
    roomGradient: 'linear-gradient(135deg, #F5F6FF 0%, #EBEEFF 100%)',
    textPrimary: '#1A1D3A',
    textSecondary: 'rgba(26,29,58,0.6)',
    textTertiary: 'rgba(26,29,58,0.4)',
    cardBg: 'rgba(255,255,255,0.7)',
    cardBorder: 'rgba(108,99,255,0.15)',
    inputBg: 'rgba(255,255,255,0.6)',
    inputBorder: 'rgba(108,99,255,0.12)',
    buttonOverlay: 'rgba(255,255,255,0.7)',
    headerBg: 'rgba(240,242,255,0.9)',
    headerBorder: 'rgba(108,99,255,0.1)',
    accent1: '#6C63FF',
    accent2: '#00B4D8',
    accent3: '#FF6B9D',
    accent4: '#00CC7A',
    accentGradient: 'linear-gradient(135deg, #6C63FF 0%, #00B4D8 50%, #00CC7A 100%)',
    btnGradient: 'linear-gradient(135deg, #6C63FF 0%, #5A52E0 100%)',
    btnGlow: '0 4px 20px rgba(108,99,255,0.25)',
    cardShadow: '0 4px 24px rgba(108,99,255,0.08), 0 1px 0 rgba(255,255,255,0.9)',
    glassCard: 'rgba(255,255,255,0.6)',
  };

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
    title: { fontSize:28, fontWeight:800, letterSpacing:-1,
      background: colors.accentGradient,
      WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:4 },
    sub: { color: colors.textSecondary, fontSize:12, marginBottom:16, letterSpacing:0.5, fontWeight:500 },

    // === CARDS ===
    card: { width:'100%', maxWidth:380, background: colors.glassCard, borderRadius:20,
      padding:'20px 18px', backdropFilter:'blur(40px)', WebkitBackdropFilter:'blur(40px)',
      border:`1px solid ${colors.cardBorder}`,
      boxShadow: colors.cardShadow },
    cardTitle: { fontSize:14, fontWeight:700, textAlign:'center', marginBottom:14,
      color: colors.textSecondary, letterSpacing:0.5, textTransform:'uppercase' },

    // === FORM ===
    field: { marginBottom:12 },
    label: { fontSize:9, fontWeight:700, letterSpacing:1.5, color: colors.accent1, marginBottom:5,
      textTransform:'uppercase', opacity: isDark ? 0.7 : 0.9 },
    input: { width:'100%', padding:'11px 14px', borderRadius:12, background: colors.inputBg,
      border: `1px solid ${colors.inputBorder}`, color: colors.textPrimary, fontSize:14, outline:'none',
      boxSizing:'border-box', fontFamily:FONT, transition:'border-color 0.2s, box-shadow 0.2s',
      backdropFilter:'blur(8px)' },
    select: { width:'100%', padding:'11px 14px', borderRadius:12, background: colors.inputBg,
      border: `1px solid ${colors.inputBorder}`, color: colors.textPrimary, fontSize:14, outline:'none',
      boxSizing:'border-box', fontFamily:FONT, backdropFilter:'blur(8px)' },

    // === BUTTONS ===
    btn: { width:'100%', padding:'13px', borderRadius:14, border:'none',
      background: colors.btnGradient, color:'#fff', fontSize:14, fontWeight:700,
      cursor:'pointer', textAlign:'center', fontFamily:FONT, letterSpacing:0.3,
      boxShadow: colors.btnGlow, transition:'transform 0.15s, box-shadow 0.15s',
      WebkitTapHighlightColor:'transparent' },
    bigBtn: { width:'100%', maxWidth:380, display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
      borderRadius:16, border:`1px solid ${colors.cardBorder}`, cursor:'pointer', marginBottom:8,
      background: colors.glassCard, backdropFilter:'blur(20px)',
      boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(108,99,255,0.08)',
      fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'transform 0.15s, border-color 0.2s',
      color: colors.textPrimary },
    settingsBtn: { padding:'8px 16px', borderRadius:12, background: colors.buttonOverlay,
      border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, fontSize:12, fontWeight:600,
      cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
      backdropFilter:'blur(12px)', transition:'all 0.15s', display:'flex', alignItems:'center', gap:5 },

    // === AVATAR ===
    avatarBtn: { width:52, height:52, borderRadius:16, border:'2px solid transparent',
      background:'none', fontSize:22, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
      WebkitTapHighlightColor:'transparent', transition:'all 0.2s', padding:0 },
    avatarSel: { borderColor: colors.accent1, background:`rgba(108,99,255,0.1)`,
      boxShadow:`0 0 0 3px rgba(108,99,255,0.2), 0 0 16px rgba(108,99,255,0.1)` },

    // === VOICE ===
    voiceBtn: { padding:'6px 14px', borderRadius:20, border: `1px solid ${colors.cardBorder}`,
      background: colors.buttonOverlay, color: colors.textSecondary, fontSize:12, cursor:'pointer',
      textTransform:'capitalize', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
      transition:'all 0.2s', fontWeight:600 },
    voiceSel: { borderColor: colors.accent1, background:'rgba(108,99,255,0.12)', color: colors.textPrimary,
      boxShadow:'0 0 12px rgba(108,99,255,0.15)' },

    // === TOGGLE ===
    toggle: { width:44, height:24, borderRadius:12, border:'none', padding:2, cursor:'pointer',
      display:'flex', alignItems:'center', transition:'background 0.3s',
      WebkitTapHighlightColor:'transparent' },
    toggleDot: { width:20, height:20, borderRadius:10, background:'#fff', transition:'transform 0.3s',
      boxShadow:'0 1px 4px rgba(0,0,0,0.3)' },

    // === TOP BAR ===
    topBar: { display:'flex', alignItems:'center', gap:10, width:'100%', maxWidth:380, marginBottom:12, flexShrink:0 },
    backBtn: { width:36, height:36, borderRadius:12, background: colors.buttonOverlay,
      border: `1px solid ${colors.cardBorder}`, color: colors.textPrimary, fontSize:16, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT,
      WebkitTapHighlightColor:'transparent', backdropFilter:'blur(12px)', transition:'all 0.15s' },
    shareBtn: { padding:'8px 20px', borderRadius:12, border: `1px solid ${colors.cardBorder}`,
      background: colors.buttonOverlay, color: colors.textSecondary, fontSize:12, cursor:'pointer',
      fontFamily:FONT, WebkitTapHighlightColor:'transparent', backdropFilter:'blur(12px)', fontWeight:600 },
    statusMsg: { marginTop:8, fontSize:11, color: colors.accent3, textAlign:'center', fontWeight:600 },

    // === MODE BUTTONS ===
    modeBtn: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
      padding:'8px 4px', borderRadius:14, border: `1px solid ${colors.cardBorder}`,
      background: colors.buttonOverlay, color: colors.textSecondary, cursor:'pointer',
      WebkitTapHighlightColor:'transparent', transition:'all 0.2s', backdropFilter:'blur(8px)' },
    modeBtnSel: { borderColor:'rgba(108,99,255,0.4)', background:'rgba(108,99,255,0.12)', color: colors.textPrimary,
      boxShadow:'0 0 20px rgba(108,99,255,0.15)' },

    // === ROOM ===
    roomPage: { display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, right:0, bottom:0,
      background: colors.roomGradient,
      color: colors.textPrimary, fontFamily:FONT },
    roomHeader: { display:'flex', alignItems:'center', padding:'6px 10px', gap:6,
      background: colors.headerBg, borderBottom: `1px solid ${colors.headerBorder}`,
      flexShrink:0, backdropFilter:'blur(20px)' },
    backBtnSmall: { width:30, height:30, borderRadius:10, background:'transparent',
      border:'none', color: colors.textSecondary, fontSize:14, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      WebkitTapHighlightColor:'transparent', transition:'color 0.15s' },
    iconBtn: { height:30, borderRadius:10, background: colors.buttonOverlay,
      border: `1px solid ${colors.cardBorder}`, color: colors.textPrimary, fontSize:13, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      WebkitTapHighlightColor:'transparent', transition:'all 0.15s' },
    speakingBar: { display:'flex', alignItems:'center', gap:8, padding:'4px 12px',
      background:`rgba(${isDark ? '108,99,255' : '108,99,255'},0.06)`,
      borderBottom:`1px solid rgba(108,99,255,0.1)`,
      color: colors.accent1, fontSize:11, flexShrink:0, fontWeight:600 },
    speakingDots: { display:'flex', gap:3, alignItems:'center' },
    dot: { width:4, height:4, borderRadius:'50%', background: colors.accent1,
      animation:'vtPulse 1.2s infinite ease-in-out', display:'inline-block' },

    // === CHAT ===
    chatArea: { flex:1, overflowY:'auto', padding:'12px 10px', minHeight:0, WebkitOverflowScrolling:'touch' },
    bubble: { padding:'10px 14px', borderRadius:16, position:'relative',
      backdropFilter:'blur(16px)',
      border: `1px solid ${isDark ? 'rgba(120,130,255,0.08)' : 'rgba(108,99,255,0.1)'}` },
    bubbleMine: { background: isDark ? 'rgba(108,99,255,0.12)' : 'rgba(108,99,255,0.08)', borderBottomRightRadius:4,
      boxShadow:'0 2px 16px rgba(108,99,255,0.1)' },
    bubbleOther: { background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderBottomLeftRadius:4,
      boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.06)' },

    // === TALK BAR ===
    talkBar: { flexShrink:0, padding:'6px 16px 14px', display:'flex', flexDirection:'column', alignItems:'center',
      background:'transparent' },
    talkBtn: { display:'flex', alignItems:'center', justifyContent:'center',
      width:56, height:56, borderRadius:'50%', border:`2px solid ${colors.cardBorder}`,
      background: isDark ? 'rgba(108,99,255,0.08)' : 'rgba(108,99,255,0.06)',
      color: colors.textPrimary, fontSize:24, cursor:'pointer', touchAction:'manipulation',
      WebkitTapHighlightColor:'transparent', transition:'all 0.25s',
      boxShadow: isDark ? '0 0 20px rgba(108,99,255,0.1)' : 'none' },
    talkBtnRec: { color: colors.accent3, fontSize:26, borderColor: colors.accent3,
      background:'rgba(255,107,157,0.1)',
      boxShadow:'0 0 0 6px rgba(255,107,157,0.1), 0 0 30px rgba(255,107,157,0.15)' },
  };

  return S;
}
