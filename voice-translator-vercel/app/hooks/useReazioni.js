'use client';
import { useState, useCallback, useRef, useEffect } from 'react';

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
      });
      return await r.json();
    } catch { return null; }
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
    }
  }, [chiama, mie]);

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
