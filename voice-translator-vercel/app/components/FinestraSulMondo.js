'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import AnteprimaCoperta from './ui/AnteprimaCoperta.js';
import { cercaTopics } from '../lib/topics/cliente.js';
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

export default function FinestraSulMondo({ C, L, lingua, prefs, attiva, paese, nomePaese }) {
  const ritmo = prefs?.mondoRitmo || 'mai';
  const [cartello, setCartello] = useState(null);   // la breaking in mostra
  const [aperta, setAperta] = useState(null);       // la scheda a tutto schermo
  const codaRef = useRef([]);
  const vistiRef = useRef(new Set());
  const giroRef = useRef(0);
  const cercandoRef = useRef(false);

  // il prossimo cartello dalla coda; null se non c'e niente di nuovo
  const avanza = useCallback(() => {
    const prossimo = codaRef.current.shift() || null;
    setCartello(prossimo);
  }, []);

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
        codaRef.current.push(...nuovi.slice(0, 5).map((t) => ({ ...t, paeseRicerca: interessi.length ? null : paese })));
        setCartello((c) => c || codaRef.current.shift() || null);
      }
    } catch { /* vere o niente: senza notizie nessun cartello, mai un errore in faccia */ }
    cercandoRef.current = false;
  }, [prefs?.interessi, paese, nomePaese, lingua, ritmo]);

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

  // il cartello resta 18 secondi, poi avanza da solo (la «serie»)
  useEffect(() => {
    if (!cartello || aperta) return undefined;
    const t = setTimeout(avanza, 18000);
    return () => clearTimeout(t);
  }, [cartello, aperta, avanza]);

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
            {aperta.immagine && (
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
