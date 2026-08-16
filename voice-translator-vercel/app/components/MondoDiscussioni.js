'use client';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { FONT, vibrate, getLang } from '../lib/constants.js';
import Icon from './Icon.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// MondoDiscussioni — il THREAD di una discussione pubblica (Fase 1)
//
// Una discussione pubblica NON muore con la stanza: resta e continua a
// raccogliere commenti. Qui si vede il titolo, l'eventuale link/foto, e
// i commenti; si scrive un commento (serve un account); e si traduce a
// richiesta come su Instagram — solo cio che tocchi, non tutto.
//
// Le traduzioni passano da /api/translate (che gia gestisce credito e
// cache): niente traduzione di massa.
// ═══════════════════════════════════════════════════════════════

function MondoDiscussioni({ discussionId, onClose }) {
  const { L, S, prefs, userToken } = useApp();
  const C = S?.colors || {};
  const mia = prefs?.lang || 'it';

  const [disc, setDisc] = useState(null);
  const [commenti, setCommenti] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [testo, setTesto] = useState('');
  const [inviando, setInviando] = useState(false);
  const [errore, setErrore] = useState('');
  // traduzioni a richiesta, per id (titolo = 'title'), in memoria
  const [tradotti, setTradotti] = useState({});
  // b.187 — chi seguo, per id pubblico (stato ottimistico di sessione)
  const [seguiti, setSeguiti] = useState(() => new Set());
  const scrollRef = useRef(null);

  const carica = useCallback(async () => {
    try {
      const r = await fetch(`/api/mondo/discussioni?disc=${encodeURIComponent(discussionId)}`);
      if (!r.ok) throw new Error('load');
      const d = await r.json();
      setDisc(d.discussione || null);
      setCommenti(d.commenti || []);
    } catch { setErrore(L('loadingError')); }
    setCaricando(false);
  }, [discussionId, L]);

  useEffect(() => { carica(); }, [carica]);

  // Traduzione a richiesta di un testo nella lingua dell'utente.
  const traduci = useCallback(async (chiave, testoOrig, linguaOrig) => {
    if (tradotti[chiave]) { // toggle: seconda pressione nasconde
      setTradotti(t => { const n = { ...t }; delete n[chiave]; return n; });
      return;
    }
    setTradotti(t => ({ ...t, [chiave]: '…' }));
    try {
      const r = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testoOrig, sourceLang: linguaOrig || 'auto', targetLang: mia,
          sourceLangName: linguaOrig || 'auto', targetLangName: getLang(mia)?.name || mia,
          userToken: userToken || '',
        }),
      });
      const d = await r.json();
      setTradotti(t => ({ ...t, [chiave]: d.translated || d.translation || testoOrig }));
    } catch {
      setTradotti(t => { const n = { ...t }; delete n[chiave]; return n; });
    }
  }, [tradotti, mia, userToken]);

  const invia = useCallback(async () => {
    const t = testo.trim();
    if (!t || inviando) return;
    if (!userToken) { setErrore(L('accessToCreate')); return; }
    setInviando(true); setErrore('');
    vibrate(10);
    try {
      const r = await fetch('/api/mondo/discussioni', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: 'commenta', userToken, discussionId, text: t, lang: mia }),
      });
      if (r.status === 401) { setErrore(L('accessToCreate')); }
      else if (!r.ok) { setErrore(L('loadingError')); }
      else { setTesto(''); await carica(); requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)); }
    } catch { setErrore(L('networkError')); }
    setInviando(false);
  }, [testo, inviando, userToken, discussionId, mia, L, carica]);

  // b.187 — segui/smetti di seguire una persona (ottimistico, poi conferma)
  const toggleSegui = useCallback(async (publicId) => {
    if (!publicId) return;
    if (!userToken) { setErrore(L('accessToCreate')); return; }
    const gia = seguiti.has(publicId);
    setSeguiti(s => { const n = new Set(s); if (gia) n.delete(publicId); else n.add(publicId); return n; });
    vibrate(8);
    try {
      await fetch('/api/mondo/discussioni', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: gia ? 'smetti' : 'segui', userToken, followedPublicId: publicId }),
      });
    } catch {
      setSeguiti(s => { const n = new Set(s); if (gia) n.add(publicId); else n.delete(publicId); return n; });
    }
  }, [userToken, seguiti, L]);

  const bg = C.bg || '#0a0e1a';
  const card = C.glassCard || 'rgba(12,16,30,0.65)';
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.06)'}`;
  const testoP = C.textPrimary || '#eef2ff';
  const muto = C.textMuted || 'rgba(242,244,247,0.6)';
  const accent = C.accent1 || '#26D9B0';

  const media = disc?.media && disc.media.url ? disc.media : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: bg, display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', flexShrink: 0, borderBottom: bordo }}>
        <button onClick={onClose} aria-label={L('closeWord')} style={{
          width: 38, height: 38, borderRadius: 12, cursor: 'pointer', background: card, border: bordo,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: muto, fontSize: 18,
        }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: testoP, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tradotti.title || disc?.title || (caricando ? '…' : L('worldNowTitle'))}
          </div>
          {disc && (
            <div style={{ fontSize: 10, color: muto }}>
              {disc.comment_count} · {disc.author_name || ''}
              {disc.title && (
                <button onClick={() => traduci('title', disc.title, disc.title_lang)} style={{
                  marginLeft: 8, background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 10, fontWeight: 700, padding: 0,
                }}>{tradotti.title ? (L('original')) : (L('seeTranslation'))}</button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Corpo: media + commenti */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', scrollbarWidth: 'none' }}>
        {media && (
          <a href={media.url} target="_blank" rel="noreferrer" style={{
            display: 'block', textDecoration: 'none', marginBottom: 14, borderRadius: 14, overflow: 'hidden', border: bordo, background: card,
          }}>
            {media.thumb && <img src={media.thumb} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />}
            <div style={{ padding: '10px 12px', fontSize: 12, color: accent, wordBreak: 'break-all' }}>{media.source || media.url}</div>
          </a>
        )}

        {caricando ? (
          <div style={{ textAlign: 'center', color: muto, padding: 24, fontSize: 13 }}>…</div>
        ) : commenti.length === 0 ? (
          <div style={{ textAlign: 'center', color: muto, padding: 24, fontSize: 13 }}>
            {L('beFirstToComment')}
          </div>
        ) : commenti.map(c => (
          <div key={c.id} style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: card, border: bordo }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: testoP }}>{c.author_name || '—'}</span>
              {c.like_count > 0 && <span style={{ fontSize: 10, color: muto }}>· {c.like_count} ♥</span>}
              <button onClick={() => toggleSegui(c.author_user_id)} style={{
                marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 10, fontWeight: 700, color: seguiti.has(c.author_user_id) ? muto : accent,
              }}>{seguiti.has(c.author_user_id) ? L('following') : L('follow')}</button>
            </div>
            <div style={{ fontSize: 14, color: testoP, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
              {tradotti[c.id] && tradotti[c.id] !== '…' ? tradotti[c.id] : c.text}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
              <button onClick={() => traduci(c.id, c.text, c.lang)} style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}>
                {tradotti[c.id] ? (L('original')) : (L('seeTranslation'))}
              </button>
              <button onClick={() => metti(c.id)} style={{ background: 'none', border: 'none', color: muto, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}>
                ♥ {L('like')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div style={{ padding: '10px 16px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', borderTop: bordo, flexShrink: 0 }}>
        {errore && <div style={{ fontSize: 11, color: '#ff6b6b', marginBottom: 6 }}>{errore}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea value={testo} onChange={e => setTesto(e.target.value)} rows={1}
            placeholder={L('writeComment')}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia(); } }}
            style={{ flex: 1, resize: 'none', padding: '10px 12px', borderRadius: 12, background: C.inputBg || 'rgba(14,18,32,0.6)', border: bordo, color: testoP, fontSize: 14, fontFamily: FONT, outline: 'none', maxHeight: 120 }} />
          <button onClick={invia} disabled={inviando || !testo.trim()} style={{
            padding: '10px 16px', borderRadius: 12, cursor: inviando || !testo.trim() ? 'default' : 'pointer',
            background: `linear-gradient(135deg, ${accent}, ${C.accent2 || '#5b8cff'})`, border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 800, fontFamily: FONT, opacity: inviando || !testo.trim() ? 0.5 : 1,
          }}>{L('sendWord')}</button>
        </div>
      </div>
    </div>
  );

  // like: idempotente lato server; aggiorna il conteggio localmente
  async function metti(commentId) {
    if (!userToken) { setErrore(L('accessToCreate')); return; }
    vibrate(8);
    try {
      const r = await fetch('/api/mondo/discussioni', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: 'like', userToken, commentId }),
      });
      if (r.ok) setCommenti(cs => cs.map(c => c.id === commentId ? { ...c, like_count: (c.like_count || 0) + 1 } : c));
    } catch { /* il like non e critico: nessun errore in faccia */ }
  }
}

export default memo(MondoDiscussioni);
