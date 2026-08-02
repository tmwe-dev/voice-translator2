'use client';
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { APP_URL, LANGS, FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';

const glass = {
  btn: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' },
  text: { primary: '#F2F4F7', secondary: 'rgba(242,244,247,0.75)', muted: 'rgba(242,244,247,0.50)' },
};

function QuickInvite({ L, S, prefs, theme, setView, handleCreateRoom, roomId, setViewAfterCreate }) {
  const lang = prefs?.lang || 'it';
  const [guestLang, setGuestLang] = useState(lang === 'en' ? 'it' : 'en');
  const [creating, setCreating] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState(roomId || '');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  // Create room function (used on mount + retry)
  const doCreateRoom = useCallback(() => {
    if (createdRoomId || creating) return;
    setCreating(true);
    setError('');
    handleCreateRoom(lang)
      .then(room => { if (room?.id || room?.roomId) setCreatedRoomId(room.id || room.roomId); else setError('Creazione stanza fallita'); })
      .catch(e => { console.warn('[QuickInvite]', e); setError('Errore di connessione. Riprova.'); })
      .finally(() => setCreating(false));
  }, [createdRoomId, creating, handleCreateRoom, lang]);

  // Auto-create room on mount
  useEffect(() => {
    doCreateRoom();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // QR code — regenerates when guest lang changes
  useEffect(() => {
    if (!createdRoomId || !canvasRef.current) return;
    const url = `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1&gl=${guestLang}`;
    let cancelled = false;
    import('qrcode').then(QRCode => {
      if (cancelled) return;
      QRCode.toCanvas(canvasRef.current, url, {
        width: 260, margin: 2,
        color: { dark: '#060810', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }, () => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [createdRoomId, lang, guestLang]);

  const getUrl = () => `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1&gl=${guestLang}`;

  const copyLink = useCallback(() => {
    if (!createdRoomId) return;
    navigator.clipboard.writeText(getUrl()).then(() => {
      vibrate(); setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [createdRoomId, lang, guestLang]);

  const enterRoom = useCallback(() => {
    vibrate();
    if (setViewAfterCreate) setViewAfterCreate();
    else setView('room');
  }, [setView, setViewAfterCreate]);

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
        </div>
      </header>

      <div style={{
        flex: 1, overflow: 'auto', padding: '0 16px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        maxWidth: 400, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>

        {/* SPINNER */}
        {creating && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', margin: '0 auto 12px',
              border: '3px solid rgba(38,217,176,0.15)', borderTopColor: '#26D9B0',
              animation: 'vtSpin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: glass.text.muted }}>Preparazione invito...</div>
          </div>
        )}

        {/* ERRORE */}
        {error && !creating && !createdRoomId && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#FF6B6B', marginBottom: 16 }}>{error}</div>
            <button onClick={doCreateRoom}
              style={{
                padding: '14px 32px', borderRadius: 14, cursor: 'pointer', border: 'none',
                background: 'linear-gradient(135deg, #26D9B0 0%, #1EB898 100%)',
                color: '#000', fontFamily: FONT, fontSize: 15, fontWeight: 700,
              }}>
              Riprova
            </button>
          </div>
        )}

        {/* QR + LINGUA */}
        {createdRoomId && !creating && (
          <>
            {/* Lingua invitato */}
            <div style={{ width: '100%', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: glass.text.muted, marginBottom: 6, textAlign: 'center' }}>
                Lingua dell'invitato
              </div>
              <select
                value={guestLang}
                onChange={e => { vibrate(); setGuestLang(e.target.value); }}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 14, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: glass.text.primary, fontSize: 15, fontFamily: FONT, outline: 'none',
                  appearance: 'none', WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='rgba(242,244,247,0.5)' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
                  textAlign: 'center',
                }}>
                {LANGS.filter(l => l.code !== lang).map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                ))}
              </select>
            </div>

            {/* QR CODE */}
            <canvas ref={canvasRef}
              style={{
                borderRadius: 18, background: '#fff', padding: 12,
                display: 'block', margin: '0 auto 16px', maxWidth: 240, width: '100%',
              }} />

            <div style={{
              fontSize: 26, fontWeight: 300, letterSpacing: 5, textAlign: 'center',
              background: 'linear-gradient(135deg, #26D9B0, #8B6AFF)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', marginBottom: 16,
            }}>
              {createdRoomId}
            </div>

            {/* Copia + Condividi */}
            <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 12 }}>
              <button onClick={copyLink}
                style={{
                  flex: 1, padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: copied ? 'linear-gradient(135deg, #26D9B0, #1EB898)' : 'rgba(255,255,255,0.04)',
                  border: copied ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: copied ? '#000' : glass.text.primary,
                  fontFamily: FONT, fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {copied ? '✓ Copiato!' : <><Icon name="link" size={14} color="currentColor" /> Copia link</>}
              </button>
              <button onClick={() => {
                if (navigator.share) navigator.share({ title: 'BarTalk', url: getUrl() }).catch(() => {});
                else copyLink();
              }}
                style={{
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  ...glass.btn, color: glass.text.primary, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Icon name="share" size={18} color={glass.text.primary} />
              </button>
            </div>

            {/* Entra */}
            <button onClick={enterRoom}
              style={{
                width: '100%', padding: '16px 0', borderRadius: 16, cursor: 'pointer', border: 'none',
                background: 'linear-gradient(135deg, #26D9B0 0%, #1EB898 50%, #178F78 100%)',
                color: '#000', fontFamily: FONT, fontSize: 16, fontWeight: 700,
                boxShadow: '0 8px 32px rgba(38,217,176,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              <Icon name="doorCreate" size={20} color="#000" /> Entra nella stanza
            </button>

            <div style={{ fontSize: 10, color: glass.text.muted, marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
              L'invitato scansiona il QR — entra subito senza registrazione.
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes vtSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default memo(QuickInvite);
