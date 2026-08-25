'use client';
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { APP_URL, LANGS, FONT, vibrate, metaScelta} from '../lib/constants.js';
import Icon from './Icon.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// b.482 — I COLORI ARRIVANO DAL TEMA, non da valori scritti a mano dentro
// la schermata: l'invito restava scuro e verde-acqua anche col tema chiaro,
// e quel verde non esisteva in nessun'altra pagina dell'applicazione.
const vetroDi = (C) => ({
  btn: {
    background: C.glassCard || 'rgba(140,170,255,0.06)',
    border: `1px solid ${C.cardBorder || 'rgba(160,190,255,0.14)'}`,
  },
  text: {
    primary: C.textPrimary || PALETTE.grayLight,
    secondary: C.textSecondary || 'rgba(238,242,255,0.82)',
    muted: C.textMuted || 'rgba(238,242,255,0.52)',
  },
});

function QuickInvite({ handleCreateRoom, roomId, setViewAfterCreate }) {
  const { L, S, prefs, theme, setView } = useApp();
  const lang = prefs?.lang || 'it';
  // b.482 — un posto solo da cui prendere i colori di questa schermata.
  const C = S?.colors || {};
  const glass = vetroDi(C);
  const accento1 = C.accent1 || PALETTE.violet;
  const accento2 = C.accent2 || PALETTE.teal;
  // b.462 — l'ospite si invita nella LINGUA 2, quella scelta nel carosello,
  // non in un ripiego calcolato sulla mia. Se non c'e, resta il ripiego.
  const [guestLang, setGuestLang] = useState(() => metaScelta(prefs) || (lang === 'en' ? 'it' : 'en'));
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
      .then(room => { if (room?.id || room?.roomId) setCreatedRoomId(room.id || room.roomId); else setError(L('roomCreateFailed')); })
      .catch(e => { console.warn('[QuickInvite]', e); setError(L('connErrorRetry')); })
      .finally(() => setCreating(false));
  }, [createdRoomId, creating, handleCreateRoom, lang, L]);

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
        color: { dark: PALETTE.bgDeep, light: '#ffffff' },
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
      background: C.bgGradient || PALETTE.bgDeep,
      fontFamily: FONT,
    }}>
      {/* b.482 — TESTATA: rientro laterale a venti come nel template, cosi
          passando da una schermata all'altra il contenuto non salta. */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 20px', flexShrink: 0,
      }}>
        {/* b.482 — il tasto indietro e il piu premuto dell'applicazione:
            quarantaquattro di lato, sotto i quali un dito sbaglia bersaglio. */}
        <button onClick={() => setView('home')}
          style={{
            width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
            ...glass.btn,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: glass.text.secondary, fontSize: 18,
          }}>
          {'‹'}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 18, fontWeight: 300, letterSpacing: -0.5,
            background: `linear-gradient(135deg, ${accento2}, ${accento1})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {L('inviteShort')}
          </div>
        </div>
      </header>

      <div style={{
        flex: 1, overflow: 'auto', padding: '0 20px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        maxWidth: 400, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>

        {/* SPINNER */}
        {creating && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', margin: '0 auto 12px',
              border: `3px solid ${accento2}26`, borderTopColor: accento2,
              animation: 'vtSpin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: glass.text.muted }}>{L('preparingInvite')}</div>
          </div>
        )}

        {/* ERRORE */}
        {error && !creating && !createdRoomId && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: C.accent3 || PALETTE.coral, marginBottom: 16 }}>{error}</div>
            <button onClick={doCreateRoom}
              style={{
                padding: '14px 32px', minHeight: 44, borderRadius: 14, cursor: 'pointer', border: 'none',
                background: `linear-gradient(135deg, ${accento1} 0%, ${accento2} 100%)`,
                color: '#000', fontFamily: FONT, fontSize: 15, fontWeight: 600,
              }}>
              {L('retryWord')}
            </button>
          </div>
        )}

        {/* QR + LINGUA */}
        {createdRoomId && !creating && (
          <>
            {/* Lingua invitato */}
            <div style={{ width: '100%', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: glass.text.muted, marginBottom: 6, textAlign: 'center' }}>
                {L('guestLanguage')}
              </div>
              {/* b.482 — la scelta della lingua e un bersaglio da toccare:
                  almeno quarantaquattro di altezza utile. */}
              <select
                value={guestLang}
                onChange={e => { vibrate(); setGuestLang(e.target.value); }}
                style={{
                  width: '100%', padding: '12px 14px', minHeight: 44, borderRadius: 14, boxSizing: 'border-box',
                  background: C.inputBg || 'rgba(140,170,255,0.05)',
                  border: `1px solid ${C.inputBorder || 'rgba(160,190,255,0.16)'}`,
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

            {/* b.482 — IL QR RESTA NERO SU BIANCO: e l'unica eccezione ai
                colori del tema, perche una fotocamera lo deve poter leggere. */}
            <canvas ref={canvasRef}
              style={{
                borderRadius: 18, background: '#fff', padding: 12,
                display: 'block', margin: '0 auto 16px', maxWidth: 240, width: '100%',
              }} />

            <div style={{
              fontSize: 26, fontWeight: 300, letterSpacing: 5, textAlign: 'center',
              background: `linear-gradient(135deg, ${accento2}, ${accento1})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', marginBottom: 16,
            }}>
              {createdRoomId}
            </div>

            {/* Copia + Condividi */}
            <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 12 }}>
              <button onClick={copyLink}
                style={{
                  flex: 1, padding: '14px 16px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
                  background: copied ? `linear-gradient(135deg, ${accento1}, ${accento2})` : glass.btn.background,
                  border: copied ? 'none' : glass.btn.border,
                  color: copied ? '#000' : glass.text.primary,
                  fontFamily: FONT, fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {copied ? `✓ ${L('copiedShort')}` : <><Icon name="link" size={14} color="currentColor" /> {L('copyLink')}</>}
              </button>
              <button onClick={() => {
                if (navigator.share) navigator.share({ title: 'BarTalk', url: getUrl() }).catch(() => {});
                else copyLink();
              }}
                style={{
                  padding: '14px 16px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
                  ...glass.btn, color: glass.text.primary, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Icon name="share" size={18} color={glass.text.primary} />
              </button>
            </div>

            {/* Entra */}
            <button onClick={enterRoom}
              style={{
                width: '100%', padding: '16px 0', minHeight: 44, borderRadius: 16, cursor: 'pointer', border: 'none',
                background: `linear-gradient(135deg, ${accento1} 0%, ${accento2} 100%)`,
                color: '#000', fontFamily: FONT, fontSize: 16, fontWeight: 600,
                boxShadow: `0 8px 32px ${accento1}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              <Icon name="doorCreate" size={20} color="#000" /> {L('enterTheRoom')}
            </button>

            <div style={{ fontSize: 10, color: glass.text.muted, marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
              {L('guestScansQR')}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes vtSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default memo(QuickInvite);
