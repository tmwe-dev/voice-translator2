'use client';
// ═══════════════════════════════════════════════════════════════
// ContenutiChat — la striscia di link condivisi in chat (b.154)
//
// Richiesta di Luca (14/8): lo spazio sotto il campo di scrittura,
// liberato spostando il microfono, mostra "miniature oppure video e
// a destra riassunto o accesso all'articolo" — cioe i link che si
// scambiano in chat, con scorrimento, invece di restare testo nudo
// in mezzo ai messaggi.
//
// Non tocca i messaggi ne il loro schema: legge SOLO l'array che gia
// arriva a RoomView (nessun nuovo campo, nessun rischio sul percorso
// che oggi funziona). Un URL in un messaggio -> /api/topics/link lo
// trasforma in scheda (stesso meccanismo di Mondo News, cache
// condivisa). Il tocco apre SchedaArgomento, gia costruita, che ha
// gia dentro sintesi/accesso all'articolo o il player video.
// ═══════════════════════════════════════════════════════════════

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FONT, vibrate } from '../lib/constants.js';

const RE_URL = /https?:\/\/[^\s"'<>]+/gi;

/** Estrae, in ordine di apparizione e senza duplicati, gli URL dei messaggi. */
function estraiLink(messages) {
  const visti = new Set();
  const trovati = [];
  for (const m of messages || []) {
    const testo = m.original || m.text || '';
    const match = testo.match(RE_URL);
    if (!match) continue;
    for (const url of match) {
      const pulito = url.replace(/[.,;:!?)\]]+$/, ''); // punteggiatura di fine frase
      if (visti.has(pulito)) continue;
      visti.add(pulito);
      trovati.push(pulito);
    }
  }
  return trovati;
}

function ContenutiChat({ messages, S, L, onApri }) {
  const [schede, setSchede] = useState({}); // url -> {tipo, dati} | 'errore' | 'carico'
  const richiesti = useRef(new Set());
  const C = S.colors || {};

  const link = useMemo(() => estraiLink(messages), [messages]);

  useEffect(() => {
    for (const url of link) {
      if (richiesti.current.has(url)) continue;
      richiesti.current.add(url);
      setSchede(s => ({ ...s, [url]: 'carico' }));
      (async () => {
        try {
          const r = await fetch(`/api/topics/link?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
          // b.363 — prima la lettura non era protetta e la scheda restava
          // per sempre in stato "carico": chi guardava non vedeva mai un esito.
          const d = await r.json().catch(() => null);
          setSchede(s => ({ ...s, [url]: d?.ok ? { tipo: d.tipo, dati: d.dati } : 'errore' }));
        } catch (e) {
          // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
          // registro non compariva nulla, e il motivo vero (rete caduta, attesa
          // scaduta, credito finito, server rotto) restava irrecuperabile.
          if (e?.name !== 'AbortError') console.warn('[b.363] /api/topics/link:', e?.message || e);
          setSchede(s => ({ ...s, [url]: 'errore' })); }
      })();
    }
  }, [link]);

  const pronte = link
    .map(url => ({ url, scheda: schede[url] }))
    .filter(x => x.scheda && x.scheda !== 'errore');

  if (pronte.length === 0) return null;

  return (
    <div role="region" aria-label={L('contenutiChatAria')} style={{
      display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 10px',
      flexShrink: 0, WebkitOverflowScrolling: 'touch',
    }}>
      {pronte.map(({ url, scheda }) => {
        const caricando = scheda === 'carico';
        const dati = caricando ? null : scheda.dati;
        const miniatura = caricando ? '' : (scheda.tipo === 'video' ? dati.miniatura : dati.immagine);
        const titolo = caricando ? L('contenutiChatCarico') : (dati.titolo || dati.fonte || dati.canale || url);
        return (
          <button key={url} disabled={caricando}
            onClick={() => { vibrate(8); onApri({ tipo: scheda.tipo, dati: { ...dati, fonti: [{ fonte: dati.fonte }] } }); }}
            style={{
              flexShrink: 0, width: 148, borderRadius: 14, overflow: 'hidden',
              background: C.card || 'rgba(255,255,255,0.04)', border: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.07)'}`,
              cursor: caricando ? 'default' : 'pointer', textAlign: 'left', padding: 0, fontFamily: FONT,
              opacity: caricando ? 0.55 : 1,
            }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: `${C.accent1 || '#5b8cff'}12` }}>
              {miniatura && (
                // eslint-disable-next-line @next/next/no-img-element -- dominio esterno ignoto
                <img src={miniatura} alt="" referrerPolicy="no-referrer"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: C.textPrimary,
              lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {titolo}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default memo(ContenutiChat);
