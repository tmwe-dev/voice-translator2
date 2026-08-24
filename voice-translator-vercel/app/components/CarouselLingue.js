'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FONT, LANGS, vibrate } from '../lib/constants.js';

// ═══════════════════════════════════════════════════════════════
// b.354 — IL CAROSELLO DELLE LINGUE, copiato dal selettore paesi di
// Wueform (ordine di Luca: «prendili, copiali come sono e usali al
// posto della dropdown»). Cinque bandiere in vista: quella al centro
// a colori pieni e luminosa, le vicine in grigio leggero, le lontane
// quasi spente; frecce ai lati, scivolata animata, trascinamento col
// dito, e il bottone a righine che apre l'elenco completo con la
// ricerca. Sotto, il nome della lingua segue il centro. Porting in
// React puro: niente librerie, stessa resa.
// ═══════════════════════════════════════════════════════════════

// Le lingue rapide prima (le piu usate), poi tutte le altre in ordine
// alfabetico — identico al criterio del selettore Wueform.
// b.363 — CODICI VERI: 'en-US' e 'pt-BR' non esistono in LANGS (sono codici
// di VOCE). Con quelli, inglese e portoghese — le due lingue piu usate —
// sparivano dalle bandiere rapide e finivano in fondo, in ordine alfabetico.
const RAPIDE = ['it', 'en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ar', 'ru', 'en-GB', 'hi'];

