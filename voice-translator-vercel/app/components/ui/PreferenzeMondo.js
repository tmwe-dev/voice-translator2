'use client';
import { FONT, vibrate } from '../../lib/constants.js';
import { useApp } from '../../contexts/AppContext.js';
import Icon from '../Icon.js';

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
// ragione). Via tutte le spiegazioni. Restano: un'icona GRANDE, il nome
// della cosa, e il comando. Chi non capisce una scelta la tocca e vede
// cosa fa: sono tutte reversibili in un tocco.
//
// I DUE COLORI. Il titolo dice DI COSA si tratta, il valore dice COM'E'
// adesso: sono due informazioni diverse e vanno distinte a colpo
// d'occhio — coi COLORI, non col peso del testo (vedi b.508 sotto).
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// b.508 — SECONDO GIRO CON LUCA, guardando il pannello vero:
//
//  1. «perché vedo ancora i grassetti? non dovrebbero esserci» — vero:
//     il commento di b.482 diceva già «a dire qual è quella accesa
//     bastano il colore e il bordo», ma il codice era rimasto a
//     fontWeight 600 dappertutto. Adesso è 400 su tutto il pannello:
//     lo stato si legge dal colore e dall'icona, non dal grassetto.
//
//  2. «da dove parto, il drop down enorme, non serve tutta quella
//     roba» — la preferenza mondoPaese (con la tendina di quaranta
//     paesi) è tolta di netto da qui. Il pianeta apre di default sul
//     paese dedotto dalla LINGUA del telefono («il mio paese, cioè la
//     mia lingua», parole di Luca) — lo fa MondoView da solo
//     all'ingresso, senza bisogno di una preferenza esplicita.
//     SCOSTAMENTO dichiarato da b.397 (che partiva sempre dal mondo
//     intero): ora si parte già sul proprio paese, e si torna al mondo
//     intero toccando un paese acceso o dall'elenco stanze.
//
//  3. «titoli, come cerco, ogni quanto cerca, quando aggiorno — tre
//     selezioni in mezza sidebar» — le quattro preferenze rimaste
//     (titoli, modo, ritmo, aggiorna) stanno ORA IN UNA RIGA SOLA
//     ciascuna: icona + nome a sinistra, UN comando compatto a destra.
//     Via le file di due-tre tasti sotto ogni titolo.
//       - titoli/modo/aggiorna → un'icona sola che cicla tra le due
//         scelte a un tocco (IconeCiclo).
//       - ritmo (mai/2/5/10)   → una rotellina verticale con freccia
//         su e freccia giù (PassoVerticale), come chiesto da Luca:
//         «un carosello verticale con più/meno che occupa niente».
// ───────────────────────────────────────────────────────────────

// Il colore del titolo, scelto per essere leggibile sul fondo scuro
// dell'app (#05070f). Niente grigi cupi: quelli spariscono.
const COLORE_TITOLO = 'rgba(186,203,230,0.92)';
const COLORE_VALORE = 'rgba(236,243,255,0.96)';

const PREFERENZE = [
  {
    chiave: 'mondoTitoli',
    predefinito: 'originali',
    tipo: 'ciclo',
    icona: 'swap',
    titoloKey: 'prefTitlesTitle',
    scelte: [
      { valore: 'tradotti', etichettaKey: 'prefTitlesTranslated', icona: 'globe' },
      { valore: 'originali', etichettaKey: 'prefTitlesOriginal', icona: 'doc' },
    ],
  },
  // b.363 — "pulsanti per automatizzare i processi desiderati per
  // default" (Luca): il modo di ricerca era una scelta che si rifaceva a
  // ogni apertura. Ora si decide una volta e resta.
  {
    chiave: 'mondoModo',
    predefinito: 'veloce',
    tipo: 'ciclo',
    icona: 'zap',
    titoloKey: 'prefModeTitle',
    scelte: [
      { valore: 'veloce', etichettaKey: 'newsModeFast', icona: 'zap' },
      { valore: 'approfondita', etichettaKey: 'newsModeDeep', icona: 'graduation' },
    ],
  },
  // b.506 — IL RITMO DELLA FINESTRA SUL MONDO (tavola E, deciso con
  // Luca): ogni quanto il pianeta cerca le ultime notizie da solo.
  // «Mai» e il predefinito: niente ricerche non chieste.
  {
    chiave: 'mondoRitmo',
    predefinito: 'mai',
    tipo: 'passo',
    icona: 'history',
    titoloKey: 'prefRhythmTitle',
    scelte: [
      { valore: 'mai', etichettaKey: 'rhythmNever' },
      { valore: '2', numero: 2 },
      { valore: '5', numero: 5 },
      { valore: '10', numero: 10 },
    ],
  },
  {
    chiave: 'mondoAggiorna',
    predefinito: 'richiesta',
    tipo: 'ciclo',
    icona: 'refresh',
    titoloKey: 'prefRefreshTitle',
    scelte: [
      { valore: 'apertura', etichettaKey: 'prefRefreshOnOpen', icona: 'refresh' },
      { valore: 'richiesta', etichettaKey: 'prefRefreshOnDemand', icona: 'eye' },
    ],
  },
];

