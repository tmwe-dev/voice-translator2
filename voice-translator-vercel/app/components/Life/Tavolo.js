'use client';
import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { parlaTavolo, parlaTurno } from '../../lib/compagni/cliente.js';

// ═══════════════════════════════════════════════════════════════
// Tavolo — tu + 2-4 Compagni che conversano insieme. Scrivi, e ognuno
// risponde a te e agli altri, tradotto, con la propria voce. Superficie
// autonoma: NON è una stanza WebRTC. (Luca)
// ═══════════════════════════════════════════════════════════════

function Tavolo({ compagni, L, lingua, userToken, testoP, muto, accent, card, bordo }) {
  const [scelti, setScelti] = useState([]);
  const [avviato, setAvviato] = useState(false);
  const [messaggi, setMessaggi] = useState([]); // {ruolo:'persona'|nome, testo, emoji, colore}
  const [testo, setTesto] = useState('');
  const [attende, setAttende] = useState(false);
  const [errore, setErrore] = useState('');
  const fondo = useRef(null);

  useEffect(() => { if (fondo.current) fondo.current.scrollIntoView({ behavior: 'smooth' }); }, [messaggi, attende]);

  const toggle = (id) => setScelti((s) => s.includes(id) ? s.filter(x => x !== id) : (s.length >= 4 ? s : [...s, id]));
  const perId = new Map(compagni.map(c => [c.id, c]));

  const invia = useCallback(async () => {
    const t = testo.trim();
    if (!t || attende) return;
    setErrore('');
    const storia = [...messaggi, { ruolo: 'persona', testo: t }];
    setMessaggi(storia); setTesto(''); setAttende(true);
    // messaggi per il server: {ruolo, testo} (persona o nome del Compagno)
    const perServer = storia.map(m => ({ ruolo: m.ruolo, testo: m.testo }));
    try {
      const d = await parlaTavolo({ compagni: scelti, messaggi: perServer, lingua, userToken });
      for (const r of (d.risposte || [])) {
        const c = perId.get(r.compagnoId) || {};
        setMessaggi((m) => [...m, { ruolo: r.nome, testo: r.testo, avatar: c.avatar, colore: c.colore }]);
      }
      // voci in sequenza
      for (const r of (d.risposte || [])) {
        if (r.voceId) await parlaTurno({ voceId: r.voceId, testo: r.testo, lingua, userToken });
      }
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : (e.status === 401 ? L('lifeLoginNeeded') : L('lifeError')));
    } finally { setAttende(false); }
  }, [testo, attende, messaggi, scelti, lingua, userToken, L]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scelta dei partecipanti ──
  if (!avviato) {
    return (
      <div>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifeTableWho')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, marginBottom: 14 }}>
          {compagni.map((c) => {
            const on = scelti.includes(c.id);
            return (
              <button key={c.id} onClick={() => { vibrate(6); toggle(c.id); }}
                style={{ padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center', background: on ? `${c.colore}22` : card, border: `1px solid ${on ? c.colore : bordo.split(' ').pop()}`, fontFamily: FONT }}>
                <img src={c.avatar} alt="" width={46} height={46} style={{ borderRadius: 12, display: 'block', margin: '0 auto 6px', objectFit: 'cover' }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: testoP }}>{c.nome}</div>
              </button>
            );
          })}
        </div>
        <button onClick={() => { if (scelti.length >= 2) { vibrate(8); setAvviato(true); setMessaggi([]); } else setErrore(L('lifeNeedCompanions')); }}
          style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: '#04121c', fontWeight: 800, fontSize: 15, fontFamily: FONT }}>
          💬 {L('lifeTableStart')}
        </button>
        {errore && <div style={{ color: '#f87171', fontSize: 13, marginTop: 10 }}>{errore}</div>}
      </div>
    );
  }

  // ── Il tavolo ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: bordo, marginBottom: 10 }}>
        <button onClick={() => setAvviato(false)} style={{ background: card, border: bordo, borderRadius: 10, padding: 7, cursor: 'pointer' }}>
          <Icon name="back" size={16} color={testoP} />
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {scelti.map(id => perId.get(id)).filter(Boolean).map(c => (
            <img key={c.id} src={c.avatar} alt="" width={26} height={26} style={{ borderRadius: 7, display: 'block', objectFit: 'cover' }} />
          ))}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messaggi.map((m, i) => {
          const mio = m.ruolo === 'persona';
          return (
            <div key={i} style={{ alignSelf: mio ? 'flex-end' : 'flex-start', maxWidth: '84%' }}>
              {!mio && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: m.colore || accent, margin: '0 4px 2px' }}>{m.avatar && <img src={m.avatar} alt="" width={16} height={16} style={{ borderRadius: 5, objectFit: 'cover' }} />}{m.ruolo}</div>}
              <div style={{ padding: '9px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, fontFamily: FONT,
                background: mio ? accent : card, color: mio ? '#04121c' : testoP, border: mio ? 'none' : bordo }}>
                {m.testo}
              </div>
            </div>
          );
        })}
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

export default memo(Tavolo);
