'use client';
import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { parlaAmico, parlaTurno } from '../../lib/compagni/cliente.js';

// ═══════════════════════════════════════════════════════════════
// AmicoChat — parla con un Compagno. Se ha la memoria accesa (🧠) ti
// ricorda nel tempo. Chat semplice + voce opzionale. (Luca)
// ═══════════════════════════════════════════════════════════════

function AmicoChat({ compagni, L, lingua, userToken, testoP, muto, accent, card, bordo }) {
  const [scelto, setScelto] = useState(null);
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto] = useState('');
  const [attende, setAttende] = useState(false);
  const [errore, setErrore] = useState('');
  const fondo = useRef(null);

  useEffect(() => { if (fondo.current) fondo.current.scrollIntoView({ behavior: 'smooth' }); }, [messaggi, attende]);

  const invia = useCallback(async () => {
    const t = testo.trim();
    if (!t || !scelto || attende) return;
    setErrore('');
    const nuovi = [...messaggi, { ruolo: 'persona', testo: t }];
    setMessaggi(nuovi); setTesto(''); setAttende(true);
    try {
      const d = await parlaAmico({ compagnoId: scelto.id, messaggi: nuovi, lingua, userToken });
      setMessaggi((m) => [...m, { ruolo: 'compagno', testo: d.risposta }]);
      if (d.voceId) parlaTurno({ voceId: d.voceId, testo: d.risposta, lingua, userToken });
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : (e.status === 401 ? L('lifeLoginNeeded') : L('lifeError')));
    } finally { setAttende(false); }
  }, [testo, scelto, attende, messaggi, lingua, userToken, L]);

  // ── Scelta del Compagno ──
  if (!scelto) {
    return (
      <div>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifePickFriend')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {compagni.map((c) => (
            <button key={c.id} onClick={() => { vibrate(8); setScelto(c); setMessaggi([]); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, background: card, border: bordo, cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
              <span style={{ fontSize: 22 }}>{c.emoji}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, color: testoP, fontSize: 14 }}>{c.nome} {c.memoria ? '🧠' : ''}</span>
                <span style={{ display: 'block', fontSize: 11, color: muto }}>{c.ruolo}</span>
              </span>
              <span style={{ color: muto }}>›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Conversazione ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: bordo, marginBottom: 10 }}>
        <button onClick={() => setScelto(null)} style={{ background: card, border: bordo, borderRadius: 10, padding: 7, cursor: 'pointer' }}>
          <Icon name="back" size={16} color={testoP} />
        </button>
        <span style={{ fontSize: 22 }}>{scelto.emoji}</span>
        <span style={{ fontWeight: 700, color: testoP }}>{scelto.nome} {scelto.memoria ? '🧠' : ''}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messaggi.map((m, i) => (
          <div key={i} style={{ alignSelf: m.ruolo === 'persona' ? 'flex-end' : 'flex-start', maxWidth: '82%',
            padding: '9px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, fontFamily: FONT,
            background: m.ruolo === 'persona' ? accent : card, color: m.ruolo === 'persona' ? '#04121c' : testoP,
            border: m.ruolo === 'persona' ? 'none' : bordo }}>
            {m.testo}
          </div>
        ))}
        {attende && <div style={{ alignSelf: 'flex-start', color: muto, fontSize: 13, padding: '4px 8px' }}>…</div>}
        <div ref={fondo} />
      </div>

      {errore && <div style={{ color: '#f87171', fontSize: 13, padding: '6px 0' }}>{errore}</div>}

      <div style={{ display: 'flex', gap: 8, paddingTop: 10 }}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') invia(); }}
          placeholder={L('lifeChatPh')} style={{ flex: 1, padding: 12, borderRadius: 12, border: bordo, background: card, color: testoP, fontSize: 15, fontFamily: FONT }} />
        <button onClick={invia} disabled={attende} style={{ padding: '0 16px', borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>
          <Icon name="send" size={16} color="#04121c" />
        </button>
      </div>
    </div>
  );
}

export default memo(AmicoChat);
