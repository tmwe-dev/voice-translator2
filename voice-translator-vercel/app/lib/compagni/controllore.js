// ═══════════════════════════════════════════════════════════════
// CONTROLLORE — la regia della conversazione (Luca, b.237)
//
// Il difetto dei Compagni non era la qualità delle singole risposte, ma
// l'assenza di una regia: ASCOLTA → INTERPRETA → DECIDI LA MOSSA → PARLA,
// invece di ASCOLTA → RISPONDI → FAI UNA DOMANDA.
//
// Questo modulo stima COSA STA FACENDO la persona (si sfoga? pensa ad
// alta voce? chiede un parere? decide? saluta?) con indizi di forma —
// punteggiatura, lunghezza, parole spia — e produce il blocco di REGIA
// da mettere nel system: situazione + mossa. È il "conversation
// controller" in versione deterministica: zero chiamate in più, zero
// latenza, testabile riga per riga.
//
// LIMITE DICHIARATO: le parole spia coprono italiano e inglese; nelle
// altre lingue restano gli indizi di forma (?, …, lunghezza), che sono
// universali. Meglio una regia parziale che nessuna regia.
//
// PURO: nessuna rete, nessuno stato.
// ═══════════════════════════════════════════════════════════════

/** @typedef {'domanda'|'sfogo'|'racconto'|'riflessione'|'decisione'|'richiesta'|'saluto'|'conferma'} Situazione */

const SPIA = {
  sfogo: /\b(stanc[oa]|sfinit[oa]|non ne posso più|che palle|arrabbiat[oa]|frustrat[oa]|triste|deluso|delusa|ansia|preoccupat[oa]|tired|exhausted|frustrated|angry|upset|worried|stressed)\b/i,
  decisione: /\b(devo decidere|non so se|meglio .+ o |conviene|should i|can't decide|dovrei|scelgo|scegliere|choose between)\b/i,
  richiesta: /\b(aiutami|organizzami|preparami|fammi|scrivimi|trovami|calcola|help me|make me|find me|plan)\b/i,
  saluto: /^\s*(ciao|ehi|hey|buongiorno|buonasera|salve|hello|hi|good morning|good evening)[\s!,.]*$/i,
  conferma: /^\s*(s[iì]|ok|okay|va bene|esatto|giusto|certo|no|yes|sure|right|got it|capito|chiaro)[\s!,.]*$/i,
};

/**
 * Stima la situazione dall'ultimo messaggio (e dalla storia recente).
 * Ordine dei controlli: dal segnale più forte al più debole.
 * @param {string} ultimo   l'ultimo messaggio della persona
 * @param {Array<{ruolo:string,testo:string}>} [storia]
 * @returns {Situazione}
 */
export function situazioneDaTesto(ultimo = '', storia = []) {
  const t = String(ultimo || '').trim();
  if (!t) return 'racconto';
  if (SPIA.saluto.test(t)) return 'saluto';
  if (SPIA.conferma.test(t)) return 'conferma';
  if (SPIA.richiesta.test(t)) return 'richiesta';
  if (SPIA.decisione.test(t)) return 'decisione';
  if (SPIA.sfogo.test(t)) return 'sfogo';
  if (t.includes('?')) return 'domanda';
  // Puntini di sospensione o frase che resta aperta: sta ancora pensando.
  if (/(\.\.\.|…)\s*$/.test(t)) return 'riflessione';
  // Messaggi lunghi senza domanda: sta raccontando, non interrogando.
  if (t.length > 240) return 'racconto';
  return 'racconto';
}

// b.238 — NON PIÙ ORDINI, MA COSE DA TENERE PRESENTI.
//
// In b.237 qui c'era una "mossa" per situazione: di fatto un
// `if situazione == sfogo: ascolta()`. È esattamente l'handcode
// comportamentale che vogliamo togliere: il modello sa già cosa fa una
// persona attenta davanti a uno sfogo, e lo sa meglio di una riga scritta
// da noi. Quello che NON può indovinare è cosa sta succedendo in questo
// turno — e quello glielo diamo, come ipotesi.
//
// Restano righe brevissime, una per situazione: non dicono cosa dire, ma
// cosa sarebbe facile sbagliare. Sono anche PIÙ CORTE delle precedenti:
// meno prompt, meno token, meno latenza.
const DA_TENERE_PRESENTE = {
  domanda: 'ha fatto una domanda vera: merita una risposta, non un rimando.',
  sfogo: 'sembra sotto pressione: probabilmente conta più essere capita che ricevere una soluzione.',
  racconto: 'sta raccontando, non interrogando.',
  riflessione: 'sta ancora costruendo il pensiero: lo spazio è suo.',
  decisione: 'sta scegliendo: le serve vederci chiaro, non essere assecondata.',
  richiesta: 'ha chiesto una cosa concreta: conta il risultato.',
  saluto: 'sta solo aprendo la conversazione.',
  conferma: 'ha confermato: il filo riprende da dove eravate.',
};

/** Cosa è facile sbagliare in questa situazione (una riga, non un ordine). */
export function notaPerSituazione(situazione) {
  return DA_TENERE_PRESENTE[situazione] || DA_TENERE_PRESENTE.racconto;
}

/**
 * Il blocco di LETTURA del turno: un'ipotesi su cosa sta succedendo, da
 * confermare o scartare. Non prescrive la risposta: la decide il Compagno.
 * Parte con due a-capo, pronto per la concatenazione (come involucroCompagno).
 * @returns {{blocco:string, situazione:Situazione}}
 */
export function regiaConversazione({ ultimo = '', storia = [] } = {}) {
  const situazione = situazioneDaTesto(ultimo, storia);
  const blocco =
`\n\nCOSA SEMBRA SUCCEDERE ORA (ipotesi da confermare o scartare, non un'istruzione): ${notaPerSituazione(situazione)} Decidi tu se e come rispondere.`;
  return { blocco, situazione };
}
