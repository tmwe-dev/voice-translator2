'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import AnteprimaCoperta from './ui/AnteprimaCoperta.js';
import { cercaTopics } from '../lib/topics/cliente.js';
import { paeseDellaNotizia } from '../lib/paeseDaFonte.js';
import { PAESI } from '../lib/paesi.js';
import { bandieraPaese } from '../lib/schedaMondo.js';

// ═══════════════════════════════════════════════════════════════
// b.506 — LA FINESTRA SUL MONDO (progettata con Luca, 26/08).
//
// «Uno puo lasciare lo schermo sul mondo ed essere informato in tempo
// reale su quello che succede: un terremoto, un'azione in borsa, uno
// scandalo.» Il pianeta gira; a un RITMO deciso dall'utente (mai / 2 /
// 5 / 10 minuti, preferenza mondoRitmo nel pannello — la leva su
// batteria e credito) si cercano le ultime notizie; quelle NUOVE
// compaiono una alla volta come un CARTELLO in basso — bandiera,
// miniatura, titolo tradotto nella lingua di chi guarda — che si puo
// chiudere o toccare. Toccato, si apre A TUTTO SCHERMO con la foto, la
// sintesi e la strada per la fonte; chiuso, vola via e il mondo
// continua a girare.
//
// LE REGOLE VERE:
// - ritmo predefinito MAI: niente ricerche non chieste (stessa regola
//   di mondoAggiorna, b.363);
// - si ferma quando la pagina e nascosta (documento hidden): una
//   finestra che cerca da sola a schermo spento brucia batteria e
//   credito per nessuno;
// - la ricerca passa dalla CACHE condivisa di /api/topics/search
//   (fresca solo col ritmo a 2, che e la scelta «ultimo minuto»);
// - cosa cerca: gli INTERESSI del profilo a rotazione se ci sono,
//   altrimenti le ultime del Paese scelto, altrimenti del mondo;
// - vere o niente: se non arriva nulla di nuovo, nessun cartello.
// ═══════════════════════════════════════════════════════════════

const MINUTI = { 2: 2, 5: 5, 10: 10 };
// b.515 — quanto aspettare il volo del pianeta prima di mostrare il
// cartello: tempo scelto guardando l'animazione di zoomTo gia dentro
// mondo-globo.html (lerpFactor 0.03 per frame, converge in ~1.2-1.6s a
// 60fps) — nessuna animazione nuova, solo il tempo per vederla finire.
const ATTESA_VOLO_MS = 1500;
// i codici che il globo sa raggiungere: fuori da questi non si vola.
const CODICI_NOTI = new Set(PAESI.map((p) => p.codice));

