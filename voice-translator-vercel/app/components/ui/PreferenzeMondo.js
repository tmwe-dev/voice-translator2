'use client';
import { FONT, vibrate } from '../../lib/constants.js';
import { useApp } from '../../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// LE PREFERENZE DI MONDO — le decisioni che si prendono una volta.
//
// b.363, ordine di Luca: «nella sidebar inserisci le preferenze
// dell'utente e le mantieni li come setting, cosi le puo modificare a
// piacere».
//
// Il criterio e questo: nel pannello ci sono due famiglie di comandi che
// non vanno confuse.
//   I FILTRI cambiano cosa vedi ADESSO, e domani ripartono da zero.
//   LE PREFERENZE cambiano come l'app si comporta SEMPRE, e restano.
// Mescolarle vuol dire che uno tocca una cosa credendo di guardare e
// invece decide, o il contrario. Qui stanno insieme ma separate, sotto
// il loro titolo, in fondo — dove si va quando si vuole sistemare una
// cosa, non quando si sta cercando.
//
// Ogni preferenza e una domanda vera con due risposte oneste, non un
// interruttore con un nome tecnico.
// ═══════════════════════════════════════════════════════════════

const PREFERENZE = [
  {
    chiave: 'mondoPosizione',
    predefinito: 'ingresso',
    titoloKey: 'prefPositionTitle',
    descKey: 'prefPositionDesc',
    scelte: [
      { valore: 'ingresso', etichettaKey: 'prefPositionOnEnter' },
      { valore: 'mai', etichettaKey: 'prefPositionNever' },
    ],
  },
  {
    chiave: 'mondoTitoli',
    predefinito: 'originali',
    titoloKey: 'prefTitlesTitle',
    descKey: 'prefTitlesDesc',
    scelte: [
      { valore: 'tradotti', etichettaKey: 'prefTitlesTranslated' },
      { valore: 'originali', etichettaKey: 'prefTitlesOriginal' },
    ],
  },
];

export default function PreferenzeMondo({ C }) {
  const { L, prefs, savePrefs } = useApp();
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.10)'}`;

  const cambia = (chiave, valore) => {
    vibrate(6);
    savePrefs({ ...prefs, [chiave]: valore });
  };

  return (
    <div style={{ borderTop: bordo, paddingTop: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: C.textMuted,
        textTransform: 'uppercase', marginBottom: 10, fontFamily: FONT,
      }}>
        {L('preferencesWord')}
      </div>

      {PREFERENZE.map((p) => {
        const attuale = prefs?.[p.chiave] || p.predefinito;
        return (
          <div key={p.chiave} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, fontFamily: FONT }}>
              {L(p.titoloKey)}
            </div>
            <div style={{ fontSize: 11.5, color: C.textMuted, fontFamily: FONT, lineHeight: 1.45, marginTop: 2, marginBottom: 8 }}>
              {L(p.descKey)}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {p.scelte.map((s) => {
                const attiva = attuale === s.valore;
                return (
                  <button key={s.valore} onClick={() => cambia(p.chiave, s.valore)}
                    aria-pressed={attiva}
                    style={{
                      padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                      fontSize: 12, fontWeight: attiva ? 800 : 600,
                      background: attiva ? `${C.accent}18` : C.card,
                      border: attiva ? `1px solid ${C.accent}40` : bordo,
                      color: attiva ? C.accent : C.textSecondary,
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                    {L(s.etichettaKey)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
