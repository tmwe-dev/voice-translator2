'use client';
import { memo, useState, useMemo, useEffect } from 'react';
import { VOICES, CONTEXTS, FONT, getLang, LANGS, vibrate, APP_VERSION } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';

// ═══════════════════════════════════════
// Minimalist theme palette
// ═══════════════════════════════════════
function getHomeColors(theme) {
  const palettes = {
    dark: {
      accent: '#8b5cf6', accent2: '#06b6d4', accent3: '#f59e0b',
      textPrimary: '#fafafa', textSecondary: 'rgba(250,250,250,0.60)',
      textMuted: 'rgba(250,250,250,0.35)',
      cardBg: 'rgba(255,255,255,0.03)', cardBorder: 'rgba(255,255,255,0.06)',
      iconTaxi: '#f59e0b', iconMondo: '#06b6d4', iconContatti: '#8b5cf6',
    },
    light: {
      accent: '#7c3aed', accent2: '#0891b2', accent3: '#d97706',
      textPrimary: '#18181b', textSecondary: 'rgba(24,24,27,0.60)',
      textMuted: 'rgba(24,24,27,0.35)',
      cardBg: 'rgba(0,0,0,0.02)', cardBorder: 'rgba(0,0,0,0.06)',
      iconTaxi: '#d97706', iconMondo: '#0891b2', iconContatti: '#7c3aed',
    },
    brown: {
      accent: '#D4A06A', accent2: '#A5D6A7', accent3: '#FF8A65',
      textPrimary: '#FFF8F0', textSecondary: 'rgba(255,248,240,0.60)',
      textMuted: 'rgba(255,248,240,0.35)',
      cardBg: 'rgba(255,255,255,0.03)', cardBorder: 'rgba(255,255,255,0.06)',
      iconTaxi: '#FF8A65', iconMondo: '#A5D6A7', iconContatti: '#D4A06A',
    },
    midnight: {
      accent: '#818cf8', accent2: '#22d3ee', accent3: '#fbbf24',
      textPrimary: '#e2e8f0', textSecondary: 'rgba(226,232,240,0.60)',
      textMuted: 'rgba(226,232,240,0.35)',
      cardBg: 'rgba(255,255,255,0.03)', cardBorder: 'rgba(255,255,255,0.06)',
      iconTaxi: '#fbbf24', iconMondo: '#22d3ee', iconContatti: '#818cf8',
    },
  };
  return palettes[theme] || palettes.dark;
}

// ═══════════════════════════════════════
// SVG Icons — modern, minimal line style
// ═══════════════════════════════════════
const TaxiIcon = ({ color, size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Car body */}
    <path d="M8 30V32C8 33.1 8.9 34 10 34H12C12 36.2 13.8 38 16 38C18.2 38 20 36.2 20 34H28C28 36.2 29.8 38 32 38C34.2 38 36 36.2 36 34H38C39.1 34 40 33.1 40 32V30" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Roof line */}
    <path d="M12 22L16 14H32L36 22" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Body bottom */}
    <path d="M8 30H40L38 24H36L32 22H16L12 22H10L8 24V30Z" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill={color + '15'}/>
    {/* Windshield */}
    <path d="M16 22L18 16H30L32 22" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    {/* Taxi sign on roof */}
    <rect x="20" y="10" width="8" height="4" rx="2" stroke={color} strokeWidth="1.8" fill={color + '25'}/>
    {/* Headlights */}
    <circle cx="11" cy="27" r="1.5" fill={color} opacity="0.7"/>
    <circle cx="37" cy="27" r="1.5" fill={color} opacity="0.7"/>
    {/* Wheels */}
    <circle cx="16" cy="34" r="2.5" stroke={color} strokeWidth="1.8" fill="none"/>
    <circle cx="32" cy="34" r="2.5" stroke={color} strokeWidth="1.8" fill="none"/>
  </svg>
);

const MondoIcon = ({ color, size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main circle */}
    <circle cx="24" cy="24" r="16" stroke={color} strokeWidth="2.2" fill={color + '08'}/>
    {/* Vertical meridian */}
    <ellipse cx="24" cy="24" rx="8" ry="16" stroke={color} strokeWidth="1.5" opacity="0.5" fill="none"/>
    {/* Horizontal lines */}
    <path d="M9 18H39" stroke={color} strokeWidth="1.3" opacity="0.35" strokeLinecap="round"/>
    <path d="M8 24H40" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round"/>
    <path d="M9 30H39" stroke={color} strokeWidth="1.3" opacity="0.35" strokeLinecap="round"/>
    {/* Translation pulse - small waves */}
    <path d="M38 12C40 10 43 11 43 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    <path d="M40 10C42 8 45 9 45 12" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.35"/>
  </svg>
);