// b.508 — UN'ICONA SOLA CHE CICLA. Al posto di due tasti affiancati
// (uno per scelta), un solo bersaglio da 44: mostra l'icona della
// scelta ATTIVA, e un tocco passa all'altra. Per due scelte è lo stesso
// numero di tocchi di prima (uno), ma metà dello spazio.
// b.516 — Luca dal vivo, sulle tre preferenze che usano questo comando
// (titoli, come cerco, quando aggiorno): «deve evidenziare il modo in
// cui lo fa in quel momento». Prima si vedeva SOLO l'icona della scelta
// attiva: chi non conosce a memoria cosa vuol dire ogni icona non sa
// leggere lo stato, e non sa nemmeno che quell'icona STA MOSTRANDO lo
// stato invece di essere un comando generico. Ora sotto l'icona c'e la
// parola vera — lo stesso trucco gia in uso nella rotellina del ritmo
// (PassoVerticale, qui sotto), solo applicato anche al ciclo.
// ═══════════════════════════════════════════════════════════════
// b.522 — LA COLONNA DEI COMANDI HA UNA LARGHEZZA FISSA.
//
// Ordine di Luca, guardando il pannello: «la disposizione delle icone
// non deve essere influenzata dal testo mai. guarda ad esempio
// approfondita».
//
// Aveva ragione e si vedeva: ogni comando era largo `minWidth: 52`,
// cioe AL MINIMO 52 ma piu largo se la sua parola lo era. «Tradotti»
// sta in 45 punti e lasciava il comando a 52; «Approfondita» ne
// occupa 68 e allargava il comando a 68. Il comando sta a destra
// della riga, quindi allargandosi si sposta a SINISTRA — e con lui la
// sua icona. Quattro righe, quattro icone su quattro colonne diverse,
// per il solo fatto che le parole hanno lunghezze diverse. Peggio
// ancora la rotellina del ritmo, che con «Solo quando tocco» (17
// lettere su una riga sola) sfondava di parecchio.
//
// La regola, da qui in avanti: un comando in colonna ha una larghezza
// FISSA (`width`, non `minWidth`), l'icona sta centrata dentro quella
// larghezza, e l'etichetta va a capo invece di allargare la scatola.
// Cosi le icone stanno incolonnate qualunque parola ci sia sotto, in
// qualunque delle trentotto lingue — che e il motivo vero per cui la
// larghezza non puo dipendere dal testo: quello che sta in una riga
// in italiano non ci sta in tedesco.
// ═══════════════════════════════════════════════════════════════
// b.523 — Luca: «metti la descrizione della icona a sinistra sotto il
// titolo in un badge brown». E la soluzione migliore del problema di
// sopra, non un ripiego: spostando la parola SOTTO IL TITOLO, a
// sinistra, la colonna di destra torna a contenere la sola icona —
// larghezza fissa per costruzione, non per accorgimento. Il testo puo
// essere lungo quanto vuole, in qualunque lingua: cresce a sinistra,
// dove c'e lo spazio elastico della riga, e non tocca piu niente.
// Il bruno e lo stesso vetro dei preferiti (PreferitiTemi.js): dice
// «questo e lo stato attuale», non «questo e un comando».
function BadgeStato({ testo }) {
  if (!testo) return null;
  return (
    <span style={{
      display: 'inline-block', maxWidth: '100%', padding: '3px 10px', borderRadius: 999,
      background: 'rgba(140,88,48,0.34)', border: '1px solid rgba(206,146,92,0.5)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
      color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: FONT,
      lineHeight: 1.35, overflowWrap: 'anywhere',
    }}>
      {testo}
    </span>
  );
}

