'use client';
import { useState, useEffect, useCallback } from 'react';
import { FONT } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';
import { PACCHETTI, oreIncluse, MOLTIPLICATORE_PREMIUM } from '../wallet/tariffe.js';

// ═══════════════════════════════════════════════
// CreditsView — LA pagina commerciale, allineata al wallet.
//
// Un solo listino in tutta l'app (app/wallet/tariffe.js):
//   Start €4,99 · Viaggio €11,99 · Mondo €24,99 — paghi una volta,
//   i minuti sono tuoi. Niente abbonamenti, niente "crediti" astratti.
// ═══════════════════════════════════════════════

const COLORI = { verde: '#3ddc84', giallo: '#ffc44d', rosso: '#ff5470' };

export default function CreditsView({ userAccount }) {
  const { S, setView } = useApp();
  const tc = S.colors || {};
  const [dati, setDati] = useState(null);
  const [codice, setCodice] = useState('');
  const [esito, setEsito] = useState('');
  const [caricando, setCaricando] = useState(false);

  const conToken = useCallback((extra = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vt-token') : null;
    return { ...extra, ...(token && { Authorization: `Bearer ${token}` }) };
  }, []);

  const carica = useCallback(async () => {
    try {
      const r = await fetch('/api/wallet/saldo', { headers: conToken() });
      if (r.ok) setDati(await r.json());
    } catch { /* offline */ }
  }, [conToken]);

  useEffect(() => { carica(); }, [carica]);

  async function compra(pacchettoId) {
    setCaricando(true);
    try {
      const r = await fetch('/api/wallet/ricarica', {
        method: 'POST', headers: conToken({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ pacchetto: pacchettoId }),
      });
      const { url } = await r.json();
      if (url) window.location.href = url;
    } finally { setCaricando(false); }
  }

  async function usaVoucher() {
    setEsito('...');
    const r = await fetch('/api/wallet/voucher', {
      method: 'POST', headers: conToken({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ codice }),
    });
    const d = await r.json();
    setEsito(d.ok ? `Fatto! ${d.testo}` : (d.motivo || 'Codice non valido'));
    if (d.ok) { setCodice(''); carica(); }
  }

  const colore = COLORI[dati?.colore] || COLORI.verde;
  const card = {
    background: tc.cardBg, border: `1px solid ${tc.cardBorder}`,
    borderRadius: 18, padding: '16px 16px',
  };

  return (
    <main style={S.page} aria-label="Credito e ricariche">
      <div style={{ ...S.scrollCenter, gap: 14, paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 16px' }}>
            <button onClick={() => setView('settings')} aria-label="Indietro" style={{
              width: 38, height: 38, borderRadius: 12, border: `1px solid ${tc.cardBorder}`,
              background: tc.cardBg, color: tc.textPrimary, cursor: 'pointer', fontSize: 16,
            }}>{'←'}</button>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: tc.textPrimary, fontFamily: FONT, margin: 0 }}>
              Il tuo credito
            </h1>
          </div>

          {!userAccount && (
            <div style={{ ...card, marginBottom: 14, fontSize: 13, color: tc.textSecondary, fontFamily: FONT }}>
              Accedi per vedere il tuo credito e ricaricare.
            </div>
          )}

          {/* Saldo */}
          {dati && (
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, fontFamily: FONT }}>MINUTI DISPONIBILI</div>
              <div style={{ fontSize: 34, fontWeight: 850, color: colore, fontFamily: FONT }}>{dati.testo}</div>
              <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12, color: tc.textSecondary, fontFamily: FONT }}>
                <span>Oggi: <b>{dati.oggi}</b></span>
                <span>Questo mese: <b>{dati.mese}</b></span>
              </div>
            </div>
          )}

          {/* Come funziona — una riga, chiara */}
          <div style={{ fontSize: 12, color: tc.textMuted, fontFamily: FONT, lineHeight: 1.5, marginBottom: 14 }}>
            Paghi una volta, i minuti restano tuoi. La voce premium (ElevenLabs) consuma {MOLTIPLICATORE_PREMIUM}{'×'}.
            Nuovo account: 30 minuti in regalo.
          </div>

          {/* Pacchetti — L'UNICO listino */}
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, fontFamily: FONT, marginBottom: 8 }}>RICARICA</div>
          {PACCHETTI.map(p => {
            const ore = oreIncluse(p);
            return (
              <button key={p.id} disabled={caricando} onClick={() => compra(p.id)} style={{
                display: 'flex', alignItems: 'center', width: '100%', gap: 12, cursor: 'pointer',
                padding: '15px 16px', marginBottom: 8, borderRadius: 16, fontFamily: FONT,
                background: p.consigliato ? `linear-gradient(145deg, ${tc.accent1 || '#5b8cff'}18, ${tc.accent2 || '#38e1ff'}10)` : tc.cardBg,
                border: p.consigliato ? `1.5px solid ${tc.accent1 || '#5b8cff'}55` : `1px solid ${tc.cardBorder}`,
                color: tc.textPrimary, textAlign: 'left', opacity: caricando ? 0.6 : 1,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>
                    {p.nome} {'·'} {ore.standard}
                    {p.consigliato && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                      padding: '3px 8px', borderRadius: 999, color: '#fff',
                      background: `linear-gradient(90deg, ${tc.accent1 || '#5b8cff'}, ${tc.accent2 || '#38e1ff'})` }}>CONSIGLIATO</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: tc.textMuted, marginTop: 2 }}>
                    con voce premium: {ore.premium}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 850, color: tc.accent2 || '#38e1ff' }}>
                  {'€'}{String(p.euro).replace('.', ',')}
                </div>
              </button>
            );
          })}

          {/* Voucher */}
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, fontFamily: FONT, margin: '14px 0 8px' }}>HAI UN VOUCHER?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={codice} onChange={(e) => setCodice(e.target.value.toUpperCase())} placeholder="CODICE"
              style={{ flex: 1, padding: '12px 14px', borderRadius: 13, fontFamily: FONT, fontSize: 14,
                background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.textPrimary }} />
            <button onClick={usaVoucher} disabled={!codice} style={{
              padding: '12px 18px', borderRadius: 13, border: 'none', cursor: 'pointer', fontFamily: FONT,
              fontSize: 14, fontWeight: 800, color: '#fff',
              background: tc.btnGradient || 'linear-gradient(90deg,#5b8cff,#38e1ff)',
            }}>Usa</button>
          </div>
          {esito && <div style={{ fontSize: 12, marginTop: 6, fontFamily: FONT, color: esito.startsWith('Fatto') ? COLORI.verde : COLORI.rosso }}>{esito}</div>}

          {/* Storico */}
          {dati?.storico?.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, fontFamily: FONT, margin: '16px 0 6px' }}>LE TUE RICARICHE</div>
              <div style={card}>
                {dati.storico.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 2px',
                    fontSize: 12.5, fontFamily: FONT,
                    borderBottom: i < dati.storico.length - 1 ? `1px solid ${tc.cardBorder}` : 'none' }}>
                    <span style={{ color: tc.textMuted, minWidth: 74 }}>{r.quando}</span>
                    <span style={{ flex: 1, color: tc.textSecondary }}>
                      {r.tipo === 'acquisto' ? 'Ricarica' : r.tipo === 'benvenuto' ? 'Benvenuto' : r.tipo === 'omaggio' ? 'Omaggio' : r.tipo === 'regalo_in' ? 'Regalo' : 'Voucher'}
                    </span>
                    <span style={{ fontWeight: 800, color: COLORI.verde }}>{r.testo}</span>
                    {r.euro && <span style={{ color: tc.textMuted }}>{r.euro}</span>}
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </main>
  );
}
