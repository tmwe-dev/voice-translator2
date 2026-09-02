'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { createLogger } from '../lib/logger.js';
const log = createLogger('useReazioni');   // b.604 — niente console.* sparsi: tutto dal logger

// ═══════════════════════════════════════════════════════════════
// useReazioni — i conteggi dei pollici e dei cuori.
//
// DUE REGOLE che rendono la cosa piacevole invece che lenta:
//
//  1. il numero cambia SUBITO sullo schermo, prima che il server
//     risponda. Se poi il server dice un'altra cosa, vince lui. Un
//     pollice che aspetta mezzo secondo non lo tocca piu nessuno.
//
//  2. si chiedono i conteggi di tutti i messaggi visibili IN UNA
//     CHIAMATA, non una per messaggio.
// ═══════════════════════════════════════════════════════════════

export default function useReazioni({ roomId, roomSessionToken, msgIds = [] }) {
  const [conte, setConte] = useState({});
  const [mie, setMie] = useState({});
  const ultimaChiave = useRef('');

  const chiama = useCallback(async (corpo) => {
    if (!roomId) return null;
    try {
      const r = await fetch('/api/reazioni', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, roomSessionToken, ...corpo }),
        // b.363 — le reazioni non avevano scadenza: una rete appesa
        // lasciava il pollice a meta, gia contato sullo schermo ma mai
        // consegnato, e il ripristino di b.126 non partiva mai.
        signal: AbortSignal.timeout(10000),
      });
      // b.363 — quando il guardiano risponde 429 il corpo e HTML: la
      // lettura esplodeva dentro il try e la reazione tornava indietro
      // senza che restasse traccia del motivo.
      const d = await r.json().catch(() => null);
      if (!d) log.warn('[reazioni] risposta non leggibile, stato', r.status);
      return d;
    } catch (e) {
      // b.363 — questo ripiego cambia cio che l'utente vede (la reazione
      // torna indietro) ma non registrava nulla: in produzione era un
      // guasto invisibile.
      log.warn('[reazioni] chiamata non riuscita:', e?.message || e);
      return null;
    }
  }, [roomId, roomSessionToken]);

  // ── Carica i conteggi dei messaggi visibili, in blocco ──
  const carica = useCallback(async (ids) => {
    if (!ids?.length) return;
    const d = await chiama({ azione: 'leggi', msgIds: ids });
    if (d?.ok) {
      setConte(p => ({ ...p, ...d.conte }));
      setMie(p => ({ ...p, ...d.mie }));
    }
  }, [chiama]);

  useEffect(() => {
    if (!roomId || !msgIds.length) return;
    const chiave = msgIds.join(',');
    if (chiave === ultimaChiave.current) return;
    ultimaChiave.current = chiave;
    carica(msgIds);
  }, [roomId, msgIds, carica]);

  // ── Reagire ──
  const reagisci = useCallback(async (msgId, tipo) => {
    // ── b.126 · si annota com'era PRIMA, per poter tornare indietro ──
    //
    // L'anticipo sullo schermo e giusto: una reazione deve comparire
    // subito. Ma se il server rifiuta — succede sempre in modalita
    // Direct, dove /api/reazioni e chiuso dal cancello — prima non
    // succedeva niente: la reazione restava li, visibile solo a chi
    // l'aveva messa, e non era mai stata consegnata a nessuno.
    //
    // Mostrare una cosa che non e successa e la stessa bugia della
    // spunta di consegna corretta in b.120.
    const conteDiPrima = conte[msgId];
    const mieDiPrima = mie[msgId];

    // Subito sullo schermo: si toglie se c'era, si mette se non c'era, e
    // su/giu si escludono come fa il server.
    setConte(prima => {
      const c = { ...(prima[msgId] || { su: 0, giu: 0, cuore: 0 }) };
      const avevo = mie[msgId] || {};
      if (avevo[tipo]) c[tipo] = Math.max(0, (c[tipo] || 0) - 1);
      else {
        c[tipo] = (c[tipo] || 0) + 1;
        const opposto = tipo === 'su' ? 'giu' : tipo === 'giu' ? 'su' : null;
        if (opposto && avevo[opposto]) c[opposto] = Math.max(0, (c[opposto] || 0) - 1);
      }
      return { ...prima, [msgId]: c };
    });
    setMie(prima => {
      const m = { ...(prima[msgId] || {}) };
      if (m[tipo]) delete m[tipo];
      else {
        m[tipo] = 1;
        const opposto = tipo === 'su' ? 'giu' : tipo === 'giu' ? 'su' : null;
        if (opposto) delete m[opposto];
      }
      return { ...prima, [msgId]: m };
    });

    const d = await chiama({ azione: 'reagisci', msgId, tipo });
    // La verita del server vince sempre sull'anticipo dello schermo.
    if (d?.ok) {
      setConte(p => ({ ...p, [msgId]: { ...(p[msgId] || {}), ...d.conte } }));
      setMie(p => ({ ...p, [msgId]: d.mie || {} }));
      return;
    }
    // b.126 — il server non l'ha presa: si torna com'era. Meglio una
    // reazione che sparisce di una che finge di esserci.
    setConte(p => {
      const q = { ...p };
      if (conteDiPrima === undefined) delete q[msgId]; else q[msgId] = conteDiPrima;
      return q;
    });
    setMie(p => {
      const q = { ...p };
      if (mieDiPrima === undefined) delete q[msgId]; else q[msgId] = mieDiPrima;
      return q;
    });
  }, [chiama, mie, conte]);

  // ── Conservare un messaggio (il server decide se puo) ──
  const conserva = useCallback((msgId, testo, lang, rispostaA) => {
    if (!msgId || !testo) return;
    chiama({ azione: 'salva', msgId, testo, lang, rispostaA });
  }, [chiama]);

  // ── Cosa vede chi entra adesso ──
  const leggiStorico = useCallback(async () => {
    const d = await chiama({ azione: 'storico' });
    return d?.ok ? d : { recenti: [], rilevanti: [], conservazione: false };
  }, [chiama]);

  return { conte, mie, reagisci, conserva, leggiStorico, ricarica: carica };
}
