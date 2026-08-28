'use client';
import { FONT, vibrate } from '../../lib/constants.js';
import { useApp } from '../../contexts/AppContext.js';
import Icon from '../Icon.js';

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
// b.482 — VIA I DODICI PITTOGRAMMI A COLORI. Erano emoji, e qui non c'e
// un'icona di casa che corrisponda a «cucina», «salute» o «trasporti»:
// inventarne una a caso sarebbe stato peggio. La parola dice gia tutto,
// ed e tradotta in trentotto lingue — il disegnino no. Nessun argomento
// e stato tolto: sono ancora dodici, si legge solo il nome.
const ARGOMENTI = [
  { id: 'economia' }, { id: 'tecnologia' }, { id: 'trasporti' },
  { id: 'ambiente' }, { id: 'lavoro' }, { id: 'formazione' },
  { id: 'citta' }, { id: 'viaggi' }, { id: 'cultura' },
  { id: 'sport' }, { id: 'salute' }, { id: 'cucina' },
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
                fontSize: 12.5, fontWeight: 500, minHeight: 44,
                background: on ? `${accento}1E` : 'rgba(255,255,255,0.045)',
                border: `1px solid ${on ? `${accento}55` : 'rgba(255,255,255,0.09)'}`,
                color: on ? accento : 'rgba(214,226,245,0.85)',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <span>{L(`topic_${a.id}`)}</span>
              {/* b.482 — QUI SI LEGGEVA «\u2713» ALLA LETTERA. Dentro il testo
                  di un elemento JSX una sequenza di scappamento non e una
                  scappatoia: e testo. Chi sceglieva un argomento vedeva
                  comparire sei caratteri di codice accanto alla parola. */}
              {on && <span style={{ lineHeight: 0 }}><Icon name="check" size={12} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
