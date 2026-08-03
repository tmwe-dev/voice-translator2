'use client';
import { memo, useState, useMemo, useEffect } from 'react';
import { FONT, getLang, LANGS, vibrate } from '../lib/constants.js';
import { PALETTE } from '../lib/palette.js';

// ═══════════════════════════════════════
// Theme palette (multi-theme support)
// ═══════════════════════════════════════
function getHomeColors(theme) {
  const palettes = {
    dark: {
      accent: PALETTE.purple, accent2: PALETTE.cyan, accent3: PALETTE.amber,
      textPrimary: '#fafafa', textSecondary: 'rgba(250,250,250,0.60)',
      textMuted: 'rgba(250,250,250,0.35)',
      cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.08)',
    },
    light: {
      accent: '#7c3aed', accent2: '#0891b2', accent3: '#d97706',
      textPrimary: '#18181b', textSecondary: 'rgba(24,24,27,0.60)',
      textMuted: 'rgba(24,24,27,0.35)',
      cardBg: 'rgba(0,0,0,0.02)', cardBorder: 'rgba(0,0,0,0.08)',
    },
    brown: {
      accent: '#D4A06A', accent2: '#A5D6A7', accent3: '#FF8A65',
      textPrimary: '#FFF8F0', textSecondary: 'rgba(255,248,240,0.60)',
      textMuted: 'rgba(255,248,240,0.35)',
      cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.08)',
    },
    midnight: {
      accent: '#818cf8', accent2: '#22d3ee', accent3: '#fbbf24',
      textPrimary: '#e2e8f0', textSecondary: 'rgba(226,232,240,0.60)',
      textMuted: 'rgba(226,232,240,0.35)',
      cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.08)',
    },
  };
  return palettes[theme] || palettes.dark;
}

// ═══════════════════════════════════════
// Action card data
// ═══════════════════════════════════════
const ACTIONS = [
  {
    id: 'face-to-face',
    icon: '📱',
    title: 'Parla con chi hai davanti',
    desc: 'Mostra il QR e parlate ciascuno nella propria lingua',
    primary: true,
  },
  {
    id: 'invite',
    icon: '✉️',
    title: 'Invita una persona',
    desc: 'Invia un link via WhatsApp, SMS o email',
  },
  {
    id: 'videocall',
    icon: '📹',
    title: 'Videochiamata tradotta',
    desc: 'Chiamata video con sottotitoli e voce tradotta',
  },
  {
    id: 'taxitalk',
    icon: '🚕',
    title: 'TaxiTalk',
    desc: 'Comunica la destinazione al tassista',
  },
];

