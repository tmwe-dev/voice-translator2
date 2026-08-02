'use client';
import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { FONT, vibrate } from '../lib/constants.js';

// ═══════════════════════════════════════════════════════════════
// TaxiQRView — Shows QR code for taxi destination
//
// Generates a QR code (via Canvas) containing a signed destination URL.
// The taxi driver scans it to see destination in their language.
// ═══════════════════════════════════════════════════════════════

// Simple QR code generator using Canvas (no external lib)
// Generates a QR-like visual with the destination URL encoded
function generateQRCanvas(canvas, data, size = 280) {
  const ctx = canvas.getContext('2d');
  canvas.width = size; canvas.height = size;

  // Use the QR API endpoint to generate the code
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const encoded = encodeURIComponent(data);
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=0a0e1a&color=26D9B0&format=png`;

  return new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      resolve(true);
    };
    img.onerror = () => {
      // Fallback: draw placeholder
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#26D9B0';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('QR Code', size / 2, size / 2 - 10);
      ctx.font = '10px system-ui';
      ctx.fillText('Scansiona con la fotocamera', size / 2, size / 2 + 10);
      resolve(false);
    };
  });
}

function TaxiQRView({ destination, onClose, onStartConversation, S }) {
  const C = S?.colors || {};
  const accent = C.accent1 || '#26D9B0';
  const purple = C.accent2 || '#8B6AFF';
  const cardBg = C.glassCard || 'rgba(12,16,30,0.65)';
  const cardBorder = C.cardBorder || 'rgba(255,255,255,0.05)';
  const textPrimary = C.textPrimary || '#F2F4F7';
  const textMuted = C.textMuted || 'rgba(242,244,247,0.60)';
  const bg = C.bg || '#060810';

  const canvasRef = useRef(null);
  const [qrReady, setQrReady] = useState(false);
  const [destId, setDestId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // ── Save destination and generate QR ──
  useEffect(() => {
    if (!destination) return;
    let cancelled = false;

    async function saveAndGenerate() {
      setSaving(true);
      try {
        // Save destination to get a signed ID
        const res = await fetch('/api/taxi/destination', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(destination),
        });
        if (!res.ok) throw new Error('Save failed');
        const { id } = await res.json();
        if (cancelled) return;
        setDestId(id);

        // Generate QR with destination URL
        const url = `${window.location.origin}/taxi/${id}`;
        if (canvasRef.current) {
          await generateQRCanvas(canvasRef.current, url, 280);
          setQrReady(true);
        }
      } catch (e) {
        console.warn('[TaxiQR] Failed to save destination:', e?.message);
        // Generate QR with inline data as fallback
        if (canvasRef.current) {
          const fallbackData = JSON.stringify({
            n: destination.normalizedAddress,
            lat: destination.lat,
            lng: destination.lng,
          });
          await generateQRCanvas(canvasRef.current, fallbackData, 280);
          setQrReady(true);
        }
      }
      setSaving(false);
    }

    saveAndGenerate();
    return () => { cancelled = true; };
  }, [destination]);

  // ── Countdown timer ──
  useEffect(() => {
    if (!destination?.expiresAt) return;
    const update = () => {
      const diff = new Date(destination.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Scaduto'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m`);
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [destination?.expiresAt]);

  // ── Share destination ──
  const handleShare = useCallback(async () => {
    vibrate(15);
    const url = destId ? `${window.location.origin}/taxi/${destId}` : '';
    const text = `🚕 TaxiTalk — Destinazione: ${destination?.normalizedAddress || ''}`;
    if (navigator.share && url) {
      try { await navigator.share({ title: 'TaxiTalk', text, url }); } catch {}
    } else if (url) {
      try { await navigator.clipboard.writeText(url); } catch {}
    }
  }, [destId, destination]);

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
            🚕 Mostra al tassista
          </div>
        </div>
        {timeLeft && (
          <span style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
            background: timeLeft === 'Scaduto' ? 'rgba(255,107,107,0.15)' : `${accent}12`,
            color: timeLeft === 'Scaduto' ? '#FF6B6B' : accent,
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
            <div style={{
              textAlign: 'center', marginTop: 8,
              fontSize: 11, color: textMuted,
            }}>
              Generazione QR...
            </div>
          )}
        </div>

        {/* Destination info */}
        <div style={{
          width: '100%', maxWidth: 340, padding: '16px 18px', borderRadius: 16,
          background: cardBg, border: `1px solid ${cardBorder}`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary, marginBottom: 6 }}>
            📍 {destination.normalizedAddress}
          </div>
          {destination.terminal && (
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
              ✈️ {destination.terminal}
            </div>
          )}
          {destination.hotelName && (
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
              🏨 {destination.hotelName}
            </div>
          )}
          {destination.flightNumber && (
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
              🛫 Volo {destination.flightNumber}
            </div>
          )}
          {destination.entrance && (
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
              🚪 {destination.entrance}
            </div>
          )}
          {destination.stops?.length > 0 && (
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
              📌 {destination.stops.length} fermat{destination.stops.length === 1 ? 'a' : 'e'}: {destination.stops.join(' → ')}
            </div>
          )}
          {destination.notes && (
            <div style={{ fontSize: 12, color: textMuted, marginTop: 4, fontStyle: 'italic' }}>
              📝 {destination.notes}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div style={{ fontSize: 12, color: textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
          Mostra questo QR al tassista. Lui vedrà la destinazione nella sua lingua con mappa e indicazioni.
        </div>
      </div>

      {/* Bottom actions */}
      <div style={{
        padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        display: 'flex', gap: 10,
      }}>
        <button onClick={handleShare} style={{
          flex: 1, padding: '14px', borderRadius: 14, cursor: 'pointer',
          background: cardBg, border: `1px solid ${cardBorder}`,
          color: textPrimary, fontSize: 13, fontWeight: 600, fontFamily: FONT,
        }}>
          📤 Condividi
        </button>
        <button onClick={onStartConversation} style={{
          flex: 1, padding: '14px', borderRadius: 14, cursor: 'pointer',
          background: `linear-gradient(135deg, ${accent}, ${purple})`,
          border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT,
          boxShadow: `0 4px 20px ${accent}35`,
        }}>
          💬 Parla col tassista
        </button>
      </div>
    </div>
  );
}

export default memo(TaxiQRView);
