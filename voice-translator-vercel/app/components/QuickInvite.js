'use client';
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { APP_URL, LANGS, FONT, vibrate } from '../lib/constants.js';
import getStyles from '../lib/styles.js';

// ═══════════════════════════════════════════════════════════════
// QuickInvite — "Barcode" instant invite
//
// 1 schermata sola:
//   • Scegli lingua (tua)
//   • Scegli genere voce (lui/lei → voce predefinita)
//   • [opzionale] cambia voce
//   • → Crea room istantaneo → QR code appare subito
//   • L'invitato scansiona → entra nella stanza senza setup
//   • Tu sei già nella stanza e puoi parlare/scrivere
// ═══════════════════════════════════════════════════════════════

const COMMON_LANGS = ['it','en','es','fr','de','pt','zh','ja','ko','ar','hi','ru','tr','th','vi'];

// Voci predefinite per genere
const VOICE_PRESETS = {
  male:   { voice: 'echo',  label: 'Echo (Lui)' },
  female: { voice: 'nova',  label: 'Nova (Lei)' },
};
const ALL_VOICES = [
  { id: 'alloy',   label: 'Alloy',   gender: 'neutral' },
  { id: 'echo',    label: 'Echo',    gender: 'male' },
  { id: 'fable',   label: 'Fable',   gender: 'neutral' },
  { id: 'onyx',    label: 'Onyx',    gender: 'male' },
  { id: 'nova',    label: 'Nova',    gender: 'female' },
  { id: 'shimmer', label: 'Shimmer', gender: 'female' },
];

