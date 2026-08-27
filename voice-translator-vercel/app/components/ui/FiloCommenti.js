'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import { conRipiego } from '../../lib/ripiego.js';
import { chiaveContenuto } from '../../lib/gradimento.js';
import { sanaCommento, ordinaCommenti, serveStanza, MAX_COMMENTO } from '../../lib/commentiContenuto.js';
import Sovrapposizione from './Sovrapposizione.js';
import Icon from '../Icon.js';

// ═══════════════════════════════════════════════════════════════
// IL FILO DEI COMMENTI di un contenuto (b.545).
//
// Ordine di Luca: «possiamo permettere di commentare... anche il commento
// apre una "stanza" di commenti che possono susseguirsi».
//
// Questo NON e' MondoDiscussioni: li c'e' una discussione gia nata, con
// un autore, un account, la moderazione. Qui c'e' molto meno — un filo
// sotto un articolo, dove si lascia una riga e si legge quella degli
// altri. Il salto dal filo alla stanza avviene quando i commenti sono
// due: allora, in cima, compare l'invito ad aprire la stanza vera
// («inserirla nell'elenco chat quando uno la commenta»). Sotto la
// soglia l'invito non c'e' proprio: una voce sola non e' una piazza.
//
// b.529, gia imparata in MondoDiscussioni: «la popup che apri devi
// eliminarla e inserire in basso direttamente campo testo e pulsanti».
// Qui infatti il campo per scrivere sta in fondo, sempre, senza popup.
// ═══════════════════════════════════════════════════════════════
export default function FiloCommenti({ aperto, url, titolo, C = {}, L, nome, onChiudi, onApriStanza }) {
  const tt = conRipiego(L);
  const chiave = chiaveContenuto(url);

  const [commenti, setCommenti] = useState([]);
  const [caricando, setCaricando] = useState(false);
  const [testo, setTesto] = useState('');
  const [inviando, setInviando] = useState(false);
  const [errore, setErrore] = useState('');
  const scorriRef = useRef(null);

  const carica = useCallback(async () => {
    if (!chiave) return;
    setCaricando(true);
    try {
      const r = await fetch(`/api/mondo/commenti?chiave=${encodeURIComponent(chiave)}`, {
        // stesso tetto d'attesa del resto del Mondo (b.363): senza, con la
        // rete muta la chiamata resta appesa e non arriva mai un esito.
        signal: AbortSignal.timeout(10000),
      });
      const d = r.ok ? await r.json().catch(() => null) : null;
      if (!d) throw new Error('risposta illeggibile');
      setCommenti(ordinaCommenti(d.commenti || []));
      setErrore('');
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.545] /api/mondo/commenti:', e?.message || e);
      setErrore(tt('loadingError', 'Errore nel caricamento'));
    }
    setCaricando(false);
    // tt cambia a ogni giro (e' una chiusura su L): tenerlo qui rifarebbe
    // la chiamata a ogni ridisegno. La lingua serve solo al messaggio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave]);

  useEffect(() => { if (aperto) carica(); }, [aperto, carica]);

  // Esc chiude, come ogni pannello di questa applicazione (PannelloLaterale).
  useEffect(() => {
    if (!aperto) return;
    const suTasto = (e) => { if (e.key === 'Escape') onChiudi?.(); };
    window.addEventListener('keydown', suTasto);
    return () => window.removeEventListener('keydown', suTasto);
  }, [aperto, onChiudi]);

  const invia = useCallback(async () => {
    const pulito = sanaCommento(testo);
    if (!pulito || inviando || !chiave) return;
    setInviando(true); setErrore('');
    vibrate(10);
    try {
      const r = await fetch('/api/mondo/commenti', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          chiave, testo: pulito, nome: nome || '',
          // la lingua di chi scrive: serve alla bandierina accanto al nome,
          // come nelle discussioni. Se il browser non la dice, si tace.
          lingua: (typeof navigator !== 'undefined' ? navigator.language : '') || '',
        }),
      });
      const d = r.ok ? await r.json().catch(() => null) : null;
      // b.545 — un commento che non e' arrivato va DETTO. Sparire in
      // silenzio farebbe credere a chi ha scritto di aver parlato.
      if (!d?.ok) { setErrore(tt('loadingError', 'Errore nel caricamento')); }
      else {
        setTesto('');
        await carica();
        requestAnimationFrame(() => scorriRef.current?.scrollTo(0, 0));
      }
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.545] /api/mondo/commenti:', e?.message || e);
      setErrore(tt('networkError', 'Errore di rete'));
    }
    setInviando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testo, inviando, chiave, nome, carica]);

  if (!aperto || !chiave) return null;

  // b.482 — i colori vengono dal tema, non da tinte scritte a mano.
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.08)'}`;
  const vetro = C.glassCard || 'rgba(255,255,255,0.05)';
  const testoP = C.textPrimary || '#f0f4ff';
  const muto = C.textMuted || 'rgba(240,244,255,0.55)';
  const accent = C.accent1 || '#6c8cff';
  const stanza = serveStanza(commenti);

  return (
    <Sovrapposizione>
      {/* il velo: si tocca fuori e si chiude, come il pannello laterale */}
      <div onClick={() => { vibrate(6); onChiudi?.(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,0.55)' }} />

      <section role="dialog" aria-modal="true" aria-label={titolo || tt('commentsWord', 'commenti')}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 131,
          maxHeight: '86dvh', display: 'flex', flexDirection: 'column',
          // coprente sul fondo del tema: dietro c'e' il feed, e attraverso
          // un pannello translucido si leggerebbe tutto (lezione b.363).
          background: C.bg || '#080b16',
          borderTop: bordo, borderRadius: '18px 18px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.55)',
          fontFamily: FONT,
        }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', flexShrink: 0, borderBottom: bordo }}>
          <button onClick={() => { vibrate(6); onChiudi?.(); }} aria-label={tt('closeWord', 'Chiudi')}
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
              background: vetro, border: bordo, color: muto,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="back" size={18} color={muto} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: testoP, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {titolo || tt('commentsWord', 'commenti')}
            </div>
            <div style={{ fontSize: 11, color: muto }}>
              {commenti.length} {tt('commentsWord', 'commenti')}
            </div>
          </div>
        </header>

        <div ref={scorriRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 20px', scrollbarWidth: 'none' }}>
          {/* b.545 — L'INVITO AD APRIRE LA STANZA, in cima e solo da due
              commenti in su: e' il momento in cui, per ordine di Luca, la
              conversazione «entra nell'elenco chat». Con un commento solo
              non compare: non si spinge nessuno a fondare una piazza per
              una frase detta da uno. */}
          {stanza && (
            <button onClick={() => { vibrate(8); onApriStanza?.(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                minHeight: 44, padding: '10px 14px', marginBottom: 12, borderRadius: 14,
                cursor: 'pointer', background: `${accent}1f`, border: `1px solid ${accent}55`,
                color: testoP, fontFamily: FONT,
              }}>
              <Icon name="doorOpen" size={18} color={accent} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
                  {tt('commentsRoomInvite', 'Se ne sta parlando: apri la stanza')}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: muto, marginTop: 2 }}>
                  {tt('commentsRoomHint', 'Da due commenti in poi la conversazione entra nell’elenco chat.')}
                </span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: accent, flexShrink: 0 }}>
                {tt('commentsOpenRoom', 'Apri la stanza')}
              </span>
            </button>
          )}

          {caricando && commenti.length === 0 ? (
            <div style={{ textAlign: 'center', color: muto, padding: 24, fontSize: 13 }}>…</div>
          ) : commenti.length === 0 ? (
            <div style={{ textAlign: 'center', color: muto, padding: 24, fontSize: 13 }}>
              {tt('beFirstToComment', 'Nessun commento ancora. Scrivi il primo.')}
            </div>
          ) : commenti.map((c) => (
            <div key={c.id || `${c.quando}-${c.testo.slice(0, 12)}`}
              style={{ marginBottom: 10, padding: '10px 14px', borderRadius: 12, background: vetro, border: bordo }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: muto, marginBottom: 4 }}>{c.nome || '—'}</div>
              <div style={{ fontSize: 14, color: testoP, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.testo}</div>
            </div>
          ))}
        </div>

        {/* b.529 — il campo sta QUI, in fondo, non dietro una popup.
            b.394 — i 106 punti tengono il campo sopra la barra di
            navigazione fissa, che se no se lo mangia. */}
        <div style={{ padding: '10px 20px', paddingBottom: 'calc(106px + env(safe-area-inset-bottom))', borderTop: bordo, flexShrink: 0 }}>
          {errore && <div style={{ fontSize: 11, color: C.accent3 || '#ff6b6b', marginBottom: 6 }}>{errore}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={1}
              maxLength={MAX_COMMENTO}
              placeholder={tt('writeComment', 'Scrivi un commento…')}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia(); } }}
              style={{
                flex: 1, resize: 'none', padding: '10px 12px', minHeight: 44, borderRadius: 12,
                background: C.inputBg || 'rgba(255,255,255,0.06)', border: bordo, color: testoP,
                fontSize: 14, fontFamily: FONT, outline: 'none', maxHeight: 120, boxSizing: 'border-box',
              }} />
            <button onClick={invia} disabled={inviando || !sanaCommento(testo)}
              style={{
                padding: '10px 16px', minHeight: 44, borderRadius: 12,
                cursor: inviando || !sanaCommento(testo) ? 'default' : 'pointer',
                background: `linear-gradient(135deg, ${accent}, ${C.accent2 || accent})`,
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FONT,
                opacity: inviando || !sanaCommento(testo) ? 0.5 : 1,
              }}>{tt('sendWord', 'Invia')}</button>
          </div>
        </div>
      </section>
    </Sovrapposizione>
  );
}
