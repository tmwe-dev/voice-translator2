'use client';
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { APP_URL, LANGS, FONT, vibrate } from '../lib/constants.js';

// ═══════════════════════════════════════════════════════════════
// QuickInvite — Dark Ambient Glassmorphism QR Invite
// ═══════════════════════════════════════════════════════════════

const COMMON_LANGS = ['it','en','es','fr','de','pt','zh','ja','ko','ar','hi','ru','tr','th','vi'];

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

// Dark glass styles
const glass = {
  card: {
    background: 'linear-gradient(160deg, rgba(14,18,35,0.75) 0%, rgba(10,14,28,0.85) 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    backdropFilter: 'blur(24px) saturate(1.1)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  btn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  text: { primary: '#F2F4F7', secondary: 'rgba(242,244,247,0.75)', muted: 'rgba(242,244,247,0.50)' },
};

function QuickInvite({ L, S, prefs, theme, setView, handleCreateRoom, roomId, setViewAfterCreate }) {
  const [lang, setLang] = useState(prefs?.lang || 'it');
  const [gender, setGender] = useState(prefs?.gender || '');
  const [voice, setVoice] = useState(prefs?.voice || 'nova');
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState(roomId || '');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  const selectGender = useCallback((g) => {
    vibrate(); setGender(g); setVoice(VOICE_PRESETS[g]?.voice || 'nova'); setShowVoicePicker(false);
  }, []);

  const createInstant = useCallback(async () => {
    if (!lang || !gender) return;
    vibrate(); setCreating(true);
    try {
      const room = await handleCreateRoom();
      if (room?.id || room?.roomId) { setCreatedRoomId(room.id || room.roomId); setCreated(true); }
    } catch (e) { console.warn('[QuickInvite] Create failed:', e); }
    setCreating(false);
  }, [lang, gender, handleCreateRoom]);

  useEffect(() => {
    if (gender && lang && !created && !creating && !createdRoomId) createInstant();
  }, [gender, lang, created, creating, createdRoomId, createInstant]);

  useEffect(() => {
    if (!createdRoomId || !canvasRef.current) return;
    const url = `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1`;
    let cancelled = false;
    import('qrcode').then(QRCode => {
      if (cancelled) return;
      QRCode.toCanvas(canvasRef.current, url, {
        width: 220, margin: 2,
        color: { dark: '#060810', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }, () => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [createdRoomId, lang]);

  const copyLink = useCallback(() => {
    if (!createdRoomId) return;
    const url = `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1`;
    navigator.clipboard.writeText(url).then(() => {
      vibrate(); setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [createdRoomId, lang]);

  const enterRoom = useCallback(() => {
    vibrate();
    if (setViewAfterCreate) setViewAfterCreate();
    else setView('room');
  }, [setView, setViewAfterCreate]);

  const langInfo = LANGS.find(l => l.code === lang);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: 'linear-gradient(160deg, #060810 0%, #0A0E1A 30%, #0D1020 60%, #080A14 100%)',
      fontFamily: FONT,
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', flexShrink: 0,
      }}>
        <button onClick={() => setView('home')}
          style={{
            width: 36, height: 36, borderRadius: 12, cursor: 'pointer',
            ...glass.btn,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: glass.text.secondary, fontSize: 18,
          }}>
          {'‹'}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 18, fontWeight: 300, letterSpacing: -0.5,
            background: 'linear-gradient(135deg, #26D9B0, #8B6AFF)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Invita
          </div>
          <div style={{ fontSize: 11, color: glass.text.muted }}>Scansiona il QR per entrare</div>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ═══ LINGUA ═══ */}
        <div style={{ padding: 16, borderRadius: 18, ...glass.card }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#26D9B0', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2 }}>
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
                    background: sel ? 'linear-gradient(135deg, #26D9B0, #1EB898)' : 'rgba(255,255,255,0.03)',
                    border: sel ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    color: sel ? '#000' : glass.text.secondary,
                    fontSize: 12, fontWeight: sel ? 700 : 400, fontFamily: FONT,
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.2s',
                  }}>
                  <span style={{ fontSize: 15 }}>{info?.flag}</span>
                  {info?.name || code}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ GENERE VOCE ═══ */}
        <div style={{ padding: 16, borderRadius: 18, ...glass.card }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8B6AFF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            La tua voce
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: showVoicePicker ? 12 : 0 }}>
            <button onClick={() => selectGender('male')}
              style={{
                flex: 1, padding: '20px 12px', borderRadius: 16, cursor: 'pointer',
                background: gender === 'male'
                  ? 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.15))'
                  : 'rgba(255,255,255,0.03)',
                border: gender === 'male' ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                transition: 'all 0.25s',
                boxShadow: gender === 'male' ? '0 4px 20px rgba(59,130,246,0.15)' : 'none',
              }}>
              <span style={{ fontSize: 36 }}>{'👨'}</span>
              <span style={{ fontSize: 15, fontWeight: 600, fontFamily: FONT, color: gender === 'male' ? '#93C5FD' : glass.text.primary }}>Lui</span>
              <span style={{ fontSize: 10, color: gender === 'male' ? 'rgba(147,197,253,0.7)' : glass.text.muted }}>{VOICE_PRESETS.male.label}</span>
            </button>

            <button onClick={() => selectGender('female')}
              style={{
                flex: 1, padding: '20px 12px', borderRadius: 16, cursor: 'pointer',
                background: gender === 'female'
                  ? 'linear-gradient(135deg, rgba(236,72,153,0.25), rgba(244,63,94,0.15))'
                  : 'rgba(255,255,255,0.03)',
                border: gender === 'female' ? '1px solid rgba(236,72,153,0.35)' : '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                transition: 'all 0.25s',
                boxShadow: gender === 'female' ? '0 4px 20px rgba(236,72,153,0.15)' : 'none',
              }}>
              <span style={{ fontSize: 36 }}>{'👩'}</span>
              <span style={{ fontSize: 15, fontWeight: 600, fontFamily: FONT, color: gender === 'female' ? '#F9A8D4' : glass.text.primary }}>Lei</span>
              <span style={{ fontSize: 10, color: gender === 'female' ? 'rgba(249,168,212,0.7)' : glass.text.muted }}>{VOICE_PRESETS.female.label}</span>
            </button>
          </div>

          {gender && (
            <button onClick={() => { vibrate(); setShowVoicePicker(!showVoicePicker); }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                fontFamily: FONT, fontSize: 11, color: glass.text.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginTop: 10, transition: 'all 0.2s',
              }}>
              {'🎵'} Voce: {ALL_VOICES.find(v => v.id === voice)?.label || voice}
              <span style={{ marginLeft: 'auto', fontSize: 10 }}>{showVoicePicker ? '▲' : '▼'}</span>
            </button>
          )}

          {showVoicePicker && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {ALL_VOICES.map(v => (
                <button key={v.id} onClick={() => { vibrate(); setVoice(v.id); setShowVoicePicker(false); }}
                  style={{
                    padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                    background: v.id === voice ? 'linear-gradient(135deg, #26D9B0, #1EB898)' : 'rgba(255,255,255,0.03)',
                    border: v.id === voice ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    color: v.id === voice ? '#000' : glass.text.secondary,
                    fontSize: 12, fontWeight: v.id === voice ? 700 : 400, fontFamily: FONT,
                    transition: 'all 0.2s',
                  }}>
                  {v.label}
                  <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>
                    {v.gender === 'male' ? '♂' : v.gender === 'female' ? '♀' : '◎'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ CREATING SPINNER ═══ */}
        {creating && (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', margin: '0 auto 12px',
              border: '3px solid rgba(38,217,176,0.15)', borderTopColor: '#26D9B0',
              animation: 'vtSpin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: glass.text.muted }}>Creazione stanza...</div>
          </div>
        )}

        {/* ═══ QR CODE RESULT ═══ */}
        {createdRoomId && !creating && (
          <div style={{
            padding: 24, borderRadius: 22, textAlign: 'center',
            background: 'linear-gradient(160deg, rgba(14,18,35,0.80) 0%, rgba(10,14,28,0.90) 50%, rgba(38,217,176,0.04) 100%)',
            border: '1px solid rgba(38,217,176,0.12)',
            backdropFilter: 'blur(40px) saturate(1.1)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.1)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 60px rgba(38,217,176,0.05)',
          }}>
            <canvas ref={canvasRef}
              style={{
                borderRadius: 16, background: '#fff', padding: 10,
                display: 'block', margin: '0 auto 16px', maxWidth: 220,
              }} />

            <div style={{
              fontSize: 28, fontWeight: 300, letterSpacing: 6,
              background: 'linear-gradient(135deg, #26D9B0, #8B6AFF)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', marginBottom: 4,
            }}>
              {createdRoomId}
            </div>
            <div style={{ fontSize: 11, color: glass.text.muted, marginBottom: 18 }}>
              {langInfo?.flag} {langInfo?.name} · {ALL_VOICES.find(v => v.id === voice)?.label}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={copyLink}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                  background: copied ? 'linear-gradient(135deg, #26D9B0, #1EB898)' : 'rgba(255,255,255,0.04)',
                  border: copied ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: copied ? '#000' : glass.text.primary,
                  fontFamily: FONT, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.2s',
                }}>
                {copied ? '✓ Copiato!' : '🔗 Copia link'}
              </button>
              <button onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'BarChat', url: `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1` }).catch(() => {});
                } else copyLink();
              }}
                style={{
                  padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                  ...glass.btn, color: glass.text.primary, fontFamily: FONT, fontSize: 13, fontWeight: 600,
                }}>
                {'📤'}
              </button>
            </div>

            <button onClick={enterRoom}
              style={{
                width: '100%', padding: '16px 0', borderRadius: 16, cursor: 'pointer', border: 'none',
                background: 'linear-gradient(135deg, #26D9B0 0%, #1EB898 50%, #178F78 100%)',
                color: '#000', fontFamily: FONT, fontSize: 16, fontWeight: 700, letterSpacing: -0.3,
                boxShadow: '0 8px 32px rgba(38,217,176,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
              }}>
              {'💬'} Entra e inizia a parlare
            </button>

            <div style={{ fontSize: 11, color: glass.text.muted, marginTop: 14, lineHeight: 1.6 }}>
              L'invitato scansiona il QR o apre il link — entra subito senza registrazione.
            </div>
          </div>
        )}

        {/* Placeholder */}
        {!gender && !creating && !createdRoomId && (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            ...glass.card, borderRadius: 22,
          }}>
            <div style={{ fontSize: 48, marginBottom: 14, filter: 'drop-shadow(0 4px 20px rgba(38,217,176,0.2))' }}>{'📱'}</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: glass.text.secondary, fontWeight: 300 }}>
              Seleziona lingua e voce — il QR code apparirà automaticamente.
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes vtSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default memo(QuickInvite);
