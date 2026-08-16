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
import SchedaArgomento from './SchedaArgomento.js';
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
  // b.153 — la scheda di lettura/visione e i video di YouTube.
  const [scheda, setScheda] = useState(null); // { tipo: 'articolo'|'video', dati }
  const [video, setVideo] = useState(null);   // null = mai cercati
  const [videoAttivi, setVideoAttivi] = useState(false);
  // b.185 — seconda modalita: Veloce (default) o Approfondita (piu fonti,
  // Wikipedia in testa). `numFonti` = quanto approfondire (3/6/10).
  const [profonda, setProfonda] = useState(false);
  const [numFonti, setNumFonti] = useState(6);
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

  // b.153 — i video viaggiano in parallelo agli articoli: la stessa
  // query interroga anche YouTube (se la chiave c'e) e i risultati
  // compaiono sotto le card. Il fallimento e silenzioso: senza chiave
  // o senza quota, semplicemente niente sezione video.
  const cercaVideoPer = useCallback(async (q) => {
    setVideo(null);
    try {
      const r = await fetch(`/api/topics/video?q=${encodeURIComponent(q)}&lang=${lingua}`);
      if (!r.ok) return;
      const d = await r.json();
      setVideoAttivi(!!d.disponibile);
      if (d.disponibile) setVideo(d.video || []);
    } catch { /* i video sono un di piu, mai un errore in faccia */ }
  }, [lingua]);

  const cerca = useCallback(async (q, cat = 'notizie', fresca = false) => {
    const pulita = (q || '').trim();
    if (!pulita || cercando) return;
    cercaVideoPer(pulita);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setCercando(true); setErrore(false); setProcesso([]); setDaCache(false);
    vibrate(10);
    try {
      const paramProfonda = profonda ? `&deep=1&fonti=${numFonti}` : '';
      const res = await fetch(
        `/api/topics/search?q=${encodeURIComponent(pulita)}&lang=${lingua}&cat=${cat}${fresca ? '&fresh=1' : ''}${paramProfonda}`,
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
  }, [lingua, cercando, descriviStadio, cercaVideoPer, profonda, numFonti]);

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
    // b.149 — su un monitor largo le card diventavano lenzuola con
    // riquadri-immagine giganteschi (schermate di Luca). Le news hanno
    // il passo di un telefono: colonna centrata, mai piu larga di 680px,
    // come la Home.
    <div style={{ padding: '0 16px 96px', fontFamily: FONT, maxWidth: 680, margin: '0 auto' }}>

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

      {/* ─── b.185 · Modalita: Veloce / Approfondita + quante fonti ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: C.card, border: bordo, borderRadius: 999, padding: 3 }}>
          <button onClick={() => { setProfonda(false); vibrate(10); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
              background: !profonda ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : 'transparent',
              border: 'none', color: !profonda ? '#fff' : C.textSecondary, fontSize: 12, fontWeight: 700, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
            }}>
            <Icon name="zap" size={13} color={!profonda ? '#fff' : C.textMuted} /> {L('newsModeFast')}
          </button>
          <button onClick={() => { setProfonda(true); vibrate(10); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
              background: profonda ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : 'transparent',
              border: 'none', color: profonda ? '#fff' : C.textSecondary, fontSize: 12, fontWeight: 700, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
            }}>
            <Icon name="graduation" size={13} color={profonda ? '#fff' : C.textMuted} /> {L('newsModeDeep')}
          </button>
        </div>
        {profonda && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT }}>{L('newsSourcesShort')}</span>
            {[3, 6, 10].map(n => (
              <button key={n} onClick={() => { setNumFonti(n); vibrate(8); }}
                style={{
                  width: 30, height: 28, borderRadius: 9, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700,
                  background: numFonti === n ? `${C.accent}20` : C.card,
                  border: numFonti === n ? `1px solid ${C.accent}45` : bordo,
                  color: numFonti === n ? C.accent : C.textSecondary,
                  WebkitTapHighlightColor: 'transparent',
                }}>{n}</button>
            ))}
          </div>
        )}
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
          {/* La miniatura: 16:9, col fondale pronto SOTTO la foto.
              b.149 — se l'immagine muore in volo, onError toglie solo
              il livello <img> e resta il fondale con l'iniziale.
              b.151 — Luca: "tante pagine vuote". Una card SENZA foto
              non mostra nessun riquadro: solo testo, compatta. Il
              riquadro esiste soltanto quando c'e una foto da farci
              stare dentro. */}
          {t.immagine && (
            <div onClick={() => { vibrate(8); setScheda({ tipo: 'articolo', dati: t }); }} style={{
              position: 'relative', aspectRatio: '16/9', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${C.accent}14, ${C.purple}18)`,
              overflow: 'hidden',
            }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: `${C.accent}55`, letterSpacing: 1 }}>
                {(t.fonti[0]?.fonte || '·').slice(0, 1).toUpperCase()}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element -- immagine
                  esterna di dominio ignoto: next/image richiederebbe la lista
                  dei domini, che per le news non esiste */}
              <img src={t.immagine} alt="" loading="lazy" referrerPolicy="no-referrer"
                onError={e => { e.currentTarget.style.display = 'none'; }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'linear-gradient(180deg, transparent 55%, rgba(5,7,15,0.85))',
              }} />
            </div>
          )}

          <div style={{ padding: '12px 14px 13px' }}>
            {/* b.153 — il titolo apre la scheda di lettura: sintesi
                BarTalk, citazione attribuita, e "Leggi su [fonte]". */}
            <h3 onClick={() => { vibrate(8); setScheda({ tipo: 'articolo', dati: t }); }} style={{
              margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35,
              color: C.textPrimary, letterSpacing: -0.2, cursor: 'pointer',
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

      {/* ─── I VIDEO (b.153): YouTube per la via ufficiale ─── */}
      {videoAttivi && video?.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>
            {L('catVideo')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {video.slice(0, 8).map(v => (
              <button key={v.id}
                onClick={() => { vibrate(8); setScheda({ tipo: 'video', dati: v }); }}
                style={{
                  padding: 0, textAlign: 'left', cursor: 'pointer', overflow: 'hidden',
                  borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`,
                  fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
                }}>
                <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura YouTube */}
                  <img src={v.miniatura} alt="" loading="lazy"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{
                      width: 38, height: 38, borderRadius: 19, background: 'rgba(0,0,0,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="play" size={16} color="#fff" />
                    </span>
                  </span>
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, color: C.textPrimary,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {v.titolo}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3 }}>{v.canale}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── La scheda di lettura/visione ─── */}
      <SchedaArgomento
        aperta={!!scheda} tipo={scheda?.tipo} dati={scheda?.dati} C={C}
        onClose={() => setScheda(null)}
        onParlane={() => {
          const d = scheda?.dati;
          if (d) onParlane?.(scheda.tipo === 'video'
            ? { titolo: d.titolo, sintesi: d.canale ? `YouTube · ${d.canale}` : '' }
            : d);
          setScheda(null);
        }} />
    </div>
  );
}

export default memo(MondoNews);
