'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { chiaveContenuto, hoMessoCuore, giraCuore, quantiCuori } from '../lib/gradimento.js'; // b.544 — il mi piace
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

// ═══════════════════════════════════════════════════════════════
// b.539 — LA COLONNINA DELLE AZIONI. Luca, guardando un video nel feed:
// «perche questo contenuto non ha tasti?».
// Perche' quando il feed e' nato (b.515) i tasti erano stati dati solo
// agli articoli: per i video l'unica azione prevista era guardare. Ma un
// video che ti colpisce e' esattamente il momento in cui vuoi parlarne —
// e li non c'era niente da toccare.
// Sta sul BORDO DESTRO, a mezza altezza: e' il posto che usano tutti
// (e chi guarda lo cerca li), e soprattutto e' lontano dalla barra dei
// comandi del player, che in fondo allo schermo deve restare libera —
// la lezione di b.538, pagata due volte.
// ═══════════════════════════════════════════════════════════════
function Azioni({ voci }) {
  return (
    <div style={{
      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
      zIndex: 3, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {voci.filter(Boolean).map((v) => (
        <div key={v.chiave} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <button
            onClick={(e) => { e.stopPropagation(); v.onTocca(); }}
            aria-label={v.parola} title={v.parola} aria-pressed={v.acceso || undefined}
            style={{
              width: 46, height: 46, borderRadius: 999, cursor: 'pointer', padding: 0,
              // b.544 — acceso quando l'hai messo tu: si vede a colpo d'occhio
              // che il tocco e' arrivato, senza aspettare la rete.
              background: v.acceso ? 'rgba(255,84,112,0.22)' : 'rgba(10,14,26,0.72)',
              border: `1px solid ${v.acceso ? 'rgba(255,84,112,0.65)' : 'rgba(255,255,255,0.18)'}`,
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>
            <Icon name={v.icona} size={19} color={v.acceso ? '#ff5470' : '#fff'} />
          </button>
          {v.conto ? (
            <span style={{
              fontSize: 11, fontWeight: 600, fontFamily: FONT,
              color: v.acceso ? '#ff5470' : 'rgba(255,255,255,0.82)',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}>{v.conto}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function FeedNotizieMondo({ aperto, onChiudi, C, L, argomenti = [], video = [], filtro, onFiltro, onParlane, onApriArticolo, onStrumenti, onCresci, crescendo = false, onCerca }) {
  const contenitoreRef = useRef(null);
  const sentinelleRef = useRef(new Map());
  const [indiceAttivo, setIndiceAttivo] = useState(0);
  const [seme, setSeme] = useState('');   // b.541 — il campo dell'ultima slide
  // ═══ b.544 — I CUORI ═══
  // «Non si puo dare un mi piace a nessuno» (Luca). `miei` e cio che ho
  // messo io (dal telefono, immediato), `conteggi` e quello di tutti
  // (dal server, quando arriva).
  const [miei, setMiei] = useState(() => new Set());
  const [conteggi, setConteggi] = useState({});

  // si chiedono i conteggi delle slide che si stanno guardando, non di
  // tutte: una manciata di indirizzi per volta.
  useEffect(() => {
    if (!aperto || !elementi.length) return undefined;
    const chiavi = elementi.slice(Math.max(0, indiceAttivo - 2), indiceAttivo + 6)
      .map((el) => chiaveContenuto(el?.dati?.url || (el?.dati?.id ? `youtube.com/watch?v=${el.dati.id}` : '')))
      .filter(Boolean);
    if (!chiavi.length) return undefined;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/mondo/gradimento?chiavi=${encodeURIComponent(chiavi.join(','))}`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return;
        const d = await r.json().catch(() => null);
        if (vivo && d?.conteggi) setConteggi((prima) => ({ ...prima, ...d.conteggi }));
      } catch { /* senza conteggi il cuore si mette lo stesso */ }
    })();
    return () => { vivo = false; };
  }, [aperto, elementi, indiceAttivo]);

  // b.544 — il tocco: prima si accende (chi tocca deve vedere subito),
  // poi si dice al server. Se il server non risponde, il cuore resta
  // acceso qui: e comunque vero che a me e piaciuto.
  const cuore = useCallback((url) => {
    const esito = giraCuore(url);
    if (!esito.chiave) return;
    vibrate(12);
    setMiei((prima) => {
      const dopo = new Set(prima);
      if (esito.acceso) dopo.add(esito.chiave); else dopo.delete(esito.chiave);
      return dopo;
    });
    setConteggi((prima) => ({ ...prima, [esito.chiave]: Math.max(0, (Number(prima[esito.chiave]) || 0) + esito.passo) }));
    fetch('/api/mondo/gradimento', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiave: esito.chiave, passo: esito.passo }),
    }).catch(() => { /* il cuore resta mio anche se la rete non c'e */ });
  }, []);

  // all'apertura si ricorda cosa avevo gia amato
  useEffect(() => { if (aperto) setMiei(new Set()); }, [aperto]);

  // b.544 — «immediatamente fai andare in alto il campo e presenti il
  // nuovo contenuto»: si semina e si torna SUBITO in cima, dove il
  // contenuto nuovo sta arrivando. Chi ha appena chiesto una cosa non
  // deve risalire a mano venti schermate.
  const semina = useCallback(() => {
    const q = seme.trim();
    if (!q) return;
    vibrate(10);
    onCerca?.(q);
    setSeme('');
    setIndiceAttivo(0);
    try { contenitoreRef.current?.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* niente da riportare in cima */ }
  }, [seme, onCerca]);

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

  // ═══ b.541 — IL FEED NON FINISCE ═══
  // Luca: «perche in fondo alla lista non metti un tasto continua cerca
  // ancora con un campo di ricerca?». Due risposte, tutte e due qui: il
  // giardino cresce DA SOLO quando mancano tre slide alla fine (chi
  // scorre non deve accorgersi di niente), e in fondo resta comunque la
  // riga per seminare a mano.
  useEffect(() => {
    if (!aperto || !onCresci || crescendo) return;
    // b.544 — si cresce anche quando il feed e CORTO o VUOTO, non solo
    // quando ci si avvicina scorrendo: «le persone sono pigre e devi
    // mettergli in bocca i contenuti». Chi apre e trova poco non deve
    // chiedere niente — la roba arriva.
    if (elementi.length < 4 || indiceAttivo >= elementi.length - 3) onCresci();
  }, [aperto, indiceAttivo, elementi.length, onCresci, crescendo]);

  // ═══ b.545 — SI PARTE DALLA PRIMA, SEMPRE ═══
  // Collaudo di Luca: «quando parte la visualizzazione mostra la pagina
  // in fondo e attiva il video della prima in alto — hai rotto tutto».
  // Causa, ed e' mia di b.544: il feed si apre PRIMA che i contenuti
  // arrivino (schermata vuota, un'altezza sola), e quando poi le slide
  // compaiono tutte insieme il browser tiene la posizione che aveva —
  // che a quel punto e' il fondo. L'indice restava 0, quindi il player
  // partiva sulla prima mentre gli occhi erano sull'ultima: video che
  // canta fuori dal riquadro.
  // Rimedio: ogni volta che l'elenco passa da vuoto a pieno (o cambia
  // lunghezza in modo brusco perche' e' arrivato un giro nuovo mentre
  // eravamo in cima) si riporta lo scorrimento sulla prima slide, senza
  // animazione. Chi sta gia scorrendo piu in basso non viene toccato.
  const quantiPrima = useRef(0);
  useEffect(() => {
    if (!aperto) { quantiPrima.current = 0; return; }
    const prima = quantiPrima.current;
    quantiPrima.current = elementi.length;
    // da vuoto a pieno: e' l'apertura vera, si parte dalla prima
    if (prima === 0 && elementi.length > 0) {
      setIndiceAttivo(0);
      try { contenitoreRef.current?.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* niente da riportare */ }
    }
  }, [aperto, elementi.length]);

  // riparte dall'inizio ogni volta che si apre o si cambia filtro: una
  // lista diversa merita di ripartire dalla prima, non da un indice che
  // ora punta a un elemento diverso.
  useEffect(() => {
    if (!aperto) return;
    setIndiceAttivo(0);
    // b.545 — l'indice da solo non basta: senza riportare anche lo
    // SCORRIMENTO, si guarda una slide e ne suona un'altra.
    try { contenitoreRef.current?.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* niente da riportare */ }
  }, [aperto, filtro]);

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
        {/* b.544 — IL FEED VUOTO NON CHIEDE NIENTE A NESSUNO: prepara.
            «devi produrre i contenuti» (Luca). Prima qui c'era un invito
            a cercare — cioe un compito. Adesso, se non c'e ancora niente,
            il giardino sta gia lavorando e lo si dice; il campo per
            seminare a mano resta in fondo, per chi lo vuole. */}
        {elementi.length === 0 && (
          <div style={{
            height: '100dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 24, textAlign: 'center', gap: 10,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', fontFamily: FONT }}>
              {L('growingWord')}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', fontFamily: FONT }}>
              {L('feedVuoto')}
            </div>
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
                {/* b.539 — i tasti che mancavano ai video. */}
                <Azioni voci={[
                  /* b.544 — IL CUORE, in cima: e la cosa piu facile da fare
                     e quella che alimenta il resto (i contenuti amati
                     salgono nel feed di tutti). */
                  (() => {
                    const u = `youtube.com/watch?v=${el.dati.id}`;
                    const k = chiaveContenuto(u);
                    const acceso = miei.has(k) || (hoMessoCuore(u) && !miei.size);
                    return { chiave: 'cuore', icona: 'heart', parola: L('likeWord'), acceso,
                      conto: quantiCuori(conteggi, u, null) || null, onTocca: () => cuore(u) };
                  })(),
                  { chiave: 'parlane', icona: 'chat', parola: L('newsTalkAbout'), onTocca: () => { vibrate(10); onParlane?.({ titolo: el.dati.titolo, sintesi: el.dati.canale ? `YouTube \u00b7 ${el.dati.canale}` : '' }); } },
                  { chiave: 'fuori', icona: 'link', parola: L('newsOpenSite'), onTocca: () => { vibrate(6); try { window.open(`https://www.youtube.com/watch?v=${el.dati.id}`, '_blank', 'noopener,noreferrer'); } catch { /* il browser ha rifiutato la finestra */ } } },
                ]} />

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
                {/* ═══ b.542 — LA PAGINA NERA ═══
                    Collaudo di Luca: «controlla perche hai fatto una
                    pagina nera». Non era una pagina rotta: era una slide
                    SENZA IMMAGINE. Le card dell'enciclopedia (e diverse
                    notizie) non ne hanno una, e qui lo sfondo si
                    disegnava solo `se` l'immagine c'era — altrimenti
                    restava il vuoto, con due righe di testo in fondo e
                    mezzo schermo di nero.
                    Ora il fondo c'e SEMPRE: quando manca la fotografia
                    si mette una copertina fatta in casa — il colore del
                    tema in sfumatura e l'iniziale della fonte in
                    filigrana, come gia fanno le card della lista. Una
                    slide senza foto puo essere spoglia; non puo essere
                    vuota. */}
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${C.accent}22, ${C.purple || C.accent}18 45%, rgba(5,7,15,0.96))` }}>
                  {el.dati.immagine ? (
                    <>
                      <AnteprimaCoperta src={el.dati.immagine} L={L}
                        contenuto={{ url: el.dati.url, source: el.dati.fonti?.[0]?.fonte || el.dati.fonti?.[0]?.dominio }}
                        stile={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,7,15,0.15), rgba(5,7,15,0.92) 65%)' }} />
                    </>
                  ) : (
                    <div aria-hidden="true" style={{
                      position: 'absolute', inset: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 132, fontWeight: 700, fontFamily: FONT,
                      color: 'rgba(255,255,255,0.07)', letterSpacing: 2, userSelect: 'none',
                    }}>
                      {String(el.dati.fonti?.[0]?.fonte || el.dati.titolo || '·').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                {/* b.539 — le stesse porte dei video, nello stesso posto:
                    il feed non cambia grammatica a meta scorrimento. */}
                <Azioni voci={[
                  (() => {
                    const u = el.dati.url || '';
                    const k = chiaveContenuto(u);
                    const acceso = miei.has(k) || (hoMessoCuore(u) && !miei.size);
                    return { chiave: 'cuore', icona: 'heart', parola: L('likeWord'), acceso,
                      conto: quantiCuori(conteggi, u, null) || null, onTocca: () => cuore(u) };
                  })(),
                  { chiave: 'leggi', icona: 'doc', parola: L('newsOpenTranslate'), onTocca: () => { vibrate(8); onApriArticolo?.(el.dati); } },
                  { chiave: 'parlane', icona: 'chat', parola: L('newsTalkAbout'), onTocca: () => { vibrate(10); onParlane?.(el.dati); } },
                  el.dati.url ? { chiave: 'fuori', icona: 'link', parola: L('newsOpenSite'), onTocca: () => { vibrate(6); try { window.open(el.dati.url, '_blank', 'noopener,noreferrer'); } catch { /* finestra rifiutata */ } } } : null,
                ]} />

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
                  {/* b.542 — I DUE BOTTONI IN BASSO SONO USCITI. Luca:
                      «devi toglierlo da sotto se lasci un duplicato a
                      destra, e anche apri e traduci giusto?». Giusto: in
                      b.539 ho aggiunto la colonnina a destra e ho
                      lasciato in piedi anche questi, cosi ogni articolo
                      aveva DUE «Apri e traduci» e DUE «Parlane» che
                      facevano la stessa identica cosa. Le porte stanno
                      nella colonnina, dove stanno anche per i video: una
                      grammatica sola. */}
                </div>
              </>
            )}
          </div>
        ))}

        {/* ═══ b.544 — L'ULTIMA RATIO, e si vede solo se serve ═══
            Ordine di Luca, con lo schermo davanti: «questo deve essere la
            ultima razio, nel senso che tu devi produrre i contenuti e se
            proprio non ne hai mostri sotto l'ultimo contenuto un campo
            semplice senza descrizione, e un tasto per avviare una
            ricerca, e immediatamente fai andare in alto il campo e
            presenti il nuovo contenuto» — piu la regola che vale per
            tutto: «considera che le persone sono pigre e devi mettergli
            in bocca i contenuti».
            In b.541 avevo fatto l'errore opposto: con il feed vuoto
            questa slide diventava la PRIMA cosa che si vedeva, con
            titolo e spiegazione, cioe un compito da svolgere al posto
            del giornale. Adesso: compare SOLO in coda a contenuti che
            gia ci sono (`elementi.length > 0`), e' nuda — campo e tasto,
            nessuna descrizione — e appena si semina si torna in cima,
            dove il contenuto nuovo sta gia arrivando. */}
        {elementi.length > 0 && onCerca && (
          <div style={{
            height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '24px 24px calc(40px + env(safe-area-inset-bottom))',
          }}>
            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 420 }}>
              <input value={seme} onChange={(e) => setSeme(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && seme.trim()) semina(); }}
                placeholder={L('newsWhatFollow')} aria-label={L('newsWhatFollow')}
                style={{
                  flex: 1, minHeight: 48, padding: '0 14px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)',
                  outline: 'none', color: '#fff', fontSize: 15, fontFamily: FONT,
                }} />
              <button onClick={semina} disabled={!seme.trim()}
                aria-label={L('newsUpdate')}
                style={{
                  minWidth: 54, minHeight: 48, borderRadius: 14, border: 'none',
                  cursor: seme.trim() ? 'pointer' : 'default', opacity: seme.trim() ? 1 : 0.5,
                  background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Icon name="search" size={18} color="#fff" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </Sovrapposizione>
  );
}
