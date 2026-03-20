'use client';
import { memo, useState, useMemo, useEffect } from 'react';
import { VOICES, CONTEXTS, FONT, getLang, vibrate } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
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
      // Buttons
      btnBg: 'rgba(255,255,255,0.04)', btnBorder: 'rgba(255,255,255,0.08)',
      btnIconColor: 'rgba(255,255,255,0.65)',
      settingsBtnBg: 'rgba(108,99,255,0.06)', settingsBtnBorder: 'rgba(108,99,255,0.12)',
      settingsIconColor: 'rgba(255,255,255,0.80)',
      contactsBtnBg: 'rgba(0,210,255,0.06)', contactsBtnBorder: 'rgba(0,210,255,0.15)',
      // Popup
      popupBg: 'linear-gradient(160deg, rgba(20,22,50,0.98) 0%, rgba(15,17,40,0.98) 100%)',
      popupBorder: 'rgba(108,99,255,0.2)', popupShadow: 'rgba(108,99,255,0.08)',
      popupCloseBg: 'rgba(255,255,255,0.06)', popupCloseBorder: 'rgba(255,255,255,0.1)',
      popupCloseColor: 'rgba(255,255,255,0.55)',
      createBtnGrad: 'linear-gradient(135deg, #6C63FF 0%, #00D2FF 100%)',
      createBtnShadow: '0 6px 24px rgba(108,99,255,0.4), 0 2px 8px rgba(0,0,0,0.2)',
      // Tabs
      tabBg: 'rgba(108,99,255,0.04)', tabBorder: 'rgba(108,99,255,0.1)',
      tabActiveBg: 'rgba(108,99,255,0.1)', tabActiveBorder: 'rgba(108,99,255,0.25)',
      tabActiveColor: '#6C63FF',
      // Online friends
      onlineStatusBg: 'rgba(0,255,148,0.15)', onlineStatusColor: '#00FF94',
      chataBtnBg: 'rgba(0,210,255,0.1)', chataBtnBorder: 'rgba(0,210,255,0.25)', chataBtnColor: '#00D2FF',
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
      btnBg: 'rgba(26,29,58,0.04)', btnBorder: 'rgba(26,29,58,0.10)',
      btnIconColor: 'rgba(26,29,58,0.55)',
      settingsBtnBg: 'rgba(90,82,224,0.06)', settingsBtnBorder: 'rgba(90,82,224,0.14)',
      settingsIconColor: 'rgba(26,29,58,0.70)',
      contactsBtnBg: 'rgba(0,163,196,0.06)', contactsBtnBorder: 'rgba(0,163,196,0.14)',
      popupBg: 'linear-gradient(160deg, rgba(245,246,255,0.99) 0%, rgba(240,242,255,0.99) 100%)',
      popupBorder: 'rgba(90,82,224,0.18)', popupShadow: 'rgba(90,82,224,0.08)',
      popupCloseBg: 'rgba(26,29,58,0.05)', popupCloseBorder: 'rgba(26,29,58,0.10)',
      popupCloseColor: 'rgba(26,29,58,0.45)',
      createBtnGrad: 'linear-gradient(135deg, #6C63FF 0%, #00A3C4 100%)',
      createBtnShadow: '0 6px 24px rgba(90,82,224,0.25), 0 2px 8px rgba(0,0,0,0.08)',
      tabBg: 'rgba(90,82,224,0.04)', tabBorder: 'rgba(90,82,224,0.08)',
      tabActiveBg: 'rgba(90,82,224,0.08)', tabActiveBorder: 'rgba(90,82,224,0.2)',
      tabActiveColor: '#5A52E0',
      onlineStatusBg: 'rgba(0,170,107,0.15)', onlineStatusColor: '#00AA6B',
      chataBtnBg: 'rgba(0,163,196,0.08)', chataBtnBorder: 'rgba(0,163,196,0.2)', chataBtnColor: '#00A3C4',
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
      btnBg: 'rgba(255,245,232,0.04)', btnBorder: 'rgba(255,245,232,0.08)',
      btnIconColor: 'rgba(255,245,232,0.60)',
      settingsBtnBg: 'rgba(212,160,106,0.06)', settingsBtnBorder: 'rgba(212,160,106,0.14)',
      settingsIconColor: 'rgba(255,245,232,0.75)',
      contactsBtnBg: 'rgba(232,184,122,0.06)', contactsBtnBorder: 'rgba(232,184,122,0.14)',
      popupBg: 'linear-gradient(160deg, rgba(30,20,12,0.98) 0%, rgba(24,16,10,0.98) 100%)',
      popupBorder: 'rgba(212,160,106,0.2)', popupShadow: 'rgba(212,160,106,0.08)',
      popupCloseBg: 'rgba(255,245,232,0.06)', popupCloseBorder: 'rgba(255,245,232,0.1)',
      popupCloseColor: 'rgba(255,245,232,0.50)',
      createBtnGrad: 'linear-gradient(135deg, #D4A06A 0%, #E8B87A 100%)',
      createBtnShadow: '0 6px 24px rgba(212,160,106,0.35), 0 2px 8px rgba(0,0,0,0.2)',
      tabBg: 'rgba(212,160,106,0.04)', tabBorder: 'rgba(212,160,106,0.08)',
      tabActiveBg: 'rgba(212,160,106,0.1)', tabActiveBorder: 'rgba(212,160,106,0.2)',
      tabActiveColor: '#D4A06A',
      onlineStatusBg: 'rgba(165,214,167,0.15)', onlineStatusColor: '#A5D6A7',
      chataBtnBg: 'rgba(232,184,122,0.1)', chataBtnBorder: 'rgba(232,184,122,0.2)', chataBtnColor: '#E8B87A',
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
      btnBg: 'rgba(255,248,240,0.04)', btnBorder: 'rgba(255,248,240,0.08)',
      btnIconColor: 'rgba(255,248,240,0.60)',
      settingsBtnBg: 'rgba(255,140,0,0.06)', settingsBtnBorder: 'rgba(255,140,0,0.14)',
      settingsIconColor: 'rgba(255,248,240,0.75)',
      contactsBtnBg: 'rgba(255,179,71,0.06)', contactsBtnBorder: 'rgba(255,179,71,0.14)',
      popupBg: 'linear-gradient(160deg, rgba(30,14,5,0.98) 0%, rgba(24,10,3,0.98) 100%)',
      popupBorder: 'rgba(255,140,0,0.2)', popupShadow: 'rgba(255,140,0,0.08)',
      popupCloseBg: 'rgba(255,248,240,0.06)', popupCloseBorder: 'rgba(255,248,240,0.1)',
      popupCloseColor: 'rgba(255,248,240,0.50)',
      createBtnGrad: 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)',
      createBtnShadow: '0 6px 24px rgba(255,140,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
      tabBg: 'rgba(255,140,0,0.04)', tabBorder: 'rgba(255,140,0,0.08)',
      tabActiveBg: 'rgba(255,140,0,0.1)', tabActiveBorder: 'rgba(255,140,0,0.2)',
      tabActiveColor: '#FF8C00',
      onlineStatusBg: 'rgba(124,252,0,0.15)', onlineStatusColor: '#7CFC00',
      chataBtnBg: 'rgba(255,179,71,0.1)', chataBtnBorder: 'rgba(255,179,71,0.2)', chataBtnColor: '#FFB347',
    },
  };
  return palettes[theme] || palettes.dark;
}