const LARGHEZZA_COMANDO = 46;   // fissa: ci sta solo l'icona, nient'altro

function IconeCiclo({ scelte, valore, onCambia, C, etichettaAria }) {
  const accento = C.accent || '#26D9B0';
  const indice = Math.max(0, scelte.findIndex((s) => s.valore === valore));
  const attuale = scelte[indice] || scelte[0];
  return (
    <button
      onClick={() => { vibrate(6); onCambia(scelte[(indice + 1) % scelte.length].valore); }}
      aria-label={etichettaAria} title={etichettaAria}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: LARGHEZZA_COMANDO, flexShrink: 0, cursor: 'pointer', padding: 0,
        background: 'none', border: 'none', WebkitTapHighlightColor: 'transparent',
      }}>
      <span style={{
        width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${accento}14`, border: `1px solid ${accento}44`,
      }}>
        <Icon name={attuale.icona} size={17} color={accento} />
      </span>
    </button>
  );
}

// b.508 — LA ROTELLINA VERTICALE (ordine di Luca: «un carosello
// verticale con più/meno che occupa niente di spazio»): freccia su,
// valore, freccia giù, incolonnati. Sostituisce la fila di quattro
// tasti (mai/2/5/10) che da sola occupava una riga intera del pannello.
function PassoVerticale({ scelte, valore, onCambia, C }) {
  const accento = C.accent || '#26D9B0';
  const indice = Math.max(0, scelte.findIndex((s) => s.valore === valore));
  const vai = (dir) => {
    vibrate(6);
    const i2 = (indice + dir + scelte.length) % scelte.length;
    onCambia(scelte[i2].valore);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: LARGHEZZA_COMANDO }}>
      <button onClick={() => vai(1)} aria-label="+"
        style={{
          width: 36, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}>
        <Icon name="chevUp" size={14} color={accento} />
      </button>
      <button onClick={() => vai(-1)} aria-label="-"
        style={{
          width: 36, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}>
        <Icon name="chevDown" size={14} color={accento} />
      </button>
    </div>
  );
}

export default function PreferenzeMondo({ C }) {
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
          fontSize: 10.5, fontWeight: 400, letterSpacing: 1.2, color: accento,
          textTransform: 'uppercase', fontFamily: FONT,
        }}>
          {L('preferencesWord')}
        </span>
      </div>

      {PREFERENZE.map((p) => {
        const attuale = prefs?.[p.chiave] || p.predefinito;
        const sceltaAttiva = p.scelte.find((s) => s.valore === attuale) || p.scelte[0];
        return (
          // b.508 — UNA RIGA SOLA per preferenza: icona, nome, comando.
          // Prima erano due righe (titolo sopra, tasti sotto): qui il
          // comando sta sulla stessa riga del nome, a destra.
          // b.523 — il nome sopra, lo STATO ATTUALE sotto in un badge
          // bruno, tutti e due a sinistra nello spazio elastico della
          // riga; a destra solo il comando, largo sempre uguale.
          <div key={p.chiave} style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
            <Icon name={p.icona} size={20} color={accento} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 400, color: COLORE_TITOLO, fontFamily: FONT }}>
                {L(p.titoloKey)}
              </span>
              <BadgeStato testo={sceltaAttiva.numero != null
                ? `${sceltaAttiva.numero} ${L('minShort')}`
                : L(sceltaAttiva.etichettaKey)} />
            </span>
            {p.tipo === 'passo' ? (
              <PassoVerticale scelte={p.scelte} valore={attuale} onCambia={(v) => cambia(p.chiave, v)} C={C} />
            ) : (
              <IconeCiclo scelte={p.scelte} valore={attuale} onCambia={(v) => cambia(p.chiave, v)} C={C}
                etichettaAria={L(sceltaAttiva.etichettaKey)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
