'use client';
import { memo, useState, useMemo, useEffect } from 'react';
import { FONT, getLang, LANGS, vibrate } from '../lib/constants.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import { IconQR, IconMail, IconVideoCall, IconCar } from './Icons.js';
import Icon from './Icon.js';
import { BatteryPillSlot } from './BatteryPill.js';
import PrimaProva, { primaProvaGiaFatta } from './PrimaProva.js'; // b.96

// ═══════════════════════════════════════
// Theme palette (multi-theme support)
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// Action card data
// ═══════════════════════════════════════
const ACTIONS = [
  {
    id: 'face-to-face',
    icon: 'qr',
    title: 'Parla con chi hai davanti',
    desc: 'Mostra il QR e parlate ciascuno nella propria lingua',
    primary: true,
  },
  {
    id: 'invite',
    icon: 'mail',
    title: 'Invita una persona',
    desc: 'Invia un link via WhatsApp, SMS o email',
  },
  {
    id: 'videocall',
    icon: 'video',
    title: 'Videochiamata tradotta',
    desc: 'Chiamata video con sottotitoli e voce tradotta',
  },
  {
    id: 'taxitalk',
    icon: 'car',
    title: 'TaxiTalk',
    desc: 'Comunica la destinazione al tassista',
  },
  {
    // b.102 — porta separata dalla videochiamata a due, che resta com'e.
    id: 'stanza-video',
    icon: 'video',
    title: 'Stanza video di gruppo',
    desc: 'Fino a 8 persone, ognuno parla e legge nella sua lingua',
  },
  {
    // b.99 — regalare minuti esisteva e funzionava, ma stava in fondo alla
    // pagina del credito: nessuno ci arrivava per caso. Se una funzione
    // non ha una voce dove le persone guardano, per loro non esiste.
    id: 'regala',
    icon: 'gift',
    title: 'Regala minuti a qualcuno',
    desc: 'Un link con dentro il tuo credito, per chi non ce l’ha',
  },
];