// ── Door SVG component (animated door CTA) ──
const DoorSVG = ({ C }) => (
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
);

const HomeView = memo(function HomeView({ L, S, prefs, setPrefs, savePrefs, myLang, selectedMode, setSelectedMode,
  selectedContext, setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom, setView,
  theme, setTheme, contacts, fetchContacts, rejoinRoom, startChatWithContact }) {

  const langInfo = getLang(prefs.lang);
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [activeRooms, setActiveRooms] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0); // 0 = Le mie, 1 = Mondo
  const [showVoicePicker, setShowVoicePicker] = useState(false);

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

  // Filter online contacts
  const onlineContacts = useMemo(() => {
    if (!contacts || !Array.isArray(contacts)) return [];
    return contacts.filter(c => c.online === true);
  }, [contacts]);

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>

        {/* ═══════════════════════════════════════
            TOP BAR: Avatar + Name + Language + Voice + Contacts + Settings
           ═══════════════════════════════════════ */}
        <div style={{display:'flex', alignItems:'center', gap:10, width:'100%', maxWidth:400, marginBottom:16,
          padding:'12px 14px', borderRadius:18, background:C.topBarBg, border:`1px solid ${C.topBarBorder}`}}>
          <AvatarImg src={prefs.avatar} size={56} style={{borderRadius:14}} />
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:14, fontWeight:800, letterSpacing:-0.3, color:C.textPrimary}}>{prefs.name}</div>
            <div style={{fontSize:11, color:C.textSecondary, display:'flex', alignItems:'center', gap:4, marginTop:2}}>
              <span style={{fontSize:14}}>{langInfo.flag}</span>
              <span style={{fontSize:10, fontWeight:700}}>{langInfo.name}</span>
            </div>
          </div>
          <div style={{display:'flex', gap:4, flexShrink:0}}>
            {/* Voice picker dropdown */}
            <div style={{position:'relative'}}>
              <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
                background:C.btnBg, border:`1px solid ${C.btnBorder}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                WebkitTapHighlightColor:'transparent'}}
                onClick={() => setShowVoicePicker(!showVoicePicker)}
                title="Voice">
                <span style={{fontSize:13}}>{'🎤'}</span>
              </button>
              {showVoicePicker && (
                <div style={{position:'absolute', top:'100%', right:0, zIndex:50, marginTop:6,
                  borderRadius:12, overflow:'hidden', background:C.popupBg, border:`1px solid ${C.popupBorder}`,
                  backdropFilter:'blur(24px)', boxShadow:'0 12px 40px rgba(0,0,0,0.4)', minWidth:120}}>
                  {VOICES.map(v => (
                    <button key={v} onClick={() => {
                      setPrefs({...prefs, voice: v});
                      savePrefs({...prefs, voice: v});
                      setShowVoicePicker(false);
                    }} style={{width:'100%', padding:'10px 12px', cursor:'pointer', border:'none',
                      background: prefs.voice === v ? C.tabActiveBg : 'transparent',
                      color: prefs.voice === v ? C.tabActiveColor : C.textSecondary,
                      fontSize:11, fontWeight: prefs.voice === v ? 700 : 500,
                      fontFamily:FONT, textAlign:'left', display:'flex', alignItems:'center', gap:6,
                      WebkitTapHighlightColor:'transparent', transition:'all 0.1s'}}>
                      <span style={{fontSize:12}}>{'\u{1F50A}'}</span>
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Contacts button */}
            <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
              background:C.contactsBtnBg, border:`1px solid ${C.contactsBtnBorder}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => setView('contacts')}
              title="Contacts">
              <span style={{fontSize:14}}>{'👥'}</span>
            </button>
            {/* Settings button */}
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
            DOOR CTA — Create/Enter Room
           ═══════════════════════════════════════ */}
        <div style={{
          width:'100%', maxWidth:400, display:'flex', flexDirection:'column',
          alignItems:'center', marginBottom:20,
        }}>
          <button style={{
            background:'transparent', border:'none', cursor:'pointer',
            padding:0, WebkitTapHighlightColor:'transparent',
            display:'flex', flexDirection:'column', alignItems:'center',
            transition:'transform 0.2s ease',
          }}
            onClick={() => {
              vibrate();
              setShowCreatePopup(true);
            }}>
            <div style={{
              width:140, height:180, position:'relative',
              animation:'vtDoorGlow 3s ease-in-out infinite',
            }}>
              <DoorSVG C={C} />
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
              <div style={{fontSize:11, color:C.textMuted, marginTop:3, fontFamily:FONT, letterSpacing:0.5}}>
                Crea una nuova stanza o entra in una chat
              </div>
            </div>
          </button>
        </div>

        {/* ═══════════════════════════════════════
            CREATE ROOM POPUP
           ═══════════════════════════════════════ */}
        {showCreatePopup && (
          <>
            <div onClick={() => setShowCreatePopup(false)}
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
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22}}>
                <div style={{fontWeight:800, fontSize:18, letterSpacing:-0.5, color:C.textPrimary}}>
                  {L('createRoom')}
                </div>
                <button onClick={() => setShowCreatePopup(false)}
                  style={{width:34, height:34, borderRadius:12, cursor:'pointer',
                    background:C.popupCloseBg, border:`1px solid ${C.popupCloseBorder}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    WebkitTapHighlightColor:'transparent', transition:'all 0.15s'}}>
                  <span style={{fontSize:16}}>{'✕'}</span>
                </button>
              </div>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:10, fontWeight:700, color:C.textTertiary,
                  textTransform:'uppercase', letterSpacing:1.2, marginBottom:7}}>
                  {L('descriptionOptional')}
                </div>
                <input style={{width:'100%', fontSize:13, padding:'12px 16px', borderRadius:14,
                  background:C.btnBg, border:`1px solid ${C.btnBorder}`,
                  color:C.textPrimary, fontFamily:FONT, boxSizing:'border-box'}}
                  value={roomDescription}
                  onChange={e => setRoomDescription(e.target.value)}
                  placeholder="Es. lezione di italiano..."
                  maxLength={150} />
              </div>
              <button style={{
                width:'100%', padding:'17px 0', borderRadius:16, cursor:'pointer', border:'none',
                background:C.createBtnGrad,
                boxShadow:C.createBtnShadow,
                color:'#FFFFFF', fontFamily:FONT, fontSize:16, fontWeight:800,
                letterSpacing:-0.2, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                WebkitTapHighlightColor:'transparent', transition:'all 0.2s'
              }}
                onClick={() => { vibrate(); setShowCreatePopup(false); handleCreateRoom(); }}>
                <span>{'\u{1F4AC}'}</span>
                {L('createRoom')}
              </button>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════
            TABS: "Le mie" (0) and "Mondo" (1)
           ═══════════════════════════════════════ */}
        <div style={{display:'flex', gap:8, width:'100%', maxWidth:400, marginBottom:16,
          padding:'4px', borderRadius:14, background:C.tabBg, border:`1px solid ${C.tabBorder}`}}>
          <button
            onClick={() => setSelectedTab(0)}
            style={{flex:1, padding:'10px 12px', borderRadius:11, cursor:'pointer', fontFamily:FONT,
              fontSize:12, fontWeight:700, border:'none',
              background: selectedTab === 0 ? C.tabActiveBg : 'transparent',
              border: selectedTab === 0 ? `1px solid ${C.tabBorder}` : 'none',
              color: selectedTab === 0 ? C.tabActiveColor : C.textMuted,
              transition:'all 0.15s', WebkitTapHighlightColor:'transparent'}}>
            Le mie
          </button>
          <button
            onClick={() => setSelectedTab(1)}
            style={{flex:1, padding:'10px 12px', borderRadius:11, cursor:'pointer', fontFamily:FONT,
              fontSize:12, fontWeight:700, border:'none',
              background: selectedTab === 1 ? C.tabActiveBg : 'transparent',
              border: selectedTab === 1 ? `1px solid ${C.tabBorder}` : 'none',
              color: selectedTab === 1 ? C.tabActiveColor : C.textMuted,
              transition:'all 0.15s', WebkitTapHighlightColor:'transparent'}}>
            Mondo
          </button>
        </div>

        {/* ═══════════════════════════════════════
            TAB 0: Le mie (Personal chats)
           ═══════════════════════════════════════ */}
        {selectedTab === 0 && (
          <div style={{width:'100%', maxWidth:400}}>
            {/* Active Rooms */}
            {activeRooms.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11, fontWeight:700, color:C.textTertiary, marginBottom:8,
                  letterSpacing:0.5, textTransform:'uppercase'}}>
                  Chat Attive
                </div>
                {activeRooms.map((room) => {
                  const timeAgo = Math.floor((Date.now() - room.leftAt) / 60000);
                  const timeStr = timeAgo < 1 ? 'ora' : timeAgo < 60 ? `${timeAgo} min fa` : `${Math.floor(timeAgo / 60)}h fa`;
                  return (
                    <div key={room.roomId} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                      marginBottom:6, borderRadius:14, background:C.topBarBg, border:`1px solid ${C.topBarBorder}`,
                      cursor:'pointer', transition:'background 0.15s'}}
                      onClick={() => { vibrate(); if (rejoinRoom) rejoinRoom(room.roomId); }}>
                      <div style={{display:'flex', gap:2, fontSize:16}}>
                        {[...new Set(room.members?.map(m => getLang(m.lang).flag) || [])].map((flag, i) => (
                          <span key={i}>{flag}</span>
                        ))}
                      </div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:12, fontWeight:700, color:C.textPrimary, overflow:'hidden',
                          textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {room.members?.map(m => m.name).join(', ') || room.roomId}
                        </div>
                        <div style={{fontSize:10, color:C.textMuted}}>
                          {room.mode === 'conversation' ? '\u{1F4AC}' : room.mode === 'classroom' ? '\u{1F3EB}' : '\u{1F399}'} {timeStr}
                        </div>
                      </div>
                      <div style={{padding:'4px 12px', borderRadius:8, fontSize:10, fontWeight:700,
                        background:C.accent + '18', color:C.accent, cursor:'pointer'}}>
                        Rientra
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Online Friends */}
            {onlineContacts.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11, fontWeight:700, color:C.textTertiary, marginBottom:8,
                  letterSpacing:0.5, textTransform:'uppercase'}}>
                  Amici Online
                </div>
                {onlineContacts.map((contact) => (
                  <div key={contact.id} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                    marginBottom:6, borderRadius:14, background:C.topBarBg, border:`1px solid ${C.topBarBorder}`}}>
                    <div style={{position:'relative'}}>
                      <AvatarImg src={contact.avatar} size={40} style={{borderRadius:10}} />
                      <div style={{position:'absolute', bottom:0, right:0, width:12, height:12, borderRadius:6,
                        background:C.onlineStatusColor, border:`2px solid ${C.topBarBg}`}} />
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:12, fontWeight:700, color:C.textPrimary}}>
                        {contact.name}
                      </div>
                    </div>
                    <button style={{padding:'6px 14px', borderRadius:10, cursor:'pointer', fontFamily:FONT,
                      fontSize:11, fontWeight:700, border:`1px solid ${C.chataBtnBorder}`,
                      background:C.chataBtnBg, color:C.chataBtnColor,
                      WebkitTapHighlightColor:'transparent', transition:'all 0.15s'}}
                      onClick={() => { vibrate(); if (startChatWithContact) startChatWithContact(contact); }}>
                      Chatta
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Link to chat history */}
            <button style={{width:'100%', padding:'12px 14px', borderRadius:14, cursor:'pointer', fontFamily:FONT,
              background:C.topBarBg, border:`1px solid ${C.topBarBorder}`,
              color:C.textSecondary, fontSize:12, fontWeight:600,
              WebkitTapHighlightColor:'transparent', transition:'all 0.15s'}}
              onClick={() => { setView('history'); }}>
              📜 Storico Chat
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════
            TAB 1: Mondo (Public chats)
           ═══════════════════════════════════════ */}
        {selectedTab === 1 && (
          <div style={{width:'100%', maxWidth:400, textAlign:'center', padding:'20px 14px',
            borderRadius:14, background:C.topBarBg, border:`1px solid ${C.topBarBorder}`}}>
            <div style={{fontSize:14, color:C.textMuted, fontWeight:600, fontFamily:FONT}}>
              Le chat pubbliche saranno disponibili presto
            </div>
            <div style={{fontSize:11, color:C.textTertiary, marginTop:8, fontFamily:FONT}}>
              Rimani in contatto con il tuo team
            </div>
          </div>
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
