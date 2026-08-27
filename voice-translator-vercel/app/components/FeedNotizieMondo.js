'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import AnteprimaCoperta from './ui/AnteprimaCoperta.js';
import Sovrapposizione from './ui/Sovrapposizione.js';

// ═══════════════════════════════════════════════════════════════
// FeedNotizieMondo — IL FEED A TUTTA PAGINA (b.515)
//
// Ordine di Luca: «nella stanza news social attiva una visualizzazione
// continua a tutta pagina che mostri le notizie a tutta pagina e se uno
// entra e scorre attiva l'autoplay per ogni video in sequenza».
//
// Una notizia (o un video) per schermata, scroll-snap verticale: chi e
// in vista prende l'autoplay, chi esce lo perde — mai piu di un video
// che suona alla volta. Il filtro (solo articoli / solo video /
// entrambi, DEFAULT SOLO VIDEO — ordine di Luca) sta in un comando
// fisso in alto, sempre visibile mentre si scorre.
//
// Riusa i dati gia in mano a MondoNews (argomenti/video dell'ultima
// ricerca): nessuna chiamata di rete propria, nessun costo aggiuntivo.
// ═══════════════════════════════════════════════════════════════

const FILTRI = [
  { id: 'video', labelKey: 'feedSoloVideo' },
  { id: 'articoli', labelKey: 'feedSoloArticoli' },
  { id: 'entrambi', labelKey: 'feedEntrambi' },
];

// b.538 — L'ALTEZZA DELLA BARRA DEI COMANDI DI YOUTUBE. Il player
// disegna i suoi comandi (play, tempo, cc, ingranaggio, schermo intero)
// in una fascia in fondo all'inquadratura: circa 48 punti sul telefono,
// una sessantina sullo schermo grande. Si tiene la misura piu generosa:
// meglio due dita d'aria in piu che un tasto coperto.
const BARRA_YT = 60;