const HomeView = memo(function HomeView({ selectedMode, setSelectedMode,
  selectedContext, setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom,
  contacts, fetchContacts, rejoinRoom, startChatWithContact, unlockAudio }) {
  const { L, S, prefs, setPrefs, savePrefs, myLang, setMyLang, setView, theme, setTheme } = useApp();

  const langInfo = getLang(prefs.lang);
  const [activeRooms, setActiveRooms] = useState([]);
  const [showLangPicker, setShowLangPicker] = useState(false);
  // b.96 — la prima prova si mostra una volta sola, e solo al primo avvio
  const [mostraPrimaProva, setMostraPrimaProva] = useState(false);
  useEffect(() => { setMostraPrimaProva(!primaProvaGiaFatta()); }, []);

  // I colori vengono dal tema attivo: un'unica verità, sei temi coerenti
  const C = useMemo(() => ({
    accent: S.colors.accent1, accent2: S.colors.accent2, accent3: S.colors.accent3,
    textPrimary: S.colors.textPrimary, textSecondary: S.colors.textSecondary,
    textMuted: S.colors.textMuted, cardBg: S.colors.cardBg, cardBorder: S.colors.cardBorder,
  }), [S]);

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
      case 'stanza-video':
        // Serve una stanza prima di poterci stare in video: si crea, e
        // dalla sala d'attesa si entra col codice da condividere.
        handleCreateRoom();
        break;
      case 'regala':
        // La pagina del credito e gia il posto giusto: c'e il saldo, e i
        // minuti regalati si scalano da li. Non serve una schermata nuova.
        setView('credits');
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
        /* Colonna unica allineata: su desktop niente card che dilagano */
        width: '100%', maxWidth: 680, margin: '0 auto',
      }}>

        {/* ═══ Header ═══ */}
        <div style={{ paddingTop: 'max(24px, env(safe-area-inset-top))', marginBottom: 24 }}>
          {/* Language selector + batteria credito */}
          <div style={{ position: 'relative', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <BatteryPillSlot />
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
                  background: theme === 'dawn' ? '#fff' : '#0a0f1f',
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

          {/* Striscia dei fatti: arricchisce senza appesantire */}
          <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
            {/* Il numero si conta, non si scrive: diceva 32 quando erano 44. */}
            {[`${LANGS.length} lingue`, 'Crittografia E2E', 'Voce naturale'].map(f => (
              <span key={f} style={{
                fontSize: 11, fontWeight: 650, color: C.textMuted, fontFamily: FONT,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: C.accent2, display: 'inline-block' }} />
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* ── INIZIO b.96 — la prima traduzione, entro dieci secondi ──
            Il primo avvio era: benvenuto, sei dentro, arrangiati. Chi non
            prova nei primi secondi non torna. Questa scheda fa SENTIRE
            l'app invece di spiegarla, e poi sparisce per sempre. */}
        {mostraPrimaProva && (
          <PrimaProva
            onChiudi={() => setMostraPrimaProva(false)}
            onIniziaDavvero={() => handleAction('face-to-face')}
          />
        )}
        {/* ── FINE b.96 ── */}

        {/* ═══ Le 4 azioni: righe in UNA card (spec sciame) ═══
            Tile gradiente solo sulla primaria; le altre tenui.
            Compatta, leggibile, zero card che dilagano. */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.cardBorder}`,
          borderRadius: 18, padding: '2px 14px', marginBottom: 12,
        }}>
          {ACTIONS.map((action, idx) => {
            const tilePieno = !!action.primary;
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '13px 2px', background: 'none', textAlign: 'left',
                  border: 'none', cursor: 'pointer',
                  borderBottom: idx < ACTIONS.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                  transition: 'opacity 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = 0.82}
                onMouseOut={(e) => e.currentTarget.style.opacity = 1}
              >
                <span style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
                  background: tilePieno ? `linear-gradient(145deg, ${C.accent}, ${C.accent2})` : C.cardBg,
                  border: tilePieno ? 'none' : `1px solid ${C.cardBorder}`,
                  color: tilePieno ? '#fff' : C.textSecondary,
                  boxShadow: tilePieno ? `0 4px 14px -4px ${C.accent}70` : 'none',
                }}>
                  {action.icon === 'qr' ? <IconQR size={20} />
                    : action.icon === 'mail' ? <IconMail size={20} />
                    : action.icon === 'video' ? <IconVideoCall size={20} />
                    : action.icon === 'gift' ? <Icon name="gift" size={20} color={C.accent} />
                    : <IconCar size={20} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.textPrimary, fontFamily: FONT }}>
                    {action.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, fontFamily: FONT, marginTop: 2 }}>
                    {action.desc}
                  </span>
                </span>
                <span style={{ color: C.textMuted, fontSize: 14, flexShrink: 0 }}>›</span>
              </button>
            );
          })}
        </div>

        {/* ═══ Il mondo ora — la Community come riga viva ═══ */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.cardBorder}`,
          borderRadius: 18, padding: '2px 14px', marginBottom: 20,
        }}>
          <button
            onClick={() => { vibrate(); setView('mondo'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '13px 2px', background: 'none', textAlign: 'left',
              border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0, width: 40, justifyContent: 'center' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 5, height: 5, borderRadius: 3, background: C.accent2,
                  boxShadow: `0 0 6px ${C.accent2}80`,
                  animation: `vtBattPulse 2.4s ${i * 0.3}s ease-in-out infinite`,
                }} />
              ))}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.textPrimary, fontFamily: FONT }}>
                Il mondo ora
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, fontFamily: FONT, marginTop: 2 }}>
                Stanze aperte, discussioni senza barriere
              </span>
            </span>
            <span style={{ color: C.textMuted, fontSize: 14, flexShrink: 0 }}>›</span>
          </button>
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
