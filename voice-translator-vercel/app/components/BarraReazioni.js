'use client';
import { memo, useCallback } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// BARRA REAZIONI — sotto ogni messaggio, sempre visibile.
//
// Tre gesti e una risposta. Niente menu a comparsa da scoprire: se un
// gesto e nascosto dietro una pressione lunga, il novanta per cento
// delle persone non sa che esiste.
//
// I numeri compaiono solo quando c'e qualcosa da contare: uno zero
// accanto a ogni messaggio e rumore.
//
// Funziona anche nelle chat cifrate: si conta un identificativo, non si
// legge un testo.
// ═══════════════════════════════════════════════════════════════

// b.138 — le etichette dei tre gesti erano in italiano fisso e finivano
// nel lettore di schermo: chi ascoltava l'app in inglese sentiva
// "D'accordo" al posto di "Agree".
const GESTI = [
  { tipo: 'su', segno: '\u{1F44D}', chiave: 'reactAgree' },
  { tipo: 'giu', segno: '\u{1F44E}', chiave: 'reactDisagree' },
  { tipo: 'cuore', segno: '❤️', chiave: 'reactLike' },
];

function BarraReazioni({ msgId, conte, mie, onReagisci, onRispondi, C, compatta }) {
  const { L } = useApp();
  const tocca = useCallback((tipo) => {
    vibrate(10);
    onReagisci?.(msgId, tipo);
  }, [msgId, onReagisci]);

  const bottone = (attivo) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: compatta ? '2px 7px' : '3px 9px',
    borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
    fontSize: compatta ? 11 : 12, lineHeight: 1.6,
    background: attivo ? `${C.accent1}1F` : 'transparent',
    border: `1px solid ${attivo ? `${C.accent1}55` : C.dividerColor || 'rgba(255,255,255,0.08)'}`,
    color: attivo ? C.accent1 : C.textMuted,
    fontWeight: attivo ? 600 : 600,
  });

  return (
    <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {GESTI.map(g => {
        const n = conte?.[g.tipo] || 0;
        const attivo = !!mie?.[g.tipo];
        return (
          <button key={g.tipo} onClick={() => tocca(g.tipo)}
            aria-label={L(g.chiave)} aria-pressed={attivo}
            title={L(g.chiave)}
            style={bottone(attivo)}>
            <span style={{ fontSize: compatta ? 12 : 13 }}>{g.segno}</span>
            {n > 0 && <span>{n}</span>}
          </button>
        );
      })}

      {onRispondi && (
        <button onClick={() => { vibrate(10); onRispondi(msgId); }}
          aria-label={L('replyToMessage')}
          style={{ ...bottone(false), fontWeight: 600 }}>
          Rispondi
          {conte?.risposte > 0 && <span style={{ fontWeight: 600 }}>{conte.risposte}</span>}
        </button>
      )}
    </div>
  );
}

export default memo(BarraReazioni);
