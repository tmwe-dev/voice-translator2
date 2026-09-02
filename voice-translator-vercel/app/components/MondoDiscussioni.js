'use client';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { FONT, vibrate, getLang } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';
import AnteprimaCoperta from './ui/AnteprimaCoperta.js';
import Sovrapposizione from './ui/Sovrapposizione.js';
import Icon from './Icon.js';
import { eBloccato, cambiaBlocco, senzaBloccati } from '../lib/bloccati.js';
import { createLogger } from '../lib/logger.js';
const log = createLogger('MondoDiscussioni');   // b.604 — niente console.* sparsi: tutto dal logger

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
      if (e?.name !== 'AbortError') log.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
      setErrore(L('loadingError')); }
    setCaricando(false);
  }, [discussionId, userToken, L]);

  useEffect(() => { carica(); }, [carica]);

  // b.363 — LA PREFERENZA "TITOLI IN ALTRE LINGUE". Chi l'ha accesa non
  // deve toccare "Traduci" ogni volta: aprendo una discussione scritta in
  // un'altra lingua, il titolo si traduce da solo. Se e gia nella sua
  // lingua non si fa niente — tradurre dall'italiano all'italiano e solo
  // una chiamata pagata per niente.
  useEffect(() => {
    // b.548 — il predefinito e TRADOTTI (ordine di Luca in b.541): qui
    // era rimasto 'originali', quindi chi non aveva mai toccato la
    // preferenza vedeva il pannello dire «Tradotti» e i titoli restare
    // in lingua. Stessa incoerenza gia trovata sul ritmo del globo.
    if ((prefs?.mondoTitoli || 'tradotti') !== 'tradotti') return;
    if (!disc?.title || tradotti.title) return;
    const mia = (prefs?.uiLang || prefs?.lang || 'it').split('-')[0];
    if ((disc.title_lang || '').split('-')[0] === mia) return;
    traduci('title', disc.title, disc.title_lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disc?.id, prefs?.mondoTitoli]);

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
      if (e?.name !== 'AbortError') log.warn('[b.363] /api/translate:', e?.message || e);
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
      if (e?.name !== 'AbortError') log.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
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
      if (e?.name !== 'AbortError') log.warn('[b.363] /api/mondo/discussioni:', e?.message || e);
      setSeguiti(s => { const n = new Set(s); if (gia) n.add(publicId); else n.delete(publicId); return n; });
      // b.255 — il pulsante tornava indietro DA SOLO, in silenzio: sembrava
      // che l'applicazione ci ripensasse. Ora si dice che non e riuscito.
      setErrore(L('genericError'));
    }
  }, [userToken, seguiti, L]);

  // b.482 — I COLORI VENGONO DAL TEMA, non da ripieghi scritti a mano.
  // Sotto ogni token c'era un colore fisso di riserva, e uno di quelli
  // (il verde acqua dell'accento) non e il colore di nessun tema di
  // BarTalk: se fosse entrato in funzione avrebbe tinto la schermata di
  // una tinta che non esiste da nessun'altra parte nell'applicazione.
  const bg = C.bg;
  const card = C.glassCard;
  const bordo = `1px solid ${C.cardBorder}`;
  const testoP = C.textPrimary;
  const muto = C.textMuted;
  const accent = C.accent1;

  const media = disc?.media && disc.media.url ? disc.media : null;
  // b.495 — tavola 21: Aa come su ogni pagina, ingrandisce i commenti.
  const [zoomTesto, setZoomTesto] = useState(0);
  // b.510 — «non voglio essere obbligato a uscire dall'applicazione per
  // leggere un testo... devi permettermi di leggerlo dentro il
  // contenitore» (Luca): l'URL aperto nel lettore INTERNO, non in una
  // scheda nuova del browser.
  const [lettoreUrl, setLettoreUrl] = useState(null);
  // b.511 — «dentro stanze lascia dietro una icona una popup per
  // commentare. cosi la interfaccia e pulita» (Luca): il modulo per
  // scrivere (soprannome + testo + invia) stava sempre aperto in fondo,
  // occupando spazio fisso anche quando non si stava scrivendo. Ora sta
  // dietro un'icona sola; i tasti veloci per commento (cuore, traduci,
  // segnala, blocca) restano DOVE ERANO, fuori da qualsiasi popup — non
  // sono stati toccati.
  // b.546 — LO STATO DELLA POPUP E' USCITO. Era il residuo di b.511: la
  // popup dei commenti e' stata tolta in b.529 su ordine di Luca («la
  // popup che apri devi eliminarla e inserire in basso direttamente
  // campo testo e pulsanti»), ma lo stato che la apriva era rimasto —
  // dichiarato e mai piu letto da nessuno. Non e' pulizia
  // opportunistica: e' la coda di un ordine eseguito a meta, trovata
  // dalla prova b.511 che continuava a cercarlo.
  const ingr = 1 + zoomTesto * 0.15;

  // b.516 — anche questa schermata dichiarava `fixed inset:0` ma usciva
  // 440x691 dentro una finestra 657x749 (misurato in produzione): il
  // `fixed` era prigioniero della colonna della sezione. I due veli
  // annidati piu sotto (z:95 e z:96) sono figli di questo, quindi
  // escono insieme a lui. Vedi Sovrapposizione.js.
  return (
    <Sovrapposizione>
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: bg, display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      {/* Header */}
      {/* b.482 — rientro laterale a 20 come il resto dell'applicazione, e
          il tasto INDIETRO — il piu premuto di questa schermata — sale da
          38 a 44. La freccia era un carattere di punteggiatura disegnato
          dal telefono: ora e l'icona di casa, uguale su ogni apparecchio. */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', flexShrink: 0, borderBottom: bordo }}>
        <button onClick={onClose} aria-label={L('closeWord')} style={{
          width: 44, height: 44, borderRadius: 12, cursor: 'pointer', background: card, border: bordo,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: muto, fontSize: 18,
        }}><Icon name="back" size={18} color={muto} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: testoP, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tradotti.title || disc?.title || (caricando ? '…' : L('worldNowTitle'))}
          </div>
          {disc && (
            <div style={{ fontSize: 10, color: muto }}>
              {disc.comment_count} · {disc.author_name || ''}
              {disc.title && (
                <button onClick={() => traduci('title', disc.title, disc.title_lang)} style={{
                  marginLeft: 8, background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 10, fontWeight: 500, padding: 0,
                  minHeight: 44, display: 'inline-flex', alignItems: 'center',
                }}>{tradotti.title ? (L('original')) : (L('seeTranslation'))}</button>
              )}
            </div>
          )}
        </div>
        {/* b.495 — tavola 21: Aa in testata, come ovunque. */}
        <button onClick={() => { vibrate(6); setZoomTesto((z) => (z >= 3 ? 0 : z + 1)); }}
          title={L('textBigger')} aria-label={L('textBigger')}
          style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
            background: zoomTesto ? `${accent}22` : card, border: bordo, color: muto,
            fontFamily: FONT, fontSize: 15, fontWeight: 500 }}>
          Aa
        </button>
        {/* b.510 — Luca cercava un modo di condividere il post e non
            c'era: usa lo stesso navigator.share gia in uso in
            ChatActionsPanel/QuickInvite/TaxiTalk — su telefono apre il
            foglio nativo del sistema, che elenca Instagram, LinkedIn,
            Facebook, WhatsApp... tutto cio che l'utente ha installato.
            Non esiste (e non e onesto promettere) un modo di postare
            direttamente DENTRO Instagram/LinkedIn/Facebook da un sito
            web senza le loro app native: il foglio di condivisione del
            sistema e la via corretta e universale. */}
        {disc && typeof navigator !== 'undefined' && navigator.share && (
          <button onClick={() => {
            vibrate(6);
            navigator.share({ title: disc.title || 'BarTalk', url: media?.url || (typeof window !== 'undefined' ? window.location.href : '') }).catch(() => { /* utente ha annullato: nessuna azione necessaria */ });
          }} aria-label={L('shareWord')} title={L('shareWord')} style={{
            flexShrink: 0, width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
            background: 'none', border: 'none', color: muto,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name="share" size={16} color={muto} /></button>
        )}
        {/* b.363 — si segnalava solo il singolo commento: una discussione
            intera fuori posto non aveva alcun modo di essere segnalata,
            benche il server la accettasse gia (tipo 'discussione'). */}
        {disc && (
          <button onClick={segnalaDiscussione} disabled={discSegnalata}
            aria-label={L('reportWord')} title={L('reportWord')}
            style={{
              flexShrink: 0, background: 'none', border: 'none', padding: 6, minHeight: 44,
              cursor: discSegnalata ? 'default' : 'pointer', color: muto,
              fontSize: 11, fontWeight: 500, fontFamily: FONT, opacity: discSegnalata ? 0.45 : 1,
            }}>
            {discSegnalata ? L('reportCopied') : L('reportWord')}
          </button>
        )}
      </header>

      {/* Corpo: media + commenti */}
      {/* b.482 — rientro a 20: i commenti si incolonnano con la testata. */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', scrollbarWidth: 'none' }}>
        {/* b.495 — tavola 21: LA NOTIZIA IN CIMA, grande, nel corpo — non
            solo compressa in testata. La bandiera della sua lingua e
            l'autore accanto; tradotta, l'originale resta sotto piccolo. */}
        {disc?.title && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: muto }}>
              {disc.title_lang && <span aria-hidden="true">{getLang(disc.title_lang).flag}</span>}
              {disc.author_name && <span>{disc.author_name}</span>}
            </div>
            <div style={{ fontSize: 17 * ingr, fontWeight: 500, lineHeight: 1.35, color: testoP, marginTop: 5 }}>
              {tradotti.title || disc.title}
            </div>
            {tradotti.title && tradotti.title !== disc.title && (
              <div style={{ fontSize: 11.5 * ingr, color: muto, marginTop: 4 }}>{disc.title}</div>
            )}
          </div>
        )}
        {media && (
          <button onClick={() => setLettoreUrl(media.url)} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: 0, cursor: 'pointer',
            marginBottom: 14, borderRadius: 14, overflow: 'hidden', border: bordo, background: card,
            font: 'inherit', color: 'inherit',
          }}>
            {media.thumb && <AnteprimaCoperta src={media.thumb} contenuto={media} L={L}
              // b.529 — Luca: «allarghi l'immagine invece di tenere
              // l'originale, e scorretto. mantieni immagine e proporzioni».
              // Era un ritaglio fisso a 180 di altezza (cover): su schermo
              // largo diventava una striscia stiracchiata. Ora l'immagine
              // resta INTERA e in proporzione, con un tetto d'altezza.
              stile={{ width: '100%', maxHeight: 340, height: 'auto', objectFit: 'contain', display: 'block', background: 'rgba(0,0,0,0.25)' }} />}
            <div style={{ padding: '10px 20px', fontSize: 12, color: accent, wordBreak: 'break-all' }}>{media.source || media.url}</div>
          </button>
        )}

        {/* b.495 — tavola 21: l'etichetta di sezione, come sulla tavola. */}
        {!caricando && commenti.length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, color: muto, margin: '2px 0 8px', textTransform: 'uppercase' }}>
            {commenti.length} {L('commentsWord')}
          </div>
        )}
        {caricando ? (
          <div style={{ textAlign: 'center', color: muto, padding: 24, fontSize: 13 }}>…</div>
        ) : commenti.length === 0 ? (
          <div style={{ textAlign: 'center', color: muto, padding: 24, fontSize: 13 }}>
            {L('beFirstToComment')}
          </div>
        ) : senzaBloccati(commenti, prefs).map(c => (
          <div key={c.id} style={{ marginBottom: 12, padding: '10px 20px', borderRadius: 12, background: card, border: bordo }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {/* b.482 — erano tutti tastini alti dieci o dodici punti:
                  il nome, il segui, il traduci, il cuore, il blocca e il
                  segnala. Su un telefono si sbaglia bersaglio quasi
                  sempre. Ora ognuno e alto 44, la misura del template. */}
              <button onClick={() => onOpenPersona?.(c.author_user_id)} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: 12, fontWeight: 500, color: testoP, fontFamily: FONT,
                minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>{/* b.495 — tavola 21: la bandiera accanto al nome — e cio
                    che dice subito da che mondo arriva il commento. */}
                {c.lang && <span aria-hidden="true">{getLang(c.lang).flag}</span>}
                {c.author_name || '—'}</button>
              {c.like_count > 0 && <span style={{ fontSize: 10, color: muto }}>· {c.like_count} ♥</span>}
              <button onClick={() => toggleSegui(c.author_user_id)} style={{
                marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 10, fontWeight: 500, color: seguiti.has(c.author_user_id) ? muto : accent,
                minHeight: 44, display: 'inline-flex', alignItems: 'center',
              }}>{seguiti.has(c.author_user_id) ? L('following') : L('follow')}</button>
            </div>
            <div style={{ fontSize: 14 * ingr, color: testoP, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
              {tradotti[c.id] && tradotti[c.id] !== '…' ? tradotti[c.id] : c.text}
            </div>
            {/* b.495 — tavola 21: il commento tradotto porta l'ORIGINALE
                sotto, piccolo — chi vuole controllare puo (come in chat). */}
            {tradotti[c.id] && tradotti[c.id] !== '…' && tradotti[c.id] !== c.text && (
              <div style={{ fontSize: 11 * ingr, color: muto, marginTop: 3, whiteSpace: 'pre-wrap' }}>{c.text}</div>
            )}
            <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
              <button onClick={() => traduci(c.id, c.text, c.lang)} style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 11, fontWeight: 500, padding: 0, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
                {tradotti[c.id] ? (L('original')) : (L('seeTranslation'))}
              </button>
              <button onClick={() => metti(c.id)} style={{ background: 'none', border: 'none', color: muto, cursor: 'pointer', fontSize: 11, fontWeight: 500, padding: 0, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
                ♥ {L('like')}
              </button>
              {/* b.363 — la segnalazione ESISTEVA solo sul server: nessuno
                  poteva usarla perche non c'era da nessuna parte un modo
                  per dirlo. Ecco il modo. */}
              {/* b.383 — BLOCCA. Segnalare dice a NOI che qualcosa non va ed
                  e un atto pubblico; bloccare riguarda solo i miei occhi.
                  Erano due cose diverse e ce n'era una sola. */}
              <button onClick={() => { vibrate(6); savePrefs(cambiaBlocco(prefs, c.author_user_id)); }}
                aria-label={L('blockPerson')} title={L('blockPerson')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                  fontSize: 10, fontWeight: 500, color: muto, fontFamily: FONT,
                  minHeight: 44, display: 'inline-flex', alignItems: 'center',
                }}>
                {L('blockPerson')}
              </button>
              <button onClick={() => segnalaCommento(c.id)} disabled={segnalati.has(c.id)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: muto, cursor: segnalati.has(c.id) ? 'default' : 'pointer', fontSize: 11, fontWeight: 500, padding: 0, opacity: segnalati.has(c.id) ? 0.45 : 1, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
                {segnalati.has(c.id) ? L('reportCopied') : L('reportWord')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      {/* b.394 — IL CAMPO PER SCRIVERE FINIVA SOTTO LA BARRA IN BASSO.
          La scheda dei commenti arriva fino al bordo dello schermo, e
          li c'e la barra di navigazione: fissa, alta 94 pixel piu l'area
          sicura. Gli ultimi 94 pixel della scheda stavano sotto di lei,
          e li ci sta esattamente il campo del soprannome e quello del
          commento. La faccia DAVANTI dello stesso ribaltamento lo spazio
          se lo riservava gia; questa, dietro, no.
          106 non e un numero inventato: e la stessa misura che tutto il
          resto del progetto usa per lasciar posto alla barra. */}
      {/* b.482 — rientro a 20 come la testata e i commenti, cosi il campo
          per scrivere sta sulla stessa colonna di tutto il resto. */}
      {/* b.511 — solo l'icona: il modulo vero e nella popup qui sotto.
          Stessa misura 106px di prima (b.394) per lasciare posto alla
          barra di navigazione fissa. */}
      {/* b.529 — IL CAMPO STA QUI, NON IN UNA POPUP. Luca: «la popup che
          apri devi eliminarla e inserire in basso direttamente campo
          testo e pulsanti. inutile ripetere in basso il nome chat». Il
          soprannome resta quello del profilo (prefs.mondoNick): non si
          richiede a ogni commento. La popup b.511 e morta. */}
      <div style={{ padding: '10px 20px', paddingBottom: 'calc(106px + env(safe-area-inset-bottom))', borderTop: bordo, flexShrink: 0 }}>
        {errore && <div style={{ fontSize: 11, color: C.accent3, marginBottom: 6 }}>{errore}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea value={testo} onChange={e => setTesto(e.target.value)} rows={1}
            placeholder={L('writeComment')}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia(); } }}
            style={{ flex: 1, resize: 'none', padding: '10px 12px', minHeight: 44, borderRadius: 12, background: C.inputBg, border: bordo, color: testoP, fontSize: 14, fontFamily: FONT, outline: 'none', maxHeight: 120, boxSizing: 'border-box' }} />
          <button onClick={invia} disabled={inviando || !testo.trim()} style={{
            padding: '10px 16px', minHeight: 44, borderRadius: 12, cursor: inviando || !testo.trim() ? 'default' : 'pointer',
            background: `linear-gradient(135deg, ${accent}, ${C.accent2})`, border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 500, fontFamily: FONT, opacity: inviando || !testo.trim() ? 0.5 : 1,
          }}>{L('sendWord')}</button>
        </div>
      </div>

      {/* b.511 — la popup per scrivere: stesso soprannome, stesso testo,
          stesso tasto invia di prima — solo dietro un tocco invece che
          sempre in vista. Stesso stile a foglio dal basso di
          CondivisoSheet.js, per restare coerenti col resto dell'app. */}
      {/* b.510 — il lettore interno: stesso contenitore, iframe della
          pagina originale al posto di una scheda nuova del browser.
          [ASSUNTO] alcuni editori impostano X-Frame-Options e rifiutano
          di essere incorniciati: in quel caso l'iframe resta bianco, e
          per questo "Apri nel browser" e SEMPRE visibile in testata, mai
          un ripiego nascosto dietro un errore che non possiamo rilevare
          in anticipo (un iframe bloccato non genera un evento onError
          leggibile da JavaScript). */}
      {lettoreUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95, background: bg, display: 'flex', flexDirection: 'column' }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', flexShrink: 0, borderBottom: bordo }}>
            <button onClick={() => setLettoreUrl(null)} aria-label={L('closeWord')} style={{
              width: 44, height: 44, borderRadius: 12, cursor: 'pointer', background: card, border: bordo,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: muto, flexShrink: 0,
            }}><Icon name="back" size={18} color={muto} /></button>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: muto, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {media?.source || lettoreUrl}
            </span>
            <a href={lettoreUrl} target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', minHeight: 44, borderRadius: 12,
              background: card, border: bordo, color: accent, fontSize: 12, fontWeight: 500, textDecoration: 'none', fontFamily: FONT, flexShrink: 0,
            }}><Icon name="link" size={14} color={accent} /> {L('openOutside')}</a>
          </header>
          <iframe src={lettoreUrl} title={media?.source || 'articolo'} style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }} />
        </div>
      )}
    </div>
    </Sovrapposizione>
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
