'use client';
import { memo, useState, useMemo, useEffect, useRef } from 'react';
import { LANGS, CONTEXTS, FONT, APP_URL, getLang, vibrate, formatCredits } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import TutorialOverlay from './TutorialOverlay.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════
// Theme-aware color palette for HomeView
// ═══════════════════════════════════════
function getHomeColors(theme) {
  const palettes = {
    dark: {
      // Primary accent
      accent: '#7B73FF', accentLight: '#B8B3FF', accentDark: '#4A40E0', accentMid: '#6C63FF',
      accent2: '#00D2FF', accent3: '#FF6B9D', accent4: '#00FF94',
      // Door SVG
      doorBody: ['#9B93FF', '#7B73FF', '#4A40E0'],
      doorFace: ['#B8B3FF', '#8B83FF', '#5A50F0'],
      doorArch: ['#C4BFFF', '#D4D0FF', '#A8A0FF'],
      doorFloor: 'rgba(108,99,255,0.15)',
      doorHandle: ['#FFE066', '#FFB800'],
      doorHandleGlow: 'rgba(255,215,0,0.35)',
      doorHandleStroke: 'rgba(255,200,0,0.3)',
      doorPanel1: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)'],
      doorPanel2: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)'],
      doorPanelStroke1: 'rgba(255,255,255,0.12)', doorPanelStroke2: 'rgba(255,255,255,0.08)',
      doorShine: ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)'],
      doorShadow: 'rgba(0,0,0,0.12)',
      doorGlowShadow: ['rgba(108,99,255,0.30)', 'rgba(108,99,255,0.45)'],
      // Title gradient
      titleGrad: 'linear-gradient(135deg, #B8B3FF 0%, #7B73FF 40%, #00D2FF 100%)',
      // Top bar
      topBarBg: 'rgba(108,99,255,0.06)', topBarBorder: 'rgba(108,99,255,0.1)',
      // Texts
      textPrimary: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.72)',
      textTertiary: 'rgba(255,255,255,0.55)', textMuted: 'rgba(255,255,255,0.40)',
      // Badges
      freeBadgeBg: 'rgba(0,255,148,0.12)', freeBadgeColor: '#00FF94',
      proBadgeBg: 'rgba(108,99,255,0.15)', proBadgeColor: '#6C63FF',
      apiBadgeBg: 'rgba(0,210,255,0.1)', apiBadgeColor: '#00D2FF',
      // Buttons
      btnBg: 'rgba(255,255,255,0.04)', btnBorder: 'rgba(255,255,255,0.08)',
      btnIconColor: 'rgba(255,255,255,0.65)',
      settingsBtnBg: 'rgba(108,99,255,0.06)', settingsBtnBorder: 'rgba(108,99,255,0.12)',
      settingsIconColor: 'rgba(255,255,255,0.80)',
      contactsBtnBg: 'rgba(0,210,255,0.06)', contactsBtnBorder: 'rgba(0,210,255,0.15)',
      logoutBtnBg: 'rgba(255,107,157,0.06)', logoutBtnBorder: 'rgba(255,107,157,0.12)',
      // Warning
      warnBg: 'rgba(255,107,157,0.06)', warnBorder: 'rgba(255,107,157,0.15)', warnColor: '#FF6B9D',
      // Install
      installBg: 'linear-gradient(135deg, rgba(78,205,196,0.08), rgba(108,99,255,0.06))',
      installBorder: 'rgba(78,205,196,0.2)', installColor: '#4ecdc4',
      installBtnGrad: 'linear-gradient(135deg, #4ecdc4, #6C63FF)',
      // Notification
      notifBg: 'rgba(255,170,0,0.06)', notifBorder: 'rgba(255,170,0,0.15)', notifColor: '#ffaa00',
      // Guest prompt
      guestBg: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(0,210,255,0.04))',
      guestBorder: 'rgba(108,99,255,0.18)',
      // Popup
      popupBg: 'linear-gradient(160deg, rgba(20,22,50,0.98) 0%, rgba(15,17,40,0.98) 100%)',
      popupBorder: 'rgba(108,99,255,0.2)', popupShadow: 'rgba(108,99,255,0.08)',
      popupCloseBg: 'rgba(255,255,255,0.06)', popupCloseBorder: 'rgba(255,255,255,0.1)',
      popupCloseColor: 'rgba(255,255,255,0.55)',
      ctxBtnBg: 'rgba(108,99,255,0.08)', ctxBtnBorder: 'rgba(108,99,255,0.2)',
      ctxDropBg: 'rgba(12,14,42,0.98)', ctxDropBorder: 'rgba(108,99,255,0.2)',
      ctxSelBg: 'rgba(108,99,255,0.12)',
      createBtnGrad: 'linear-gradient(135deg, #6C63FF 0%, #00D2FF 100%)',
      createBtnShadow: '0 6px 24px rgba(108,99,255,0.4), 0 2px 8px rgba(0,0,0,0.2)',
      // Invite
      inviteBg: 'rgba(0,210,255,0.04)', inviteBorder: 'rgba(0,210,255,0.1)',
      shareBtnBg: 'rgba(0,210,255,0.12)', shareBtnBorder: 'rgba(0,210,255,0.25)',
      // Referral
      refBg: 'rgba(255,107,157,0.04)', refBorder: 'rgba(255,107,157,0.1)',
      refBtnBg: 'rgba(255,107,157,0.1)', refBtnBorder: 'rgba(255,107,157,0.2)',
    },
    light: {
      accent: '#5A52E0', accentLight: '#7B73FF', accentDark: '#3D35B0', accentMid: '#6C63FF',
      accent2: '#00A3C4', accent3: '#E0527A', accent4: '#00AA6B',
      doorBody: ['#8B83F0', '#6C63FF', '#4A40D0'],
      doorFace: ['#A8A0FF', '#7B73FF', '#5A50E8'],
      doorArch: ['#B0A8FF', '#C0B8FF', '#9088F0'],
      doorFloor: 'rgba(90,82,224,0.12)',
      doorHandle: ['#FFD84D', '#F0A800'],
      doorHandleGlow: 'rgba(255,200,0,0.30)',
      doorHandleStroke: 'rgba(200,160,0,0.25)',
      doorPanel1: ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.10)'],
      doorPanel2: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)'],
      doorPanelStroke1: 'rgba(255,255,255,0.25)', doorPanelStroke2: 'rgba(255,255,255,0.15)',
      doorShine: ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)'],
      doorShadow: 'rgba(0,0,0,0.08)',
      doorGlowShadow: ['rgba(90,82,224,0.25)', 'rgba(90,82,224,0.40)'],
      titleGrad: 'linear-gradient(135deg, #5A52E0 0%, #6C63FF 40%, #00A3C4 100%)',
      topBarBg: 'rgba(90,82,224,0.06)', topBarBorder: 'rgba(90,82,224,0.12)',
      textPrimary: '#1A1D3A', textSecondary: 'rgba(26,29,58,0.72)',
      textTertiary: 'rgba(26,29,58,0.52)', textMuted: 'rgba(26,29,58,0.38)',
      freeBadgeBg: 'rgba(0,170,107,0.12)', freeBadgeColor: '#00AA6B',
      proBadgeBg: 'rgba(90,82,224,0.12)', proBadgeColor: '#5A52E0',
      apiBadgeBg: 'rgba(0,163,196,0.1)', apiBadgeColor: '#00A3C4',
      btnBg: 'rgba(26,29,58,0.04)', btnBorder: 'rgba(26,29,58,0.10)',
      btnIconColor: 'rgba(26,29,58,0.55)',
      settingsBtnBg: 'rgba(90,82,224,0.06)', settingsBtnBorder: 'rgba(90,82,224,0.14)',
      settingsIconColor: 'rgba(26,29,58,0.70)',
      contactsBtnBg: 'rgba(0,163,196,0.06)', contactsBtnBorder: 'rgba(0,163,196,0.14)',
      logoutBtnBg: 'rgba(224,82,122,0.06)', logoutBtnBorder: 'rgba(224,82,122,0.14)',
      warnBg: 'rgba(224,82,122,0.06)', warnBorder: 'rgba(224,82,122,0.18)', warnColor: '#E0527A',
      installBg: 'linear-gradient(135deg, rgba(0,163,196,0.06), rgba(90,82,224,0.04))',
      installBorder: 'rgba(0,163,196,0.18)', installColor: '#008A9E',
      installBtnGrad: 'linear-gradient(135deg, #00A3C4, #5A52E0)',
      notifBg: 'rgba(200,140,0,0.06)', notifBorder: 'rgba(200,140,0,0.18)', notifColor: '#C08C00',
      guestBg: 'linear-gradient(135deg, rgba(90,82,224,0.06), rgba(0,163,196,0.03))',
      guestBorder: 'rgba(90,82,224,0.18)',
      popupBg: 'linear-gradient(160deg, rgba(245,246,255,0.99) 0%, rgba(240,242,255,0.99) 100%)',
      popupBorder: 'rgba(90,82,224,0.18)', popupShadow: 'rgba(90,82,224,0.08)',
      popupCloseBg: 'rgba(26,29,58,0.05)', popupCloseBorder: 'rgba(26,29,58,0.10)',
      popupCloseColor: 'rgba(26,29,58,0.45)',
      ctxBtnBg: 'rgba(90,82,224,0.06)', ctxBtnBorder: 'rgba(90,82,224,0.15)',
      ctxDropBg: 'rgba(245,246,255,0.99)', ctxDropBorder: 'rgba(90,82,224,0.15)',
      ctxSelBg: 'rgba(90,82,224,0.08)',
      createBtnGrad: 'linear-gradient(135deg, #6C63FF 0%, #00A3C4 100%)',
      createBtnShadow: '0 6px 24px rgba(90,82,224,0.25), 0 2px 8px rgba(0,0,0,0.08)',
      inviteBg: 'rgba(0,163,196,0.04)', inviteBorder: 'rgba(0,163,196,0.12)',
      shareBtnBg: 'rgba(0,163,196,0.08)', shareBtnBorder: 'rgba(0,163,196,0.18)',
      refBg: 'rgba(224,82,122,0.04)', refBorder: 'rgba(224,82,122,0.10)',
      refBtnBg: 'rgba(224,82,122,0.08)', refBtnBorder: 'rgba(224,82,122,0.15)',
    },
    brown: {
      accent: '#D4A06A', accentLight: '#E8C8A0', accentDark: '#9C7040', accentMid: '#C4944E',
      accent2: '#E8B87A', accent3: '#FF8A65', accent4: '#A5D6A7',
      doorBody: ['#E8C8A0', '#D4A06A', '#9C7040'],
      doorFace: ['#F0D8B0', '#D4A878', '#B88850'],
      doorArch: ['#E8D0B0', '#F0DCC0', '#D4B890'],
      doorFloor: 'rgba(212,160,106,0.15)',
      doorHandle: ['#FFE066', '#D4A020'],
      doorHandleGlow: 'rgba(255,215,0,0.30)',
      doorHandleStroke: 'rgba(200,160,50,0.3)',
      doorPanel1: ['rgba(255,245,232,0.18)', 'rgba(255,245,232,0.04)'],
      doorPanel2: ['rgba(255,245,232,0.12)', 'rgba(255,245,232,0.02)'],
      doorPanelStroke1: 'rgba(255,245,232,0.12)', doorPanelStroke2: 'rgba(255,245,232,0.08)',
      doorShine: ['rgba(255,245,232,0.28)', 'rgba(255,245,232,0)'],
      doorShadow: 'rgba(0,0,0,0.15)',
      doorGlowShadow: ['rgba(212,160,106,0.30)', 'rgba(212,160,106,0.45)'],
      titleGrad: 'linear-gradient(135deg, #E8C8A0 0%, #D4A06A 40%, #E8B87A 100%)',
      topBarBg: 'rgba(212,160,106,0.06)', topBarBorder: 'rgba(212,160,106,0.12)',
      textPrimary: '#FFF5E8', textSecondary: 'rgba(255,245,232,0.72)',
      textTertiary: 'rgba(255,245,232,0.55)', textMuted: 'rgba(255,245,232,0.40)',
      freeBadgeBg: 'rgba(165,214,167,0.15)', freeBadgeColor: '#A5D6A7',
      proBadgeBg: 'rgba(212,160,106,0.15)', proBadgeColor: '#D4A06A',
      apiBadgeBg: 'rgba(232,184,122,0.12)', apiBadgeColor: '#E8B87A',
      btnBg: 'rgba(255,245,232,0.04)', btnBorder: 'rgba(255,245,232,0.08)',
      btnIconColor: 'rgba(255,245,232,0.60)',
      settingsBtnBg: 'rgba(212,160,106,0.06)', settingsBtnBorder: 'rgba(212,160,106,0.14)',
      settingsIconColor: 'rgba(255,245,232,0.75)',
      contactsBtnBg: 'rgba(232,184,122,0.06)', contactsBtnBorder: 'rgba(232,184,122,0.14)',
      logoutBtnBg: 'rgba(255,138,101,0.06)', logoutBtnBorder: 'rgba(255,138,101,0.14)',
      warnBg: 'rgba(255,138,101,0.06)', warnBorder: 'rgba(255,138,101,0.18)', warnColor: '#FF8A65',
      installBg: 'linear-gradient(135deg, rgba(165,214,167,0.06), rgba(212,160,106,0.04))',
      installBorder: 'rgba(165,214,167,0.18)', installColor: '#A5D6A7',
      installBtnGrad: 'linear-gradient(135deg, #A5D6A7, #D4A06A)',
      notifBg: 'rgba(232,184,122,0.06)', notifBorder: 'rgba(232,184,122,0.18)', notifColor: '#E8B87A',
      guestBg: 'linear-gradient(135deg, rgba(212,160,106,0.08), rgba(232,184,122,0.04))',
      guestBorder: 'rgba(212,160,106,0.18)',
      popupBg: 'linear-gradient(160deg, rgba(30,20,12,0.98) 0%, rgba(24,16,10,0.98) 100%)',
      popupBorder: 'rgba(212,160,106,0.2)', popupShadow: 'rgba(212,160,106,0.08)',
      popupCloseBg: 'rgba(255,245,232,0.06)', popupCloseBorder: 'rgba(255,245,232,0.1)',
      popupCloseColor: 'rgba(255,245,232,0.50)',
      ctxBtnBg: 'rgba(212,160,106,0.08)', ctxBtnBorder: 'rgba(212,160,106,0.2)',
      ctxDropBg: 'rgba(20,14,8,0.98)', ctxDropBorder: 'rgba(212,160,106,0.2)',
      ctxSelBg: 'rgba(212,160,106,0.12)',
      createBtnGrad: 'linear-gradient(135deg, #D4A06A 0%, #E8B87A 100%)',
      createBtnShadow: '0 6px 24px rgba(212,160,106,0.35), 0 2px 8px rgba(0,0,0,0.2)',
      inviteBg: 'rgba(232,184,122,0.04)', inviteBorder: 'rgba(232,184,122,0.1)',
      shareBtnBg: 'rgba(232,184,122,0.12)', shareBtnBorder: 'rgba(232,184,122,0.25)',
      refBg: 'rgba(255,138,101,0.04)', refBorder: 'rgba(255,138,101,0.1)',
      refBtnBg: 'rgba(255,138,101,0.1)', refBtnBorder: 'rgba(255,138,101,0.2)',
    },
    orange: {
      accent: '#FF8C00', accentLight: '#FFB347', accentDark: '#CC6C00', accentMid: '#FF9A20',
      accent2: '#FFB347', accent3: '#FF6347', accent4: '#7CFC00',
      doorBody: ['#FFB347', '#FF8C00', '#CC6C00'],
      doorFace: ['#FFC870', '#FFA030', '#E07800'],
      doorArch: ['#FFD080', '#FFE0A0', '#FFB060'],
      doorFloor: 'rgba(255,140,0,0.15)',
      doorHandle: ['#FFE066', '#CC8800'],
      doorHandleGlow: 'rgba(255,200,0,0.35)',
      doorHandleStroke: 'rgba(200,160,0,0.3)',
      doorPanel1: ['rgba(255,248,240,0.18)', 'rgba(255,248,240,0.04)'],
      doorPanel2: ['rgba(255,248,240,0.12)', 'rgba(255,248,240,0.02)'],
      doorPanelStroke1: 'rgba(255,248,240,0.12)', doorPanelStroke2: 'rgba(255,248,240,0.08)',
      doorShine: ['rgba(255,248,240,0.30)', 'rgba(255,248,240,0)'],
      doorShadow: 'rgba(0,0,0,0.15)',
      doorGlowShadow: ['rgba(255,140,0,0.30)', 'rgba(255,140,0,0.45)'],
      titleGrad: 'linear-gradient(135deg, #FFB347 0%, #FF8C00 40%, #FFD080 100%)',
      topBarBg: 'rgba(255,140,0,0.06)', topBarBorder: 'rgba(255,140,0,0.12)',
      textPrimary: '#FFF8F0', textSecondary: 'rgba(255,248,240,0.72)',
      textTertiary: 'rgba(255,248,240,0.55)', textMuted: 'rgba(255,248,240,0.40)',
      freeBadgeBg: 'rgba(124,252,0,0.12)', freeBadgeColor: '#7CFC00',
      proBadgeBg: 'rgba(255,140,0,0.15)', proBadgeColor: '#FF8C00',
      apiBadgeBg: 'rgba(255,179,71,0.12)', apiBadgeColor: '#FFB347',
      btnBg: 'rgba(255,248,240,0.04)', btnBorder: 'rgba(255,248,240,0.08)',
      btnIconColor: 'rgba(255,248,240,0.60)',
      settingsBtnBg: 'rgba(255,140,0,0.06)', settingsBtnBorder: 'rgba(255,140,0,0.14)',
      settingsIconColor: 'rgba(255,248,240,0.75)',
      contactsBtnBg: 'rgba(255,179,71,0.06)', contactsBtnBorder: 'rgba(255,179,71,0.14)',
      logoutBtnBg: 'rgba(255,99,71,0.06)', logoutBtnBorder: 'rgba(255,99,71,0.14)',
      warnBg: 'rgba(255,99,71,0.06)', warnBorder: 'rgba(255,99,71,0.18)', warnColor: '#FF6347',
      installBg: 'linear-gradient(135deg, rgba(124,252,0,0.06), rgba(255,140,0,0.04))',
      installBorder: 'rgba(124,252,0,0.18)', installColor: '#7CFC00',
      installBtnGrad: 'linear-gradient(135deg, #7CFC00, #FF8C00)',
      notifBg: 'rgba(255,179,71,0.06)', notifBorder: 'rgba(255,179,71,0.18)', notifColor: '#FFB347',
      guestBg: 'linear-gradient(135deg, rgba(255,140,0,0.08), rgba(255,179,71,0.04))',
      guestBorder: 'rgba(255,140,0,0.18)',
      popupBg: 'linear-gradient(160deg, rgba(30,14,5,0.98) 0%, rgba(24,10,3,0.98) 100%)',
      popupBorder: 'rgba(255,140,0,0.2)', popupShadow: 'rgba(255,140,0,0.08)',
      popupCloseBg: 'rgba(255,248,240,0.06)', popupCloseBorder: 'rgba(255,248,240,0.1)',
      popupCloseColor: 'rgba(255,248,240,0.50)',
      ctxBtnBg: 'rgba(255,140,0,0.08)', ctxBtnBorder: 'rgba(255,140,0,0.2)',
      ctxDropBg: 'rgba(20,10,3,0.98)', ctxDropBorder: 'rgba(255,140,0,0.2)',
      ctxSelBg: 'rgba(255,140,0,0.12)',
      createBtnGrad: 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)',
      createBtnShadow: '0 6px 24px rgba(255,140,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
      inviteBg: 'rgba(255,179,71,0.04)', inviteBorder: 'rgba(255,179,71,0.1)',
      shareBtnBg: 'rgba(255,179,71,0.12)', shareBtnBorder: 'rgba(255,179,71,0.25)',
      refBg: 'rgba(255,99,71,0.04)', refBorder: 'rgba(255,99,71,0.1)',
      refBtnBg: 'rgba(255,99,71,0.1)', refBtnBorder: 'rgba(255,99,71,0.2)',
    },
  };
  return palettes[theme] || palettes.dark;
}