export default function FeedNotizieMondo({ aperto, onChiudi, C, L, argomenti = [], video = [], filtro, onFiltro, onParlane, onApriArticolo, onStrumenti }) {
  const contenitoreRef = useRef(null);
  const sentinelleRef = useRef(new Map());
  const [indiceAttivo, setIndiceAttivo] = useState(0);

  const elementi = useMemo(() => {
    const art = (argomenti || []).map((t) => ({ tipo: 'articolo', dati: t, chiave: `a-${t.id || t.url || t.titolo}` }));
    const vid = (video || []).filter((v) => v?.id).map((v) => ({ tipo: 'video', dati: v, chiave: `v-${v.id}` }));
    if (filtro === 'video') return vid;
    if (filtro === 'articoli') return art;
    // «entrambi»: intercalati, cosi non si scorrono prima tutti gli
    // articoli in blocco e poi tutti i video in blocco.
    const out = [];
    const n = Math.max(art.length, vid.length);
    for (let i = 0; i < n; i++) { if (art[i]) out.push(art[i]); if (vid[i]) out.push(vid[i]); }
    return out;
  }, [argomenti, video, filtro]);

  // b.515 — CHI E' IN VISTA PRENDE L'AUTOPLAY. Un solo IntersectionObserver
  // su tutte le slide: quella con piu area visibile (soglia 0.6) diventa
  // l'attiva. Le altre spengono il loro player da sole, perche il loro
  // iframe smette di esistere quando non sono piu l'attiva (vedi sotto,
  // i !== indiceAttivo mostra solo la miniatura) — «autoplay in
  // sequenza», mai due video che suonano insieme.
  useEffect(() => {
    if (!aperto || !contenitoreRef.current) return undefined;
    const oss = new IntersectionObserver((entries) => {
      // ═══ b.538 — IL RIBALTAMENTO DELLO SCHERMO ═══
      // Collaudo di Luca: «quando ho ribaltato lo schermo, va in errore e
      // si chiude l'applicazione».
      // La causa e' qui, ed e' una di quelle che si vedono solo quando
      // l'altezza cambia sotto i piedi. Ruotando il telefono, le slide —
      // alte 100dvh l'una — vengono rimisurate tutte insieme: per un
      // istante PIU DI UNA supera la soglia di 0.6, e questo giro
      // chiamava setIndiceAttivo per OGNI voce dell'elenco, in fila.
      // Ogni chiamata ridisegna, il ridisegno rimisura, la rimisura
      // richiama: React conta gli aggiornamenti a catena e oltre un
      // certo numero si arrende («Maximum update depth exceeded»), che
      // e' proprio l'errore che fa comparire la schermata rossa.
      // Due chiusure, tutte e due necessarie:
      //   1. si sceglie UNA sola slide per giro — quella che si vede di
      //      piu — invece di obbedire a tutte;
      //   2. se e' gia lei l'attiva non si tocca niente: nessun
      //      ridisegno, nessuna catena.
      let miglioreIdx = -1;
      let miglioreArea = 0;
      entries.forEach((e) => {
        if (!e.isIntersecting || e.intersectionRatio < 0.6) return;
        if (e.intersectionRatio <= miglioreArea) return;
        const idx = Number(e.target.dataset.indice);
        if (!Number.isFinite(idx)) return;
        miglioreArea = e.intersectionRatio;
        miglioreIdx = idx;
      });
      if (miglioreIdx >= 0) setIndiceAttivo((prima) => (prima === miglioreIdx ? prima : miglioreIdx));
    }, { root: contenitoreRef.current, threshold: [0.6] });
    sentinelleRef.current.forEach((el) => oss.observe(el));
    return () => oss.disconnect();
  }, [aperto, elementi.length]);

  // b.538 — E DOPO IL RIBALTAMENTO SI RESTA DOVE SI ERA. Cambiando
  // orientamento tutte le slide cambiano altezza e lo scorrimento
  // finisce a meta strada fra due: si rimette la slide attiva al suo
  // posto, senza animazione (un'animazione mentre lo schermo gira si
  // vede come uno strappo). Luca: «con il telefono devo poter ribaltare
  // tranquillamente l'immagine e vederla tutto schermo».
  useEffect(() => {
    if (!aperto) return undefined;
    const rimetti = () => {
      // si aspetta che il browser abbia finito di rimisurare: farlo
      // subito rimetterebbe a posto con le misure vecchie.
      setTimeout(() => {
        const el = sentinelleRef.current.get(elementi[indiceAttivo]?.chiave);
        try { el?.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch { /* niente da rimettere */ }
      }, 260);
    };
    window.addEventListener('orientationchange', rimetti);
    window.addEventListener('resize', rimetti);
    return () => {
      window.removeEventListener('orientationchange', rimetti);
      window.removeEventListener('resize', rimetti);
    };
  }, [aperto, indiceAttivo, elementi]);

  // riparte dall'inizio ogni volta che si apre o si cambia filtro: una
  // lista diversa merita di ripartire dalla prima, non da un indice che
  // ora punta a un elemento diverso.
  useEffect(() => { if (aperto) setIndiceAttivo(0); }, [aperto, filtro]);

  if (!aperto) return null;

  // b.516 — «a tutta pagina» non lo era: misurato in produzione 440x691
  // dentro una finestra 657x749, perche' il `fixed` era prigioniero
  // della colonna della sezione. Vedi Sovrapposizione.js.
  return (
    <Sovrapposizione>
    <div style={{ position: 'fixed', inset: 0, zIndex: 97, background: C.bg || '#05070f', fontFamily: FONT }}>
      {/* ═══ header fisso: chiudi + il filtro a tre stati ═══ */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px',
        background: 'linear-gradient(180deg, rgba(5,7,15,0.85), transparent)',
      }}>
        {/* b.535 — Luca: «la x in alto deve essere una freccia back». */}
        <button onClick={() => { vibrate(6); onChiudi?.(); }} aria-label={L('backWord')}
          style={{
            width: 44, height: 44, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
            background: 'rgba(10,14,26,0.7)', border: '1px solid rgba(255,255,255,0.14)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Icon name="back" size={16} color="#fff" />
        </button>
        <div role="tablist" aria-label={L('feedFiltroLabel')} style={{
          display: 'flex', gap: 4, flex: 1, overflow: 'hidden', padding: 3,
          background: 'rgba(10,14,26,0.7)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12,
        }}>
          {FILTRI.map((f) => {
            const acceso = filtro === f.id;
            return (
              <button key={f.id} role="tab" aria-selected={acceso}
                onClick={() => { vibrate(6); onFiltro?.(f.id); }}
                style={{
                  flex: 1, minHeight: 38, padding: '0 8px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: acceso ? C.accent : 'transparent', color: acceso ? '#fff' : 'rgba(255,255,255,0.72)',
                  fontSize: 12, fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap',
                }}>
                {L(f.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* b.535 — Luca: «non c'e la linguetta in primo piano per
          modificare le ricerche o farne in tempo reale di nuove.
          inseriscila a sinistra». Bordo sinistro, meta' altezza: apre
          gli strumenti SOPRA il feed (PannelloLaterale con `sopra`). */}
      {onStrumenti && (
        <button onClick={() => { vibrate(8); onStrumenti(); }}
          aria-label={L('tabNews')} title={L('tabNews')}
          style={{
            position: 'absolute', left: 0, top: '44%', zIndex: 3,
            width: 34, height: 64, borderRadius: '0 14px 14px 0', cursor: 'pointer',
            background: 'rgba(10,14,26,0.78)', border: '1px solid rgba(255,255,255,0.16)',
            borderLeft: 'none', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}>
          <Icon name="search" size={15} color="#fff" />
        </button>
      )}

      {/* ═══ il feed: una slide per schermata, scroll-snap verticale ═══ */}
      <div ref={contenitoreRef} style={{
        position: 'absolute', inset: 0, overflowY: 'auto', scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', scrollbarWidth: 'none',
      }}>
        {elementi.length === 0 && (
          <div style={{
            height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 14,
          }}>
            {L('feedVuoto')}
          </div>
        )}
        {elementi.map((el, i) => (
          <div key={el.chiave}
            ref={(node) => { if (node) sentinelleRef.current.set(el.chiave, node); else sentinelleRef.current.delete(el.chiave); }}
            data-indice={i}
            style={{
              height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always',
              position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}>
            {el.tipo === 'video' ? (
              <>
                <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
                  {i === indiceAttivo ? (
                    // b.515 — il player ufficiale YouTube (nocookie), come
                    // in SchedaArgomento.js: la sua monetizzazione resta
                    // sua. Esiste SOLO mentre e la slide attiva: uscendo
                    // dalla vista lo smontaggio del componente ferma
                    // l'audio da solo, senza un comando esplicito.
                    <iframe key={`on-${el.dati.id}`}
                      src={`https://www.youtube-nocookie.com/embed/${el.dati.id}?autoplay=1&playsinline=1`}
                      title={el.dati.titolo}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura YouTube, dominio esterno
                    <img src={el.dati.miniatura} alt="" loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                  )}
                </div>
                {/* b.535 — Luca: «il menu di youtube rimane nascosto».
                    Questo velo col titolo copriva la barra dei comandi del
                    player e si mangiava i tocchi: ora e' solo pittura
                    (pointerEvents none) — il titolo si vede, il menu di
                    YouTube si tocca. */}
                <div style={{
                  // b.538, Luca per la seconda volta: «i comandi di YouTube
                  // rimangono nascosti dall'ombreggiatura in basso. Devi
                  // fare in modo di alzarla». In b.535 il velo aveva smesso
                  // di RUBARE i tocchi (pointerEvents none), ma continuava a
                  // COPRIRLI con la pittura: la barra del player sta negli
                  // ultimi ~56 punti dell'inquadratura, e li c'era il fondo
                  // scuro pieno. Ora il blocco si alza di tutta l'altezza
                  // della barra (BARRA_YT) e il gradiente si spegne prima:
                  // il titolo si legge, i comandi restano in chiaro.
                  position: 'relative', zIndex: 1,
                  padding: '16px 20px 10px',
                  marginBottom: `calc(${BARRA_YT}px + env(safe-area-inset-bottom))`,
                  background: 'linear-gradient(180deg, transparent, rgba(5,7,15,0.92) 55%)',
                  pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{el.dati.titolo}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{el.dati.canale}</div>
                </div>
              </>
            ) : (
              <>
                {el.dati.immagine && (
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <AnteprimaCoperta src={el.dati.immagine} L={L}
                      contenuto={{ url: el.dati.url, source: el.dati.fonti?.[0]?.fonte || el.dati.fonti?.[0]?.dominio }}
                      stile={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,7,15,0.15), rgba(5,7,15,0.92) 65%)' }} />
                  </div>
                )}
                <div style={{ position: 'relative', zIndex: 1, padding: '16px 20px calc(28px + env(safe-area-inset-bottom))' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{el.dati.titolo}</h3>
                  {el.dati.sintesi && (
                    <p style={{
                      margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {el.dati.sintesi}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {/* b.515 — stessa scelta della card in lista: «apri e
                        traduci» qui non aspetta il tocco sul tasto Genera. */}
                    <button onClick={() => { vibrate(8); onApriArticolo?.(el.dati); }}
                      style={{
                        flex: 1, minHeight: 44, borderRadius: 11, cursor: 'pointer',
                        background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                        border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                      }}>
                      {L('newsOpenTranslate')}
                    </button>
                    <button onClick={() => { vibrate(10); onParlane?.(el.dati); }}
                      style={{
                        flex: 1, minHeight: 44, borderRadius: 11, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff', fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                      }}>
                      {L('newsTalkAbout')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
    </Sovrapposizione>
  );
}
