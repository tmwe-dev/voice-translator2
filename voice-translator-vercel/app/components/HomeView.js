'use client';
import { memo, useState, useMemo, useEffect } from 'react';
import { VOICES, CONTEXTS, FONT, getLang, vibrate, APP_VERSION } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';

// ═══════════════════════════════════════
// Theme-aware color palette for HomeView
// ═══════════════════════════════════════
function getHomeColors(theme) {
  const palettes = {
    dark: {
      // Primary accent
      accent: '#26D9B0', accentLight: '#B8B3FF', accentDark: '#4A40E0', accentMid: '#26D9B0',
      accent2: '#8B6AFF', accent3: '#FF6B6B', accent4: '#26D9B0',
      // Door SVG
      doorBody: ['#9B93FF', '#26D9B0', '#4A40E0'],
      doorFace: ['#B8B3FF', '#8B83FF', '#5A50F0'],
      doorArch: ['#C4BFFF', '#D4D0FF', '#A8A0FF'],
      doorFloor: 'rgba(38,217,176,0.15)',
      doorHandle: ['#FFE066', '#FFB800'],
      doorHandleGlow: 'rgba(255,215,0,0.35)',
      doorHandleStroke: 'rgba(255,200,0,0.3)',
      doorPanel1: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)'],
      doorPanel2: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)'],
      doorPanelStroke1: 'rgba(255,255,255,0.12)', doorPanelStroke2: 'rgba(255,255,255,0.08)',
      doorShine: ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)'],
      doorShadow: 'rgba(0,0,0,0.12)',
      doorGlowShadow: ['rgba(38,217,176,0.30)', 'rgba(38,217,176,0.45)'],
      // Title gradient
      titleGrad: 'linear-gradient(135deg, #B8B3FF 0%, #26D9B0 40%, #8B6AFF 100%)',
      // Top bar
      topBarBg: 'rgba(38,217,176,0.06)', topBarBorder: 'rgba(38,217,176,0.1)',
      // Texts
      textPrimary: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.72)',
      textTertiary: 'rgba(255,255,255,0.55)', textMuted: 'rgba(255,255,255,0.40)',
      // Buttons
      btnBg: 'rgba(255,255,255,0.04)', btnBorder: 'rgba(255,255,255,0.08)',
      btnIconColor: 'rgba(255,255,255,0.65)',
      settingsBtnBg: 'rgba(38,217,176,0.06)', settingsBtnBorder: 'rgba(38,217,176,0.12)',
      settingsIconColor: 'rgba(255,255,255,0.80)',
      contactsBtnBg: 'rgba(0,210,255,0.06)', contactsBtnBorder: 'rgba(0,210,255,0.15)',
      // Popup
      popupBg: 'linear-gradient(160deg, rgba(20,22,50,0.98) 0%, rgba(15,17,40,0.98) 100%)',
      popupBorder: 'rgba(38,217,176,0.2)', popupShadow: 'rgba(38,217,176,0.08)',
      popupCloseBg: 'rgba(255,255,255,0.06)', popupCloseBorder: 'rgba(255,255,255,0.1)',
      popupCloseColor: 'rgba(255,255,255,0.55)',
      createBtnGrad: 'linear-gradient(135deg, #26D9B0 0%, #8B6AFF 100%)',
      createBtnShadow: '0 6px 24px rgba(38,217,176,0.4), 0 2px 8px rgba(0,0,0,0.2)',
      // Tabs
      tabBg: 'rgba(38,217,176,0.04)', tabBorder: 'rgba(38,217,176,0.1)',
      tabActiveBg: 'rgba(38,217,176,0.1)', tabActiveBorder: 'rgba(38,217,176,0.25)',
      tabActiveColor: '#26D9B0',
      // Online friends
      onlineStatusBg: 'rgba(0,255,148,0.15)', onlineStatusColor: '#26D9B0',
      chataBtnBg: 'rgba(0,210,255,0.1)', chataBtnBorder: 'rgba(0,210,255,0.25)', chataBtnColor: '#8B6AFF',
    },
    light: {
      accent: '#5A52E0', accentLight: '#26D9B0', accentDark: '#3D35B0', accentMid: '#26D9B0',
      accent2: '#00A3C4', accent3: '#E0527A', accent4: '#00AA6B',
      doorBody: ['#8B83F0', '#26D9B0', '#4A40D0'],
      doorFace: ['#A8A0FF', '#26D9B0', '#5A50E8'],
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
      titleGrad: 'linear-gradient(135deg, #5A52E0 0%, #26D9B0 40%, #00A3C4 100%)',
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
      createBtnGrad: 'linear-gradient(135deg, #26D9B0 0%, #00A3C4 100%)',
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
        let saved; try { saved = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]'); } catch { saved = []; }
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
    <main style={S.page} aria-label="BarChat Home P4">
      <div style={S.scrollCenter}>

        {/* ═══════════════════════════════════════
            1. GREETING AREA (top)
           ═══════════════════════════════════════ */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          maxWidth: 400, marginBottom: 28, paddingTop: 8
        }} role="banner">
          <div style={{ position: 'relative' }}>
            <AvatarImg src={prefs.avatar} size={56} style={{ borderRadius: 14 }} />
            <span style={{
              position: 'absolute', bottom: -4, right: -8,
              fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
              background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '1px 4px',
              fontFamily: 'monospace', letterSpacing: 0.3, whiteSpace: 'nowrap'
            }}>{APP_VERSION}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 18, fontWeight: 900, letterSpacing: -0.5,
              color: C.textPrimary, fontFamily: FONT
            }}>
              Buongiorno, {prefs.name} 👋
            </div>
            <button onClick={() => setView('settings')}
              style={{
                fontSize: 12, color: C.textSecondary, marginTop: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, textDecoration: 'none', fontFamily: FONT,
                WebkitTapHighlightColor: 'transparent'
              }}>
              ✏️ Modifica profilo
            </button>
          </div>
        </header>

        {/* ═══════════════════════════════════════
            2. BIG CTA BUTTON (center, huge)
           ═══════════════════════════════════════ */}
        <button
          onClick={() => {
            vibrate();
            handleCreateRoom();
          }}
          style={{
            width: '100%', maxWidth: 400, padding: '48px 24px',
            marginBottom: 32, borderRadius: 24, border: 'none',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #5b21b6 100%)',
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 12px 48px rgba(139, 92, 246, 0.4)',
            transition: 'all 0.3s ease', WebkitTapHighlightColor: 'transparent',
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)',
            backgroundSize: '200% 200%'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = '0 16px 56px rgba(139, 92, 246, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 12px 48px rgba(139, 92, 246, 0.4)';
          }}>
          <span style={{ fontSize: 44 }}>🎤</span>
          <div style={{
            fontSize: 28, fontWeight: 900, color: '#FFFFFF',
            letterSpacing: -0.8, fontFamily: FONT
          }}>
            Parla e Traduci
          </div>
          <div style={{
            fontSize: 13, color: 'rgba(255,255,255,0.8)',
            fontWeight: 500, fontFamily: FONT, letterSpacing: 0.3
          }}>
            Comunicare nel tuo linguaggio
          </div>
        </button>

        {/* ═══════════════════════════════════════
            3. LANGUAGE BAR (pills + swap button)
           ═══════════════════════════════════════ */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          maxWidth: 400, marginBottom: 28, justifyContent: 'center'
        }}>
          <button
            style={{
              padding: '10px 16px', borderRadius: 20,
              background: C.accent + '20', border: `1px solid ${C.accent}40`,
              color: C.accent, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s'
            }}
            onClick={() => { /* open language selector */ }}>
            {langInfo.flag} {langInfo.name}
          </button>
          <div style={{ fontSize: 18, color: C.textSecondary }}>⇄</div>
          <button
            style={{
              padding: '10px 16px', borderRadius: 20,
              background: C.accent2 + '20', border: `1px solid ${C.accent2}40`,
              color: C.accent2, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s'
            }}
            onClick={() => { /* open language selector */ }}>
            {getLang(myLang).flag} {getLang(myLang).name}
          </button>
        </div>

        {/* ═══════════════════════════════════════
            4. QUICK ACTIONS ROW (horizontal scroll)
           ═══════════════════════════════════════ */}
        <div style={{
          display: 'flex', gap: 10, width: '100%', maxWidth: 400,
          marginBottom: 28, overflowX: 'auto', paddingBottom: 4,
          scrollBehavior: 'smooth'
        }}>
          {/* Invita QR */}
          <button
            onClick={() => { vibrate(); setView('quickinvite'); }}
            style={{
              flex: '0 0 auto', padding: '14px 16px',
              borderRadius: 16, background: C.btnBg, border: `1px solid ${C.btnBorder}`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s'
            }}>
            <span style={{ fontSize: 22 }}>🔗</span>
            <span style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600 }}>Invita QR</span>
          </button>

          {/* Chat */}
          <button
            onClick={() => {
              vibrate();
              handleCreateRoom();
            }}
            style={{
              flex: '0 0 auto', padding: '14px 16px',
              borderRadius: 16, background: C.btnBg, border: `1px solid ${C.btnBorder}`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s'
            }}>
            <span style={{ fontSize: 22 }}>💬</span>
            <span style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600 }}>Chat</span>
          </button>

          {/* Video */}
          <button
            onClick={() => {
              vibrate();
              setSelectedMode('classroom');
              handleCreateRoom();
            }}
            style={{
              flex: '0 0 auto', padding: '14px 16px',
              borderRadius: 16, background: C.btnBg, border: `1px solid ${C.btnBorder}`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s'
            }}>
            <span style={{ fontSize: 22 }}>📹</span>
            <span style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600 }}>Video</span>
          </button>

          {/* Call */}
          <button
            onClick={() => {
              vibrate();
              setSelectedMode('call');
              handleCreateRoom();
            }}
            style={{
              flex: '0 0 auto', padding: '14px 16px',
              borderRadius: 16, background: C.btnBg, border: `1px solid ${C.btnBorder}`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s'
            }}>
            <span style={{ fontSize: 22 }}>📞</span>
            <span style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600 }}>Chiama</span>
          </button>

          {/* Interpreter */}
          <button
            onClick={() => { vibrate(); setView('interpreter'); }}
            style={{
              flex: '0 0 auto', padding: '14px 16px',
              borderRadius: 16, background: C.btnBg, border: `1px solid ${C.btnBorder}`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s'
            }}>
            <span style={{ fontSize: 22 }}>🎙️</span>
            <span style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600 }}>Interprete</span>
          </button>

          {/* Taxi */}
          <button
            onClick={() => { vibrate(); setView('taxi'); }}
            style={{
              flex: '0 0 auto', padding: '14px 16px',
              borderRadius: 16, background: C.btnBg, border: `1px solid ${C.btnBorder}`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s'
            }}>
            <span style={{ fontSize: 22 }}>🚕</span>
            <span style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600 }}>Taxi</span>
          </button>
        </div>

        {/* ═══════════════════════════════════════
            5. RECENT CONVERSATIONS LIST
           ═══════════════════════════════════════ */}
        {/* Active Rooms */}
        {activeRooms.length > 0 && (
          <div style={{ width: '100%', maxWidth: 400, marginBottom: 24 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.textTertiary, marginBottom: 12,
              letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: FONT
            }}>
              Chat Attive
            </div>
            {activeRooms.map((room) => {
              const timeAgo = Math.floor((Date.now() - room.leftAt) / 60000);
              const timeStr = timeAgo < 1 ? 'ora' : timeAgo < 60 ? `${timeAgo} min fa` : `${Math.floor(timeAgo / 60)}h fa`;
              return (
                <div
                  key={room.roomId}
                  onClick={() => {
                    vibrate();
                    if (rejoinRoom) rejoinRoom(room.roomId);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                    marginBottom: 10, borderRadius: 16, background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
                    cursor: 'pointer', transition: 'all 0.2s', fontFamily: FONT
                  }}>
                  <div style={{ display: 'flex', gap: 6, fontSize: 18 }}>
                    {[...new Set(room.members?.map(m => getLang(m.lang).flag) || [])].map((flag, i) => (
                      <span key={i}>{flag}</span>
                    ))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: C.textPrimary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {room.members?.map(m => m.name).join(', ') || room.roomId}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {room.mode === 'conversation' ? '💬' : room.mode === 'classroom' ? '🎓' : '🎧'} {timeStr}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Online Contacts / Recent Conversations */}
        {onlineContacts.length > 0 && (
          <div style={{ width: '100%', maxWidth: 400, marginBottom: 24 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.textTertiary, marginBottom: 12,
              letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: FONT
            }}>
              Contatti Online
            </div>
            {onlineContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => {
                  vibrate();
                  if (startChatWithContact) startChatWithContact(contact);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  marginBottom: 10, borderRadius: 16, background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
                  cursor: 'pointer', transition: 'all 0.2s', fontFamily: FONT
                }}>
                <div style={{ position: 'relative' }}>
                  <AvatarImg src={contact.avatar} size={44} style={{ borderRadius: 12 }} />
                  <div style={{
                    position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
                    borderRadius: 6, background: C.onlineStatusColor, border: `2px solid ${C.topBarBg}`
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
                    {contact.name}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                    Online
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Theme-aware animations & styles */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </main>
  );
});

export default HomeView;
