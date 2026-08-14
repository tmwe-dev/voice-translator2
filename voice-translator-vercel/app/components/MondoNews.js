'use client';
// ═══════════════════════════════════════════════════════════════
// MondoNews — il tab NEWS dentro Mondo (b.147)
//
// La regola di prodotto, concordata: la notizia e il pretesto, la
// conversazione e il prodotto. Quindi in cima ai risultati stanno le
// STANZE che gia parlano dell'argomento (livello 0, gratis), poi le
// Topic Card raggruppate per evento. Ogni card ha [Apri] e [Parlane]:
// Parlane apre il foglio di creazione stanza gia compilato.
//
// IL PROCESSO SI VEDE. La rotta /api/topics/search risponde una riga
// NDJSON per stadio: qui ogni riga diventa una voce nel pannello
// "COBRA", cosi l'attesa racconta il lavoro invece di nasconderlo.
//
// Niente aggiornamento automatico: ogni ricerca nasce da un gesto.
// ═══════════════════════════════════════════════════════════════

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { useApp } from '../contexts/AppContext.js';

const CATEGORIE = [
  { id: 'top',        cat: 'notizie',    labelKey: 'newsTopHeadlines' },
  { id: 'mondo',      cat: 'notizie',    labelKey: 'catWorld' },
  { id: 'sport',      cat: 'sport',      labelKey: 'catSport' },
  { id: 'tecnologia', cat: 'tecnologia', labelKey: 'catTech' },
  { id: 'economia',   cat: 'economia',   labelKey: 'catEconomy' },
  { id: 'scienza',    cat: 'scienza',    labelKey: 'catScience' },
  { id: 'arte',       cat: 'arte',       labelKey: 'catArt' },
];

// La query da mandare al motore per ogni scorciatoia, per lingua UI.
// "top" usa il nome del giornale radio: i titoli del giorno.
const QUERY_RAPIDE = {
  top:        { it: 'ultime notizie', en: 'top news today', es: 'últimas noticias', fr: 'dernières nouvelles', de: 'nachrichten heute' },
  mondo:      { it: 'notizie dal mondo', en: 'world news', es: 'noticias del mundo', fr: 'actualités monde', de: 'weltnachrichten' },
  sport:      { it: 'sport', en: 'sports', es: 'deportes', fr: 'sport', de: 'sport' },
  tecnologia: { it: 'tecnologia', en: 'technology', es: 'tecnología', fr: 'technologie', de: 'technologie' },
  economia:   { it: 'economia', en: 'economy business', es: 'economía', fr: 'économie', de: 'wirtschaft' },
  scienza:    { it: 'scienza', en: 'science', es: 'ciencia', fr: 'science', de: 'wissenschaft' },
  arte:       { it: 'arte cultura', en: 'art culture', es: 'arte cultura', fr: 'art culture', de: 'kunst kultur' },
};

