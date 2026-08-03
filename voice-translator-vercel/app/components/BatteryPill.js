'use client';
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext.js';
import { PACCHETTI, oreIncluse } from '../wallet/tariffe.js';
import { subscribeTick } from '../lib/ticker.js';

// ═══════════════════════════════════════════════
// BatteryPill — la pila del credito, in alto, cliccabile.
// Verde > 50% · Giallo 15-50% · Rosso < 15%
// Click → popup: saldo, uso oggi/mese, ricarica Stripe, voucher.
// ═══════════════════════════════════════════════

const COLORI = { verde: '#3ddc84', giallo: '#ffc44d', rosso: '#ff5470' };

export default function BatteryPill({ utente }) {
  const { S } = useApp();
  const tc = S.colors || {};
  const [dati, setDati] = useState(null);      // { testo, colore, percento, oggi, mese }
  const [aperto, setAperto] = useState(false);
  const [codice, setCodice] = useState('');
  const [esito, setEsito] = useState('');

  // Carica il saldo ora e poi ogni 60s (si ferma se l'app è in background)
  const carica = useCallback(async () => {
    if (!utente) return;
    try {
      const r = await fetch(`/api/wallet/saldo?utente=${encodeURIComponent(utente)}`);
      if (r.ok) setDati(await r.json());
    } catch { /* offline: teniamo l'ultimo dato */ }
  }, [utente]);

  useEffect(() => subscribeTick(60000, carica, { immediate: true }), [carica]);

  if (!utente || !dati) return null;
  const colore = COLORI[dati.colore] || COLORI.verde;

  // Ricarica: chiedi il link a Stripe e vai
  async function ricarica(pacchettoId) {
    const r = await fetch('/api/wallet/ricarica', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utente, pacchetto: pacchettoId }),
    });
    const { url } = await r.json();
    if (url) window.location.href = url;
  }

  // Voucher: manda il codice, mostra l'esito
  async function usaVoucher() {
    setEsito('...');
    const r = await fetch('/api/wallet/voucher', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utente, codice }),
    });
    const d = await r.json();
    setEsito(d.ok ? `Fatto! ${d.testo}` : (d.motivo || 'Codice non valido'));
    if (d.ok) { setCodice(''); carica(); }
  }

  return (
    <>
      {/* ── La pila in header ── */}
      <button onClick={() => setAperto(true)} aria-label={`Credito: ${dati.testo}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        background: tc.cardBg || 'rgba(140,170,255,0.06)', border: `1px solid ${tc.cardBorder || 'rgba(160,190,255,0.14)'}`,
        borderRadius: 999, padding: '5px 11px', fontFamily: 'inherit',
      }}>
        {/* corpo pila */}
        <span style={{ position: 'relative', width: 24, height: 12, borderRadius: 3,
          border: `1.5px solid ${colore}`, display: 'inline-block' }}>
          <span style={{ position: 'absolute', left: 1.5, top: 1.5, bottom: 1.5,
            width: `${Math.max(6, dati.percento)}%`, maxWidth: 'calc(100% - 3px)',
            background: colore, borderRadius: 1.5 }} />
          {/* polo della pila */}
          <span style={{ position: 'absolute', right: -4.5, top: 3, width: 3, height: 6,
            background: colore, borderRadius: 1 }} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 750, color: tc.textPrimary || '#eef2ff' }}>{dati.testo}</span>
      </button>

      {/* ── Popup ── */}
      {aperto && (
        <div onClick={() => setAperto(false)} style={{
          position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Il tuo credito" style={{
            width: '100%', maxWidth: 360, borderRadius: 22, padding: '20px 18px',
            background: tc.popupBg || 'rgba(5,7,15,0.96)', border: `1px solid ${tc.cardBorder}`,
            color: tc.textPrimary, backdropFilter: 'blur(20px)',
          }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>Il tuo credito</div>
            <div style={{ fontSize: 30, fontWeight: 850, color: colore }}>{dati.testo}</div>

            <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
              <div style={{ flex: 1, padding: '9px 11px', borderRadius: 14, background: tc.cardBg, border: `1px solid ${tc.cardBorder}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted }}>OGGI</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{dati.oggi}</div>
              </div>
              <div style={{ flex: 1, padding: '9px 11px', borderRadius: 14, background: tc.cardBg, border: `1px solid ${tc.cardBorder}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted }}>QUESTO MESE</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{dati.mese}</div>
              </div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, margin: '10px 0 6px' }}>RICARICA</div>
            {PACCHETTI.map(p => {
              const ore = oreIncluse(p);
              return (
                <button key={p.id} onClick={() => ricarica(p.id)} style={{
                  display: 'flex', alignItems: 'center', width: '100%', gap: 10, cursor: 'pointer',
                  padding: '10px 12px', marginBottom: 6, borderRadius: 14, fontFamily: 'inherit',
                  background: tc.cardBg, border: `1px solid ${p.consigliato ? (tc.accent1 || '#5b8cff') : tc.cardBorder}`,
                  color: tc.textPrimary,
                }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800 }}>{p.nome} · {ore.standard}</div>
                    <div style={{ fontSize: 10.5, color: tc.textMuted }}>voce premium: {ore.premium}{p.consigliato ? ' · consigliato' : ''}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: tc.accent2 || '#38e1ff' }}>€{p.euro}</div>
                </button>
              );
            })}

            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, margin: '12px 0 6px' }}>HAI UN VOUCHER?</div>
            <div style={{ display: 'flex', gap: 7 }}>
              <input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="CODICE"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 12, fontFamily: 'inherit', fontSize: 13,
                  background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.textPrimary }} />
              <button onClick={usaVoucher} disabled={!codice} style={{
                padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 800, color: '#fff',
                background: tc.btnGradient || 'linear-gradient(90deg,#5b8cff,#38e1ff)',
              }}>Usa</button>
            </div>
            {esito && <div style={{ fontSize: 12, marginTop: 6, color: esito.startsWith('Fatto') ? COLORI.verde : COLORI.rosso }}>{esito}</div>}

            <button onClick={() => setAperto(false)} style={{
              width: '100%', marginTop: 14, padding: 11, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700, background: 'transparent',
              border: `1px solid ${tc.cardBorder}`, color: tc.textSecondary,
            }}>Chiudi</button>
          </div>
        </div>
      )}
    </>
  );
}
