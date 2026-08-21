'use client';
import { FONT, vibrate } from '../../lib/constants.js';
import { useApp } from '../../contexts/AppContext.js';
import Scelta from './Scelta.js';

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
  // b.363 — "pulsanti per automatizzare i processi desiderati per
  // default" (Luca): il modo di ricerca era una scelta che si rifaceva a
  // ogni apertura. Ora si decide una volta e resta.
  {
    chiave: 'mondoModo',
    predefinito: 'veloce',
    titoloKey: 'prefModeTitle',
    descKey: 'prefModeDesc',
    scelte: [
      { valore: 'veloce', etichettaKey: 'newsModeFast' },
      { valore: 'approfondita', etichettaKey: 'newsModeDeep' },
    ],
  },
  {
    chiave: 'mondoAggiorna',
    predefinito: 'richiesta',
    titoloKey: 'prefRefreshTitle',
    descKey: 'prefRefreshDesc',
    scelte: [
      { valore: 'apertura', etichettaKey: 'prefRefreshOnOpen' },
      { valore: 'richiesta', etichettaKey: 'prefRefreshOnDemand' },
    ],
  },
];

export default function PreferenzeMondo({ C }) {
  const { L, prefs, savePrefs } = useApp();

  const cambia = (chiave, valore) => {
    vibrate(6);
    savePrefs({ ...prefs, [chiave]: valore });
  };

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: C.textMuted,
        textTransform: 'uppercase', marginBottom: 4, fontFamily: FONT,
      }}>
        {L('preferencesWord')}
      </div>
      <div style={{ fontSize: 11.5, color: C.textMuted, fontFamily: FONT, lineHeight: 1.45, marginBottom: 12 }}>
        {L('preferencesDesc')}
      </div>

      {PREFERENZE.map((p) => (
        <Scelta key={p.chiave} C={C}
          etichetta={L(p.titoloKey)}
          valore={prefs?.[p.chiave] || p.predefinito}
          opzioni={p.scelte.map((s) => ({ valore: s.valore, etichetta: L(s.etichettaKey) }))}
          onCambia={(v) => cambia(p.chiave, v)} />
      ))}
    </div>
  );
}