function CarouselLingue({ selezionata, onScegli, onLinguaMenu, C, L }) {
  const lingue = useMemo(() => {
    const rapide = RAPIDE.map((c) => LANGS.find((l) => l.code === c)).filter(Boolean);
    const resto = LANGS.filter((l) => !RAPIDE.includes(l.code))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    return [...rapide, ...resto];
  }, []);
  const totale = lingue.length;

  const [centro, setCentro] = useState(() => {
    const i = lingue.findIndex((l) => l.code === selezionata);
    return i >= 0 ? i : 0;
  });
  const [verso, setVerso] = useState(0);        // -1 sinistra · 1 destra (per l'animazione)
  const [salto, setSalto] = useState(0);        // chiave che riavvia l'animazione
  const [aperto, setAperto] = useState(false);  // l'elenco completo con la ricerca
  const [cerca, setCerca] = useState('');
  const toccoX = useRef(null);

  // il centro segue la selezione esterna (senza animare al primo giro)
  useEffect(() => {
    const i = lingue.findIndex((l) => l.code === selezionata);
    if (i >= 0) setCentro(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selezionata]);

  // b.363 — SCORRERE NON E SCEGLIERE. Prima la bandiera che si fermava al
  // centro diventava la lingua da sola dopo un attimo di quiete: cercando
  // un paese e passandone cinque, la lingua cambiava CINQUE VOLTE, e ogni
  // volta si ricaricava mezza interfaccia sotto le dita. Ora scorrere
  // sposta soltanto lo sguardo; la lingua cambia quando si conferma.
  // Dall'elenco completo, invece, resta immediata: li si sceglie davvero.

  const scorri = useCallback((dir) => {
    setVerso(dir);
    setSalto((s) => s + 1);
    setCentro((c) => (c + dir + totale) % totale);
  }, [totale]);

  // b.356 — "lo scroll e troppo veloce, una bandiera alla volta" (Luca):
  // la rotella e il trascinamento sparano decine di eventi per un solo
  // gesto. Questo cancello lascia passare UN passo ogni 450 ms; le
  // frecce restano libere, un tocco = un passo per natura.
  const ultimoPasso = useRef(0);
  const scorriConCalma = useCallback((dir) => {
    const ora = Date.now();
    if (ora - ultimoPasso.current < 450) return;
    ultimoPasso.current = ora;
    scorri(dir);
  }, [scorri]);

  const scegli = useCallback((l) => { vibrate(6); onScegli(l); }, [onScegli]);

  // le CINQUE in vista: come nel Wueform, il colore racconta la distanza
  const visibili = [-2, -1, 0, 1, 2].map((sp) => {
    const idx = (centro + sp + totale) % totale;
    return { ...lingue[idx], sp };
  });
  const alCentro = lingue[centro];

  const filtrate = cerca
    ? lingue.filter((l) => `${l.name} ${l.code}`.toLowerCase().includes(cerca.toLowerCase()))
    : lingue;

  const freccia = (dir, segno) => (
    <button onClick={() => scorri(dir)} aria-label={dir < 0 ? 'precedente' : 'successiva'}
      style={{ width: 34, height: 34, borderRadius: 17, border: 'none', background: 'transparent',
        color: C.textMuted, cursor: 'pointer', fontSize: 18, flexShrink: 0, fontFamily: FONT,
        transition: 'transform .25s, color .25s' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = C.textPrimary; e.currentTarget.style.transform = 'scale(1.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.transform = 'scale(1)'; }}>
      {segno}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {/* il bottone a righine che apre l'elenco completo (dal Wueform) */}
      <button onClick={() => { vibrate(6); setAperto((v) => !v); setCerca(''); }}
        aria-label={L('yourLang')} aria-expanded={aperto}
        style={{ width: 34, height: 34, borderRadius: 17, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', color: C.textMuted, marginBottom: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)', transition: 'transform .3s, background .3s' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}>
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.2}>
          <line x1="4" y1="8" x2="20" y2="8" style={{ animation: 'vtRiga 3s ease-in-out infinite' }} />
          <line x1="6" y1="12" x2="18" y2="12" style={{ animation: 'vtRiga 3s .4s ease-in-out infinite' }} />
          <line x1="8" y1="16" x2="16" y2="16" style={{ animation: 'vtRiga 3s .8s ease-in-out infinite' }} />
        </svg>
      </button>

      {/* l'elenco completo con la ricerca */}
      {aperto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setAperto(false)} />
          <div style={{ position: 'absolute', top: 52, zIndex: 100, width: 300,
            background: C.headerBg || 'rgba(10,15,31,0.97)', border: `1px solid ${C.cardBorder}`,
            borderRadius: 16, boxShadow: '0 16px 56px rgba(0,0,0,0.5)', overflow: 'hidden',
            backdropFilter: 'blur(24px)' }}>
            <input autoFocus value={cerca} onChange={(e) => setCerca(e.target.value)}
              placeholder={L('yourLang') + '…'}
              style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', border: 'none',
                borderBottom: `1px solid ${C.cardBorder}`, background: 'transparent',
                color: C.textPrimary, fontSize: 14, fontFamily: FONT, outline: 'none' }} />
            <div style={{ maxHeight: 250, overflowY: 'auto', padding: 6 }}>
              {filtrate.map((l) => {
                const on = l.code === selezionata;
                return (
                  <button key={l.code} onClick={() => { setAperto(false); scegli(l); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: on ? `${C.accent}22` : 'transparent',
                      color: on ? C.accent : C.textPrimary, fontSize: 13,
                      fontWeight: on ? 700 : 400, fontFamily: FONT, textAlign: 'left',
                      transition: 'background .2s' }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                    onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ width: 16, textAlign: 'center', opacity: on ? 1 : 0 }}>✓</span>
                    <span style={{ fontSize: 20 }}>{l.flag}</span>
                    <span style={{ flex: 1 }}>{l.name}</span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{l.code.toUpperCase()}</span>
                  </button>
                );
              })}
              <button onClick={() => { setAperto(false); onLinguaMenu?.(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginTop: 4,
                  padding: '10px 12px', borderRadius: 12, border: 'none',
                  borderTop: `1px solid ${C.cardBorder}`, background: 'transparent',
                  color: C.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}>
                {L('uiLanguage')} <span style={{ marginLeft: 'auto', opacity: 0.5 }}>›</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* il carosello: frecce + cinque bandiere, scivolata sul cambio */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 380, cursor: 'grab', touchAction: 'pan-y' }}
        onTouchStart={(e) => { toccoX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (toccoX.current == null) return;
          const d = toccoX.current - e.changedTouches[0].clientX;
          if (Math.abs(d) > 50) scorri(d > 0 ? 1 : -1);
          toccoX.current = null;
        }}
        // b.355 — "il carosello non scrolla lateralmente" (Luca): ora si
        // TRASCINA col mouse e risponde alla rotella/trackpad orizzontale.
        onMouseDown={(e) => { toccoX.current = e.clientX; }}
        onMouseUp={(e) => {
          if (toccoX.current == null) return;
          const d = toccoX.current - e.clientX;
          if (Math.abs(d) > 40) scorriConCalma(d > 0 ? 1 : -1);
          toccoX.current = null;
        }}
        onMouseLeave={() => { toccoX.current = null; }}
        onWheel={(e) => {
          const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          if (Math.abs(d) > 12) scorriConCalma(d > 0 ? 1 : -1);
        }}>
        {freccia(-1, '‹')}
        <div key={salto} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          minWidth: 230, height: 46, animation: `vtScivola${verso >= 0 ? 'D' : 'S'} .4s cubic-bezier(0.25,0.1,0.25,1)` }}>
          {visibili.map((l) => {
            const cent = l.sp === 0;
            const vicina = Math.abs(l.sp) === 1;
            return (
              <button key={`${l.code}-${l.sp}`}
                onClick={() => { if (cent) { scegli(l); } else { setVerso(l.sp > 0 ? 1 : -1); setSalto((s) => s + 1); setCentro((c) => (c + l.sp + totale) % totale); } }}
                title={l.name}
                style={{ width: 40, border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 2px',
                  fontFamily: FONT }}>
                {/* b.438 — le bandiere come nel template: piene, non
                    oscurate. Via il brightness<1 che le spegneva e il
                    grayscale sul centro; i vicini si smorzano con la sola
                    opacita, come nel template. E piu grandi. */}
                <span style={{ fontSize: cent ? 26 : 16, lineHeight: 1, transition: 'all .3s',
                  filter: cent ? 'none' : vicina ? 'grayscale(30%)' : 'grayscale(55%)',
                  opacity: cent ? 1 : vicina ? 0.6 : 0.35,
                  transform: cent ? 'scale(1.06)' : 'scale(1)' }}>
                  {l.flag}
                </span>
                <span style={{ fontSize: 8.5, letterSpacing: 1, fontWeight: 500, textTransform: 'uppercase',
                  color: cent ? C.textPrimary : C.textMuted, opacity: cent ? 1 : 0.5 }}>
                  {l.code.split('-')[0]}
                </span>
              </button>
            );
          })}
        </div>
        {freccia(1, '›')}
      </div>

      {/* b.356 — il bottone col nome del paese e stato tolto (collaudo di
          Luca: «il nome del paese non serve metterlo in un bottone»). Resta
          il nome nudo, piccolo, sotto le bandiere: informa e basta. La
          scelta la fa gia la rotazione (auto-selezione) o il tocco sulla
          bandiera centrale. */}
      {/* b.363 — UN SOLO POSTO, SEMPRE ALTO UGUALE. Il tasto di conferma non
          si AGGIUNGE sotto il nome: lo SOSTITUISCE. Aggiungendolo, tutto
          quello che sta sotto — microfono, QR, sezioni — scendeva di
          trenta pixel a ogni bandiera che passava, e chi stava guardando
          si ritrovava il contenuto che scappava sotto le dita.
          Regola generale di Luca: cio che apre una funzione non deve MAI
          spingere in basso il resto della pagina.
          L'altezza e fissata qui: che ci sia il nome o il tasto, il posto
          occupato e lo stesso. */}
      <div aria-live="polite" style={{
        marginTop: 6, height: 30, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {alCentro.code === selezionata ? (
          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.accent,
            display: 'flex', alignItems: 'center', gap: 6 }}>
            {alCentro.name}
            <span style={{ color: C.accent, fontSize: 12 }}>✓</span>
          </span>
        ) : (
          <button onClick={() => scegli(alCentro)}
            style={{ padding: '5px 16px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${C.accent}55`, background: 'transparent', color: C.accent,
              fontFamily: FONT, fontSize: 12.5, fontWeight: 600, lineHeight: 1.4,
              whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
              WebkitTapHighlightColor: 'transparent' }}>
            {L('useWord')} {alCentro.name}
          </button>
        )}
      </div>

      <style>{`
        @keyframes vtScivolaD { from { transform: translateX(52px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes vtScivolaS { from { transform: translateX(-52px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes vtRiga { 0% { opacity: 0; } 15% { opacity: 1; } 60% { opacity: 1; } 80% { opacity: 0; } 100% { opacity: 0; } }
      `}</style>
    </div>
  );
}

export default memo(CarouselLingue);
