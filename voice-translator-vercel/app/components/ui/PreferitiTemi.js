'use client';
import { useMemo } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';

// ═══════════════════════════════════════════════════════════════
// I PREFERITI — i temi di cui si parla qui, tolti dalla pagina e
// messi in cima al pannello (b.517).
//
// Ordine di Luca: «trasporti 1 citta 1 ?? mostra dei bei badge con
// sfondo in vetro colore brown e blu in alternanza, numero bianco
// visibile e mettili dentro la sidebar in alto come preferiti,
// inserisci una x per eliminare la preferenza».
//
// Prima erano due pillole grigie in mezzo all'elenco delle stanze:
// non si capiva che fossero SUE, non si potevano togliere, e
// rubavano la prima riga a cio che si era venuti a vedere.
//
// La «x» non nasconde per finta: scrive in `temiTolti` dentro le
// preferenze, quindi quel tema resta fuori anche al prossimo giro,
// su qualunque dispositivo. Non c'e un tasto per «aggiungere»: i
// temi arrivano da soli da quello di cui si sta parlando davvero nel
// Paese che si guarda — l'utente decide solo cosa NON vuole vedere.
// ═══════════════════════════════════════════════════════════════

// vetro colorato: due tinte che si alternano, come chiesto. Il fondo
// e traslucido con la sfocatura dietro (il pannello e coprente, quindi
// il "vetro" e sul colore, non sul mondo); il numero sta su una sua
// pastiglia bianca traslucida, perche resti leggibile su ENTRAMBE le
// tinte senza doverlo ricolorare a mano ogni volta.
const TINTE = [
  { vetro: 'rgba(140,88,48,0.34)', bordo: 'rgba(206,146,92,0.5)' },  // brown
  { vetro: 'rgba(44,94,170,0.34)', bordo: 'rgba(112,162,236,0.5)' }, // blu
];

export default function PreferitiTemi({ temi = [], prefs, savePrefs, C, L, onScegli }) {
  const tolti = useMemo(() => new Set(prefs?.temiTolti || []), [prefs?.temiTolti]);
  const visibili = useMemo(
    () => (temi || []).filter((t) => t?.topic && !tolti.has(t.topic)),
    [temi, tolti],
  );

  if (!visibili.length) return null;

  const togli = (topic) => {
    vibrate(6);
    const nuovi = Array.from(new Set([...(prefs?.temiTolti || []), topic]));
    savePrefs?.({ ...prefs, temiTolti: nuovi });
  };

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, color: C.textMuted, margin: '0 0 8px' }}>
        {L('favouritesWord')}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {visibili.map((t, i) => {
          const tinta = TINTE[i % TINTE.length];
          return (
            <span key={t.topic} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 4px 4px 12px', borderRadius: 999,
              background: tinta.vetro, border: `1px solid ${tinta.bordo}`,
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
              fontFamily: FONT, maxWidth: '100%',
            }}>
              <button onClick={() => { vibrate(8); onScegli?.(t.topic); }}
                title={t.topic}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 36,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontFamily: FONT, color: '#fff', fontSize: 12.5, fontWeight: 600,
                  maxWidth: 200, WebkitTapHighlightColor: 'transparent',
                }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
                {/* il numero: bianco pieno su pastiglia chiara, cosi si
                    legge uguale sul bruno e sul blu. */}
                <span style={{
                  minWidth: 21, height: 21, padding: '0 6px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.24)', color: '#fff',
                  fontSize: 11.5, fontWeight: 700, lineHeight: '21px', textAlign: 'center',
                }}>
                  {t.discussioni}
                </span>
              </button>
              <button onClick={() => togli(t.topic)}
                aria-label={`${L('removeWord')} ${t.topic}`} title={L('removeWord')}
                style={{
                  width: 28, height: 28, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
                  background: 'rgba(0,0,0,0.22)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <Icon name="x" size={11} color="#fff" />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
