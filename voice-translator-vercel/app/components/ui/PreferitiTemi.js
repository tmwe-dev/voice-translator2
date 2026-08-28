'use client';
import { useMemo, useState } from 'react';
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

// b.535 — DUE NOVITA'. (1) `nudo`: dentro la card di vetro della sidebar
// (CardSezione) il titolo lo mette la card, quindi qui niente header e
// badge sempre aperti. (2) `aggiunte`: le ricerche che l'utente ha
// salvato con la stella («quando scelgo il milan ac aggiungi un
// selettore aggiungi alle notizie preferite e aggiungi il badge») —
// badge blu con logo, un tocco RIFA la ricerca, la x la toglie.
export default function PreferitiTemi({ temi = [], prefs, savePrefs, C, L, onScegli, nudo = false, aggiunte = [], onScegliAggiunta, onTogliAggiunta }) {
  const tolti = useMemo(() => new Set(prefs?.temiTolti || []), [prefs?.temiTolti]);
  // b.529 — Luca: «devono essere in ordine alfabetico, meglio dentro
  // una dropdown». Alfabetici nella lingua di chi guarda, e richiusi
  // dietro una riga col conteggio: si aprono quando servono.
  const visibili = useMemo(
    () => (temi || []).filter((t) => t?.topic && !tolti.has(t.topic))
      .sort((a, b) => String(a.topic).localeCompare(String(b.topic))),
    [temi, tolti],
  );
  const [aperti, setAperti] = useState(false);

  // b.535 — in modo nudo (dentro la card) si mostra comunque: se non
  // c'e' niente, una riga spiega COME si riempie (chiarezza chiesta da
  // Luca: «non e' chiaro cosa puoi fare»).
  if (!nudo && !visibili.length && !aggiunte.length) return null;

  const togli = (topic) => {
    vibrate(6);
    const nuovi = Array.from(new Set([...(prefs?.temiTolti || []), topic]));
    savePrefs?.({ ...prefs, temiTolti: nuovi });
  };

  return (
    <div style={{ marginBottom: 4 }}>
      {!nudo && (
      <button onClick={() => setAperti((v) => !v)} aria-expanded={aperti}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44,
          padding: '0 2px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT,
        }}>
        {/* b.535 — contrasto: era C.textMuted 10.5, il grigio smorto che
            Luca ha bocciato («non puoi usare il grigio scuro su sfondo
            scuro»). Bianco al 78%, corpo 11.5. */}
        <span style={{ flex: 1, textAlign: 'left', fontSize: 11.5, fontWeight: 500, letterSpacing: 1, color: 'rgba(255,255,255,0.78)' }}>
          {L('favouritesWord')} ({visibili.length + (aggiunte?.length || 0)})
        </span>
        <span style={{ transform: aperti ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'flex' }}>
          <Icon name="chevDown" size={13} color={'rgba(255,255,255,0.78)'} />
        </span>
      </button>
      )}
      {(nudo || aperti) && (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: nudo ? 0 : 6 }}>
        {/* b.535 — le ricerche SALVATE CON LA STELLA: badge blu col logo,
            un tocco rifa la ricerca, la x la toglie. */}
        {(aggiunte || []).map((r) => (
          <span key={`agg-${r.q}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 2px 2px 6px', borderRadius: 7,
            background: 'rgba(44,94,170,0.34)', border: '1px solid rgba(112,162,236,0.5)',
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
            fontFamily: FONT, maxWidth: '100%',
          }}>
            <button onClick={() => { vibrate(8); onScegliAggiunta?.(r.q); }}
              title={r.q}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 26,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: FONT, color: '#fff', fontSize: 11.5, fontWeight: 500,
                maxWidth: 200, WebkitTapHighlightColor: 'transparent',
              }}>
              <span aria-hidden="true" style={{ fontSize: 11, lineHeight: 1 }}>{'\u2605'}</span>
              {r.img
                // eslint-disable-next-line @next/next/no-img-element -- miniatura esterna della ricerca salvata
                ? <img src={r.img} alt="" width={18} height={18} style={{ borderRadius: 5, objectFit: 'cover', display: 'block' }} />
                : null}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.etichetta || r.q}</span>
            </button>
            <button onClick={() => { vibrate(6); onTogliAggiunta?.(r.q); }}
              aria-label={`${L('removeWord')} ${r.etichetta || r.q}`} title={L('removeWord')}
              style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                background: 'rgba(0,0,0,0.22)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <Icon name="x" size={11} color="#fff" />
            </button>
          </span>
        ))}
        {nudo && !visibili.length && !(aggiunte || []).length && (
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.62)', fontFamily: FONT, lineHeight: 1.5 }}>
            {L('favEmptyHint')}
          </span>
        )}
        {visibili.map((t, i) => {
          const tinta = TINTE[i % TINTE.length];
          return (
            <span key={t.topic} style={{
              // b.529 — rettangolari e piu bassi: occupano meno spazio.
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 2px 2px 9px', borderRadius: 7,
              background: tinta.vetro, border: `1px solid ${tinta.bordo}`,
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
              fontFamily: FONT, maxWidth: '100%',
            }}>
              <button onClick={() => { vibrate(8); onScegli?.(t.topic); }}
                title={t.topic}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 26,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontFamily: FONT, color: '#fff', fontSize: 11.5, fontWeight: 500,
                  maxWidth: 200, WebkitTapHighlightColor: 'transparent',
                }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
                {/* il numero: bianco pieno su pastiglia chiara, cosi si
                    legge uguale sul bruno e sul blu. */}
                <span style={{
                  minWidth: 18, height: 18, padding: '0 5px', borderRadius: 5,
                  background: 'rgba(255,255,255,0.24)', color: '#fff',
                  fontSize: 10.5, fontWeight: 500, lineHeight: '18px', textAlign: 'center',
                }}>
                  {t.discussioni}
                </span>
              </button>
              <button onClick={() => togli(t.topic)}
                aria-label={`${L('removeWord')} ${t.topic}`} title={L('removeWord')}
                style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
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
      )}
    </div>
  );
}
