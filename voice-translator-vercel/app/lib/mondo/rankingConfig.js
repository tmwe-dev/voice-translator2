// ═══════════════════════════════════════════════════════════════
// I PESI DEL RANKING, IN UN POSTO SOLO (b.576, FASE 3)
//
// Documento di Luca, capitolo 17: «questi numeri devono stare in
// mondoRankingConfig.js. Non sparsi nel codice».
//
// La ragione non e' l'ordine: e' che finche' i numeri stanno sparsi
// nessuno puo rispondere alla domanda «perche' vedo questa roba?». Un
// peso scritto in mezzo a una funzione e' una decisione presa da chi
// passava di li quel giorno. Un peso scritto qui e' una decisione del
// prodotto, e si puo discutere.
//
// I valori sono quelli del documento, non ritoccati da me.
// ═══════════════════════════════════════════════════════════════

export const PESI_RANKING = {
  intent: 0.35,        // quanto risponde a cio che stai chiedendo ADESSO
  freshness: 0.20,     // quanto e' fresco
  interests: 0.15,     // i tuoi interessi DICHIARATI
  affinity: 0.10,      // cio che abbiamo imparato guardandoti
  quality: 0.10,       // qualita, che non e' popolarita (capitolo 28)
  collective: 0.05,    // quanto piace agli altri
  exploration: 0.05,   // il fuori-programma
};

// Capitolo 23 — il tetto contro la bolla. Non e' un dettaglio di
// bilanciamento: e' la differenza fra un giornale e uno specchio.
export const QUOTE = {
  vicinoAiTuoiInteressi: 0.65,
  mondoEScoperta: 0.22,
  sorpresa: 0.13,
};

// Quanto invecchia una notizia. Mezza vita in ore: dopo `mezzaVita` ore
// il punteggio di freschezza e' meta.
export const FRESCHEZZA = {
  mezzaVitaOre: { breaking: 3, article: 18, discussion: 48, video: 72 },
  senzaDataPunteggio: 0.35,   // chi non dice quando e' nato non e' fresco ne vecchio
};

// Capitolo 22 — le regole della Regia, tenute qui perche' sono numeri
// di prodotto anche loro.
export const REGIA = {
  maxStessoTopicDiFila: 2,
  maxStessaFonteDiFila: 2,
  quotaInternazionale: 0.22,
  quotaEsplorazione: 0.12,
  maxUnFormato: 0.80,   // capitolo 33: nessun formato oltre l'80%
};

// b.596 — qui c'era QUERY_ESPLICITA_COMANDA = true, capitolo 19:
// "se hai scritto una domanda, la risposta viene prima della
// personalizzazione". Nessun codice la leggeva — la regola descritta
// nel documento non risulta applicata da nessuna parte, non solo non
// esportata: verifica da fare, non una semplice pulizia di export.

// ═══ FASE 5 — L'INTERRUTTORE ═══
// Il documento (cap. 40) vuole la migrazione a pezzi e il vecchio
// tenuto accanto per confronto. Questo e' il pezzo: gli ARTICOLI
// passano dal motore nuovo, i video no (quella e' la FASE 6).
// Sta qui e non dentro un componente perche' tornare indietro deve
// costare una riga e nessun ragionamento — la sera in cui serve un
// rollback non e' la sera in cui si legge il codice.
export const MOTORE_NUOVO_ARTICOLI = true;
