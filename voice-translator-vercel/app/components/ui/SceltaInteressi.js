'use client';
import { useState } from 'react';
import Icon from '../Icon.js';
import { FONT, vibrate } from '../../lib/constants.js';
import { INTERESSI, MINIMO } from '../../lib/accoglienza.js';
import { VETRO, VETRO_ACCESO } from '../../lib/vetro.js';

// ═══════════════════════════════════════════════════════════════
// LA PRIMA DOMANDA (b.562)
//
// Ordine di Luca: «quando entri la prima volta nella sezione Mondo crea
// una pagina di onboarding semplice con scelta di interessi come su
// Instagram, Facebook, LinkedIn, e su conferma imposta gia la
// piattaforma con contenuti per partire».
//
// TRE COSE, E BASTA. Una domanda, una griglia, un tasto. Nessun giro di
// schermate, nessuna spiegazione di cosa sia BarTalk: chi e' arrivato
// fin qui vuole vedere il mondo, non leggere un manuale.
//
// «NON ADESSO» C'E', ED E' IMPORTANTE. Un'accoglienza che non si puo
// saltare e' un pedaggio. Chi salta parte con le ricerche predefinite
// del suo Paese e non gli si chiede piu niente: la domanda si fa UNA
// volta nella vita (`interessiSaltati`).
//
// NIENTE GRASSETTO da nessuna parte, nemmeno qui — ordine permanente.
// ═══════════════════════════════════════════════════════════════
export default function SceltaInteressi({ C, L, onConferma, onSalta }) {
  const [scelti, setScelti] = useState([]);
  const abbastanza = scelti.length >= MINIMO;

  const gira = (id) => {
    vibrate(6);
    setScelti((prima) => (prima.includes(id) ? prima.filter((x) => x !== id) : [...prima, id]));
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 5, overflowY: 'auto',
      background: C?.bg || '#05070f', fontFamily: FONT,
      padding: '28px 20px calc(28px + env(safe-area-inset-bottom))',
    }}>
      <h2 style={{
        margin: '8px 0 6px', fontSize: 21, fontWeight: 500, lineHeight: 1.25,
        color: C?.textPrimary || '#fff',
      }}>{L('onbTitolo')}</h2>
      <p style={{
        margin: '0 0 20px', fontSize: 13.5, lineHeight: 1.45,
        color: C?.textSecondary || 'rgba(186,203,230,0.85)',
      }}>{L('onbSotto')}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
        {INTERESSI.map((voce) => {
          const acceso = scelti.includes(voce.id);
          return (
            <button key={voce.id} onClick={() => gira(voce.id)}
              aria-pressed={acceso}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                minHeight: 46, padding: '0 15px', borderRadius: 999, cursor: 'pointer',
                ...(acceso ? VETRO_ACCESO : VETRO),
                color: '#fff', fontFamily: FONT, fontSize: 13.5, fontWeight: 500,
                WebkitTapHighlightColor: 'transparent',
              }}>
              <Icon name={voce.icona} size={16} color={acceso ? '#dce6ff' : 'rgba(255,255,255,0.75)'} />
              {L(voce.chiave)}
            </button>
          );
        })}
      </div>

      {/* Il tasto resta spento finche' non ce ne sono tre: dirlo prima e'
          piu gentile che lasciar toccare e poi rifiutare. */}
      <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => { if (abbastanza) { vibrate(10); onConferma?.(scelti); } }}
          disabled={!abbastanza}
          style={{
            width: '100%', minHeight: 50, borderRadius: 14, border: 'none',
            cursor: abbastanza ? 'pointer' : 'default',
            background: `linear-gradient(135deg, ${C?.accent || '#5b8cff'}, ${C?.purple || '#8f6bff'})`,
            opacity: abbastanza ? 1 : 0.4,
            color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 500,
            WebkitTapHighlightColor: 'transparent',
          }}>
          {abbastanza ? L('onbAvanti') : `${scelti.length}/${MINIMO} ${L('onbScelti')}`}
        </button>
        <button onClick={() => { vibrate(6); onSalta?.(); }}
          style={{
            width: '100%', minHeight: 44, borderRadius: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            color: C?.textSecondary || 'rgba(186,203,230,0.8)',
            fontFamily: FONT, fontSize: 13, fontWeight: 500,
            WebkitTapHighlightColor: 'transparent',
          }}>{L('onbSalta')}</button>
      </div>
    </div>
  );
}
