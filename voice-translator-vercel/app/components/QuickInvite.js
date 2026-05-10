'use client';
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { APP_URL, LANGS, FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';

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
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState(roomId || '');
  const [copied, setCopied] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestGender, setGuestGender] = useState('');
  const [guestLang, setGuestLang] = useState('en');
  const canvasRef = useRef(null);
  const qrSectionRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll to QR when room is created
  useEffect(() => {
    if (createdRoomId && qrSectionRef.current) {
      setTimeout(() => {
        qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [createdRoomId]);

  const selectGender = useCallback(async (g) => {
    vibrate();
    setGender(g);
    setVoice(VOICE_PRESETS[g]?.voice || 'nova');
    if (lang && !createdRoomId && !creating) {
      setCreating(true);
      try {
        const room = await handleCreateRoom(lang);
        if (room?.id || room?.roomId) { setCreatedRoomId(room.id || room.roomId); setCreated(true); }
      } catch (e) { console.warn('[QuickInvite] Auto-create failed:', e); }
      setCreating(false);
    }
  }, [lang, createdRoomId, creating, handleCreateRoom]);

  const createInstant = useCallback(async () => {
    if (!lang || !gender) return;
    vibrate(); setCreating(true);
    try {
      const room = await handleCreateRoom(lang);
      if (room?.id || room?.roomId) { setCreatedRoomId(room.id || room.roomId); setCreated(true); }
    } catch (e) { console.warn('[QuickInvite] Create failed:', e); }
    setCreating(false);
  }, [lang, gender, handleCreateRoom]);

  // QR code generation
  useEffect(() => {
    if (!createdRoomId || !canvasRef.current) return;
    const url = `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1` + (guestName ? `&gn=${encodeURIComponent(guestName)}` : '') + (guestGender ? `&gg=${guestGender}` : '') + (guestLang ? `&gl=${guestLang}` : '');
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
    const url = `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1` + (guestName ? `&gn=${encodeURIComponent(guestName)}` : '') + (guestGender ? `&gg=${guestGender}` : '') + (guestLang ? `&gl=${guestLang}` : '');
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

      <div ref={scrollRef} style={{
        flex: 1, overflow: 'auto', padding: '0 16px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
        maxWidth: 600, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>

        {/* ═══ LINGUA ═══ */}
        <div style={{ padding: 14, borderRadius: 16, ...glass.card }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#26D9B0', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            La tua lingua
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {COMMON_LANGS.map(code => {
              const info = LANGS.find(l => l.code === code);
              const sel = code === lang;
              return (
                <button key={code} onClick={() => {
                    vibrate(); setLang(code);
                    if (createdRoomId) { setCreatedRoomId(''); setCreated(false); setGender(''); }
                  }}
                  style={{
                    padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                    background: sel ? 'linear-gradient(135deg, #26D9B0, #1EB898)' : 'rgba(255,255,255,0.03)',
                    border: sel ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    color: sel ? '#000' : glass.text.secondary,
                    fontSize: 11, fontWeight: sel ? 700 : 400, fontFamily: FONT,
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'all 0.2s',
                  }}>
                  <span style={{ fontSize: 14 }}>{info?.flag}</span>
                  {info?.name || code}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ GENERE VOCE ═══ */}
        <div style={{ padding: 14, borderRadius: 16, ...glass.card }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8B6AFF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            La tua voce
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => selectGender('male')}
              style={{
                flex: 1, padding: '14px 10px', borderRadius: 14, cursor: 'pointer',
                background: gender === 'male'
                  ? 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.15))'
                  : 'rgba(255,255,255,0.03)',
                border: gender === 'male' ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                transition: 'all 0.25s',
              }}>
              <Icon name="user" size={28} color={gender === 'male' ? '#93C5FD' : 'rgba(242,244,247,0.92)'} />
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: FONT, color: gender === 'male' ? '#93C5FD' : glass.text.primary }}>Lui</span>
              <span style={{ fontSize: 9, color: gender === 'male' ? 'rgba(147,197,253,0.7)' : glass.text.muted }}>{VOICE_PRESETS.male.label}</span>
            </button>
            <button onClick={() => selectGender('female')}
              style={{
                flex: 1, padding: '14px 10px', borderRadius: 14, cursor: 'pointer',
                background: gender === 'female'
                  ? 'linear-gradient(135deg, rgba(236,72,153,0.25), rgba(244,63,94,0.15))'
                  : 'rgba(255,255,255,0.03)',
                border: gender === 'female' ? '1px solid rgba(236,72,153,0.35)' : '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                transition: 'all 0.25s',
              }}>
              <Icon name="user" size={28} color={gender === 'female' ? '#F9A8D4' : 'rgba(242,244,247,0.92)'} />
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: FONT, color: gender === 'female' ? '#F9A8D4' : glass.text.primary }}>Lei</span>
              <span style={{ fontSize: 9, color: gender === 'female' ? 'rgba(249,168,212,0.7)' : glass.text.muted }}>{VOICE_PRESETS.female.label}</span>
            </button>
          </div>
        </div>

        {/* ═══ GENERA QR BUTTON — subito dopo la voce ═══ */}
        {gender && !creating && !createdRoomId && (
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
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', margin: '0 auto 12px',
              border: '3px solid rgba(38,217,176,0.15)', borderTopColor: '#26D9B0',
              animation: 'vtSpin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: glass.text.muted }}>Creazione stanza...</div>
          </div>
        )}

        {/* ═══ QR CODE RESULT — prima dei dati invitato ═══ */}
        {createdRoomId && !creating && (
          <div ref={qrSectionRef} style={{
            padding: 20, borderRadius: 20, textAlign: 'center',
            background: 'linear-gradient(160deg, rgba(14,18,35,0.80) 0%, rgba(10,14,28,0.90) 50%, rgba(38,217,176,0.04) 100%)',
            border: '1px solid rgba(38,217,176,0.12)',
            backdropFilter: 'blur(40px) saturate(1.1)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.1)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 60px rgba(38,217,176,0.05)',
          }}>
            <canvas ref={canvasRef}
              style={{
                borderRadius: 14, background: '#fff', padding: 8,
                display: 'block', margin: '0 auto 12px', maxWidth: 200, width: '100%',
              }} />

            <div style={{
              fontSize: 24, fontWeight: 300, letterSpacing: 5,
              background: 'linear-gradient(135deg, #26D9B0, #8B6AFF)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', marginBottom: 4,
            }}>
              {createdRoomId}
            </div>
            <div style={{ fontSize: 11, color: glass.text.muted, marginBottom: 6 }}>
              Tu: {langInfo?.flag} {langInfo?.name} · {ALL_VOICES.find(v => v.id === voice)?.label}
            </div>
            {(guestName || guestLang) && (
              <div style={{ fontSize: 11, color: '#FF9F43', marginBottom: 14 }}>
                Invitato: {guestName || '?'} · {LANGS.find(l => l.code === guestLang)?.flag} {LANGS.find(l => l.code === guestLang)?.name}
                {guestGender && ` · ${guestGender === 'male' ? '♂️' : '♀️'}`}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={copyLink}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
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
                  padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
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

            <div style={{ fontSize: 10, color: glass.text.muted, marginTop: 10, lineHeight: 1.5 }}>
              L'invitato scansiona il QR o apre il link — entra subito senza registrazione.
            </div>
          </div>
        )}

        {/* ═══ DATI INVITATO — opzionale, sotto QR ═══ */}
        {gender && (
          <div style={{ padding: 14, borderRadius: 16, ...glass.card }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#FF9F43', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              {createdRoomId ? 'Personalizza invito (opzionale)' : 'Chi stai invitando?'}
            </div>

            {/* Nome + Sesso inline */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: glass.text.muted, marginBottom: 3 }}>Nome</div>
                <input
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="Es. Maria..."
                  maxLength={20}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 10, boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: glass.text.primary, fontSize: 13, fontFamily: FONT, outline: 'none',
                  }}
                />
              </div>
              <div style={{ width: 120 }}>
                <div style={{ fontSize: 10, color: glass.text.muted, marginBottom: 3 }}>Sesso</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { key: 'male', label: '♂ Lui' },
                    { key: 'female', label: '♀ Lei' },
                  ].map(g => (
                    <button key={g.key} onClick={() => { vibrate(); setGuestGender(g.key); }}
                      style={{
                        flex: 1, padding: '9px 4px', borderRadius: 10, cursor: 'pointer',
                        background: guestGender === g.key
                          ? (g.key === 'male' ? 'rgba(59,130,246,0.2)' : 'rgba(236,72,153,0.2)')
                          : 'rgba(255,255,255,0.03)',
                        border: guestGender === g.key
                          ? (g.key === 'male' ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(236,72,153,0.4)')
                          : '1px solid rgba(255,255,255,0.06)',
                        color: guestGender === g.key
                          ? (g.key === 'male' ? '#93C5FD' : '#F9A8D4')
                          : glass.text.secondary,
                        fontFamily: FONT, fontSize: 11, fontWeight: guestGender === g.key ? 700 : 400,
                        textAlign: 'center', transition: 'all 0.2s',
                      }}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Lingua invitato */}
            <div>
              <div style={{ fontSize: 10, color: glass.text.muted, marginBottom: 3 }}>Lingua invitato</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {COMMON_LANGS.filter(c => c !== lang).map(code => {
                  const info = LANGS.find(l => l.code === code);
                  const sel = code === guestLang;
                  return (
                    <button key={code} onClick={() => { vibrate(); setGuestLang(code); }}
                      style={{
                        padding: '5px 8px', borderRadius: 7, cursor: 'pointer',
                        background: sel ? 'linear-gradient(135deg, #FF9F43, #FF6B6B)' : 'rgba(255,255,255,0.03)',
                        border: sel ? 'none' : '1px solid rgba(255,255,255,0.06)',
                        color: sel ? '#000' : glass.text.secondary,
                        fontSize: 10, fontWeight: sel ? 700 : 400, fontFamily: FONT,
                        display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s',
                      }}>
                      <span style={{ fontSize: 12 }}>{info?.flag}</span>
                      {info?.name || code}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Placeholder */}
        {!gender && !creating && !createdRoomId && (
          <div style={{
            textAlign: 'center', padding: '28px 16px',
            ...glass.card, borderRadius: 20,
          }}>
            <div style={{ marginBottom: 12, display: 'inline-block' }}>
              <Icon name="share" size={44} color="#26D9B0" />
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: glass.text.secondary, fontWeight: 300 }}>
              Seleziona lingua e voce — il QR code apparira automaticamente.
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes vtSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default memo(QuickInvite);
