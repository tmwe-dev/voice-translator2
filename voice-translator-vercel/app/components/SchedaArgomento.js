'use client';
// ═══════════════════════════════════════════════════════════════
// SchedaArgomento — il popup di lettura/visione (b.153)
//
// La regola, decisa con Luca il 14/8: il contenuto altrui si ospita
// col suo meccanismo ufficiale, mai in copia, e l'autore si vede
// sempre.
//
//   ARTICOLO: miniatura + testata/data bene in vista, la "Sintesi di
//   BarTalk" (testo NOSTRO, scritto dall'AI sui soli dati del cluster,
//   dichiarato come tale), al piu un breve estratto virgolettato con
//   la fonte (diritto di citazione, art. 70 L.633/41), e il bottone
//   primario "Leggi su [testata]" verso l'originale. MAI il testo
//   integrale.
//
//   VIDEO: il player YouTube incorporato ufficiale (nocookie), con
//   titolo e nome del canale leggibili: visualizzazioni e monetizza-
//   zione restano al creatore. E il canale autorizzato da YouTube.
//
// La sintesi si GENERA su richiesta (costa, addebitata come /api/
// summary) ma la cache condivisa la rende gratis a chi arriva dopo.
// ═══════════════════════════════════════════════════════════════

import { memo, useState, useEffect, useCallback } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { useApp } from '../contexts/AppContext.js';
import AnteprimaCoperta from './ui/AnteprimaCoperta.js';

