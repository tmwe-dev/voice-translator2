// ═══════════════════════════════════════════════════════════════
// b.353 — LO SCUDO DELLE EMOTICON (collaudo di Luca: «le emoticon non
// vanno MAI tradotte, adesso lo stai facendo»).
//
// Il modello di traduzione, vedendo un'emoticon nel testo, a volte la
// "traduce": la descrive a parole, la cambia, la perde. Qui le emoticon
// si mettono al riparo PRIMA della traduzione (ogni gruppo diventa un
// segnaposto neutro che il modello lascia stare) e si RIMETTONO al loro
// posto dopo. Cosi arrivano dall'altra parte identiche, sempre.
//
// Funzioni pure, nessuna dipendenza: usabili da qualunque rotta.
// ═══════════════════════════════════════════════════════════════

// Un "gruppo emoticon": pittogrammi Unicode con eventuali variazioni,
// toni della pelle e congiunzioni (famiglie, bandiere, professioni).
const GRUPPO_EMOJI = /(?:\p{Extended_Pictographic}(?:️|︎)?(?:\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF})?(?:‍\p{Extended_Pictographic}(?:️|︎)?(?:\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF})?)*|[\u{1F1E6}-\u{1F1FF}]{2})/gu;

/**
 * Mette al riparo le emoticon: ritorna il testo coi segnaposto e la
 * mappa per il ripristino. Se non ci sono emoticon, il testo torna
 * intatto e la mappa e vuota (zero costo).
 */
export function proteggiEmoji(testo) {
  const mappa = [];
  const protetto = String(testo || '').replace(GRUPPO_EMOJI, (gruppo) => {
    const indice = mappa.push(gruppo) - 1;
    // Il segnaposto: raro nel linguaggio naturale, banale da conservare
    // per un modello, e senza lettere che qualcuno possa "tradurre".
    return `⟦${indice}⟧`; // ⟦0⟧ ⟦1⟧ ...
  });
  return { protetto, mappa };
}

/** Rimette le emoticon al loro posto. Tollerante: un segnaposto perso
 *  dal modello non fa danni, e gli avanzi ⟦n⟧ orfani vengono puliti. */
export function ripristinaEmoji(testo, mappa) {
  if (!mappa || mappa.length === 0) return testo;
  let esito = String(testo || '');
  for (let i = 0; i < mappa.length; i++) {
    esito = esito.split(`⟦${i}⟧`).join(mappa[i]);
  }
  // il modello a volte "sistema" gli spazi attorno al segnaposto
  esito = esito.replace(/⟦\d+⟧/g, '');
  return esito;
}
