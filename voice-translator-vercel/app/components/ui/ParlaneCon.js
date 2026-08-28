'use client';
// ═══════════════════════════════════════════════════════════════
// PARLANE CON CHI? — il ponte fra una notizia e Vita.
//
// b.551, idea di Luca: «se creo una chat come sai devo poter invitare uno
// degli agenti ai o piu di uno in una stanza, o meglio poter creare un
// podcast, magari con approfondimento e possibilita di partecipare (un
// tavolo) e confrontarsi per arrivare a una conclusione o un semplice
// approfondimento. cosi leghiamo life a una informazione».
//
// Fino a ieri «Parlane» faceva una cosa sola: apriva una stanza fra
// persone. E una stanza appena aperta e' vuota — il difetto che avevamo
// gia riconosciuto. Adesso «Parlane» pone la domanda giusta, CON CHI:
//   · con le persone      → la stanza di sempre
//   · con un Compagno     → entri e lui ha gia letto la notizia
//   · al Tavolo           → due o piu Compagni ne discutono per arrivare
//                           a una conclusione, e tu intervieni quando vuoi
//   · al Podcast          → non partecipi, ascolti (per le persone pigre)
// ═══════════════════════════════════════════════════════════════
import { createPortal } from 'react-dom';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';

export const MODI = [
  { id: 'persone', icona: 'users', titolo: 'parlaneConPersone', sotto: 'parlaneConPersoneDesc' },
  { id: 'compagno', icona: 'chat', titolo: 'parlaneConCompagno', sotto: 'parlaneConCompagnoDesc' },
  { id: 'tavolo', icona: 'target', titolo: 'parlaneConTavolo', sotto: 'parlaneConTavoloDesc' },
  { id: 'podcast', icona: 'mic', titolo: 'parlaneConPodcast', sotto: 'parlaneConPodcastDesc' },
];

export default function ParlaneCon({ aperto, contenuto, onScegli, onChiudi, C, L }) {
  if (!aperto || typeof document === 'undefined') return null;
  const bordo = `1px solid ${C?.cardBorder || 'rgba(255,255,255,0.12)'}`;
  const accent = C?.accent || C?.accent1 || '#5b8cff';

  return createPortal(
    <>
      <div onClick={onChiudi} style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.55)' }} />
      <div role="dialog" aria-label={L('parlaneConTitolo')} style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 151,
        maxHeight: '80dvh', overflowY: 'auto',
        background: 'rgba(10,14,26,0.97)', backdropFilter: 'blur(20px)',
        borderTop: bordo, borderRadius: '20px 20px 0 0',
        padding: '16px 16px calc(20px + env(safe-area-inset-bottom))', fontFamily: FONT,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>{L('parlaneConTitolo')}</div>
            {contenuto?.titolo && (
              <div style={{
                fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{contenuto.titolo}</div>
            )}
          </div>
          <button onClick={onChiudi} aria-label={L('closeWord')}
            style={{ width: 38, height: 38, borderRadius: 10, cursor: 'pointer', border: bordo,
              background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="x" size={14} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MODI.map((m) => (
            <button key={m.id} onClick={() => { vibrate(10); onScegli?.(m.id, contenuto); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                minHeight: 62, padding: '10px 12px', borderRadius: 14, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: bordo, textAlign: 'left',
                fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: `${accent}16`, border: `1px solid ${accent}3a`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={m.icona} size={17} color={accent} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#fff' }}>{L(m.titolo)}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255,255,255,0.62)', marginTop: 2 }}>{L(m.sotto)}</span>
              </span>
              <Icon name="chevRight" size={14} color="rgba(255,255,255,0.4)" />
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