const HomeView = memo(function HomeView({ L, S, prefs, setPrefs, savePrefs, myLang, setMyLang, selectedMode, setSelectedMode,
  selectedContext, setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom, setView,
  theme, setTheme, contacts, fetchContacts, rejoinRoom, startChatWithContact, unlockAudio }) {

  const langInfo = getLang(prefs.lang);
  const [activeRooms, setActiveRooms] = useState([]);
  const [showLangPicker, setShowLangPicker] = useState(false);

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

  // Handle action card clicks
  function handleAction(actionId) {
    vibrate();
    if (unlockAudio) unlockAudio();
    switch (actionId) {
      case 'face-to-face':
        handleCreateRoom();
        break;
      case 'invite':
        setView('quickinvite');
        break;
      case 'videocall':
        handleCreateRoom(); // Creates room, video activated from within
        break;
      case 'taxitalk':
        setView('speaker');
        break;
    }
  }

  return (
    <main style={S.page} aria-label="BarTalk Home">
      <div style={{
        ...S.scrollCenter,
        display: 'flex', flexDirection: 'column',
        minHeight: '100dvh',
        paddingTop: 'max(24px, env(safe-area-inset-top))',
        paddingBottom: 100, boxSizing: 'border-box',
        padding: '0 20px',
      }}>

        {/* ═══ Header ═══ */}
        <div style={{ paddingTop: 'max(24px, env(safe-area-inset-top))', marginBottom: 28 }}>
          {/* Language selector */}
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <button
              onClick={() => { vibrate(); setShowLangPicker(!showLangPicker); }}
              style={{
                padding: '8px 14px', borderRadius: 20,
                background: C.cardBg, border: `1px solid ${C.cardBorder}`,
                color: C.textPrimary, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: FONT, display: 'flex',
                alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>{langInfo.flag}</span>
              {langInfo.name}
              <span style={{ fontSize: 10, opacity: 0.5 }}>▼</span>
            </button>

            {showLangPicker && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowLangPicker(false)} />
                <div style={{
                  position: 'absolute', top: '100%', left: 0,
                  marginTop: 6, zIndex: 100, width: 260,
                  background: theme === 'light' ? '#fff' : '#1a1a2e',
                  border: `1px solid ${C.accent}25`, borderRadius: 14,
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
                          vibrate(); savePrefs({ ...prefs, lang: l.code }); setShowLangPicker(false);
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

          {/* Title */}
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -0.5,
            color: C.textPrimary, fontFamily: FONT,
            margin: 0, lineHeight: 1.2,
          }}>
            Con chi vuoi parlare?
          </h1>
        </div>

        {/* ═══ Primary Action — Face to Face ═══ */}
        <button
          onClick={() => handleAction('face-to-face')}
          style={{
            width: '100%', padding: '20px 18px', borderRadius: 18,
            background: `linear-gradient(145deg, ${C.accent}18, ${C.accent2}12)`,
            border: `1.5px solid ${C.accent}35`,
            cursor: 'pointer', textAlign: 'left', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 16,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(145deg, ${C.accent}, ${C.accent2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, flexShrink: 0,
            boxShadow: `0 4px 20px ${C.accent}40`,
          }}>
            📱
          </div>
          <div>
            <div style={{
              fontSize: 17, fontWeight: 700, color: C.textPrimary,
              fontFamily: FONT, marginBottom: 3,
            }}>
              Parla con chi hai davanti
            </div>
            <div style={{
              fontSize: 13, color: C.textSecondary, fontFamily: FONT, lineHeight: 1.4,
            }}>
              Mostra il QR e parlate ciascuno nella propria lingua
            </div>
          </div>
        </button>

        {/* ═══ Secondary Actions ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {ACTIONS.filter(a => !a.primary).map(action => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 14,
                background: C.cardBg, border: `1px solid ${C.cardBorder}`,
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'background-color 0.15s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = C.accent + '10'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = C.cardBg}
            >
              <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{action.icon}</span>
              <div>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: C.textPrimary,
                  fontFamily: FONT, marginBottom: 1,
                }}>
                  {action.title}
                </div>
                <div style={{
                  fontSize: 12, color: C.textMuted, fontFamily: FONT,
                }}>
                  {action.desc}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* ═══ Community Section ═══ */}
        <div style={{
          padding: '18px 16px', borderRadius: 16,
          background: C.cardBg, border: `1px solid ${C.cardBorder}`,
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase', color: C.textMuted,
            fontFamily: FONT, marginBottom: 10,
          }}>
            Community BarTalk
          </div>
          <div style={{
            fontSize: 13, color: C.textSecondary, fontFamily: FONT,
            lineHeight: 1.5, marginBottom: 14,
          }}>
            Partecipa a discussioni internazionali senza barriere linguistiche.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { vibrate(); setView('mondo'); }}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10,
                background: C.accent2 + '15', border: `1px solid ${C.accent2}30`,
                color: C.accent2, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              Scopri
            </button>
            <button
              onClick={() => { vibrate(); setView('contacts'); }}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10,
                background: 'transparent', border: `1px solid ${C.cardBorder}`,
                color: C.textSecondary, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              Contatti
            </button>
          </div>
        </div>

        {/* ═══ Active Rooms ═══ */}
        {activeRooms.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.textMuted,
              letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT, marginBottom: 10,
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
                    background: C.cardBg, border: `1px solid ${C.cardBorder}`,
                    cursor: 'pointer', fontFamily: FONT,
                    transition: 'background-color 0.15s',
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
