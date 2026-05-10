'use client';
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { APP_URL, LANGS, FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════════════════════
// QuickInvite — Dark Ambient Glassmorphism QR Invite
// Sender auto-set from prefs, user only fills guest data
// ═══════════════════════════════════════════════════════════════

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
  // ═══ SENDER: auto from prefs (read-only) ═══
  const lang = prefs?.lang || 'it';
  const gender = prefs?.gender || 'male';
  const voice = prefs?.voice || VOICE_PRESETS[gender]?.voice || 'nova';

  // ═══ GUEST: user fills only these ═══
  const [guestName, setGuestName] = useState('');
  const [guestGender, setGuestGender] = useState('');
  const [guestLang, setGuestLang] = useState(lang === 'en' ? 'it' : 'en');

  const [creating, setCreating] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState(roomId || '');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);
  const qrSectionRef = useRef(null);

  // Auto-scroll to QR when created
  useEffect(() => {
    if (createdRoomId && qrSectionRef.current) {
      setTimeout(() => qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }, [createdRoomId]);

  const createInstant = useCallback(async () => {
    if (creating || createdRoomId) return;
    vibrate(); setCreating(true);
    try {
      const room = await handleCreateRoom(lang);
      if (room?.id || room?.roomId) setCreatedRoomId(room.id || room.roomId);
    } catch (e) { console.warn('[QuickInvite] Create failed:', e); }
    setCreating(false);
  }, [lang, creating, createdRoomId, handleCreateRoom]);

  // QR code generation — regenerates when guest info changes
  useEffect(() => {
    if (!createdRoomId || !canvasRef.current) return;
    const url = `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1`
      + (guestName ? `&gn=${encodeURIComponent(guestName)}` : '')
      + (guestGender ? `&gg=${guestGender}` : '')
      + (guestLang ? `&gl=${guestLang}` : '');
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
  }, [createdRoomId, lang, guestName, guestGender, guestLang]);

  const copyLink = useCallback(() => {
    if (!createdRoomId) return;
    const url = `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1`
      + (guestName ? `&gn=${encodeURIComponent(guestName)}` : '')
      + (guestGender ? `&gg=${guestGender}` : '')
      + (guestLang ? `&gl=${guestLang}` : '');
    navigator.clipboard.writeText(url).then(() => {
      vibrate(); setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [createdRoomId, lang, guestName, guestGender, guestLang]);

  const enterRoom = useCallback(() => {
    vibrate();
    if (setViewAfterCreate) setViewAfterCreate();
    else setView('room');
  }, [setView, setViewAfterCreate]);

  const langInfo = LANGS.find(l => l.code === lang);
  const guestLangInfo = LANGS.find(l => l.code === guestLang);

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

        {/* ═══ SENDER SUMMARY (auto from prefs, read-only) ═══ */}
        <div style={{
          padding: '12px 16px', borderRadius: 14,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>{langInfo?.flag}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: glass.text.primary, fontWeight: 500 }}>
              {prefs?.name || 'Tu'}
            </div>
            <div style={{ fontSize: 11, color: glass.text.muted }}>
              {langInfo?.name} · {ALL_VOICES.find(v => v.id === voice)?.label || voice}
            </div>
          </div>
          <div style={{
            fontSize: 9, color: glass.text.muted, padding: '3px 8px',
            borderRadius: 6, background: 'rgba(255,255,255,0.03)',
          }}>mittente</div>
        </div>

        {/* ═══ DATI INVITATO ═══ */}
        <div style={{ padding: 16, borderRadius: 18, ...glass.card }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#FF9F43', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Chi stai invitando?
          </div>

          {/* Nome invitato */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: glass.text.muted, marginBottom: 4 }}>Nome</div>
            <input
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Es. Maria, John..."
              maxLength={20}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 12, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: glass.text.primary, fontSize: 14, fontFamily: FONT, outline: 'none',
              }}
            />
          </div>

          {/* Sesso invitato — BORDERLESS */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: glass.text.muted, marginBottom: 4 }}>Voce</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'male', icon: '♂️', label: 'Lui', color: '#93C5FD', bg: 'rgba(59,130,246,0.15)' },
                { key: 'female', icon: '♀️', label: 'Lei', color: '#F9A8D4', bg: 'rgba(236,72,153,0.15)' },
              ].map(g => (
                <button key={g.key} onClick={() => { vibrate(); setGuestGender(g.key); }}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                    background: guestGender === g.key ? g.bg : 'rgba(255,255,255,0.02)',
                    border: 'none',
                    color: guestGender === g.key ? g.color : glass.text.secondary,
                    fontFamily: FONT, fontSize: 14, fontWeight: guestGender === g.key ? 700 : 400,
                    textAlign: 'center', transition: 'all 0.2s',
                  }}>
                  <span style={{ fontSize: 18 }}>{g.icon}</span> {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lingua invitato — DROPDOWN */}
          <div>
            <div style={{ fontSize: 10, color: glass.text.muted, marginBottom: 4 }}>Lingua</div>
            <select
              value={guestLang}
              onChange={e => { vibrate(); setGuestLang(e.target.value); }}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 12, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: glass.text.primary, fontSize: 14, fontFamily: FONT, outline: 'none',
                appearance: 'none', WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='rgba(242,244,247,0.5)' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
              }}>
              {LANGS.filter(l => l.code !== lang).map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ═══ GENERA QR BUTTON ═══ */}
        {!creating && !createdRoomId && (
          <button onClick={createInstant}
            style={{
              width: '100%', padding: '18px 0', borderRadius: 16, cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg, #26D9B0 0%, #1EB898 50%, #178F78 100%)',
              color: '#000', fontFamily: FONT, fontSize: 17, fontWeight: 700, letterSpacing: -0.3,
              boxShadow: '0 8px 32px rgba(38,217,176,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 0.2s',
            }}>
            <Icon name="share" size={22} color="#000" /> Genera QR Invito
          </button>
        )}

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
          <div ref={qrSectionRef} style={{
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
                display: 'block', margin: '0 auto 16px', maxWidth: 220, width: '100%',
              }} />

            <div style={{
              fontSize: 28, fontWeight: 300, letterSpacing: 6,
              background: 'linear-gradient(135deg, #26D9B0, #8B6AFF)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', marginBottom: 4,
            }}>
              {createdRoomId}
            </div>
            <div style={{ fontSize: 11, color: glass.text.muted, marginBottom: 8 }}>
              Tu: {langInfo?.flag} {langInfo?.name} · {ALL_VOICES.find(v => v.id === voice)?.label}
            </div>
            {(guestName || guestLang) && (
              <div style={{ fontSize: 11, color: '#FF9F43', marginBottom: 18 }}>
                Invitato: {guestName || '?'} · {guestLangInfo?.flag} {guestLangInfo?.name}
                {guestGender && ` · ${guestGender === 'male' ? '♂️' : '♀️'}`}
              </div>
            )}

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
                {copied ? '✓ Copiato!' : <><Icon name="link" size={14} color="currentColor" /> Copia link</>}
              </button>
              <button onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'BarTalk', url: `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1` }).catch(() => {});
                } else copyLink();
              }}
                style={{
                  padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                  ...glass.btn, color: glass.text.primary, fontFamily: FONT, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Icon name="share" size={16} color={glass.text.primary} />
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
              <Icon name="doorCreate" size={20} color="#000" /> Entra e inizia a parlare
            </button>

            <div style={{ fontSize: 11, color: glass.text.muted, marginTop: 14, lineHeight: 1.6 }}>
              L'invitato scansiona il QR o apre il link — entra subito senza registrazione.
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes vtSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default memo(QuickInvite);
