'use client';
import { FONT, vibrate } from '../../lib/constants.js';
import { useApp } from '../../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// GLI INTERESSI, NEL PROFILO — si scelgono, non si indovinano.
//
// b.363, ordine di Luca: «nel profilo interessi e preferenze possono
// determinare meglio quello che possiamo fargli vedere».
//
// Il modo conta piu della funzione. Qui si CHIEDE, e chi risponde puo
// cambiare idea quando vuole: e l'opposto del dedurre chi sei da eta,
// sesso o mestiere, che e come gli altri social sbagliano — e sbagliano
// proprio con le persone a cui dare piu importanza.
//
// E si dice a chiare lettere cosa succede dopo: quello che scegli sale,
// il resto SCENDE ma resta. Nessuno si costruisce una bolla per errore.
// ═══════════════════════════════════════════════════════════════

// Gli argomenti che il Mondo usa davvero sulle discussioni. Non un
// catalogo di fantasia: questi sono quelli che esistono nei dati.
const ARGOMENTI = [
  { id: 'economia', emoji: '\u{1F4B6}' },
  { id: 'tecnologia', emoji: '\u{1F4A1}' },
  { id: 'trasporti', emoji: '\u{1F684}' },
  { id: 'ambiente', emoji: '\u{1F33F}' },
  { id: 'lavoro', emoji: '\u{1F4BC}' },
  { id: 'formazione', emoji: '\u{1F393}' },
  { id: 'citta', emoji: '\u{1F3D9}' },
  { id: 'viaggi', emoji: '\u2708' },
  { id: 'cultura', emoji: '\u{1F3AD}' },
  { id: 'sport', emoji: '\u26BD' },
  { id: 'salute', emoji: '\u{1FAC0}' },
  { id: 'cucina', emoji: '\u{1F373}' },
];

export default function InteressiProfilo({ C }) {
  const { L, prefs, savePrefs } = useApp();
  const scelti = prefs?.interessi || [];
  const accento = C.accent || '#26D9B0';

  const gira = (id) => {
    vibrate(6);
    const dopo = scelti.includes(id) ? scelti.filter((x) => x !== id) : [...scelti, id];
    savePrefs({ ...prefs, interessi: dopo });
  };

  return (
    <div style={{ padding: '12px 4px 16px' }}>
      <div style={{ fontSize: 12, color: 'rgba(150,168,196,0.85)', fontFamily: FONT, lineHeight: 1.5, marginBottom: 12 }}>
        {L('interestsDesc')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {ARGOMENTI.map((a) => {
          const on = scelti.includes(a.id);
          return (
            <button key={a.id} onClick={() => gira(a.id)} aria-pressed={on}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                fontSize: 12.5, fontWeight: on ? 800 : 600,
                background: on ? `${accento}1E` : 'rgba(255,255,255,0.045)',
                border: `1px solid ${on ? `${accento}55` : 'rgba(255,255,255,0.09)'}`,
                color: on ? accento : 'rgba(214,226,245,0.85)',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{a.emoji}</span>
              <span>{L(`topic_${a.id}`)}</span>
              {on && <span style={{ fontSize: 11 }}>\u2713</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
