'use client';
import Icon from './Icon.js';
import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import { buildMapsUrl } from '../lib/mapsLink.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// TaxiQRView — QR con il LINK ALLA MAPPA per il tassista.
//
// b.182 — il QR NON porta piu dentro la nostra app. Contiene un link
// diretto a una mappa vera (Google Maps con le indicazioni verso la
// destinazione): il tassista inquadra e si apre la SUA app mappe, gia
// instradata, nella sua lingua, anche offline. Niente install, niente
// pagina nostra, niente server — cosi spariscono i due difetti provati
// dal vivo (la pagina tassista che dava 404 e la mappa nostra che non si
// disegnava). Il link viaggia in chiaro: e solo la destinazione, quella
// che stai comunque comunicando al tassista.
// ═══════════════════════════════════════════════════════════════

// La scritta di riserva (se il servizio del QR non risponde) arriva gia
// tradotta come argomento.
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
  // URL della mappa (con le indicazioni): entra nel QR e serve per "Condividi".
  const qrUrlRef = useRef('');

  // ── Costruisci il link mappa e genera il QR ──
  useEffect(() => {
    if (!destination) return;
    const url = buildMapsUrl(destination, 'google');
    qrUrlRef.current = url;
    if (canvasRef.current && url) {
      generateQRCanvas(canvasRef.current, url, 280, L('scanWithCamera')).then(() => setQrReady(true));
    }
  }, [destination, L]);

  // ── Condividi il link mappa (WhatsApp/SMS/...) ──
  const handleShare = useCallback(async () => {
    vibrate(15);
    const url = qrUrlRef.current;
    if (!url) return;
    if (navigator.share) {
      try { await navigator.share({ title: 'TaxiTalk', text: L('taxiSharedDest'), url }); } catch { /* l utente ha annullato */ }
    } else {
      try { await navigator.clipboard.writeText(url); } catch { /* la clipboard non e disponibile qui */ }
    }
  }, [L]);

  if (!destination) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: bg, display: 'flex', flexDirection: 'column',
      fontFamily: FONT,
    }}>
      {/* b.482 — TESTATA: rientro laterale a venti come nel template, e il
          tasto indietro portato a quarantaquattro, la misura sotto la quale
          un dito comincia a sbagliare bersaglio. */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 20px', flexShrink: 0,
      }}>
        <button onClick={onClose} aria-label={L('closeWord')} style={{
          width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
          background: cardBg, border: `1px solid ${cardBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: textMuted, fontSize: 18,
        }}>‹</button>
        {/* b.482 — le parole vengono dai pacchetti lingua: questa schermata
            la guarda un tassista che puo non parlare italiano. */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: textPrimary }}>
            {L('showToDriver')}
          </div>
          <div style={{ fontSize: 10, color: textMuted }}>
            {L('scanWithCamera')}
          </div>
        </div>
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
        </div>

        {/* Destination preview */}
        <div style={{
          width: '100%', maxWidth: 340, padding: '16px 20px', borderRadius: 16,
          background: cardBg, border: `1px solid ${cardBorder}`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary, marginBottom: 6 }}>
            {destination.normalizedAddress}
          </div>
          {destination.terminal && (
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>{destination.terminal}</div>
          )}
          {destination.hotelName && (
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>{destination.hotelName}</div>
          )}
          {destination.flightNumber && (
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>{L('destFlight')} {destination.flightNumber}</div>
          )}
          {destination.entrance && (
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>{destination.entrance}</div>
          )}
          {destination.stops?.length > 0 && (
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 2 }}>
              {L('intermediateStops')} ({destination.stops.length}): {destination.stops.join(' → ')}
            </div>
          )}
          {destination.notes && (
            <div style={{ fontSize: 12, color: textMuted, marginTop: 4, fontStyle: 'italic' }}>{destination.notes}</div>
          )}
        </div>

        {/* b.482 — anche la spiegazione passa dai pacchetti lingua. */}
        <div style={{ fontSize: 12, color: textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
          {L('taxiScanOpensMap')}
        </div>
      </div>

      {/* Bottom actions */}
      <div style={{
        padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        display: 'flex', gap: 10,
      }}>
        {/* b.482 — questo tasto aveva una casella d'icona VUOTA: chiedeva
            un disegno («car») che in Icon.js non esiste, e non si vedeva
            niente. Ora porta l'icona del condividere, che e cio che fa. */}
        <button onClick={handleShare} style={{
          flex: 1, padding: '14px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
          background: cardBg, border: `1px solid ${cardBorder}`,
          color: textPrimary, fontSize: 13, fontWeight: 600, fontFamily: FONT,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="share" size={15} color={textPrimary} /> {L('shareLink')}
        </button>
        <button onClick={onStartConversation} style={{
          flex: 1, padding: '14px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
          background: `linear-gradient(135deg, ${accent}, ${purple})`,
          border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FONT,
          boxShadow: `0 4px 20px ${accent}35`,
        }}>
          {L('talkToDriver')}
        </button>
      </div>
    </div>
  );
}

export default memo(TaxiQRView);
