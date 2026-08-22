// ═══════════════════════════════════════════════════════════════
// IL COMPAGNO DI SVENTURA — quello che sta li mentre fai un'altra cosa.
//
// b.384, ordine di Luca: «compagni che insieme fanno le cose ma ti
// intrattengono. Questa figura puo anche essere associata al compagno di
// vita, tutor, coach che abbiamo negli obiettivi».
//
// COS'E' E COSA NON E'. Non e un assistente a cui chiedi qualcosa: e uno
// che c'e. Non ha una schermata sua — il suo posto e accanto a te
// mentre studi, mentre insegui un obiettivo, mentre fai una cosa lunga.
// Se gli dessimo una schermata diventerebbe una cosa che si apre e si
// chiude, cioe il contrario di quello che e.
//
// QUANDO PARLA. Poco, e mai in mezzo. Alla fine di un pezzo, quando la
// voce del Maestro tace: una riga, non un commento a tutto. Un compagno
// che parla sopra quello che stai facendo non e compagnia, e disturbo.
//
// E' LO STESSO PERSONAGGIO DEGLI ALTRI POSTI. Non c'e un elenco separato
// di "compagni di sventura": si sceglie uno dei propri Compagni, e da
// quel momento quel personaggio ti accompagna anche qui. Chi lo vuole
// anche come coach degli obiettivi lo mette li e basta: e sempre lui.
// ═══════════════════════════════════════════════════════════════

/** Ogni quanti pezzi si fa vivo: uno su tre. Uno che commenta tutto stanca. */
const OGNI = 3;

/** Quanto sta zitto come minimo, in millisecondi. */
const RESPIRO_MIN = 45 * 1000;

/**
 * Deve dire qualcosa adesso? Si guarda dove siamo arrivati e quando ha
 * parlato l'ultima volta. Puro: nessuno stato, nessuna rete.
 */
export function tocca(indicePezzo, ultimoIntervento, adesso = Date.now()) {
  if (!Number.isFinite(indicePezzo) || indicePezzo < 0) return false;
  // mai sul primo: si comincia lasciando lavorare.
  if (indicePezzo === 0) return false;
  if (indicePezzo % OGNI !== 0) return false;
  if (ultimoIntervento && adesso - ultimoIntervento < RESPIRO_MIN) return false;
  return true;
}

/**
 * Cosa gli si chiede. Non "commenta la lezione" — quello produce un
 * riassunto, che e la cosa piu noiosa che possa dire uno che ti sta
 * accanto. Gli si chiede di REAGIRE, da persona.
 */
export function cosaDirgli({ argomento = '', pezzo = '', lingua = 'it' } = {}) {
  return [
    `Stai facendo compagnia a una persona mentre studia "${argomento}". Non sei il suo insegnante: sei uno che sta li con lei.`,
    `Ha appena finito questo pezzo:\n"${String(pezzo).slice(0, 700)}"`,
    `Di' UNA riga sola, nella lingua ${lingua}, come la direbbe una persona vera: una battuta, una cosa che ti ha colpito, un ricordo, una domanda vera. Massimo venti parole.`,
    `VIETATO: riassumere quello che ha appena letto (lo ha appena letto), farle i complimenti, chiederle se ha capito, o dire "interessante". Se non hai niente da dire, rispondi con una riga vuota: stare zitti e permesso.`,
  ].join('\n\n');
}
