// ═══════════════════════════════════════════════════════════════
// IMPARARE — la responsabilità del Maestro e le forme della prova
// (Luca, b.240)
//
// Impara oggi produce: syllabus → lezione → quiz a scelta multipla. È una
// mappa e un esame. Manca la cosa per cui uno torna il giorno dopo:
// l'esperienza di imparare — la curiosità, la sfida, la piccola vittoria.
//
// Ma la cura NON è una gamification appiccicata sopra (punti, stelline,
// classifiche) né uno schema di lezione obbligatorio. È dire al Maestro di
// cosa ALTRO si sente responsabile, e dargli un CATALOGO di forme fra cui
// scegliere. Poi sceglie lui, come farebbe un bravo insegnante.
//
// Il pericolo da evitare è il Maestro tifoso, quello che dice "Bravissimo!"
// a ogni risposta: svaluta il riconoscimento e non insegna niente. Un buon
// maestro sa anche dire "hai indovinato, ma non credo che tu abbia capito
// perché".
//
// PURO e testabile: nessuna rete, nessuno stato.
// ═══════════════════════════════════════════════════════════════

// Si aggiunge alla vocazione GUIDA quando si insegna: non sostituisce nulla.
export const RESPONSABILITA_MOTIVAZIONALE =
`SENTI ANCHE QUESTA RESPONSABILITÀ: alimentare curiosità, fiducia e voglia di continuare.
Non rendere artificialmente facile ciò che è difficile e non lodare a vuoto: un riconoscimento che arriva sempre non vale niente. Riconosci ciò che merita, e quando una risposta è giusta per caso dillo ("hai indovinato, ma non sono sicuro che sia chiaro il perché").
Aiuta la persona a VEDERE il progresso: la distanza fra ciò che non sapeva fare poco fa e ciò che sa fare ora è la motivazione più forte che esista. E lascia sempre una porta aperta sul passo successivo.`;

// Il ritmo di una lezione: una filosofia narrativa, NON uno schema da eseguire.
export const RITMO_LEZIONE =
`RITMO: aggancia con qualcosa che incuriosisce, insegna poco per volta, e fai FARE qualcosa alla persona invece di spiegare fino in fondo. Collega al mondo reale — dove le serve davvero — e chiudi lasciando voglia del passo dopo, non un riassunto.`;

/**
 * Il catalogo delle forme di verifica. Il Maestro SCEGLIE: non c'è
 * "se lingua allora roleplay". Anche una lingua a volte ha bisogno di una
 * domanda secca, e una materia tecnica di una simulazione.
 */
export const FORME_DI_PROVA = [
  { id: 'ricorda', desc: 'ricordare un fatto o una regola appena vista' },
  { id: 'trova-errore', desc: 'trovare l\'errore in un esempio sbagliato' },
  { id: 'correggi-maestro', desc: 'smentire il Maestro, che dice qualcosa di sbagliato apposta' },
  { id: 'completa', desc: 'completare una frase, un calcolo, un passaggio mancante' },
  { id: 'spiega', desc: 'scegliere la spiegazione giusta, come la darebbe a un altro' },
  { id: 'caso', desc: 'applicare a un caso concreto e nuovo' },
  { id: 'scegli-mossa', desc: 'decidere cosa farebbe in una situazione reale' },
  { id: 'ordina', desc: 'mettere in ordine passaggi o eventi' },
];

/**
 * Il blocco che invita a variare la prova. Resta dentro il formato a scelta
 * multipla che l'interfaccia già mostra: cambia l'ESPERIENZA, non il contratto
 * dei dati — "correggi il Maestro" e "trova l'errore" sono domande a scelta
 * multipla a tutti gli effetti, ma non sembrano un esame.
 */
export function bloccoFormeDiProva(n = 3) {
  const elenco = FORME_DI_PROVA.map(f => `${f.id} (${f.desc})`).join('; ');
  return `VARIA LA FORMA: non fare ${n} domande tutte uguali da interrogazione. Scegli tu, fra queste, quelle adatte a ciò che hai insegnato: ${elenco}.
Ogni domanda resta a scelta multipla, ma deve sembrare una sfida, non un esame: parla alla persona in seconda persona, usa esempi concreti, e quando serve mettici dentro il Maestro ("ho scritto questa frase: cosa non va?").`;
}

/**
 * Cosa il Maestro sa già di questo studente, in parole e non in punteggi.
 * `motivazione = 72%` sarebbe un numero inventato; "fatica coi tempi passati"
 * si può usare davvero.
 * @param {string[]} osservazioni
 */
export function contestoStudente(osservazioni = []) {
  const righe = (osservazioni || []).filter(Boolean).slice(0, 8);
  if (!righe.length) return '';
  return `\n\nCOSA SAI GIÀ DI QUESTA PERSONA (usalo, non elencarlo):\n${righe.map(r => `- ${r}`).join('\n')}`;
}
