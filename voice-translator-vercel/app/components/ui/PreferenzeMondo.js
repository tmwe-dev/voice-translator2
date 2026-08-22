'use client';
import { FONT, vibrate } from '../../lib/constants.js';
import { useApp } from '../../contexts/AppContext.js';
import Icon from '../Icon.js';
import Scelta from './Scelta.js';
import Interruttore from './Interruttore.js';
import { bandieraPaese } from '../../lib/schedaMondo.js';

// ═══════════════════════════════════════════════════════════════
// LE PREFERENZE DI MONDO — le decisioni che si prendono una volta.
//
// b.363, ordini di Luca in tre passaggi:
//   «nella sidebar inserisci le preferenze e le mantieni li come setting»
//   «in dropdown se la scelta e singola, usa bene gli spazi»
//   «inserisci icone e usa un mix tra flag, tasti e dropdown. rendi
//    leggibili i testi, usa due colori per titolo e valore. non usare
//    grigio scuro sul nero»
//
// b.367 — «LA SIDE BAR E' PER UN BAMBINO O UN ANZIANO?» (Luca, e aveva
// ragione). C'era un paragrafo di spiegazione sotto OGNI voce: quattro
// blocchi di prosa per quattro scelte che si capiscono guardandole. Un
// pannello che spiega e un pannello che non si fida di chi lo usa —
// e si legge come un foglietto illustrativo.
// Via tutte le spiegazioni. Restano: un'icona GRANDE, il nome della
// cosa, e il comando. Chi non capisce una scelta la tocca e vede cosa
// fa: sono tutte reversibili in un tocco.
//
// COSA DISTINGUE UN TASTO DA UNA TENDINA. Non e questione di gusto:
//   DUE o TRE risposte  -> TASTI affiancati. Si vedono TUTTE senza
//     aprire niente, e si cambia con un tocco solo. Nasconderle dentro
//     una tendina costa due tocchi per una cosa che stava in uno.
//   MOLTE risposte      -> TENDINA. Quaranta lingue affiancate sono una
//     parete di bottoni che va a capo dove capita.
// Qui dentro le scelte sono tutte a due risposte: quindi tasti.
//
// I DUE COLORI. Il titolo dice DI COSA si tratta, il valore dice COM'E'
// adesso: sono due informazioni diverse e vanno distinte a colpo
// d'occhio. Prima erano grigio scuro su nero — un colore che sul fondo
// di quest'app semplicemente non si legge.
// ═══════════════════════════════════════════════════════════════

// I due colori del testo, scelti per essere leggibili sul fondo scuro
// dell'app (#05070f). Niente grigi cupi: quelli spariscono.
const COLORE_TITOLO = 'rgba(186,203,230,0.92)';   // azzurro chiaro, calmo
const COLORE_SPIEGA = 'rgba(150,168,196,0.78)';   // un gradino sotto

const PREFERENZE = [
  // b.363 — "sul mio paese non va bene" (Luca). E vero: quel nome non
  // dice niente, e la scelta era finta — o il paese dedotto dalla lingua,
  // o nessuno. Ora e una scelta di PAESE vera, con le bandiere: "dove
  // sono" (dedotto), un paese qualunque scelto a mano, oppure nessuno e
  // il pianeta resta dove l'hai lasciato.
  {
    chiave: 'mondoPaese',
    // b.397 — IL MONDO GIRA, FINCHE NON DICI DOVE ANDARE (ordine di Luca:
    // «all'ingresso lascia girare il mondo, a meno che il default sia su
    // un paese o preferenze»). Prima il valore di partenza era «dove
    // sono»: si entrava in Mondo e il pianeta scattava subito sull'Italia,
    // cioe il globo faceva la sua unica mossa prima ancora che tu avessi
    // deciso qualcosa. Ora parte dal mondo intero e gira; ci si va solo se
    // lo chiedi tu, qui dentro o toccando il pianeta.
    // Chi aveva gia scelto «dove sono» a mano se lo tiene: cambia solo
    // cosa succede a chi non ha mai scelto niente.
    predefinito: 'nessuno',
    tipo: 'paesi',
    icona: 'target',
    titoloKey: 'prefPositionTitle',
  },
  {
    chiave: 'mondoTitoli',
    predefinito: 'originali',
    icona: 'swap',
    titoloKey: 'prefTitlesTitle',
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
    tipo: 'interruttore',
    icona: 'zap',
    titoloKey: 'prefModeTitle',
    scelte: [
      { valore: 'veloce', etichettaKey: 'newsModeFast', icona: 'zap' },
      { valore: 'approfondita', etichettaKey: 'newsModeDeep', icona: 'graduation' },
    ],
  },
  {
    chiave: 'mondoAggiorna',
    predefinito: 'richiesta',
    icona: 'refresh',
    titoloKey: 'prefRefreshTitle',
    scelte: [
      { valore: 'apertura', etichettaKey: 'prefRefreshOnOpen' },
      { valore: 'richiesta', etichettaKey: 'prefRefreshOnDemand' },
    ],
  },
];