// ── Client-side QR code generator ──
function HomeQR({ url }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!canvasRef.current || !url) return;
    let cancelled = false;
    import('qrcode').then(QRCode => {
      if (cancelled) return;
      QRCode.toCanvas(canvasRef.current, url, {
        width: 140, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }, (err) => { if (!err && !cancelled) setReady(true); });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [url]);
  return (
    <div style={{textAlign:'center', marginBottom:8}}>
      <canvas ref={canvasRef}
        style={{borderRadius:14, background:'#fff', padding:6, display:'block', margin:'0 auto',
          maxWidth:140, maxHeight:140}} />
    </div>
  );
}

const HomeView = memo(function HomeView({ L, S, prefs, setPrefs, savePrefs, myLang, selectedMode, setSelectedMode, selectedContext,
  setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom, setView, userToken,
  userAccount, useOwnKeys, creditBalance, refreshBalance, setAuthStep, loadHistory,
  showShareApp, setShowShareApp, shareAppLang, setShareAppLang, shareApp,
  showTutorial, setShowTutorial, tutorialStep, setTutorialStep, status,
  isTrial, platformHasEL, referralCode, theme, setTheme, logout,
  showInstallBanner, handleInstallApp, dismissInstallBanner,
  notifPermission, requestNotifPermission, deferredInstallPrompt, rejoinRoom }) {

  const langInfo = getLang(prefs.lang);
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [activeRooms, setActiveRooms] = useState([]);

  const isGuest = !userToken;
  const isIT = L('createRoom') === 'Crea Stanza';
  const lowCredits = !isGuest && !useOwnKeys && !isTrial && creditBalance < 30;

  // Theme-aware colors
  const C = useMemo(() => getHomeColors(theme), [theme]);

  // Load and validate active rooms on mount
  useEffect(() => {
    async function checkActiveRooms() {
      try {
        const saved = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]');
        if (saved.length === 0) { setActiveRooms([]); return; }
        const checked = [];
        for (const room of saved) {
          try {
            const res = await fetch('/api/room', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'check', roomId: room.roomId })
            });
            const data = await res.json();
            if (data.exists && !data.ended) checked.push(room);
          } catch {}
        }
        localStorage.setItem('vt-active-rooms', JSON.stringify(checked));
        setActiveRooms(checked);
      } catch {}
    }
    checkActiveRooms();
  }, []);

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>

        {/* ═══════════════════════════════════════
            TOP BAR
           ═══════════════════════════════════════ */}
        <div style={{display:'flex', alignItems:'center', gap:10, width:'100%', maxWidth:400, marginBottom:14,
          padding:'10px 14px', borderRadius:18, background:C.topBarBg, border:`1px solid ${C.topBarBorder}`}}>
          <AvatarImg src={prefs.avatar} size={72} style={{borderRadius:18}} />
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:15, fontWeight:800, letterSpacing:-0.3, color:C.textPrimary}}>{prefs.name}</div>
            <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:4}}>
              <span style={{fontSize:15}}>{langInfo.flag}</span>
              <span style={{fontSize:9, fontWeight:800, padding:'1px 7px', borderRadius:6,
                background: isTrial || isGuest ? C.freeBadgeBg : C.proBadgeBg,
                color: isTrial || isGuest ? C.freeBadgeColor : C.proBadgeColor}}>
                {isGuest || isTrial ? 'FREE' : 'PRO'}
              </span>
              {useOwnKeys && (
                <span style={{fontSize:9, padding:'1px 5px', borderRadius:4,
                  background:C.apiBadgeBg, color:C.apiBadgeColor}}>
                  <Icon name="key" size={8} color={C.apiBadgeColor} /> API
                </span>
              )}
            </div>
          </div>
          <div style={{display:'flex', gap:4}}>
            {!isGuest && (
              <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
                background:C.contactsBtnBg, border:`1px solid ${C.contactsBtnBorder}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                WebkitTapHighlightColor:'transparent'}}
                onClick={() => setView('contacts')}
                title={L('createRoom') === 'Crea Stanza' ? 'Contatti' : 'Contacts'}>
                <span style={{fontSize:14}}>{'👥'}</span>
              </button>
            )}
            <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
              background:C.btnBg, border:`1px solid ${C.btnBorder}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => { loadHistory(); setView('history'); }}
              title={L('history')}>
              <Icon name="history" size={15} color={C.btnIconColor} />
            </button>
            <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
              background:C.btnBg, border:`1px solid ${C.btnBorder}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => { setTutorialStep(0); setShowTutorial(true); }}
              title={L('tutorial')}>
              <Icon name="graduation" size={15} color={C.btnIconColor} />
            </button>
            {!isGuest && (
              <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
                background:C.logoutBtnBg, border:`1px solid ${C.logoutBtnBorder}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                WebkitTapHighlightColor:'transparent'}}
                onClick={() => { logout({ clearPrefs: true }); setPrefs({ name:'', lang:'it', avatar:'/avatars/1.png', voice:'nova', autoPlay:true }); setView('welcome'); }}
                title={L('logoutAccount')}>
                <Icon name="logout" size={14} color={C.accent3} />
              </button>
            )}
            <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
              background:C.settingsBtnBg, border:`1px solid ${C.settingsBtnBorder}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => setView('settings')}>
              <Icon name="settings" size={16} color={C.settingsIconColor} />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            LOW CREDITS WARNING
           ═══════════════════════════════════════ */}
        {lowCredits && (
          <button style={{width:'100%', maxWidth:400, marginBottom:10, padding:'10px 14px', borderRadius:14,
            background:C.warnBg, border:`1px solid ${C.warnBorder}`,
            display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontFamily:FONT,
            WebkitTapHighlightColor:'transparent'}}
            onClick={() => { refreshBalance(); setView('credits'); }}>
            <span style={{fontSize:18}}>{'\u26A0\uFE0F'}</span>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontSize:12, fontWeight:700, color:C.warnColor}}>
                {L('lowCreditsWarning') || 'Crediti in esaurimento'}
              </div>
              <div style={{fontSize:10, color:C.textTertiary, marginTop:1}}>
                {formatCredits(creditBalance)} {L('remaining') || 'rimanenti'} — {L('tapToRecharge') || 'tocca per ricaricare'}
              </div>
            </div>
            <Icon name="zap" size={18} color={C.warnColor} />
          </button>
        )}

        {/* PWA Install Banner */}
        {showInstallBanner && deferredInstallPrompt && (
          <div style={{width:'100%', maxWidth:400, marginBottom:10, padding:'12px 14px', borderRadius:14,
            background:C.installBg, border:`1.5px solid ${C.installBorder}`, fontFamily:FONT,
            display:'flex', alignItems:'center', gap:10, animation:'vtFadeIn 0.3s ease'}}>
            <div style={{width:40, height:40, borderRadius:10,
              background:C.installBtnGrad,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <span style={{fontSize:20}}>{'📲'}</span>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700, fontSize:12, color:C.installColor}}>
                {L('installApp') || 'Installa VoiceTranslate'}
              </div>
              <div style={{fontSize:10, color:C.textMuted, marginTop:1}}>
                {L('installAppDesc') || 'Aggiungi al desktop per accesso rapido e notifiche'}
              </div>
            </div>
            <div style={{display:'flex', gap:4, flexShrink:0}}>
              <button onClick={handleInstallApp}
                style={{padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer',
                  background:C.installBtnGrad, color:'#fff',
                  fontSize:10, fontWeight:700, fontFamily:FONT}}>
                {L('install') || 'Installa'}
              </button>
              <button onClick={dismissInstallBanner}
                style={{padding:'6px 8px', borderRadius:8, border:`1px solid ${C.btnBorder}`,
                  background:'transparent', color:C.textMuted, cursor:'pointer',
                  fontSize:12, fontFamily:FONT}}>
                {'\u2716'}
              </button>
            </div>
          </div>
        )}

        {/* Notification permission prompt */}
        {!showInstallBanner && notifPermission === 'default' && !isGuest && (
          <button style={{width:'100%', maxWidth:400, marginBottom:10, padding:'10px 14px', borderRadius:14,
            background:C.notifBg, border:`1px solid ${C.notifBorder}`,
            display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontFamily:FONT,
            WebkitTapHighlightColor:'transparent'}}
            onClick={requestNotifPermission}>
            <span style={{fontSize:18}}>{'🔔'}</span>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontSize:12, fontWeight:700, color:C.notifColor}}>
                {L('enableNotifications') || 'Attiva le notifiche'}
              </div>
              <div style={{fontSize:10, color:C.textTertiary, marginTop:1}}>
                {L('enableNotifDesc') || 'Ricevi avvisi quando arrivano messaggi nella stanza'}
              </div>
            </div>
            <Icon name="bell" size={18} color={C.notifColor} />
          </button>
        )}

        {/* Guest sign in prompt */}
        {isGuest && (
          <button style={{width:'100%', maxWidth:400, marginBottom:10, padding:'12px 14px', borderRadius:14,
            background:C.guestBg, border:`1.5px solid ${C.guestBorder}`, cursor:'pointer', fontFamily:FONT,
            display:'flex', alignItems:'center', gap:10, WebkitTapHighlightColor:'transparent', color:C.textPrimary}}
            onClick={() => { setAuthStep('email'); setView('account'); }}>
            <Icon name="user" size={22} color={C.accent} />
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontWeight:700, fontSize:13, color:C.accent}}>{L('loginToCreateRooms')}</div>
              <div style={{fontSize:10, color:C.textTertiary}}>
                {L('signInProDesc')}
              </div>
            </div>
            <span style={{fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:6,
              background:C.proBadgeBg, color:C.proBadgeColor}}>PRO</span>
          </button>
        )}

        {/* ═══════════════════════════════════════
            ACTIVE ROOMS
           ═══════════════════════════════════════ */}
        {activeRooms.length > 0 && (
          <div style={{width:'100%', maxWidth:400, marginBottom:16}}>
            <div style={{fontSize:11, fontWeight:700, color:C.textTertiary, marginBottom:8, letterSpacing:0.5, textTransform:'uppercase'}}>
              {L('activeChats') || 'Chat Attive'}
            </div>
            {activeRooms.map((room) => {
              const timeAgo = Math.floor((Date.now() - room.leftAt) / 60000);
              const timeStr = timeAgo < 1 ? 'ora' : timeAgo < 60 ? `${timeAgo} min fa` : `${Math.floor(timeAgo / 60)}h fa`;
              return (
                <div key={room.roomId} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                  marginBottom:6, borderRadius:14, background:C.topBarBg, border:`1px solid ${C.topBarBorder}`,
                  cursor:'pointer', transition:'background 0.15s'}}
                  onClick={() => { vibrate(); if (rejoinRoom) rejoinRoom(room.roomId); }}>
                  <div style={{display:'flex', gap:2, fontSize:18}}>
                    {[...new Set(room.members?.map(m => getLang(m.lang).flag) || [])].map((flag, i) => (
                      <span key={i}>{flag}</span>
                    ))}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:700, color:C.textPrimary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {room.members?.map(m => m.name).join(', ') || room.roomId}
                    </div>
                    <div style={{fontSize:10, color:C.textMuted}}>
                      {room.mode === 'conversation' ? '\u{1F4AC}' : room.mode === 'classroom' ? '\u{1F3EB}' : '\u{1F399}'} {timeStr}
                    </div>
                  </div>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    const updated = activeRooms.filter(r => r.roomId !== room.roomId);
                    setActiveRooms(updated);
                    localStorage.setItem('vt-active-rooms', JSON.stringify(updated));
                  }} style={{width:28, height:28, borderRadius:8, background:'none', border:`1px solid ${C.btnBorder}`,
                    color:C.textMuted, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center'}}>
                    {'\u2716'}
                  </button>
                  <div style={{padding:'4px 12px', borderRadius:8, fontSize:11, fontWeight:700,
                    background:C.accent + '18', color:C.accent, cursor:'pointer'}}>
                    {L('rejoin') || 'Rientra'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════════════════════════
            IL TUO PIANO — Tier info card
           ═══════════════════════════════════════ */}
        {!isGuest && (() => {
          const tierName = useOwnKeys ? 'TOP PRO' : (isTrial ? 'FREE' : 'PRO');
          const tierIcon = useOwnKeys ? '\u{1F451}' : (isTrial ? '\u{1F193}' : '\u2B50');
          const tierColor = useOwnKeys ? C.apiBadgeColor : (isTrial ? C.freeBadgeColor : C.proBadgeColor);
          const tierBg = useOwnKeys ? C.apiBadgeBg : (isTrial ? C.freeBadgeBg : C.proBadgeBg);
          return (
            <button style={{width:'100%', maxWidth:400, marginBottom:14, padding:'14px 16px', borderRadius:16,
              background:C.topBarBg, border:`1px solid ${C.topBarBorder}`, cursor:'pointer', fontFamily:FONT,
              textAlign:'left', WebkitTapHighlightColor:'transparent', color:C.textPrimary}}
              onClick={() => { if (isTrial) { setAuthStep('email'); setView('credits'); } else setView('credits'); }}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                <span style={{fontSize:18}}>{tierIcon}</span>
                <span style={{fontSize:14, fontWeight:800, color:tierColor}}>
                  {isIT ? `Piano ${tierName}` : `${tierName} Plan`}
                </span>
                <span style={{fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:6,
                  background:tierBg, color:tierColor, marginLeft:'auto'}}>
                  {tierName}
                </span>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:5}}>
                {isTrial ? (<>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? 'Traduzione vocale base' : 'Basic voice translation'}
                  </div>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? '25 lingue supportate' : '25 supported languages'}
                  </div>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? 'Voci Microsoft Neural (Edge)' : 'Microsoft Neural Voices (Edge)'}
                  </div>
                  <div style={{fontSize:11, color:C.textMuted, display:'flex', alignItems:'center', gap:6}}>
                    <span>{'\u26A1'}</span> {isIT ? 'Limite: 50K caratteri/giorno' : 'Limit: 50K chars/day'}
                  </div>
                  <div style={{fontSize:11, color:C.textMuted, display:'flex', alignItems:'center', gap:6}}>
                    <span>{'\u{1F9E0}'}</span> AI: GPT-4o Mini
                  </div>
                  <div style={{marginTop:6, padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700,
                    background:C.proBadgeBg, color:C.proBadgeColor, textAlign:'center'}}>
                    {isIT ? 'Passa a PRO \u2728' : 'Upgrade to PRO \u2728'}
                  </div>
                </>) : useOwnKeys ? (<>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? 'Tutto di PRO incluso' : 'Everything in PRO'}
                  </div>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? 'Proprie chiavi API' : 'Your own API keys'}
                  </div>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? 'Scegli AI: Claude/GPT/Gemini' : 'Choose AI: Claude/GPT/Gemini'}
                  </div>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? 'ElevenLabs con voce custom' : 'ElevenLabs with custom voice'}
                  </div>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? 'Costo zero piattaforma' : 'Zero platform cost'}
                  </div>
                </>) : (<>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? 'Traduzione vocale illimitata' : 'Unlimited voice translation'}
                  </div>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? 'Voci ElevenLabs HD' : 'ElevenLabs HD Voices'}
                  </div>
                  <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:6}}>
                    <span style={{color:C.freeBadgeColor}}>{'\u2705'}</span> {isIT ? '25 lingue, tutte le modalit\u00E0' : '25 languages, all modes'}
                  </div>
                  <div style={{fontSize:11, color:C.textMuted, display:'flex', alignItems:'center', gap:6}}>
                    <span>{'\u{1F4B0}'}</span> {isIT ? `Credito: ${formatCredits(creditBalance)}` : `Credit: ${formatCredits(creditBalance)}`}
                  </div>
                  <div style={{fontSize:11, color:C.textMuted, display:'flex', alignItems:'center', gap:6}}>
                    <span>{'\u{1F9E0}'}</span> AI: GPT-4o Mini ({isIT ? 'default' : 'default'})
                  </div>
                </>)}
              </div>
            </button>
          );
        })()}

        {/* ═══════════════════════════════════════
            CREA STANZA — elegant 3D door, no background
           ═══════════════════════════════════════ */}
        <div style={{
          width:'100%', maxWidth:400, display:'flex', flexDirection:'column',
          alignItems:'center', marginTop:12, marginBottom:20,
        }}>
          <button style={{
            background:'transparent', border:'none', cursor:'pointer',
            padding:0, WebkitTapHighlightColor:'transparent',
            display:'flex', flexDirection:'column', alignItems:'center',
            transition:'transform 0.2s ease',
          }}
            onClick={() => {
              vibrate();
              if (isGuest) { setAuthStep('email'); setView('account'); return; }
              setShowCreatePopup(true);
            }}>
            {/* Door SVG 3D — theme-aware */}
            <div style={{
              width:140, height:180, position:'relative',
              animation:'vtDoorGlow 3s ease-in-out infinite',
            }}>
              <svg viewBox="0 0 140 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:'100%', height:'100%'}}>
                <defs>
                  <linearGradient id="doorBody" x1="30" y1="8" x2="110" y2="172">
                    <stop offset="0%" stopColor={C.doorBody[0]}/>
                    <stop offset="35%" stopColor={C.doorBody[1]}/>
                    <stop offset="100%" stopColor={C.doorBody[2]}/>
                  </linearGradient>
                  <linearGradient id="doorFace" x1="38" y1="14" x2="102" y2="168">
                    <stop offset="0%" stopColor={C.doorFace[0]}/>
                    <stop offset="40%" stopColor={C.doorFace[1]}/>
                    <stop offset="100%" stopColor={C.doorFace[2]}/>
                  </linearGradient>
                  <linearGradient id="panelGrad" x1="48" y1="28" x2="92" y2="90">
                    <stop offset="0%" stopColor={C.doorPanel1[0]}/>
                    <stop offset="100%" stopColor={C.doorPanel1[1]}/>
                  </linearGradient>
                  <linearGradient id="panelGrad2" x1="48" y1="100" x2="92" y2="155">
                    <stop offset="0%" stopColor={C.doorPanel2[0]}/>
                    <stop offset="100%" stopColor={C.doorPanel2[1]}/>
                  </linearGradient>
                  <linearGradient id="handleGrad" x1="95" y1="88" x2="102" y2="100">
                    <stop offset="0%" stopColor={C.doorHandle[0]}/>
                    <stop offset="100%" stopColor={C.doorHandle[1]}/>
                  </linearGradient>
                  <radialGradient id="handleGlow" cx="98" cy="94" r="12" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={C.doorHandleGlow}/>
                    <stop offset="100%" stopColor="rgba(255,215,0,0)"/>
                  </radialGradient>
                  <linearGradient id="archGrad" x1="34" y1="6" x2="106" y2="6">
                    <stop offset="0%" stopColor={C.doorArch[0]}/>
                    <stop offset="50%" stopColor={C.doorArch[1]}/>
                    <stop offset="100%" stopColor={C.doorArch[2]}/>
                  </linearGradient>
                  <linearGradient id="shineGrad" x1="42" y1="14" x2="60" y2="60">
                    <stop offset="0%" stopColor={C.doorShine[0]}/>
                    <stop offset="100%" stopColor={C.doorShine[1]}/>
                  </linearGradient>
                  <linearGradient id="floorGlow" x1="30" y1="172" x2="110" y2="180">
                    <stop offset="0%" stopColor="rgba(0,0,0,0)"/>
                    <stop offset="50%" stopColor={C.doorFloor}/>
                    <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
                  </linearGradient>
                </defs>

                <ellipse cx="70" cy="175" rx="50" ry="5" fill="url(#floorGlow)"/>
                <rect x="30" y="8" width="80" height="164" rx="8" fill="url(#doorBody)"/>
                <rect x="34" y="12" width="72" height="156" rx="6" fill="url(#doorFace)"/>
                <path d="M38 18 Q70 4 102 18" stroke="url(#archGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                <rect x="48" y="28" width="44" height="58" rx="5" fill="url(#panelGrad)" stroke={C.doorPanelStroke1} strokeWidth="1"/>
                <rect x="48" y="100" width="44" height="54" rx="5" fill="url(#panelGrad2)" stroke={C.doorPanelStroke2} strokeWidth="1"/>
                <circle cx="98" cy="94" r="12" fill="url(#handleGlow)"/>
                <circle cx="98" cy="94" r="5" fill="url(#handleGrad)" stroke={C.doorHandleStroke} strokeWidth="0.5"/>
                <circle cx="96.5" cy="92.5" r="2" fill="rgba(255,255,255,0.45)"/>
                <ellipse cx="98" cy="102" rx="1.5" ry="2" fill="rgba(0,0,0,0.25)"/>
                <path d="M38 14 L58 14 Q42 50 38 70 Z" fill="url(#shineGrad)" opacity="0.7"/>
                <rect x="30" y="8" width="6" height="164" rx="4" fill={C.doorShadow}/>
              </svg>
            </div>

            <div style={{marginTop:16, textAlign:'center'}}>
              <div style={{
                fontWeight:900, fontSize:24, letterSpacing:-0.8,
                background:C.titleGrad,
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                backgroundClip:'text', fontFamily:FONT,
              }}>
                {L('createRoom')}
              </div>
              <div style={{fontSize:12, color:C.textMuted, marginTop:4, fontFamily:FONT, letterSpacing:0.5}}>
                {L('tapToStart') || 'Tocca per iniziare'}
              </div>
            </div>
          </button>
        </div>

        {/* ═══════════════════════════════════════
            CREATE ROOM POPUP
           ═══════════════════════════════════════ */}
        {showCreatePopup && (() => {
          /* SVG icon paths for context types — modern line style */
          const ctxIcons = {
            general: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
            tourism: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4',
            medical: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
            education: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12 12 0 01.84 4.172C19 18.09 15.866 21 12 21s-7-2.91-7-6.25a12 12 0 01.84-4.172L12 14z',
            business: 'M21 13.255A23.2 23.2 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0h2a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h2',
            restaurant: 'M12 8c-2.21 0-4 1.79-4 4h8c0-2.21-1.79-4-4-4zM5 16h14M7 20h10M8 12V4m4 0v8m4-8v8',
            personal: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
            legal: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2',
            shopping: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
            realestate: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5h4v5',
            tech: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
            emergency: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
          };
          const CtxIcon = ({ id, size = 20, color }) => (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
              stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d={ctxIcons[id] || ctxIcons.general} />
            </svg>
          );
          return (
          <>
            <div onClick={() => { setShowCreatePopup(false); setShowContextDropdown(false); }}
              style={{position:'fixed', inset:0, zIndex:200,
                background:'rgba(0,0,0,0.55)', backdropFilter:'blur(8px)',
                animation:'vtFadeIn 0.2s ease-out'}} />
            <div style={{position:'fixed', left:'50%', top:'50%', transform:'translate(-50%, -50%)',
              zIndex:201, width:'calc(100% - 40px)', maxWidth:380,
              padding:'28px 22px 24px', borderRadius:28,
              background:C.popupBg,
              border:`1px solid ${C.popupBorder}`,
              boxShadow:`0 24px 80px rgba(0,0,0,0.45), 0 0 50px ${C.popupShadow}`,
              animation:'vtSlideUp 0.25s ease-out'}}>
              {/* Header — elegant mini door SVG + title */}
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22}}>
                <div style={{display:'flex', alignItems:'center', gap:12}}>
                  <div style={{width:40, height:40, borderRadius:14,
                    background:`linear-gradient(135deg, ${C.accent}22, ${C.accent}08)`,
                    border:`1px solid ${C.accent}25`,
                    display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke={C.accent} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="2" width="14" height="20" rx="2" />
                      <circle cx="14" cy="12" r="1" fill={C.accent} stroke="none" />
                      <path d="M7 6h4v12H7z" strokeWidth={0.8} opacity={0.4} />
                    </svg>
                  </div>
                  <div>
                    <div style={{fontWeight:800, fontSize:18, letterSpacing:-0.5, color:C.textPrimary}}>
                      {L('createRoom')}
                    </div>
                    <div style={{fontSize:10, color:C.textMuted, fontWeight:500, marginTop:1}}>
                      {L('context') || 'Seleziona contesto'}
                    </div>
                  </div>
                </div>
                <button onClick={() => { setShowCreatePopup(false); setShowContextDropdown(false); }}
                  style={{width:34, height:34, borderRadius:12, cursor:'pointer',
                    background:C.popupCloseBg, border:`1px solid ${C.popupCloseBorder}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    WebkitTapHighlightColor:'transparent', transition:'all 0.15s'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={C.popupCloseColor} strokeWidth={2} strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Context selector — modern card style */}
              <div style={{marginBottom:16, position:'relative'}}>
                <button onClick={() => setShowContextDropdown(!showContextDropdown)}
                  style={{width:'100%', padding:'14px 16px', borderRadius:16, cursor:'pointer',
                    background:C.ctxBtnBg, border:`1px solid ${C.ctxBtnBorder}`,
                    display:'flex', alignItems:'center', gap:12, fontFamily:FONT,
                    WebkitTapHighlightColor:'transparent', color:C.textPrimary, transition:'all 0.15s'}}>
                  <div style={{width:36, height:36, borderRadius:12, flexShrink:0,
                    background:`linear-gradient(135deg, ${C.accent}18, ${C.accent}08)`,
                    border:`1px solid ${C.accent}20`,
                    display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <CtxIcon id={selectedContext} size={18} color={C.accent} />
                  </div>
                  <div style={{flex:1, textAlign:'left'}}>
                    <span style={{fontSize:14, fontWeight:700, color:C.accent}}>
                      {L(CONTEXTS.find(c => c.id === selectedContext)?.nameKey)}
                    </span>
                    <div style={{fontSize:10, color:C.textMuted, marginTop:2, lineHeight:1.3}}>
                      {L(CONTEXTS.find(c => c.id === selectedContext)?.descKey) || ''}
                    </div>
                  </div>
                  <Icon name={showContextDropdown ? 'chevUp' : 'chevDown'} size={16} color={C.textTertiary} />
                </button>
                {showContextDropdown && (
                  <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:50,
                    marginTop:6, borderRadius:18, overflow:'hidden',
                    background:C.ctxDropBg, border:`1px solid ${C.ctxDropBorder}`,
                    backdropFilter:'blur(24px)', boxShadow:'0 12px 40px rgba(0,0,0,0.4)',
                    maxHeight:260, overflowY:'auto'}}>
                    {CONTEXTS.map(c => {
                      const isSel = selectedContext === c.id;
                      return (
                        <button key={c.id} onClick={() => { setSelectedContext(c.id); setShowContextDropdown(false); }}
                          style={{width:'100%', padding:'11px 14px', cursor:'pointer',
                            display:'flex', alignItems:'center', gap:11, fontFamily:FONT,
                            WebkitTapHighlightColor:'transparent', transition:'all 0.1s',
                            background: isSel ? C.ctxSelBg : 'transparent',
                            border:'none', borderBottom:`1px solid ${C.btnBorder}`,
                            color:C.textPrimary}}>
                          <div style={{width:30, height:30, borderRadius:10, flexShrink:0,
                            background: isSel ? `${C.accent}18` : 'transparent',
                            display:'flex', alignItems:'center', justifyContent:'center'}}>
                            <CtxIcon id={c.id} size={16} color={isSel ? C.accent : C.textTertiary} />
                          </div>
                          <span style={{flex:1, textAlign:'left', fontSize:13, fontWeight: isSel ? 700 : 500,
                            color: isSel ? C.accent : C.textSecondary}}>
                            {L(c.nameKey)}
                          </span>
                          {isSel && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Description — soft input */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:10, fontWeight:700, color:C.textTertiary,
                  textTransform:'uppercase', letterSpacing:1.2, marginBottom:7}}>
                  {L('descriptionOptional')}
                </div>
                <input style={{...S.input, fontSize:13, padding:'12px 16px', borderRadius:14}} value={roomDescription}
                  onChange={e => setRoomDescription(e.target.value)}
                  placeholder={L('descriptionPlaceholder') || 'Es. lezione di italiano...'}
                  maxLength={150} />
              </div>

              {/* Create button — elegant gradient with sparkle icon */}
              <button style={{
                width:'100%', padding:'17px 0', borderRadius:16, cursor:'pointer', border:'none',
                background:C.createBtnGrad,
                boxShadow:C.createBtnShadow,
                color:'#FFFFFF', fontFamily:FONT, fontSize:16, fontWeight:800,
                letterSpacing:-0.2, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                WebkitTapHighlightColor:'transparent', transition:'all 0.2s'
              }}
                onClick={() => { vibrate(); setShowCreatePopup(false); handleCreateRoom(); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.8 5.6 21.2 8 14 2 9.2h7.6L12 2z" />
                </svg>
                {L('createRoom')}
              </button>
            </div>
          </>
          );
        })()}

        {/* ═══════════════════════════════════════
            INVITE CARD
           ═══════════════════════════════════════ */}
        <button style={{width:'100%', maxWidth:400, marginBottom:8, padding:'12px 14px', borderRadius:16,
          background:C.inviteBg, border:`1px solid ${C.inviteBorder}`,
          display:'flex', alignItems:'center', gap:12, cursor:'pointer', fontFamily:FONT,
          WebkitTapHighlightColor:'transparent', color:C.textPrimary}}
          onClick={() => setShowShareApp(!showShareApp)}>
          <img src="/avatars/2.png" alt="" style={{width:42, height:42, objectFit:'contain', borderRadius:12}} />
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontWeight:700, fontSize:13, color:C.textPrimary}}>
              {L('inviteFriend') || 'Invita un amico'}
            </div>
            <div style={{fontSize:10, color:C.textTertiary, marginTop:1}}>
              {L('inviteFriendDesc') || 'Condividi VoiceTranslate con QR o link'}
            </div>
          </div>
          <Icon name="share" size={20} color={C.accent2} />
        </button>

        {/* Share panel (expandable) */}
        {showShareApp && (
          <div style={{width:'100%', maxWidth:400, marginBottom:8, padding:'14px', borderRadius:16,
            background:C.inviteBg, border:`1px solid ${C.inviteBorder}`}}>
            <div style={{marginBottom:8}}>
              <div style={{...S.label, fontSize:10}}>{L('inviteLangLabel')}</div>
              <select style={{...S.select, fontSize:12}} value={shareAppLang} onChange={e => setShareAppLang(e.target.value)}>
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
            </div>
            <HomeQR url={`${APP_URL}?lang=${shareAppLang}`} />
            <button style={{...S.btn, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              background:C.shareBtnBg, border:`1px solid ${C.shareBtnBorder}`, color:C.accent2, fontSize:13}}
              onClick={() => shareApp()}>
              <Icon name="share" size={16} color={C.accent2} />
              {L('shareLink')}
            </button>
            {!isGuest && referralCode && (
              <div style={{marginTop:8, padding:'10px 12px', borderRadius:12,
                background:C.refBg, border:`1px solid ${C.refBorder}`,
                display:'flex', alignItems:'center', gap:8}}>
                <Icon name="gift" size={18} color={C.accent3} />
                <div style={{flex:1, fontFamily:"'Courier New', monospace", fontSize:13, fontWeight:700, color:C.accent3}}>
                  {referralCode}
                </div>
                <button style={{padding:'6px 10px', borderRadius:8, background:C.refBtnBg,
                  border:`1px solid ${C.refBtnBorder}`, color:C.accent3, fontSize:10, fontWeight:700,
                  cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', gap:3}}
                  onClick={() => {
                    const url = `${APP_URL}?ref=${referralCode}&lang=${shareAppLang}`;
                    const text = `${L('referralInviteText') || 'Join me on VoiceTranslate!'} ${referralCode} - ${url}`;
                    if (navigator.share) { navigator.share({ title:'VoiceTranslate', text, url }); }
                    else { navigator.clipboard.writeText(text); }
                  }}>
                  <Icon name="copy" size={12} color={C.accent3} />
                  Invite
                </button>
              </div>
            )}
          </div>
        )}

        {status && <div style={S.statusMsg}>{status}</div>}

        {showTutorial && (
          <TutorialOverlay L={L} tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep} setShowTutorial={setShowTutorial} />
        )}
      </div>

      {/* Theme-aware animations */}
      <style>{`
        @keyframes vtFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes vtSlideUp {
          from { opacity: 0; transform: translate(-50%, -45%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes vtDoorGlow {
          0%, 100% { filter: drop-shadow(0 16px 40px ${C.doorGlowShadow[0]}) drop-shadow(0 4px 12px rgba(0,0,0,0.25)); }
          50% { filter: drop-shadow(0 16px 48px ${C.doorGlowShadow[1]}) drop-shadow(0 6px 16px rgba(0,0,0,0.30)); }
        }
      `}</style>
    </div>
  );
});

export default HomeView;
