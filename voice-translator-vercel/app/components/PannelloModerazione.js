'use client';
import { useState, useCallback, useEffect } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { useApp } from '../contexts/AppContext.js';
import { subscribeTick } from '../lib/ticker.js';

// ═══════════════════════════════════════════════════════════════
// PANNELLO DI MODERAZIONE — visibile solo a chi ospita.
//
// Tre gesti, nessuna schermata in piu da imparare:
//   · qualcuno bussa   -> Ammetti / Rifiuta
//   · qualcuno esagera -> Blocca (e non rientra)
//   · qualcuno sbagliato -> Sblocca
//
// Le persone in una stanza sono i loro NOMI: e l'unita che usa gia tutto il
// resto dell'app. Bloccare "Marco" blocca "marco " e "MARCO".
// ═══════════════════════════════════════════════════════════════

export default function PannelloModerazione({ roomId, roomSessionToken, membri = [], mioNome, aperto, onChiudi }) {
  const { L, S } = useApp();
  const C = S?.colors || {};

  const [inAttesa, setInAttesa] = useState([]);
  const [bloccati, setBloccati] = useState([]);
  const [inCorso, setInCorso] = useState('');
  const [avviso, setAvviso] = useState('');

  const chiama = useCallback(async (azione, nome) => {
    const r = await fetch('/api/moderazione', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione, roomId, nome, roomSessionToken }),
    });
    return r.json().catch(() => ({}));
  }, [roomId, roomSessionToken]);

  const aggiorna = useCallback(async () => {
    if (!roomId || !roomSessionToken) return;
    const d = await chiama('richieste');
    if (d?.ok) { setInAttesa(d.inAttesa || []); setBloccati(d.bloccati || []); }
  }, [chiama, roomId, roomSessionToken]);

  // Chi bussa aspetta dietro la porta: ogni otto secondi si guarda.
  useEffect(() => {
    if (!aperto) return undefined;
    return subscribeTick(8000, aggiorna, { immediate: true });
  }, [aperto, aggiorna]);

  const agisci = useCallback(async (azione, nome) => {
    vibrate(15);
    setInCorso(`${azione}:${nome}`);
    setAvviso('');
    const d = await chiama(azione, nome);
    setInCorso('');
    if (d?.error) { setAvviso(d.error); return; }
    await aggiorna();
  }, [chiama, aggiorna]);

  if (!aperto) return null;

  const riga = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
    borderRadius: 12, background: C.overlayBg, border: `1px solid ${C.overlayBorder}`,
    marginBottom: 6,
  };
  const pill = (colore, pieno) => ({
    padding: '7px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: FONT,
    fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
    background: pieno ? colore : 'transparent',
    border: `1px solid ${pieno ? colore : `${colore}55`}`,
    color: pieno ? '#fff' : colore,
  });
  const titoletto = {
    fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase',
    color: C.textMuted, margin: '14px 0 7px', fontFamily: FONT,
  };

  // Chi ospita non compare fra le persone da moderare.
  const altri = membri
    .map(m => (typeof m === 'string' ? m : m?.name))
    .filter(n => n && n.toLowerCase() !== (mioNome || '').toLowerCase());

  return (
    <div style={{
      padding: 16, borderRadius: 18, fontFamily: FONT,
      background: C.cardBg, border: `1px solid ${C.cardBorder}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Icon name="lock" size={16} color={C.accent1} />
        <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{L('modWhoEnters')}</span>
        {onChiudi && (
          <button onClick={onChiudi} aria-label={L('closeWord')} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: C.textMuted, display: 'flex', padding: 2,
          }}>
            <Icon name="x" size={14} color={C.textMuted} />
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.5 }}>
        {L('modDesc')}
      </div>

      {avviso && (
        <div style={{ fontSize: 12, color: C.accent3, marginTop: 10 }}>{avviso}</div>
      )}

      {/* ── Chi bussa ── */}
      <div style={titoletto}>{L('modKnocking')} ({inAttesa.length})</div>
      {inAttesa.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textMuted }}>{L('modNobodyWaiting')}</div>
      ) : inAttesa.map(nome => (
        <div key={nome} style={riga}>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.textPrimary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nome}
          </span>
          <button disabled={!!inCorso} onClick={() => agisci('ammetti', nome)} style={pill(C.accent1 || '#5b8cff', true)}>
            {L('modAdmit')}
          </button>
          <button disabled={!!inCorso} onClick={() => agisci('rifiuta', nome)} style={pill(C.textMuted || '#888', false)}>
            {L('modReject')}
          </button>
        </div>
      ))}

      {/* ── Chi e dentro ── */}
      <div style={titoletto}>{L('modInRoom')} ({altri.length})</div>
      {altri.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textMuted }}>{L('modOnlyYou')}</div>
      ) : altri.map(nome => (
        <div key={nome} style={riga}>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.textPrimary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nome}
          </span>
          <button disabled={!!inCorso} onClick={() => agisci('segnala', nome)} style={pill(C.textMuted || '#888', false)}>
            {L('modReport')}
          </button>
          <button disabled={!!inCorso} onClick={() => agisci('blocca', nome)} style={pill(C.accent3 || '#e5484d', false)}>
            {L('modBlock')}
          </button>
        </div>
      ))}

      {/* ── Chi e fuori ── */}
      {bloccati.length > 0 && (
        <>
          <div style={titoletto}>{L('modBlocked')} ({bloccati.length})</div>
          {bloccati.map(nome => (
            <div key={nome} style={riga}>
              <span style={{ flex: 1, fontSize: 13.5, color: C.textMuted, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nome}
              </span>
              <button disabled={!!inCorso} onClick={() => agisci('sblocca', nome)} style={pill(C.accent1 || '#5b8cff', false)}>
                {L('modUnblock')}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