function SchedaArgomento({ aperta, tipo, dati, C, onClose, onParlane }) {
  const { L, prefs, userToken } = useApp();
  const [sintesiAI, setSintesiAI] = useState('');
  const [generando, setGenerando] = useState(false);
  const [serveAccount, setServeAccount] = useState(false);
  const [errSintesi, setErrSintesi] = useState(false); // b.232 — 402/500 non erano più mostrati

  // Ogni scheda nuova riparte pulita; e appena si apre si CHIEDE la
  // cache condivisa: se qualcuno ha gia pagato la sintesi, arriva
  // gratis senza premere niente.
  // b.324 — audit Mondo D5: Escape chiude il LETTORE (non butta alla Home:
  // il gestore globale ora lascia la mano ai dialoghi aperti).
  useEffect(() => {
    if (!aperta) return;
    const suTasto = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', suTasto);
    return () => document.removeEventListener('keydown', suTasto);
  }, [aperta, onClose]);

  useEffect(() => {
    setSintesiAI(''); setServeAccount(false); setErrSintesi(false); setGenerando(false);
    if (!aperta || tipo !== 'articolo' || !dati?.titolo) return;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/topics/riassunto', { signal: AbortSignal.timeout(60000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titolo: dati.titolo, lang: prefs.uiLang || 'en' }),
        });
        if (r.ok && vivo) {
          // b.363 — prima la lettura non era protetta: una risposta rotta
          // buttava fuori e la scheda restava muta senza spiegazioni.
          const d = await r.json().catch(() => null);
          if (d?.daCache && d.sintesi) setSintesiAI(d.sintesi);
        }
      } catch { /* la cache non risponde: si potra generare a mano */ }
    })();
    return () => { vivo = false; };
  }, [aperta, tipo, dati, prefs.uiLang]);

  const genera = useCallback(async () => {
    if (generando || !dati) return;
    setGenerando(true); setServeAccount(false);
    vibrate(10);
    try {
      const r = await fetch('/api/topics/riassunto', { signal: AbortSignal.timeout(60000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titolo: dati.titolo, sintesi: dati.sintesi,
          fonti: (dati.fonti || []).map(f => ({ fonte: f.fonte, titolo: f.titolo })),
          lang: prefs.uiLang || 'en', userToken,
        }),
      });
      if (r.status === 401) { setServeAccount(true); return; }
      // b.232 — prima 402 (credito) e 500 non mostravano nulla: click "morto".
      if (!r.ok) { setErrSintesi(true); return; }
      // b.363 — prima la lettura non era protetta: con una risposta rotta il
      // tasto "genera" tornava a essere un click morto.
      const d = await r.json().catch(() => null);
      if (!d) { setErrSintesi(true); return; }
      if (d.sintesi) setSintesiAI(d.sintesi);
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/topics/riassunto:', e?.message || e);
      setErrSintesi(true); }
    finally { setGenerando(false); }
  }, [dati, generando, prefs.uiLang, userToken]);

  if (!aperta || !dati) return null;
  const bordo = `1px solid ${C.cardBorder}`;
  const fontePrima = dati.fonti?.[0]?.fonte || dati.canale || '';

  return (
    <div role="dialog" aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(3,5,12,0.72)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
      <div style={{
        width: '100%', maxWidth: 680, maxHeight: '88dvh', overflowY: 'auto',
        // b.324 — D4: lo scorrimento del corpo deve funzionare anche col
        // dito sopra il video e senza trascinarsi dietro la pagina sotto.
        WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
        background: C.bg || '#070a14', borderRadius: '20px 20px 0 0',
        border: bordo, borderBottom: 'none', fontFamily: FONT,
        // b.326 — audit Mondo D3: con contenuti corti (video) la fila delle
        // azioni cadeva nella fascia della barra di navigazione fissa: un
        // tocco "fantasma" atterrava sulla barra sotto (Home / menu). Ora la
        // scheda tiene sempre le azioni SOPRA quella fascia.
        paddingBottom: 'calc(76px + env(safe-area-inset-bottom))',
      }}>
        {/* ─── Testata della scheda ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 0' }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: C.textMuted }}>
            {fontePrima}
          </span>
          <button onClick={onClose} aria-label={L('goBack')} style={{
            width: 32, height: 32, borderRadius: 10, cursor: 'pointer',
            background: C.card, border: bordo, color: C.textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="x" size={14} color={C.textMuted} />
          </button>
        </div>

        {/* ─── VIDEO: il player ufficiale ─── */}
        {tipo === 'video' && (
          <div style={{ padding: '10px 14px 0' }}>
            <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${dati.id}`}
                title={dati.titolo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
            </div>
          </div>
        )}

        {/* ─── ARTICOLO: la miniatura ─── */}
        {tipo === 'articolo' && dati.immagine && (
          <div style={{ padding: '10px 14px 0' }}>
            <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 14, overflow: 'hidden', background: `linear-gradient(135deg, ${C.accent}14, ${C.purple}18)` }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- dominio esterno ignoto */}
              <AnteprimaCoperta src={dati.immagine} L={L}
                contenuto={{ url: dati.url, source: dati.fonte || dati.dominio }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
                stile={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
        )}

        <div style={{ padding: '12px 16px 16px' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.3, color: C.textPrimary, letterSpacing: -0.3 }}>
            {dati.titolo}
          </h2>
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6 }}>
            {tipo === 'video'
              ? dati.canale
              : (dati.fonti || []).slice(0, 4).map(f => f.fonte || f.dominio).join(' · ')}
          </div>

          {/* ─── La Sintesi di BarTalk (solo articoli) ─── */}
          {tipo === 'articolo' && (
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: C.card, border: bordo }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.2, color: C.accent, marginBottom: 6 }}>
                {L('schedaSintesi')}
              </div>
              {sintesiAI ? (
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: C.textPrimary }}>{sintesiAI}</p>
              ) : (
                <>
                  <button onClick={genera} disabled={generando} style={{
                    padding: '9px 16px', borderRadius: 11, cursor: 'pointer',
                    background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                    border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 600,
                    fontFamily: FONT, opacity: generando ? 0.6 : 1,
                  }}>
                    {generando ? L('schedaScrivo') : L('schedaGenera')}
                  </button>
                  {serveAccount && (
                    <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{L('schedaAccedi')}</div>
                  )}
                  {errSintesi && !serveAccount && (
                    <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{L('genericError')}</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── Il breve estratto, virgolettato e attribuito ─── */}
          {tipo === 'articolo' && dati.sintesi && (
            <blockquote style={{
              margin: '12px 0 0', padding: '2px 0 2px 12px',
              borderLeft: `3px solid ${C.accent}50`,
              fontSize: 12.5, lineHeight: 1.55, color: C.textSecondary, fontStyle: 'italic',
            }}>
              “{dati.sintesi}” <span style={{ fontStyle: 'normal', color: C.textMuted }}>— {fontePrima}</span>
            </blockquote>
          )}

          {/* ─── Le azioni: la fonte prima di tutto ───
              b.324 — audit Mondo D4: i pulsanti erano SOTTO la piega e con
              contenuti lunghi diventavano irraggiungibili. Ora la fila e
              APPICCICATA in fondo alla scheda (sticky): sempre visibile,
              qualunque sia la lunghezza del corpo. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, position: 'sticky', bottom: 0, padding: '10px 0 4px', background: C.bg || '#070a14' }}>
            {tipo === 'articolo' && dati.url && (
              <a href={dati.url} target="_blank" rel="noopener noreferrer" onClick={() => vibrate(8)}
                style={{
                  flex: 1.4, padding: '11px 0', borderRadius: 12, textAlign: 'center',
                  background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                  color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}>
                {L('schedaLeggiSu').replace('{x}', fontePrima)}
              </a>
            )}
            <button onClick={() => { vibrate(12); onParlane?.(); }} style={{
              flex: 1, padding: '11px 0', borderRadius: 12, cursor: 'pointer',
              background: tipo === 'video' ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : 'transparent',
              border: tipo === 'video' ? 'none' : bordo,
              color: tipo === 'video' ? '#fff' : C.textSecondary,
              fontSize: 13, fontWeight: 600, fontFamily: FONT,
            }}>
              {L('newsTalkAbout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(SchedaArgomento);