// b.363 — I PAESI FRA CUI SCEGLIERE. I nomi non li scrivo io in trentotto
// lingue: li sa gia il telefono, e li dice nella lingua di chi guarda.
// Le bandiere si costruiscono dal codice, senza nessun elenco da tenere.
const PAESI = ['IT','US','GB','ES','FR','DE','BR','PT','RU','JP','CN','KR','AE','IN','TR','PL','NL','SE','VN','TH','ID','GR','IL','UA','CZ','RO','HU','DK','NO','FI','MX','AR','CA','AU','ZA','EG','NG','KE','PH','MY'];

function opzioniPaese(L, bandieraMia) {
  let nome = (c) => c;
  try {
    const dn = new Intl.DisplayNames(undefined, { type: 'region' });
    nome = (c) => dn.of(c) || c;
  } catch { /* il telefono non sa tradurre i paesi: restano i codici */ }
  return [
    { valore: 'auto', etichetta: L('prefPositionOnEnter'), bandiera: bandieraMia || '📍' },
    { valore: 'nessuno', etichetta: L('prefPositionNever') },
    ...PAESI.map((c) => ({ valore: c, etichetta: nome(c), bandiera: bandieraPaese(c) }))
      .sort((a, b) => a.etichetta.localeCompare(b.etichetta)),
  ];
}

export default function PreferenzeMondo({ C, bandieraMia }) {
  const { L, prefs, savePrefs } = useApp();
  const accento = C.accent || '#26D9B0';

  const cambia = (chiave, valore) => {
    vibrate(6);
    savePrefs({ ...prefs, [chiave]: valore });
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4,
      }}>
        <Icon name="settings" size={13} color={accento} />
        <span style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, color: accento,
          textTransform: 'uppercase', fontFamily: FONT,
        }}>
          {L('preferencesWord')}
        </span>
      </div>

      {PREFERENZE.map((p) => {
        const attuale = prefs?.[p.chiave] || p.predefinito;
        return (
          <div key={p.chiave} style={{ marginBottom: 22 }}>
            {/* b.367 — icona grande, nome, e basta. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 9 }}>
              <Icon name={p.icona} size={22} color={accento} />
              <span style={{ fontSize: 15, fontWeight: 700, color: COLORE_TITOLO, fontFamily: FONT }}>
                {L(p.titoloKey)}
              </span>
            </div>

            {/* b.363 — IL MISTO (ordine di Luca): non tutto e uguale, e non
                deve sembrarlo. Molte risposte -> tendina con le bandiere.
                Due risposte che sono un solo comando -> interruttore.
                Due risposte alla pari -> due tasti, tutti e due in vista. */}
            {p.tipo === 'paesi' ? (
              <Scelta C={C}
                valore={prefs?.[p.chiave] || p.predefinito}
                opzioni={opzioniPaese(L, bandieraMia)}
                onCambia={(v) => cambia(p.chiave, v)} />
            ) : p.tipo === 'interruttore' ? (
              <Interruttore C={C} coloreTitolo={COLORE_TITOLO}
                valore={attuale}
                sinistra={{ valore: p.scelte[0].valore, etichetta: L(p.scelte[0].etichettaKey) }}
                destra={{ valore: p.scelte[1].valore, etichetta: L(p.scelte[1].etichettaKey) }}
                onCambia={(v) => cambia(p.chiave, v)} />
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                {p.scelte.map((s) => {
                  const attiva = attuale === s.valore;
                  return (
                    <button key={s.valore} onClick={() => cambia(p.chiave, s.valore)}
                      aria-pressed={attiva}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '13px 12px', borderRadius: 13, cursor: 'pointer', fontFamily: FONT,
                        fontSize: 14, fontWeight: attiva ? 800 : 600,
                        background: attiva ? `${accento}1E` : 'rgba(255,255,255,0.045)',
                        border: `1px solid ${attiva ? `${accento}55` : 'rgba(255,255,255,0.09)'}`,
                        color: attiva ? accento : 'rgba(214,226,245,0.85)',
                        WebkitTapHighlightColor: 'transparent',
                      }}>
                      {s.icona && <Icon name={s.icona} size={13} color={attiva ? accento : 'rgba(214,226,245,0.75)'} />}
                      <span>{L(s.etichettaKey)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