function MondoNews({ C, onJoinRoom, onParlane }) {
  const { L, prefs } = useApp();
  const lingua = prefs.uiLang || 'en';

  const [query, setQuery] = useState('');
  const [cercando, setCercando] = useState(false);
  const [processo, setProcesso] = useState([]);   // le righe del pannello COBRA
  const [argomenti, setArgomenti] = useState(null); // null = mai cercato
  const [stanze, setStanze] = useState([]);
  const [daCache, setDaCache] = useState(false);
  const [errore, setErrore] = useState(false);
  const [chipAttiva, setChipAttiva] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const descriviStadio = useCallback((r) => {
    switch (r.stadio) {
      case 'stanze':    return L('newsCobraRooms');
      case 'cache':     return L('newsCobraCache');
      case 'cerca':     return L('newsCobraSearching');
      case 'fonti':     return L('newsCobraFound').replace('{x}', r.quante);
      case 'leggo':     return L('newsCobraReading').replace('{x}', r.dominio);
      case 'raggruppo': return L('newsCobraCluster');
      default: return null;
    }
  }, [L]);

  const cerca = useCallback(async (q, cat = 'notizie', fresca = false) => {
    const pulita = (q || '').trim();
    if (!pulita || cercando) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setCercando(true); setErrore(false); setProcesso([]); setDaCache(false);
    vibrate(10);
    try {
      const res = await fetch(
        `/api/topics/search?q=${encodeURIComponent(pulita)}&lang=${lingua}&cat=${cat}${fresca ? '&fresh=1' : ''}`,
        { signal: ac.signal });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let resto = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        resto += decoder.decode(value, { stream: true });
        const righe = resto.split('\n');
        resto = righe.pop();
        for (const riga of righe) {
          if (!riga.trim()) continue;
          let r; try { r = JSON.parse(riga); } catch { continue; }
          if (r.stadio === 'fine') {
            setArgomenti(r.argomenti || []);
            setStanze(r.stanze || []);
            setDaCache(!!r.daCache);
          } else if (r.stadio === 'errore') {
            setErrore(true);
          } else {
            const testo = descriviStadio(r);
            if (testo) setProcesso(p => [...p.slice(-5), { testo, id: p.length }]);
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setErrore(true);
    } finally {
      setCercando(false);
    }
  }, [lingua, cercando, descriviStadio]);

  const cercaChip = useCallback((c) => {
    setChipAttiva(c.id);
    const q = (QUERY_RAPIDE[c.id] || {})[lingua] || (QUERY_RAPIDE[c.id] || {}).en || c.id;
    setQuery('');
    cerca(q, c.cat);
  }, [lingua, cerca]);

  const quando = (ts) => {
    if (!ts) return '';
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return L('timeNow');
    if (min < 60) return `${min}m`;
    if (min < 1440) return `${Math.floor(min / 60)}h`;
    return `${Math.floor(min / 1440)}g`;
  };

  const bordo = `1px solid ${C.cardBorder}`;

  return (
    <div style={{ padding: '0 16px 96px', fontFamily: FONT }}>

      {/* ─── Cerca + Aggiorna ─── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setChipAttiva(null); }}
          onKeyDown={e => { if (e.key === 'Enter') cerca(query); }}
          placeholder={L('newsWhatFollow')}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 14,
            background: C.input, border: bordo, outline: 'none',
            color: C.textPrimary, fontSize: 14, fontFamily: FONT,
          }} />
        <button
          onClick={() => (chipAttiva
            ? cercaChip(CATEGORIE.find(c => c.id === chipAttiva))
            : cerca(query, 'notizie', true))}
          disabled={cercando || (!query.trim() && !chipAttiva)}
          aria-label={L('newsUpdate')}
          style={{
            padding: '0 18px', borderRadius: 14, cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
            fontFamily: FONT, opacity: cercando || (!query.trim() && !chipAttiva) ? 0.5 : 1,
            WebkitTapHighlightColor: 'transparent',
          }}>
          {L('newsUpdate')}
        </button>
      </div>

      {/* ─── Scorciatoie ─── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}>
        {CATEGORIE.map(c => (
          <button key={c.id} onClick={() => cercaChip(c)} disabled={cercando}
            style={{
              padding: '7px 13px', borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer',
              background: chipAttiva === c.id ? `${C.accent}18` : C.card,
              border: chipAttiva === c.id ? `1px solid ${C.accent}40` : bordo,
              color: chipAttiva === c.id ? C.accent : C.textSecondary,
              fontSize: 12, fontWeight: chipAttiva === c.id ? 700 : 500, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
            }}>
            {L(c.labelKey)}
          </button>
        ))}
      </div>

      {/* ─── Il pannello COBRA: il lavoro si vede ─── */}
      {(cercando || (processo.length > 0 && argomenti === null)) && (
        <div style={{
          margin: '6px 0 12px', padding: '12px 14px', borderRadius: 14,
          background: C.card, border: bordo,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 4, background: C.accent,
              animation: 'vtPulse 1.2s infinite ease-in-out',
            }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: C.accent }}>
              COBRA
            </span>
          </div>
          {processo.map((p, i) => (
            <div key={p.id} style={{
              fontSize: 12, lineHeight: 1.9, fontFamily: 'ui-monospace, monospace',
              color: i === processo.length - 1 ? C.textPrimary : C.textMuted,
            }}>
              {i === processo.length - 1 && cercando ? '▸ ' : '· '}{p.testo}
            </div>
          ))}
        </div>
      )}

      {/* ─── Esiti vuoti ─── */}
      {errore && (
        <div style={{ padding: '18px 4px', fontSize: 13, color: C.red }}>{L('newsError')}</div>
      )}
      {!errore && !cercando && argomenti !== null && argomenti.length === 0 && (
        <div style={{ padding: '18px 4px', fontSize: 13, color: C.textMuted }}>{L('newsNoResults')}</div>
      )}

      {/* ─── LIVELLO 0: ne stanno gia parlando ─── */}
      {stanze.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>
            {L('newsTalkingRooms')}
          </div>
          {stanze.map(s => (
            <button key={s.roomId} onClick={() => { vibrate(10); onJoinRoom?.(s.roomId); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', marginBottom: 6, borderRadius: 12, cursor: 'pointer',
                background: `${C.accent}0E`, border: `1px solid ${C.accent}28`,
                color: C.textPrimary, fontFamily: FONT, textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4, background: C.accent, flexShrink: 0,
                animation: 'vtPulse 1.2s infinite ease-in-out',
              }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.nome || s.description}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted, flexShrink: 0 }}>
                {s.members || 1} · {s.lang?.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ─── Le Topic Card ───
          Niente backdrop-filter sulle card: e la lezione di b.143 — un
          velo per card, ripetuto per tutte, diventa nebbia sull'intera
          pagina. Il fondo translucido basta; il blur vive solo su
          elementi singoli come il pannello COBRA. */}
      {argomenti !== null && argomenti.map(t => (
        <article key={t.id} style={{
          marginBottom: 14, borderRadius: 18, overflow: 'hidden',
          background: C.card, border: bordo,
        }}>
          {/* La miniatura: 16:9 piena, o un fondale col nome della fonte */}
          {t.immagine ? (
            <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0a0f1f' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- immagine
                  esterna di dominio ignoto: next/image richiederebbe la lista
                  dei domini, che per le news non esiste */}
              <img src={t.immagine} alt="" loading="lazy" referrerPolicy="no-referrer"
                onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, transparent 55%, rgba(5,7,15,0.85))',
              }} />
            </div>
          ) : (
            <div style={{
              aspectRatio: '21/9', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${C.accent}14, ${C.purple}18)`,
            }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: `${C.accent}55`, letterSpacing: 1 }}>
                {(t.fonti[0]?.fonte || '·').slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}

          <div style={{ padding: '12px 14px 13px' }}>
            <h3 style={{
              margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35,
              color: C.textPrimary, letterSpacing: -0.2,
            }}>
              {t.titolo}
            </h3>
            {t.sintesi && (
              <p style={{
                margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, color: C.textSecondary,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {t.sintesi}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                {t.fonti.slice(0, 3).map(f => f.fonte || f.dominio).join(' · ')}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                — {t.fonti.length} {t.fonti.length === 1 ? L('newsSourceOne') : L('newsSources')}
                {t.pubblicato ? ` · ${quando(t.pubblicato)}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
              <a href={t.url} target="_blank" rel="noopener noreferrer"
                onClick={() => vibrate(8)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 11, textAlign: 'center',
                  background: 'transparent', border: bordo, color: C.textSecondary,
                  fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {L('newsOpen')}
              </a>
              <button onClick={() => { vibrate(12); onParlane?.(t); }}
                style={{
                  flex: 1.4, padding: '9px 0', borderRadius: 11, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                  border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700,
                  fontFamily: FONT, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <Icon name="send" size={13} color="#fff" />
                {L('newsTalkAbout')}
              </button>
            </div>
          </div>
        </article>
      ))}

      {daCache && argomenti?.length > 0 && (
        <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', padding: '2px 0 10px' }}>
          {L('newsCobraCache')}
        </div>
      )}
    </div>
  );
}

export default memo(MondoNews);
