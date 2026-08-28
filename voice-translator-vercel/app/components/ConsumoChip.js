'use client';
import { memo, useState } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { useApp } from '../contexts/AppContext.js';
import useConsumo from '../hooks/useConsumo.js';

// ═══════════════════════════════════════════════════════════════
// ConsumoChip — il consumo, sempre a vista e che CRESCE (Luca)
//
// Mostra il consumo di QUESTA chat (caratteri tradotti), che aumenta dal
// vivo mentre usi l'app (evento 'vt:consumo'). Toccandolo si apre il
// riepilogo: questa chat, oggi, totale, e la HISTORY per giorno.
//
// Sono CARATTERI, il segnale reale del client — non un numero di credito
// inventato. Il credito/minuti autorevoli restano nella pillola in alto
// (che legge /api/wallet/saldo).
// ═══════════════════════════════════════════════════════════════

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function ConsumoChip({ roomId }) {
  const { L, S } = useApp();
  const C = S?.colors || {};
  const { oggi, totale, perChat, storico } = useConsumo();
  const [aperto, setAperto] = useState(false);
  const dQuestaChat = roomId ? (perChat[roomId] || 0) : 0;

  const muto = C.textMuted || 'rgba(242,244,247,0.6)';
  const testoP = C.textPrimary || '#eef2ff';
  const accent = C.accent1 || '#26D9B0';
  const card = C.glassCard || 'rgba(12,16,30,0.65)';
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.08)'}`;

  const riga = (etichetta, valore) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: bordo }}>
      <span style={{ fontSize: 12, color: muto }}>{etichetta}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: testoP }}>{fmt(valore)} <span style={{ fontSize: 10, color: muto, fontWeight: 400 }}>{L('consumoChars')}</span></span>
    </div>
  );

  return (
    <>
      <button onClick={() => { vibrate(8); setAperto(true); }}
        aria-label={L('consumoTitle')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999,
          background: card, border: bordo, cursor: 'pointer', fontFamily: FONT,
          WebkitTapHighlightColor: 'transparent',
        }}>
        <Icon name="zap" size={12} color={accent} />
        <span style={{ fontSize: 11, fontWeight: 500, color: testoP }}>{fmt(dQuestaChat || oggi)}</span>
      </button>

      {aperto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onClick={() => setAperto(false)} />
          <div style={{
            position: 'fixed', zIndex: 301, top: '18%', left: '50%', transform: 'translateX(-50%)',
            width: 'min(340px, 88vw)', maxHeight: '64vh', overflowY: 'auto',
            background: C.bg || '#0a0e1a', border: bordo, borderRadius: 18, padding: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', fontFamily: FONT,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="zap" size={16} color={accent} />
              <span style={{ fontSize: 15, fontWeight: 500, color: testoP }}>{L('consumoTitle')}</span>
            </div>
            {riga(L('consumoThisChat'), dQuestaChat)}
            {riga(L('consumoToday'), oggi)}
            {riga(L('consumoTotal'), totale)}

            {storico.length > 1 && (
              <div style={{ marginTop: 10 }}>
                {storico.slice(0, 14).map(s => (
                  <div key={s.data} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 11, color: muto }}>
                    <span>{s.data}</span>
                    <span style={{ color: testoP, fontWeight: 500 }}>{fmt(s.chars)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default memo(ConsumoChip);
