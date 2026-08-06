// ═══════════════════════════════════════════════════════════════
// IL NUMERO DI SICUREZZA — chi c'e davvero dall'altra parte (b.113)
//
// ── IL BUCO CHE CHIUDE ──
//
// Lo scambio delle chiavi era corretto: ECDH su P-256, chiavi
// effimere, chiave privata non esportabile, AES-GCM a 256 bit. Tutto
// giusto. Ma mancava la domanda piu semplice:
//
//   LA CHIAVE PUBBLICA CHE HO RICEVUTO E DAVVERO LA SUA?
//
// Le chiavi pubbliche passano dal canale dati, che nasce dal
// signaling. Chi controlla il signaling puo mettersi in mezzo: fa
// credere a me di parlare con lei e a lei di parlare con me, tenendo
// due conversazioni cifrate benissimo — con se stesso in mezzo. La
// cifratura funziona a meraviglia e non serve a niente.
//
// Non e un difetto del codice crittografico: e un pezzo che manca.
// Nessuna matematica puo dire se una chiave appartiene a una persona.
// Solo la persona puo dirlo, e deve farlo per una strada che l'attacco
// non controlla — la voce, di persona, una telefonata.
//
// ── COME FUNZIONA ──
//
// Dalle due chiavi pubbliche si ricava un numero. Le due parti lo
// vedono uguale se e solo se stanno parlando davvero l'una con
// l'altra. Se qualcuno si e messo in mezzo, i due numeri sono diversi:
// lui ha una chiave con me e un'altra con lei, e non puo far tornare
// entrambi i conti.
//
// Le due chiavi si ORDINANO prima di unirle. Senza, il mio telefono
// calcolerebbe impronta(mia, sua) e il suo impronta(sua, mia): due
// numeri diversi per la stessa coppia, e il controllo direbbe sempre
// "attenzione" anche quando e tutto a posto. Un allarme che suona
// sempre e un allarme che nessuno guarda piu.
//
// ── PERCHE CIFRE E NON PAROLE ──
//
// Le parole andrebbero tradotte, e questo e un programma in cui le due
// persone spesso non condividono una lingua. Le cifre si leggono in
// qualunque lingua e si confrontano guardando lo schermo dell'altro.
//
// Venti cifre sono circa 66 bit: chi volesse fabbricare una coppia di
// chiavi che dia lo stesso numero dovrebbe provarci per un tempo che
// non ha, e comunque la sessione dura pochi minuti.
// ═══════════════════════════════════════════════════════════════

const GRUPPI = 4;
const CIFRE_PER_GRUPPO = 5;
const CIFRE = GRUPPI * CIFRE_PER_GRUPPO;

/**
 * Il numero di sicurezza di una coppia di chiavi.
 *
 * @param {string} chiaveA  chiave pubblica esportata (JWK come stringa)
 * @param {string} chiaveB  l'altra
 * @param {string} [dominio] la stanza: due stanze diverse con le stesse
 *   chiavi devono dare numeri diversi, cosi un numero visto altrove non
 *   si puo riusare qui.
 * @returns {Promise<string>} venti cifre in quattro gruppi
 */
export async function numeroDiSicurezza(chiaveA, chiaveB, dominio = '') {
  if (!chiaveA || !chiaveB) return '';

  // L'ORDINAMENTO e il punto. I due telefoni hanno le stesse due
  // chiavi ma in ordine opposto: senza ordinarle, calcolerebbero due
  // numeri diversi e il controllo non servirebbe a niente.
  const [prima, seconda] = [String(chiaveA), String(chiaveB)].sort();
  const materiale = `bartalk-v1|${dominio}|${prima}|${seconda}`;

  const dati = new TextEncoder().encode(materiale);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', dati));

  // Ogni cifra prende un byte diverso: si consumano venti dei
  // trentadue byte del digest, senza riusarne nessuno.
  let cifre = '';
  for (let i = 0; i < CIFRE; i++) cifre += (digest[i] % 10).toString();

  return cifre.match(new RegExp(`.{1,${CIFRE_PER_GRUPPO}}`, 'g')).join(' ');
}

/**
 * I due numeri combaciano?
 * Confronto insensibile agli spazi: chi lo detta a voce non dice dove
 * cadono i gruppi.
 */
export function combaciano(uno, due) {
  const pulisci = (x) => String(x || '').replace(/\D/g, '');
  const a = pulisci(uno);
  const b = pulisci(due);
  return a.length === CIFRE && a === b;
}

/**
 * La forma compatta da mettere in un QR: nessuno spazio.
 * Il QR NON sostituisce il confronto — contiene lo stesso numero, letto
 * dalla fotocamera invece che a voce. Serve quando le due persone sono
 * vicine; a distanza resta la voce.
 */
export function perCodiceQR(numero) {
  return String(numero || '').replace(/\D/g, '');
}

export const COSTANTI_IMPRONTA = { GRUPPI, CIFRE_PER_GRUPPO, CIFRE };
