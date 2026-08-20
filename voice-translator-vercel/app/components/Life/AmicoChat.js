'use client';
import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { parlaAmico, parlaTurno } from '../../lib/compagni/cliente.js';
import { obiettiviAttivi } from '../../lib/compagni/obiettivi.js';
import { memGet, memSet } from '../../lib/memoria.js';
import CompagnoLive from './CompagnoLive.js';

// b.231 — la storia della chat ora PERSISTE per Compagno (prima viveva solo
// in memoria e spariva a ogni ricarica o cambio Compagno). Sta sul dispositivo.
const CHIAVE_CHAT = (id) => `vt-chat-${id}`;
function caricaChat(id) {
  if (typeof window === 'undefined' || !id) return [];
  try { const s = memGet(CHIAVE_CHAT(id)); const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a.slice(-100) : []; }
  catch { return []; }
}
function salvaChat(id, messaggi) {
  if (typeof window === 'undefined' || !id) return;
  try { memSet(CHIAVE_CHAT(id), JSON.stringify((messaggi || []).slice(-100))); }
  catch { /* quota/privato: si perde solo la persistenza, non la chat viva */ }
}

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
  // b.316 — conversazione VOCALE dal vivo (widget ElevenLabs, personalita
  // del Compagno iniettata all'avvio). Un contenitore, mille personaggi.
  const [dalVivo, setDalVivo] = useState(false);
  const fondo = useRef(null);
  // b.232 — riferimento sempre aggiornato al Compagno scelto, per evitare che
  // la risposta di A (in arrivo) finisca nella chat di B se si cambia Compagno.
  const sceltoRef = useRef(scelto);
  useEffect(() => { sceltoRef.current = scelto; }, [scelto]);

  useEffect(() => { if (fondo.current) fondo.current.scrollIntoView({ behavior: 'smooth' }); }, [messaggi, attende]);

  // b.231 — salva la conversazione sul dispositivo a ogni cambiamento.
  useEffect(() => { if (scelto) salvaChat(scelto.id, messaggi); }, [messaggi, scelto]);

  // b.232 — cambiando Compagno azzera attesa/errore: prima B restava con il
  // "…" e il tasto invio disabilitato finché la vecchia richiesta di A non finiva.
  useEffect(() => { setAttende(false); setErrore(''); }, [scelto]);

  const invia = useCallback(async () => {
    const t = testo.trim();
    if (!t || !scelto || attende) return;
    setErrore('');
    const idAtt = scelto.id;
    const nuovi = [...messaggi, { ruolo: 'persona', testo: t }];
    setMessaggi(nuovi); setTesto(''); setAttende(true);
    try {
      const d = await parlaAmico({ compagnoId: scelto.id, messaggi: nuovi, lingua, userToken, obiettivi: obiettiviAttivi() });
      // b.232 — se nel frattempo si è cambiato Compagno, scarta la risposta.
      if (sceltoRef.current?.id !== idAtt) return;
      setMessaggi((m) => [...m, { ruolo: 'compagno', testo: d.risposta }]);
      // b.238 — la voce riceve anche COME il Compagno voleva dirlo.
      if (d.voceId) parlaTurno({ voceId: d.voceId, testo: d.risposta, lingua, userToken, modoVoce: d.modoVoce });
    } catch (e) {
      if (sceltoRef.current?.id !== idAtt) return;
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : (e.status === 401 ? L('lifeLoginNeeded') : L('lifeError')));
    } finally { if (sceltoRef.current?.id === idAtt) setAttende(false); }
  }, [testo, scelto, attende, messaggi, lingua, userToken, L]);

  // ── Scelta del Compagno ──
  if (!scelto) {
    return (
      <div>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifePickFriend')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {compagni.map((c) => (
            <button key={c.id} onClick={() => { vibrate(8); setScelto(c); setMessaggi(caricaChat(c.id)); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, background: card, border: bordo, cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
              <img src={c.avatar} alt="" width={42} height={42} style={{ borderRadius: 10, display: 'block', flexShrink: 0, objectFit: 'cover' }} />
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
        <button onClick={() => setScelto(null)} aria-label={L('lifeBack')} style={{ background: card, border: bordo, borderRadius: 10, padding: 7, cursor: 'pointer' }}>
          <Icon name="back" size={16} color={testoP} />
        </button>
        <img src={scelto.avatar} alt={scelto.nome} width={32} height={32} style={{ borderRadius: 8, display: 'block', objectFit: 'cover' }} />
        <span style={{ fontWeight: 700, color: testoP, flex: 1 }}>{scelto.nome} {scelto.memoria ? '🧠' : ''}</span>
        {/* b.316 — parla DAL VIVO col Compagno: voce in tempo reale. */}
        <button onClick={() => { vibrate(8); setDalVivo((v) => !v); }} aria-pressed={dalVivo}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800,
            background: dalVivo ? `${accent}22` : accent, color: dalVivo ? accent : '#04121c', border: dalVivo ? `1px solid ${accent}` : 'none' }}>
          <Icon name="mic" size={14} color={dalVivo ? accent : '#04121c'} /> {dalVivo ? 'Chiudi' : 'Dal vivo'}
        </button>
      </div>

      {dalVivo && (
        <CompagnoLive compagno={scelto} lingua={lingua} onChiudi={() => setDalVivo(false)}
          {...{ testoP, muto, accent, card, bordo }} />
      )}

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
          aria-label={L('lifeChatPh')} placeholder={L('lifeChatPh')} style={{ flex: 1, padding: 12, borderRadius: 12, border: bordo, background: card, color: testoP, fontSize: 15, fontFamily: FONT }} />
        <button onClick={invia} disabled={attende} aria-label={L('send')} style={{ padding: '0 16px', borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>
          <Icon name="send" size={16} color="#04121c" />
        </button>
      </div>
    </div>
  );
}

export default memo(AmicoChat);
