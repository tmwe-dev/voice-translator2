'use client';
import { memo, useState, useEffect, useCallback } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// MondoPersona — il profilo pubblico di una persona (Fase 1)
//
// Si segue una persona per le sue IDEE, non per quello che pubblica:
// qui si vede il suo nome (o nickname), quanti la seguono, e DOVE ha
// discusso e commentato. Toccando una voce si apre quella discussione.
//
// Nessuna email, nessun dato privato: solo l'attivita pubblica.
// ═══════════════════════════════════════════════════════════════

function MondoPersona({ publicId, onClose, onOpenDiscussione }) {
  const { L, S, userToken } = useApp();
  const C = S?.colors || {};
  const [p, setP] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [seguito, setSeguito] = useState(false);
  // b.255 — mancava del tutto un posto dove dire che il Segui non e
  // riuscito: il pulsante tornava indietro da solo, senza spiegazioni.
  const [erroreSegui, setErroreSegui] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/mondo/discussioni?persona=${encodeURIComponent(publicId)}`, { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
        // b.363 — prima la lettura non era protetta: il profilo restava vuoto
        // e nessuno, ne' l'utente ne' il registro, sapeva perche'.
        if (r.ok && vivo) { const d = await r.json().catch(() => null); if (d) setP(d.profilo || null); else console.warn('[b.363] mondo/persona: risposta illeggibile'); }
      } catch { /* profilo non caricato: resta il minimo */ }
      if (vivo) setCaricando(false);
    })();
    return () => { vivo = false; };
  }, [publicId]);

  const toggleSegui = useCallback(async () => {
    if (!userToken) return;
    const gia = seguito;
    setSeguito(!gia);
    vibrate(8);
    try {
      const r = await fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: gia ? 'smetti' : 'segui', userToken, followedPublicId: publicId }),
      });
      if (!r.ok) throw new Error('rifiutato');
      setErroreSegui('');
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
      setSeguito(gia); setErroreSegui(L('genericError')); }
  }, [userToken, seguito, publicId, L]);

  const bg = C.bg || '#0a0e1a';
  const card = C.glassCard || 'rgba(12,16,30,0.65)';
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.06)'}`;
  const testoP = C.textPrimary || '#eef2ff';
  const muto = C.textMuted || 'rgba(242,244,247,0.6)';
  const accent = C.accent1 || '#26D9B0';

  const sezione = (titolo) => (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, color: muto, textTransform: 'uppercase', margin: '16px 0 8px' }}>{titolo}</div>
  );
  // b.482 — LE RIGHE DEL PROFILO PRENDONO LE MISURE DEL TEMPLATE. Il
  // rientro laterale era dodici mentre tutto il resto della schermata
  // stava a sedici: due rientri diversi incolonnati si vedono, anche
  // quando chi guarda non sa dire cosa non torna. Ora venti, come la
  // testata e il corpo. E l'altezza utile arriva a quarantaquattro, che
  // e la misura sotto la quale un dito comincia a sbagliare bersaglio.
  const voce = (testo, onClick) => (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', padding: '14px 20px', marginBottom: 8, borderRadius: 12,
      minHeight: 44,
      background: card, border: bordo, cursor: 'pointer', fontFamily: FONT, color: testoP, fontSize: 13,
      overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', WebkitTapHighlightColor: 'transparent',
    }}>{testo}</button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 95, background: bg, display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', flexShrink: 0, borderBottom: bordo }}>
        {/* b.482 — IL TASTO INDIETRO, che e il piu premuto di ogni
            schermata: sale da trentotto a quarantaquattro, e al posto del
            segno tipografico disegnato a mano porta l'icona vera del set,
            la stessa che usano tutte le altre schermate. */}
        <button onClick={onClose} aria-label={L('closeWord')} style={{
          width: 44, height: 44, borderRadius: 12, cursor: 'pointer', background: card, border: bordo,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: muto, fontSize: 18,
        }}><Icon name="back" size={18} color={muto} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: testoP }}>{p?.nome || (caricando ? '…' : '—')}</div>
          <div style={{ fontSize: 11, color: muto }}>{(p?.seguaci ?? 0)} {L('followersLabel')}</div>
        </div>
        {/* b.482 — la pillola Segui era alta ventinove: sotto la soglia
            del dito. Il rientro interno resta quello di una pillola, a
            cambiare e solo l'altezza utile. */}
        {userToken && (
          <button onClick={toggleSegui} style={{
            padding: '7px 16px', borderRadius: 999, minHeight: 44, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600,
            background: seguito ? 'transparent' : `linear-gradient(135deg, ${accent}, ${C.accent2 || '#5b8cff'})`,
            border: seguito ? bordo : 'none', color: seguito ? muto : '#fff',
          }}>{seguito ? L('following') : L('follow')}</button>
        )}
      </header>

      {/* b.255 — il messaggio che mancava: senza, il pulsante tornava
          indietro da solo e nessuno sapeva perche. */}
      {erroreSegui && (
        <div role="alert" style={{
          margin: '0 20px 8px', padding: '8px 20px', borderRadius: 10,
          background: `${C.statusError || '#ef4444'}18`,
          border: `1px solid ${C.statusError || '#ef4444'}40`,
          color: C.statusError || '#ef4444', fontSize: 12, fontFamily: FONT,
        }}>{erroreSegui}</div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 24px', scrollbarWidth: 'none' }}>
        {p?.discussioni?.length > 0 && (
          <>
            {sezione(L('discussionsLabel'))}
            {p.discussioni.map(d => voce(d.title || '—', () => { vibrate(6); onOpenDiscussione?.(d.id); }))}
          </>
        )}
        {/* b.482 — NIENTE TASTI INVISIBILI: un commento senza testo
            disegnava una riga cliccabile vuota, cioe un bersaglio che si
            preme senza sapere che c'e. Ora porta lo stesso segno di
            "manca" gia usato qui sopra per le discussioni senza titolo. */}
        {p?.commenti?.length > 0 && (
          <>
            {sezione(L('commentsLabel'))}
            {p.commenti.map(c => voce((c.text || '').slice(0, 140) || '—', () => { vibrate(6); onOpenDiscussione?.(c.discussion_id); }))}
          </>
        )}
        {!caricando && !(p?.discussioni?.length) && !(p?.commenti?.length) && (
          <div style={{ textAlign: 'center', color: muto, padding: 28, fontSize: 13 }}>—</div>
        )}
      </div>
    </div>
  );
}

export default memo(MondoPersona);
