'use client';
import Icon from './Icon.js';
import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import { encryptDestination } from '../lib/taxiCrypto.js';
import { PALETTE } from '../lib/palette.js';
import { subscribeTick } from '../lib/ticker.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// TaxiQRView — Shows QR code for encrypted taxi destination
//
// PRIVACY: The destination is encrypted client-side with AES-256-GCM
// before being sent to the server. The server stores only ciphertext.
// The decryption key is embedded in the QR URL fragment (#k=...),
// which is never sent to the server by HTTP specification.
// The destination is deleted from Redis after first retrieval.
// ═══════════════════════════════════════════════════════════════

// b.138 — la scritta di riserva (quando il servizio del QR non risponde)
// era "Scansiona con la fotocamera" in italiano fisso, e questa funzione
// vive fuori dal componente: la frase gia tradotta le arriva come argomento.
function generateQRCanvas(canvas, data, size = 280, etichettaScansiona = '') {
  const ctx = canvas.getContext('2d');
  canvas.width = size; canvas.height = size;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  const encoded = encodeURIComponent(data);
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=0a0e1a&color=26D9B0&format=png`;

  return new Promise((resolve) => {
    img.onload = () => { ctx.drawImage(img, 0, 0, size, size); resolve(true); };
    img.onerror = () => {
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = PALETTE.teal; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('QR Code', size / 2, size / 2 - 10);
      ctx.font = '10px system-ui';
      ctx.fillText(etichettaScansiona || 'Scan with the camera', size / 2, size / 2 + 10);
      resolve(false);
    };
  });
}

function TaxiQRView({ destination, onClose, onStartConversation, S }) {
  const { L } = useApp();
  const C = S?.colors || {};
  const accent = C.accent1 || PALETTE.teal;
  const purple = C.accent2 || PALETTE.violet;
  const cardBg = C.glassCard || 'rgba(12,16,30,0.65)';
  const cardBorder = C.cardBorder || 'rgba(255,255,255,0.05)';
  const textPrimary = C.textPrimary || PALETTE.grayLight;
  const textMuted = C.textMuted || 'rgba(242,244,247,0.60)';
  const bg = C.bg || PALETTE.bgDeep;

  const canvasRef = useRef(null);
  const [qrReady, setQrReady] = useState(false);
  const [destId, setDestId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  // b.138 — prima si controllava `timeLeft === 'Scaduto'` per decidere il
  // colore: una condizione che si sarebbe rotta in silenzio appena la
  // scritta smetteva di essere italiana. Lo stato ora e un booleano.
  const [scaduto, setScaduto] = useState(false);
  const [revoked, setRevoked] = useState(false);
  // Keep the full QR URL (with fragment) for sharing
  const qrUrlRef = useRef('');

  // ── Encrypt, save, and generate QR ──
  useEffect(() => {
    if (!destination) return;
    let cancelled = false;

    async function saveAndGenerate() {
      setSaving(true);
      try {
        // 1. Encrypt destination client-side
        const { ciphertext, key } = await encryptDestination(destination);

        // 2. Send ONLY ciphertext to server
        const res = await fetch('/api/taxi/destination', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ciphertext }),
        });
        if (!res.ok) throw new Error('Save failed');
        const { id } = await res.json();
        if (cancelled) return;
        setDestId(id);

        // 3. Build URL with key in fragment — fragment is NEVER sent to server
        const url = `${window.location.origin}/taxi/${id}#k=${key}`;
        qrUrlRef.current = url;

        // 4. Generate QR
        if (canvasRef.current) {
          await generateQRCanvas(canvasRef.current, url, 280, L('scanWithCamera'));
          setQrReady(true);
        }
      } catch (e) {
        console.warn('[TaxiQR] Failed to encrypt/save:', e?.message);
        // NO FALLBACK with cleartext — if encryption fails, show error
        // This is fail-closed: we don't send data unencrypted
      }
      setSaving(false);
    }

    saveAndGenerate();
    return () => { cancelled = true; };
  }, [destination, L]);

  // ── Countdown timer ──
  useEffect(() => {
    if (!destination?.expiresAt) return;
    const update = () => {
      const diff = new Date(destination.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(L('expiredWord')); setScaduto(true); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m`); setScaduto(false);
    };
    return subscribeTick(60000, update, { immediate: true });
  }, [destination?.expiresAt, L]);

  // ── Share (includes key in fragment) ──
  const handleShare = useCallback(async () => {
    vibrate(15);
    const url = qrUrlRef.current;
    const text = L('taxiSharedDest');
    if (navigator.share && url) {
      try { await navigator.share({ title: 'TaxiTalk', text, url }); } catch { /* l utente ha annullato, o il permesso non c e */ }
    } else if (url) {
      try { await navigator.clipboard.writeText(url); } catch { /* l utente ha annullato, o il permesso non c e */ }
    }
  }, [L]);

  // ── Revoke destination ──
  const handleRevoke = useCallback(async () => {
    if (!destId) return;
    vibrate(20);
    try {
      const res = await fetch(`/api/taxi/destination?id=${destId}`, { method: 'DELETE' });
      if (res.ok) setRevoked(true);
    } catch { /* il dispositivo non vibra: non cambia nulla */ }
  }, [destId]);

  if (!destination) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: bg, display: 'flex', flexDirection: 'column',
      fontFamily: FONT,
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', flexShrink: 0,
      }}>
        <button onClick={onClose} aria-label="Chiudi" style={{
          width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
          background: cardBg, border: `1px solid ${cardBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: textMuted, fontSize: 18,
        }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: textPrimary }}>
            Mostra al tassista
          </div>
          <div style={{ fontSize: 10, color: textMuted }}>
            {L('destEncryptedE2E')}
          </div>
        </div>
        {timeLeft && !revoked && (
          <span style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
            background: scaduto ? 'rgba(255,107,107,0.15)' : `${accent}12`,
            color: scaduto ? PALETTE.coral : accent,
          }}>
            ⏱ {timeLeft}
          </span>
        )}
      </header>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '0 24px', gap: 20,
      }}>
        {revoked ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}><Icon name="car" size={40} color={(S?.colors?.textMuted) || 'rgba(255,255,255,0.35)'} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary, marginBottom: 6 }}>
              Destinazione revocata
            </div>
            <div style={{ fontSize: 12, color: textMuted }}>
              Il QR non è più valido. I dati sono stati eliminati dal server.
            </div>
          </div>
        ) : (
          <>
            {/* QR Code */}
            <div style={{
              padding: 20, borderRadius: 24,
              background: '#0a0e1a', border: `2px solid ${accent}25`,
              boxShadow: `0 0 60px ${accent}10`,
            }}>
              <canvas ref={canvasRef} style={{
                width: 240, height: 240, borderRadius: 12,
                opacity: qrReady ? 1 : 0.3,
                transition: 'opacity 0.3s',
              }} />
              {saving && (
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: textMuted }}>
                  Cifratura e generazione QR...
                </div>
              )}
            </div>

            {/* Destination preview (local only — shown from state, not from server) */}
            <div style={{
              width: '100%', maxWidth: 340, padding: '16px 18px', borderRadius: 16,
              background: cardBg, border: `1px solid ${cardBorder}`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary, marginBottom: 6 }}>
                {destination.normalizedAddress}
              </div>
              {destination.terminal && (
                <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
                 {destination.terminal}
                </div>
              )}
              {destination.hotelName && (
                <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
                  {destination.hotelName}
                </div>
              )}
              {destination.flightNumber && (
                <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
                  Volo {destination.flightNumber}
                </div>
              )}
              {destination.entrance && (
                <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
                  {destination.entrance}
                </div>
              )}
              {destination.stops?.length > 0 && (
                <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
                  {destination.stops.length} fermat{destination.stops.length === 1 ? 'a' : 'e'}: {destination.stops.join(' → ')}
                </div>
              )}
              {destination.notes && (
                <div style={{ fontSize: 12, color: textMuted, marginTop: 4, fontStyle: 'italic' }}>
                  {destination.notes}
                </div>
              )}
              <div style={{ fontSize: 10, color: `${accent}80`, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                Solo chi scansiona il QR può leggere questi dati
              </div>
            </div>

            {/* Instructions */}
            <div style={{ fontSize: 12, color: textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
              Mostra questo QR al tassista. La destinazione è cifrata: solo chi scansiona può leggerla. Dopo la prima lettura, i dati vengono eliminati dal server.
            </div>
          </>
        )}
      </div>

      {/* Bottom actions */}
      <div style={{
        padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        display: 'flex', gap: 10,
      }}>
        {!revoked && (
          <>
            <button onClick={handleRevoke} style={{
              padding: '14px', borderRadius: 14, cursor: 'pointer',
              background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)',
              color: PALETTE.coral, fontSize: 13, fontWeight: 600, fontFamily: FONT,
            }}>
              Revoca
            </button>
            <button onClick={handleShare} style={{
              flex: 1, padding: '14px', borderRadius: 14, cursor: 'pointer',
              background: cardBg, border: `1px solid ${cardBorder}`,
              color: textPrimary, fontSize: 13, fontWeight: 600, fontFamily: FONT,
            }}>
              Condividi
            </button>
            <button onClick={onStartConversation} style={{
              flex: 1, padding: '14px', borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${accent}, ${purple})`,
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT,
              boxShadow: `0 4px 20px ${accent}35`,
            }}>
              Parla
            </button>
          </>
        )}
        {revoked && (
          <button onClick={onClose} style={{
            flex: 1, padding: '14px', borderRadius: 14, cursor: 'pointer',
            background: `linear-gradient(135deg, ${accent}, ${purple})`,
            border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FONT,
          }}>
            Torna indietro
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(TaxiQRView);