export default function FinestraSulMondo({ C, L, lingua, prefs, attiva, paese, nomePaese, onPuntaGlobo, autoplayVideo = true, occupato = false }) {
  // b.515 — ordine di Luca: «di default lo fai partire». La regola di
  // sopra (mai spesa non chiesta) resta vera nello spirito: ora e acceso
  // di base, e chi non lo vuole lo spegne lui dal pannello — non il
  // contrario.
  const ritmo = prefs?.mondoRitmo || '5';
  const [cartello, setCartello] = useState(null);   // la breaking in mostra
  const [aperta, setAperta] = useState(null);       // la scheda a tutto schermo
  const [videoLettura, setVideoLettura] = useState(null); // b.515 — il video correlato, cercato SOLO quando si apre
  const codaRef = useRef([]);
  const vistiRef = useRef(new Set());
  const giroRef = useRef(0);
  const cercandoRef = useRef(false);
  // b.515 — cartello/aperta letti dentro cerca() via ref, non da
  // dipendenza diretta: se stessero nella dependency array di cerca(),
  // ogni apertura/chiusura di un cartello ricreerebbe cerca() e con lei
  // (l'effetto del ritmo dipende da cerca) l'intervallo — il timer dei
  // 5/10 minuti ripartirebbe da capo ogni volta che l'utente tocca un
  // cartello, invece di scandire il tempo vero.
  const cartelloRef = useRef(null);
  const apertaRef = useRef(null);
  useEffect(() => { cartelloRef.current = cartello; }, [cartello]);
  useEffect(() => { apertaRef.current = aperta; }, [aperta]);
  // b.517 — «occupato» arriva da fuori (pannello aperto, lettura in
  // corso...): si legge da un ref, non da una dipendenza, perche non
  // deve rigenerare il timer del ritmo ogni volta che cambia.
  const occupatoRef = useRef(false);
  useEffect(() => { occupatoRef.current = occupato; }, [occupato]);
  const voloRef = useRef(null);          // il timer dell'attesa prima di mostrare
  const aspettandoRef = useRef(false);   // tra "ho puntato il pianeta" e "mostro il cartello"

  // b.515 — IL PROSSIMO DALLA CODA, MA CON UNA TAPPA IN MEZZO. Ordine di
  // Luca: «mentre arrivano le notizie devi muovere il globo prima di
  // visualizzarle nella area specifica e poi aprire il thumbnail». Se il
  // prossimo ha un paese, prima si punta il pianeta (onPuntaGlobo) e
  // SOLO DOPO l'attesa del volo compare il cartello col thumbnail. Senza
  // un paese da puntare (interessi a rotazione: nessun luogo) il
  // cartello compare subito, come prima di questa versione — non c'e
  // niente da far vedere volare.
  // Questa funzione la chiama anche chi chiude la lettura (il tasto
  // indietro della scheda a tutto schermo): e li che il ciclo riprende,
  // mai da solo mentre l'utente sta ancora leggendo.
  const avanza = useCallback(() => {
    if (voloRef.current) { clearTimeout(voloRef.current); voloRef.current = null; }
    const prossimo = codaRef.current.shift() || null;
    if (!prossimo) {
      aspettandoRef.current = false;
      setCartello(null);
      onPuntaGlobo?.(null);   // niente piu in coda: il pianeta torna libero
      return;
    }
    if (prossimo.paeseRicerca) {
      aspettandoRef.current = true;
      onPuntaGlobo?.(prossimo.paeseRicerca);
      voloRef.current = setTimeout(() => {
        aspettandoRef.current = false;
        voloRef.current = null;
        setCartello(prossimo);
      }, ATTESA_VOLO_MS);
    } else {
      setCartello(prossimo);
    }
  }, [onPuntaGlobo]);

  const cerca = useCallback(async () => {
    if (cercandoRef.current) return;
    cercandoRef.current = true;
    try {
      const interessi = Array.isArray(prefs?.interessi) ? prefs.interessi.filter(Boolean) : [];
      const q = interessi.length
        ? interessi[giroRef.current++ % interessi.length]
        : (paese && nomePaese ? `${nomePaese(paese)} breaking news` : 'breaking news');
      const fine = await cercaTopics({
        q, lingua, cat: 'notizie',
        // «ultimo minuto» (ritmo a 2) salta la cache; gli altri ritmi la
        // usano: e la cache condivisa a fare da vero contatore di spesa.
        fresca: ritmo === '2', fonti: 0,
        segnale: AbortSignal.timeout(60000),
      }, () => {});
      const nuovi = (fine?.argomenti || []).filter((t) => {
        const k = t.url || t.id || t.titolo;
        if (!k || vistiRef.current.has(k)) return false;
        vistiRef.current.add(k);
        return true;
      });
      if (nuovi.length) {
        // b.517 — IL PAESE LO DICE LA NOTIZIA, NON LA RICERCA.
        //
        // BUG PRE-ESISTENTE (mio, b.515), dichiarato: qui c'era
        //   paeseRicerca: interessi.length ? null : paese
        // che nei fatti non faceva volare il pianeta MAI. Con gli
        // interessi accesi (il modo normale) il paese era `null`;
        // senza interessi era quello che l'utente aveva GIA scelto,
        // cioe dove il globo si trovava gia. La funzione era viva nel
        // codice e morta all'uso: Luca l'ha vista mancare dal vivo.
        //
        // Il paese si legge dalle FONTI della notizia (dominio ->
        // paese, vedi lib/paeseDaFonte.js). Se non si riconosce, resta
        // `null` e il pianeta non si muove: meglio fermo che nel posto
        // sbagliato.
        codaRef.current.push(...nuovi.slice(0, 5).map((t) => ({
          ...t,
          paeseRicerca: paeseDellaNotizia(t, CODICI_NOTI) || (interessi.length ? null : paese),
        })));
        // b.515 — parte da sola SOLO se non c'e gia un cartello in
        // mostra, nessun volo in corso, e l'utente non sta leggendo: la
        // guardia vera («non muovere il globo mentre l'utente legge»)
        // sta qui.
        // b.517 — la guardia si estende: «quando l'utente sta
        // lavorando leggendo o interagendo con un articolo, video etc,
        // non fai muovere il globo» (ordine di Luca, b.515). Prima
        // guardava solo il cartello a schermo intero di questa
        // finestra; ora `occupato` copre anche il pannello aperto e
        // qualunque altra cosa l'utente abbia davanti.
        if (!cartelloRef.current && !aspettandoRef.current && !apertaRef.current && !occupatoRef.current) avanza();
      }
    } catch { /* vere o niente: senza notizie nessun cartello, mai un errore in faccia */ }
    cercandoRef.current = false;
  }, [prefs?.interessi, paese, nomePaese, lingua, ritmo, avanza]);

  // ── IL RITMO: parte quando la finestra e davanti agli occhi ──
  useEffect(() => {
    if (!attiva || !MINUTI[ritmo]) return undefined;
    let timer = null;
    const parti = () => {
      if (timer) return;
      cerca();
      timer = setInterval(cerca, MINUTI[ritmo] * 60000);
    };
    const fermati = () => { if (timer) { clearInterval(timer); timer = null; } };
    const suVisibilita = () => { document.hidden ? fermati() : parti(); };
    if (!document.hidden) parti();
    document.addEventListener('visibilitychange', suVisibilita);
    return () => { fermati(); document.removeEventListener('visibilitychange', suVisibilita); };
  }, [attiva, ritmo, cerca]);

  // b.515 — «lascia che l'utente decida se attivare l'autoplay del video
  // breaking news». Il motore di cerca() interroga SOLO articoli (mai
  // video, vedi cercaArgomenti): un video, se c'e, si cerca a parte e
  // SOLO quando l'utente apre davvero la lettura — mai per ogni notizia
  // che arriva in coda, che costerebbe quota YouTube per breaking che
  // nessuno guarda mai.
  useEffect(() => {
    setVideoLettura(null);
    if (!aperta?.titolo) return undefined;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/topics/video?q=${encodeURIComponent(aperta.titolo)}&lang=${encodeURIComponent(lingua)}`,
          { signal: AbortSignal.timeout(15000) });
        if (!r.ok || !vivo) return;
        const d = await r.json().catch(() => null);
        if (vivo && d?.video?.[0]) setVideoLettura(d.video[0]);
      } catch { /* niente video: la scheda resta com'era, solo testo e immagine */ }
    })();
    return () => { vivo = false; };
  }, [aperta, lingua]);

  // il cartello resta 18 secondi, poi avanza da solo (la «serie»)
  useEffect(() => {
    if (!cartello || aperta) return undefined;
    const t = setTimeout(avanza, 18000);
    return () => clearTimeout(t);
  }, [cartello, aperta, avanza]);

  // b.515 — smontaggio pulito: se la finestra sparisce (cambio tab) col
  // volo in corso, il timer non deve sopravviverle.
  useEffect(() => () => { if (voloRef.current) clearTimeout(voloRef.current); }, []);

  if (!attiva) return null;

  const bandiera = cartello?.paeseRicerca ? bandieraPaese(cartello.paeseRicerca) : null;

  return (
    <>
      {/* ═══ IL CARTELLO — il toast della breaking, in basso ═══ */}
      {cartello && !aperta && (
        <div style={{
          position: 'absolute', left: 20, right: 20, bottom: 'calc(120px + env(safe-area-inset-bottom))',
          display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto',
            width: '100%', maxWidth: 420, padding: '10px 12px',
            background: 'rgba(6,9,18,0.92)', border: `1px solid ${C.cardBorder}`,
            borderRadius: 16, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 14px 40px rgba(0,0,0,0.5)', fontFamily: FONT,
            animation: 'vtCartelloSale .28s cubic-bezier(0.2,0.8,0.3,1)',
          }}>
            {cartello.immagine ? (
              <AnteprimaCoperta src={cartello.immagine} L={L}
                contenuto={{ url: cartello.url }}
                stile={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <span style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${C.accent}14`, border: `1px solid ${C.cardBorder}` }}>
                <Icon name="doc" size={18} color={C.accent} />
              </span>
            )}
            <button onClick={() => { vibrate(8); setAperta(cartello); }}
              style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: FONT, padding: 0, minHeight: 44 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600,
                letterSpacing: 1, textTransform: 'uppercase', color: C.accent }}>
                {bandiera && <span aria-hidden="true" style={{ fontSize: 12 }}>{bandiera}</span>}
                {L('breakingWord')}
              </span>
              <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', fontSize: 13.5, fontWeight: 600, lineHeight: 1.3,
                color: C.textPrimary, marginTop: 2 }}>
                {cartello.titolo}
              </span>
            </button>
            <button onClick={() => { vibrate(6); avanza(); }} aria-label={L('closeWord')}
              style={{ width: 44, height: 44, flexShrink: 0, background: 'none', border: 'none',
                cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center',
                justifyContent: 'center' }}>
              <Icon name="x" size={16} color={C.textMuted} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ LA SCHEDA A TUTTO SCHERMO — si legge, si chiude, vola via ═══ */}
      {aperta && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 96, background: C.bg || '#05070f',
          display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', flexShrink: 0 }}>
            <button onClick={() => { vibrate(6); setAperta(null); avanza(); }} aria-label={L('closeWord')}
              style={{ width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
                background: C.card, border: `1px solid ${C.cardBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="back" size={18} color={C.textMuted} />
            </button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
              letterSpacing: 1.2, textTransform: 'uppercase', color: C.accent }}>
              {bandiera && <span aria-hidden="true">{bandiera}</span>}
              {L('breakingWord')}
            </span>
          </header>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px calc(24px + env(safe-area-inset-bottom))', scrollbarWidth: 'none' }}>
            {videoLettura ? (
              // b.515 — il player ufficiale YouTube (nocookie), stesso
              // meccanismo gia in uso in SchedaArgomento.js: mai una
              // copia, sempre la fonte con la sua monetizzazione intatta.
              // Autoplay SOLO se l'utente lo ha acceso in testata.
              <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 16, overflow: 'hidden', background: '#000', marginBottom: 14 }}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoLettura.id}${autoplayVideo ? '?autoplay=1' : ''}`}
                  title={videoLettura.titolo || aperta.titolo}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
              </div>
            ) : aperta.immagine && (
              <AnteprimaCoperta src={aperta.immagine} L={L} contenuto={{ url: aperta.url }}
                stile={{ width: '100%', aspectRatio: '16/9', borderRadius: 16, objectFit: 'cover', marginBottom: 14 }} />
            )}
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 600, lineHeight: 1.3, color: C.textPrimary }}>
              {aperta.titolo}
            </h2>
            {aperta.sintesi && (
              <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.6, color: C.textSecondary }}>
                {aperta.sintesi}
              </p>
            )}
            {aperta.fonti?.[0]?.url && (
              <a href={aperta.fonti[0].url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 18, minHeight: 54, borderRadius: 16, textDecoration: 'none',
                  background: `${C.accent}14`, border: `1px solid ${C.accent}44`,
                  color: C.accent, fontSize: 14.5, fontWeight: 600 }}>
                <Icon name="link" size={16} color={C.accent} />
                {L('schedaLeggiSu').replace('{x}', aperta.fonti[0].fonte || aperta.fonti[0].dominio || '')}
              </a>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes vtCartelloSale { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    </>
  );
}