const ContattiIcon = ({ color, size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main person */}
    <circle cx="24" cy="16" r="6" stroke={color} strokeWidth="2.2" fill={color + '10'}/>
    <path d="M14 36C14 30.5 18.5 26 24 26C29.5 26 34 30.5 34 36" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    {/* Left person (smaller) */}
    <circle cx="12" cy="20" r="3.5" stroke={color} strokeWidth="1.5" opacity="0.45" fill="none"/>
    <path d="M5 34C5 30 8 27 12 27" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.35"/>
    {/* Right person (smaller) */}
    <circle cx="36" cy="20" r="3.5" stroke={color} strokeWidth="1.5" opacity="0.45" fill="none"/>
    <path d="M43 34C43 30 40 27 36 27" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.35"/>
  </svg>
);

const HomeView = memo(function HomeView({ L, S, prefs, setPrefs, savePrefs, myLang, setMyLang, selectedMode, setSelectedMode,
  selectedContext, setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom, setView,
  theme, setTheme, contacts, fetchContacts, rejoinRoom, startChatWithContact, unlockAudio }) {

  const langInfo = getLang(prefs.lang);
  const [activeRooms, setActiveRooms] = useState([]);
  const [showLangPicker, setShowLangPicker] = useState(null);

  const C = useMemo(() => getHomeColors(theme), [theme]);

  // Check active rooms on mount
  useEffect(() => {
    async function checkActiveRooms() {
      try {
        let saved; try { saved = JSON.parse(localStorage.getItem('vt-active-rooms') || '[]'); } catch { saved = []; }
        if (saved.length === 0) { setActiveRooms([]); return; }
        const checked = [];
        for (const room of saved) {
          try {
            const res = await fetch('/api/room', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  const onlineContacts = useMemo(() => {
    if (!contacts || !Array.isArray(contacts)) return [];
    return contacts.filter(c => c.online === true);
  }, [contacts]);

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buongiorno';
    if (h < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  }, []);

  return (
    <main style={S.page} aria-label="BarTalk Home">
      <div style={{
        ...S.scrollCenter,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'space-between', minHeight: '100dvh',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 100, boxSizing: 'border-box',
      }}>

        {/* ═══ TOP: Greeting ═══ */}
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center', paddingTop: 24 }}>
          <div style={{
            fontSize: 14, fontWeight: 500, color: C.textMuted,
            fontFamily: FONT, letterSpacing: 0.5, marginBottom: 4,
          }}>
            {greeting}{prefs.name ? `, ${prefs.name}` : ''}
          </div>
          <div style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -1,
            background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accent2} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontFamily: FONT, marginBottom: 8,
          }}>
            BarTalk
          </div>
          <div style={{
            fontSize: 11, color: C.textMuted, fontFamily: 'monospace',
            letterSpacing: 0.5, opacity: 0.5,
          }}>
            {APP_VERSION}
          </div>
        </div>

        {/* ═══ CENTER: Main CTA + Language ═══ */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 32, width: '100%', maxWidth: 400, flex: 1,
          justifyContent: 'center', padding: '0 16px',
        }}>

          {/* Big Talk Button — clean circle */}
          <button
            onClick={() => { vibrate(); if (unlockAudio) unlockAudio(); handleCreateRoom(); }}
            style={{
              width: 120, height: 120, borderRadius: '50%', border: 'none',
              background: `linear-gradient(145deg, ${C.accent}, ${C.accent2})`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              boxShadow: `0 8px 40px ${C.accent}50, 0 0 80px ${C.accent}15`,
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'white', fontFamily: FONT, letterSpacing: 0.5 }}>
              PARLA
            </span>
          </button>

          {/* Language selector — allowed to have border */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            position: 'relative',
          }}>
            <button
              style={{
                padding: '8px 16px', borderRadius: 24,
                background: showLangPicker === 'my' ? C.accent + '20' : 'transparent',
                border: `1px solid ${C.accent}40`,
                color: C.accent, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: FONT,
                WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s',
              }}
              onClick={() => { vibrate(); setShowLangPicker(showLangPicker === 'my' ? null : 'my'); }}
            >
              {langInfo.flag} {langInfo.name}
            </button>

            <span style={{ fontSize: 16, color: C.textMuted }}>→</span>

            <div style={{
              padding: '8px 16px', borderRadius: 24,
              border: `1px solid ${C.accent2}30`,
              color: C.accent2, fontSize: 13, fontWeight: 500,
              fontFamily: FONT, opacity: 0.6,
            }}>
              🌐 Auto
            </div>

            {/* Language picker dropdown */}
            {showLangPicker && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowLangPicker(null)} />
                <div style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginTop: 8, zIndex: 100, width: 260,
                  background: theme === 'light' ? '#fff' : '#1a1a2e',
                  border: `1px solid ${C.accent}25`, borderRadius: 16,
                  maxHeight: 280, overflowY: 'auto', padding: 6,
                  boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
                }}>
                  {LANGS.map(l => {
                    const isSelected = l.code === prefs.lang;
                    return (
                      <button key={l.code}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                          padding: '10px 12px', border: 'none', borderRadius: 10,
                          background: isSelected ? C.accent + '20' : 'transparent',
                          color: isSelected ? C.accent : C.textPrimary,
                          fontSize: 13, fontWeight: isSelected ? 700 : 400,
                          cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                        }}
                        onClick={() => {
                          vibrate(); savePrefs({ ...prefs, lang: l.code }); setShowLangPicker(null);
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{l.flag}</span>
                        <span>{l.name}</span>
                        {isSelected && <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ═══ BOTTOM: Navigation Icons — large, borderless ═══ */}
        <div style={{
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          width: '100%', maxWidth: 400, padding: '0 8px', marginBottom: 8,
        }}>
          {/* TaxiTalk */}
          <button
            onClick={() => { vibrate(); setView('speaker'); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: 12, WebkitTapHighlightColor: 'transparent',
              transition: 'opacity 0.2s',
            }}
          >
            <TaxiIcon color={C.iconTaxi} size={44} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, fontFamily: FONT }}>
              TaxiTalk
            </span>
          </button>

          {/* Mondo */}
          <button
            onClick={() => { vibrate(); setView('mondo'); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: 12, WebkitTapHighlightColor: 'transparent',
              transition: 'opacity 0.2s',
            }}
          >
            <MondoIcon color={C.iconMondo} size={44} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, fontFamily: FONT }}>
              Mondo
            </span>
          </button>

          {/* Contatti */}
          <button
            onClick={() => { vibrate(); setView('contacts'); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: 12, WebkitTapHighlightColor: 'transparent',
              transition: 'opacity 0.2s',
            }}
          >
            <ContattiIcon color={C.iconContatti} size={44} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, fontFamily: FONT }}>
              Contatti
            </span>
          </button>

          {/* Invita QR */}
          <button
            onClick={() => { vibrate(); setView('quickinvite'); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: 12, WebkitTapHighlightColor: 'transparent',
              transition: 'opacity 0.2s',
            }}
          >
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="8" width="12" height="12" rx="2" stroke={C.textSecondary} strokeWidth="2" fill="none"/>
              <rect x="28" y="8" width="12" height="12" rx="2" stroke={C.textSecondary} strokeWidth="2" fill="none"/>
              <rect x="8" y="28" width="12" height="12" rx="2" stroke={C.textSecondary} strokeWidth="2" fill="none"/>
              <rect x="11" y="11" width="6" height="6" rx="1" fill={C.textSecondary} opacity="0.4"/>
              <rect x="31" y="11" width="6" height="6" rx="1" fill={C.textSecondary} opacity="0.4"/>
              <rect x="11" y="31" width="6" height="6" rx="1" fill={C.textSecondary} opacity="0.4"/>
              <path d="M28 28H32V32" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round"/>
              <path d="M36 28V32H40V40H36" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M28 36H32V40" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, fontFamily: FONT }}>
              Invita
            </span>
          </button>
        </div>

        {/* ═══ Active Rooms (only if any) ═══ */}
        {activeRooms.length > 0 && (
          <div style={{ width: '100%', maxWidth: 400, padding: '0 16px' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.textMuted,
              letterSpacing: 1, textTransform: 'uppercase', fontFamily: FONT, marginBottom: 10,
            }}>
              Chat attive
            </div>
            {activeRooms.map((room) => {
              const timeAgo = Math.floor((Date.now() - room.leftAt) / 60000);
              const timeStr = timeAgo < 1 ? 'ora' : timeAgo < 60 ? `${timeAgo}m` : `${Math.floor(timeAgo / 60)}h`;
              return (
                <div key={room.roomId}
                  onClick={() => { vibrate(); if (rejoinRoom) rejoinRoom(room.roomId); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    marginBottom: 8, borderRadius: 14,
                    background: C.cardBg, cursor: 'pointer',
                    transition: 'all 0.2s', fontFamily: FONT,
                  }}
                >
                  <div style={{ display: 'flex', gap: 4, fontSize: 16 }}>
                    {[...new Set(room.members?.map(m => getLang(m.lang).flag) || [])].map((flag, i) => (
                      <span key={i}>{flag}</span>
                    ))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: C.textPrimary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {room.members?.map(m => m.name).join(', ') || room.roomId}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{timeStr}</div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </main>
  );
});

export default HomeView;
