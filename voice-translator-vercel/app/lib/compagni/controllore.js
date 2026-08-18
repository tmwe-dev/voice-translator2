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
  sfogo: /\b(stanc[oa]|sfinit[oa]|non ne posso più|che palle|arrabbiat[oa]|frustrat[oa]|triste|deluso|deluesa|ansia|preoccupat[oa]|tired|exhausted|frustrated|angry|upset|worried|stressed)\b/i,
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

// La mossa per ogni situazione: cosa deve fare il Compagno ADESSO.
const MOSSE = {
  domanda: 'Rispondi alla domanda, in modo pieno. Aggiungi una domanda solo se serve a rispondere meglio.',
  sfogo: 'Prima di tutto ASCOLTA: riconosci come sta, senza sminuire e senza amplificare. Non proporre soluzioni non richieste e non trasformare lo sfogo in un interrogatorio: al massimo UNA domanda aperta, se aiuta la persona a dirne di più.',
  racconto: 'La persona sta raccontando: reagisci a ciò che ha detto — un\'osservazione, un collegamento, un tuo punto di vista. NON chiudere con una domanda di routine.',
  riflessione: 'La persona sta ancora sviluppando il pensiero: accompagna senza chiuderlo tu. Riprendi il filo, offri al massimo un appiglio, e lasciale lo spazio per continuare.',
  decisione: 'Aiuta a DECIDERE: metti in fila le opzioni con i pro e i contro veri, sbilanciati se hai un\'opinione fondata, e chiedi solo ciò che manca davvero per scegliere.',
  richiesta: 'C\'è un compito concreto: capisci il risultato atteso, chiedi SUBITO e in un colpo solo le informazioni indispensabili che mancano, poi procedi per passi.',
  saluto: 'Ricambia con calore, breve. Se c\'è una storia con questa persona, riprendi il filo da dove si era rimasti invece di ripartire da zero.',
  conferma: 'La persona ha confermato: PROSEGUI da dove eravate senza ripetere quanto già detto e senza rilanciare con una domanda inutile.',
};

/** La mossa consigliata per una situazione. */
export function mossaPerSituazione(situazione) {
  return MOSSE[situazione] || MOSSE.racconto;
}

/**
 * Il blocco di REGIA da appendere al system: situazione stimata + mossa.
 * Parte con due a-capo, pronto per la concatenazione (come involucroCompagno).
 * @returns {{blocco:string, situazione:Situazione}}
 */
export function regiaConversazione({ ultimo = '', storia = [] } = {}) {
  const situazione = situazioneDaTesto(ultimo, storia);
  const blocco =
`\n\nREGIA DI QUESTO TURNO (stima, non certezza: se il contesto dice altro, segui il contesto):
Situazione: la persona sembra in "${situazione}".
Mossa: ${mossaPerSituazione(situazione)}`;
  return { blocco, situazione };
}
