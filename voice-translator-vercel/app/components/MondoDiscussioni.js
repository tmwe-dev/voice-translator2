'use client';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { FONT, vibrate, getLang } from '../lib/constants.js';
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

function MondoDiscussioni({ discussionId, onClose, onOpenPersona }) {
  const { L, S, prefs, userToken, savePrefs } = useApp();
  const C = S?.colors || {};
  const mia = prefs?.lang || 'it';
  // b.190 — nickname pubblico: il nome mostrato nel Mondo, al posto del
  // nome vero. Vive nelle preferenze; se vuoto, il server usa il nome.
  const [nick, setNick] = useState(prefs?.mondoNick || '');

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
  const [segnalati, setSegnalati] = useState(() => new Set());
  const [discSegnalata, setDiscSegnalata] = useState(false);
  const [likeMessi, setLikeMessi] = useState(() => new Set()); // b.232 — evita il doppio conteggio del like
  const scrollRef = useRef(null);

  const carica = useCallback(async () => {
    try {
      const r = await fetch(`/api/mondo/discussioni?disc=${encodeURIComponent(discussionId)}`, { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
      if (!r.ok) throw new Error('load');
      // b.363 — prima la lettura non era protetta: la discussione restava
      // vuota senza che il guasto venisse mai dichiarato.
      const d = await r.json().catch(() => null);
      if (!d) throw new Error('risposta illeggibile');
      setDisc(d.discussione || null);
      setCommenti(d.commenti || []);
      // b.363 — e poi COSA HO GIA FATTO io qui: quali cuori ho messo, chi
      // seguo. Prima se lo ricordava solo il telefono, e bastava ricaricare
      // perche tutte le etichette ripartissero a zero dicendo il falso.
      // In POST: il gettone non deve viaggiare dentro un indirizzo.
      if (userToken) {
        const lista = d.commenti || [];
        fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            azione: 'miei', userToken,
            commentIds: lista.map((c) => c.id).filter(Boolean),
            authorIds: [...new Set(lista.map((c) => c.author_user_id).filter(Boolean))],
          }),
        }).then((rr) => rr.ok ? rr.json() : null).then((dd) => {
          if (!dd) return;
          if (dd.cuori?.length) setLikeMessi(new Set(dd.cuori));
          if (dd.seguiti?.length) setSeguiti(new Set(dd.seguiti));
        }).catch(() => { /* senza questo elenco si riparte a zero, come prima: non e un guasto */ });
      }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
      setErrore(L('loadingError')); }
    setCaricando(false);
  }, [discussionId, userToken, L]);

  useEffect(() => { carica(); }, [carica]);

  // Traduzione a richiesta di un testo nella lingua dell'utente.
  const traduci = useCallback(async (chiave, testoOrig, linguaOrig) => {
    if (tradotti[chiave]) { // toggle: seconda pressione nasconde
      setTradotti(t => { const n = { ...t }; delete n[chiave]; return n; });
      return;
    }
    setTradotti(t => ({ ...t, [chiave]: '…' }));
    try {
      const r = await fetch('/api/translate', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testoOrig, sourceLang: linguaOrig || 'auto', targetLang: mia,
          sourceLangName: linguaOrig || 'auto', targetLangName: getLang(mia)?.name || mia,
          userToken: userToken || '',
        }),
      });
      // b.363 — prima la lettura non era protetta: con una risposta rotta la
      // traduzione restava sui puntini per sempre.
      const d = await r.json().catch(() => null);
      if (!d) { setTradotti(t => { const n = { ...t }; delete n[chiave]; return n; }); return; }
      // b.363 — non si spaccia l'ORIGINALE per traduzione: se la risposta non
      // e valida (errore, credito finito, o traduzione respinta dal controllo
      // qualita) si toglie la voce invece di salvare il testo di partenza.
      const buona = r.ok && !d.validationFailed && (d.translated || d.translation);
      if (!buona) { setTradotti(t => { const n = { ...t }; delete n[chiave]; return n; }); return; }
      setTradotti(t => ({ ...t, [chiave]: buona }));
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/translate:', e?.message || e);
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
      const r = await fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: 'commenta', userToken, discussionId, text: t, lang: mia, nick: nick.trim() }),
      });
      if (r.status === 401) { setErrore(L('accessToCreate')); }
      else if (!r.ok) { setErrore(L('loadingError')); }
      else { setTesto(''); await carica(); requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)); }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
      setErrore(L('networkError')); }
    setInviando(false);
  }, [testo, inviando, userToken, discussionId, mia, nick, L, carica]);

  // b.187 — segui/smetti di seguire una persona (ottimistico, poi conferma)
  const toggleSegui = useCallback(async (publicId) => {
    if (!publicId) return;
    if (!userToken) { setErrore(L('accessToCreate')); return; }
    const gia = seguiti.has(publicId);
    setSeguiti(s => { const n = new Set(s); if (gia) n.delete(publicId); else n.add(publicId); return n; });
    vibrate(8);
    try {
      // b.255 — anche una risposta di rifiuto (403, 429, 500) va trattata
      // come un fallimento: prima si guardava solo l'eccezione di rete, e
      // un "no" del server lasciava il pulsante acceso per sempre.
      const r = await fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: gia ? 'smetti' : 'segui', userToken, followedPublicId: publicId }),
      });
      if (!r.ok) throw new Error('rifiutato');
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
      setSeguiti(s => { const n = new Set(s); if (gia) n.add(publicId); else n.delete(publicId); return n; });
      // b.255 — il pulsante tornava indietro DA SOLO, in silenzio: sembrava
      // che l'applicazione ci ripensasse. Ora si dice che non e riuscito.
      setErrore(L('genericError'));
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
        {/* b.363 — si segnalava solo il singolo commento: una discussione
            intera fuori posto non aveva alcun modo di essere segnalata,
            benche il server la accettasse gia (tipo 'discussione'). */}
        {disc && (
          <button onClick={segnalaDiscussione} disabled={discSegnalata}
            aria-label={L('reportWord')} title={L('reportWord')}
            style={{
              flexShrink: 0, background: 'none', border: 'none', padding: 6,
              cursor: discSegnalata ? 'default' : 'pointer', color: muto,
              fontSize: 11, fontWeight: 700, fontFamily: FONT, opacity: discSegnalata ? 0.45 : 1,
            }}>
            {discSegnalata ? L('reportCopied') : L('reportWord')}
          </button>
        )}
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
              <button onClick={() => onOpenPersona?.(c.author_user_id)} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: 12, fontWeight: 700, color: testoP, fontFamily: FONT,
              }}>{c.author_name || '—'}</button>
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
              {/* b.363 — la segnalazione ESISTEVA solo sul server: nessuno
                  poteva usarla perche non c'era da nessuna parte un modo
                  per dirlo. Ecco il modo. */}
              <button onClick={() => segnalaCommento(c.id)} disabled={segnalati.has(c.id)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: muto, cursor: segnalati.has(c.id) ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, padding: 0, opacity: segnalati.has(c.id) ? 0.45 : 1 }}>
                {segnalati.has(c.id) ? L('reportCopied') : L('reportWord')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div style={{ padding: '10px 16px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', borderTop: bordo, flexShrink: 0 }}>
        {errore && <div style={{ fontSize: 11, color: C.red || '#ff6b6b', marginBottom: 6 }}>{errore}</div>}
        <input value={nick} onChange={e => setNick(e.target.value)} maxLength={40}
          onBlur={() => savePrefs?.({ ...prefs, mondoNick: nick.trim() })}
          placeholder={L('publicNickname')}
          style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: C.inputBg || 'rgba(14,18,32,0.6)', border: bordo, color: testoP, fontSize: 12, fontFamily: FONT, outline: 'none', boxSizing: 'border-box' }} />
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

  // b.363 — segnala l'intera discussione: stessa regola del commento.
  async function segnalaDiscussione() {
    if (!userToken) { setErrore(L('accessToCreate')); return; }
    if (discSegnalata || !discussionId) return;
    vibrate(8);
    setDiscSegnalata(true);
    try {
      const r = await fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: 'segnala', userToken, tipo: 'discussione', contenuto: discussionId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.nascosto) onClose?.();
    } catch { /* la segnalazione non e critica: resta presa in carico sullo schermo */ }
  }

  // b.363 — segnala un commento: una volta sola per persona, e alla
  // soglia il contenuto si nasconde da solo (regola gia sul server).
  async function segnalaCommento(commentId) {
    if (!userToken) { setErrore(L('accessToCreate')); return; }
    if (segnalati.has(commentId)) return;
    vibrate(8);
    setSegnalati((v) => new Set(v).add(commentId));
    try {
      const r = await fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: 'segnala', userToken, tipo: 'commento', contenuto: commentId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.nascosto) setCommenti((cs) => cs.filter((c) => c.id !== commentId));
    } catch { /* la segnalazione non e critica: resta presa in carico sullo schermo */ }
  }

  // like: idempotente lato server; aggiorna il conteggio localmente
  async function metti(commentId) {
    if (!userToken) { setErrore(L('accessToCreate')); return; }
    // b.232 — il server è idempotente (un like per persona): se l'avevo già
    // messo, non re-incremento (prima ogni click faceva +1 in UI, ma il DB
    // restava a 1). Così l'UI resta allineata al server.
    if (likeMessi.has(commentId)) return;
    vibrate(8);
    try {
      const r = await fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: 'like', userToken, commentId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setLikeMessi(s => new Set(s).add(commentId));
        // b.363 — il numero lo dice il server, non il telefono: dopo un
        // ricarico il "gia messo" era dimenticato e il conteggio locale
        // saliva su un cuore che il database non aveva registrato.
        setCommenti(cs => cs.map(c => c.id === commentId
          ? { ...c, like_count: typeof d.like_count === 'number' ? d.like_count : (d.gia ? (c.like_count || 0) : (c.like_count || 0) + 1) }
          : c));
      }
    } catch { /* il like non e critico: nessun errore in faccia */ }
  }
}

export default memo(MondoDiscussioni);