function QuickInvite({ L, S, prefs, theme, setView, handleCreateRoom, roomId, setViewAfterCreate }) {
  const C = getStyles(theme);

  // State
  const [lang, setLang] = useState(prefs?.lang || 'it');
  const [gender, setGender] = useState(prefs?.gender || '');
  const [voice, setVoice] = useState(prefs?.voice || 'nova');
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState(roomId || '');
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef(null);

  // Quando seleziona genere → imposta voce default
  const selectGender = useCallback((g) => {
    vibrate();
    setGender(g);
    setVoice(VOICE_PRESETS[g]?.voice || 'nova');
    setShowVoicePicker(false);
  }, []);

  // Crea room istantanea
  const createInstant = useCallback(async () => {
    if (!lang || !gender) return;
    vibrate();
    setCreating(true);
    try {
      const room = await handleCreateRoom();
      if (room?.id || room?.roomId) {
        const id = room.id || room.roomId;
        setCreatedRoomId(id);
        setCreated(true);
      }
    } catch (e) {
      console.warn('[QuickInvite] Create failed:', e);
    }
    setCreating(false);
  }, [lang, gender, handleCreateRoom]);

  // Auto-create quando genere è selezionato
  useEffect(() => {
    if (gender && lang && !created && !creating && !createdRoomId) {
      createInstant();
    }
  }, [gender, lang, created, creating, createdRoomId, createInstant]);

  // Genera QR code
  useEffect(() => {
    if (!createdRoomId || !canvasRef.current) return;
    const url = `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1`;
    let cancelled = false;

    import('qrcode').then(QRCode => {
      if (cancelled) return;
      QRCode.toCanvas(canvasRef.current, url, {
        width: 220,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }, () => {});
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [createdRoomId, lang]);

  // Copy link
  const copyLink = useCallback(() => {
    if (!createdRoomId) return;
    const url = `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1`;
    navigator.clipboard.writeText(url).then(() => {
      vibrate();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [createdRoomId, lang]);

  // Entra nella stanza
  const enterRoom = useCallback(() => {
    vibrate();
    if (setViewAfterCreate) setViewAfterCreate();
    else setView('room');
  }, [setView, setViewAfterCreate]);

  // Lingua info
  const langInfo = LANGS.find(l => l.code === lang);

  return (
    <div style={{
      ...S.page,
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.pageBg || '#060810', fontFamily: FONT,
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', flexShrink: 0,
      }}>
        <button onClick={() => setView('home')}
          style={{
            width: 36, height: 36, borderRadius: 12, cursor: 'pointer',
            background: C.btnBg, border: `1px solid ${C.btnBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <span style={{ fontSize: 16 }}>{'‹'}</span>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.5 }}>
            Invita
          </div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Scansiona il QR per entrare</div>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ═══ STEP 1: Lingua ═══ */}
        <div style={{
          padding: 16, borderRadius: 18,
          background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            La tua lingua
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {COMMON_LANGS.map(code => {
              const info = LANGS.find(l => l.code === code);
              const sel = code === lang;
              return (
                <button key={code} onClick={() => { vibrate(); setLang(code); }}
                  style={{
                    padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                    background: sel ? 'linear-gradient(135deg, #26D9B0, #8B6AFF)' : 'transparent',
                    border: sel ? 'none' : `1px solid ${C.topBarBorder}`,
                    color: sel ? '#fff' : C.textSecondary,
                    fontSize: 12, fontWeight: sel ? 700 : 500, fontFamily: FONT,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                  <span style={{ fontSize: 15 }}>{info?.flag}</span>
                  {info?.name || code}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ STEP 2: Genere voce (Lui / Lei) ═══ */}
        <div style={{
          padding: 16, borderRadius: 18,
          background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            La tua voce
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: showVoicePicker ? 12 : 0 }}>
            {/* Lui */}
            <button onClick={() => selectGender('male')}
              style={{
                flex: 1, padding: '16px 12px', borderRadius: 16, cursor: 'pointer',
                background: gender === 'male'
                  ? 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)'
                  : C.btnBg,
                border: gender === 'male' ? 'none' : `1px solid ${C.topBarBorder}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
              }}>
              <span style={{ fontSize: 32 }}>{'👨'}</span>
              <span style={{
                fontSize: 14, fontWeight: 700, fontFamily: FONT,
                color: gender === 'male' ? '#fff' : C.textPrimary,
              }}>Lui</span>
              <span style={{
                fontSize: 10, color: gender === 'male' ? 'rgba(255,255,255,0.7)' : C.textMuted,
              }}>Voce: {VOICE_PRESETS.male.label}</span>
            </button>

            {/* Lei */}
            <button onClick={() => selectGender('female')}
              style={{
                flex: 1, padding: '16px 12px', borderRadius: 16, cursor: 'pointer',
                background: gender === 'female'
                  ? 'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)'
                  : C.btnBg,
                border: gender === 'female' ? 'none' : `1px solid ${C.topBarBorder}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
              }}>
              <span style={{ fontSize: 32 }}>{'👩'}</span>
              <span style={{
                fontSize: 14, fontWeight: 700, fontFamily: FONT,
                color: gender === 'female' ? '#fff' : C.textPrimary,
              }}>Lei</span>
              <span style={{
                fontSize: 10, color: gender === 'female' ? 'rgba(255,255,255,0.7)' : C.textMuted,
              }}>Voce: {VOICE_PRESETS.female.label}</span>
            </button>
          </div>

          {/* Voce alternativa (opzionale) */}
          {gender && (
            <button onClick={() => { vibrate(); setShowVoicePicker(!showVoicePicker); }}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: `1px dashed ${C.topBarBorder}`,
                fontFamily: FONT, fontSize: 11, color: C.textMuted,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                marginTop: 8,
              }}>
              {'🎵'} Voce: {ALL_VOICES.find(v => v.id === voice)?.label || voice}
              <span style={{ marginLeft: 'auto', fontSize: 10 }}>{showVoicePicker ? '▲' : '▼'}</span>
            </button>
          )}

          {showVoicePicker && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {ALL_VOICES.map(v => (
                <button key={v.id} onClick={() => { vibrate(); setVoice(v.id); setShowVoicePicker(false); }}
                  style={{
                    padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
                    background: v.id === voice ? 'linear-gradient(135deg, #26D9B0, #8B6AFF)' : 'transparent',
                    border: v.id === voice ? 'none' : `1px solid ${C.topBarBorder}`,
                    color: v.id === voice ? '#fff' : C.textSecondary,
                    fontSize: 12, fontWeight: v.id === voice ? 700 : 500, fontFamily: FONT,
                  }}>
                  {v.label}
                  <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.6 }}>
                    {v.gender === 'male' ? '♂' : v.gender === 'female' ? '♀' : '◎'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ QR CODE — appare quando room è creata ═══ */}
        {creating && (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', margin: '0 auto 12px',
              border: '3px solid rgba(38,217,176,0.2)', borderTopColor: '#26D9B0',
              animation: 'vtSpin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: C.textMuted }}>Creazione stanza...</div>
          </div>
        )}

        {createdRoomId && !creating && (
          <div style={{
            padding: 20, borderRadius: 22,
            background: C.topBarBg, border: `1px solid ${C.topBarBorder}`,
            textAlign: 'center',
          }}>
            {/* QR */}
            <div style={{ marginBottom: 12 }}>
              <canvas ref={canvasRef}
                style={{
                  borderRadius: 16, background: '#fff', padding: 10,
                  display: 'block', margin: '0 auto', maxWidth: 220,
                }} />
            </div>

            {/* Room code */}
            <div style={{
              fontSize: 28, fontWeight: 800, letterSpacing: 6,
              color: '#26D9B0', marginBottom: 4,
            }}>
              {createdRoomId}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>
              {langInfo?.flag} {langInfo?.name} · {ALL_VOICES.find(v => v.id === voice)?.label}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={copyLink}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                  background: copied ? 'linear-gradient(135deg, #10B981, #34D399)' : C.btnBg,
                  border: copied ? 'none' : `1px solid ${C.topBarBorder}`,
                  color: copied ? '#fff' : C.textPrimary,
                  fontFamily: FONT, fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {copied ? '✓ Copiato!' : '🔗 Copia link'}
              </button>
              <button onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'BarChat — Entra nella stanza',
                    url: `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1`,
                  }).catch(() => {});
                } else { copyLink(); }
              }}
                style={{
                  padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                  background: C.btnBg, border: `1px solid ${C.topBarBorder}`,
                  color: C.textPrimary, fontFamily: FONT, fontSize: 13, fontWeight: 700,
                }}>
                {'📤'}
              </button>
            </div>

            {/* Entra nella stanza */}
            <button onClick={enterRoom}
              style={{
                width: '100%', padding: '16px 0', borderRadius: 16, cursor: 'pointer',
                border: 'none',
                background: 'linear-gradient(135deg, #26D9B0 0%, #8B6AFF 50%, #A78BFA 100%)',
                color: '#fff', fontFamily: FONT, fontSize: 16, fontWeight: 800,
                letterSpacing: -0.3,
                boxShadow: '0 8px 32px rgba(38,217,176,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              {'💬'} Entra e inizia a parlare
            </button>

            <div style={{
              fontSize: 11, color: C.textMuted, marginTop: 12, lineHeight: 1.5,
            }}>
              L'invitato scansiona il QR o apre il link — entra subito nella stanza senza registrazione.
            </div>
          </div>
        )}

        {/* Istruzioni se non ha ancora selezionato */}
        {!gender && !creating && !createdRoomId && (
          <div style={{ textAlign: 'center', padding: '20px 16px', color: C.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>{'📱'}</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              Seleziona lingua e voce — il QR code apparirà automaticamente.
              L'invitato lo scansiona ed è subito nella stanza.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes vtSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default memo(QuickInvite);
