// CANTIERE — collegato alla FASE 5 del documento di Mondo (b.576).
// Finche' quella fase non arriva questo file esiste e non lo chiama
// ancora nessuno: e' voluto, il documento dice «nessun cambio UI».
// Quando verra collegato, questa riga se ne va con la fase.
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

// Capitolo 19, e vale piu di tutti i pesi messi insieme: se hai
// scritto una domanda, la risposta viene prima della personalizzazione.
export const QUERY_ESPLICITA_COMANDA = true;
