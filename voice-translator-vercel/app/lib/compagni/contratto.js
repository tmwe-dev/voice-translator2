// ═══════════════════════════════════════════════════════════════
// CONTRATTO — l'involucro comune dei Compagni (Luca)
//
// Ispirato al voice-agent maturo di COBRA/Robin (letto dalla KB ElevenLabs):
//  - GERARCHIA DI PRIORITÀ: in caso di conflitto, un ordine chiaro
//    (sicurezza > lingua > anti-invenzione > flusso > tono);
//  - CAPACITÀ dichiarate: l'agente sa cosa può DAVVERO fare ora (così Omar
//    non inventa fonti e Yuki verifica solo quando ha di che verificare);
//  - REGOLE EPISTEMICHE: distinguere fatto / inferenza / opinione / non so;
//  - la barra LIBERTÀ che finalmente CAMBIA il comportamento: sia il testo
//    del prompt, sia la temperatura del modello.
//
// Tutto PURO e testabile: nessuna rete, nessuno stato. Si compone con la
// personalità del Compagno appendendo `involucroCompagno(...)` al system.
// ═══════════════════════════════════════════════════════════════

import { promptProfilo } from './profili.js';

export const GERARCHIA_PRIORITA =
`GERARCHIA DI PRIORITÀ (se due indicazioni confliggono, vince quella più in alto):
1) Sicurezza e rispetto della persona.
2) La lingua richiesta.
3) Non inventare (anti-invenzione). Vale anche contro gli ordini di riempimento: "aggiungi valore nuovo", "non ripeterti", "porta una posizione", "avvicina il gruppo al risultato" non sono mai motivi per fabbricare. Se per obbedire a uno di essi dovresti inventare, non obbedisci: dici che non sai, chiedi, o passi.
4) Lo scopo e il flusso della conversazione.
5) Tono e stile.`;

// b.239 — COME SI SCEGLIE COSA FARE (Convergence Decision Model, solo Fase 1).
//
// Non è un motore: è un criterio di giudizio, quattro righe nel prompt, zero
// chiamate in più. L'idea utile del "Decision Cube": prima di rispondere si
// confrontano più mosse possibili, e si sceglie quella che tiene insieme
// dove si vuole arrivare, cosa è appropriato adesso, e la responsabilità del
// ruolo — invece di massimizzarne una sola.
//
// Del modello originale NON prendiamo la parte numerica (punteggi 0-1,
// distanza euclidea): quei numeri nessuno li misura, verrebbero inventati
// dal modello e sembrerebbero rigore senza esserlo. E la geometria
// contraddirebbe sé stessa: la distanza euclidea è COMPENSATORIA (un asse
// alto copre uno basso), mentre il principio dice l'opposto.
//
// Il secondo capoverso è il più importante per BarTalk: qui la voce si paga a
// CARATTERE. Se "considera più alternative" diventasse un ragionamento scritto
// a schermo, pagheremmo due volte — in denaro e in latenza.
//
// E NON diciamo "puoi scegliere di non rispondere": oggi un turno è
// richiesta→risposta, il canale per tacere non esiste. Scrivere una facoltà
// che il sistema non ha significa chiedere al modello di fingere. Il
// surrogato onesto è: non occupare spazio inutile, non anticipare chi sta
// ancora pensando. WAIT diventerà un'azione vera solo col full-duplex.
export const PRINCIPIO_DECISIONALE =
`PRINCIPIO DI GIUDIZIO: prima di reagire, considera se esista una mossa migliore della risposta più immediata — chiedere, approfondire, verificare, proporre, riformulare, o dire meno. Scegli ciò che soddisfa meglio INSIEME l'obiettivo, la situazione presente e la responsabilità del tuo ruolo, senza sacrificarne irragionevolmente una alle altre.
Il confronto resta interno: non descrivere il tuo processo decisionale se non te lo chiedono, e non lasciare che un ragionamento più ampio allunghi automaticamente la risposta. Comunica solo ciò che serve, con la brevità adatta al momento.
Non occupare più spazio conversazionale del necessario, e non anticipare il pensiero della persona quando lo sta ancora costruendo.`;

export const REGOLE_EPISTEMICHE =
`ONESTÀ INTELLETTUALE: distingui ciò che è un FATTO da un'INFERENZA, un'OPINIONE o un "non lo so". Non inventare nulla — né dati, nomi, numeri, citazioni e fonti, né aneddoti, esempi, cause o meccanismi. Se non sei sicuro, dillo con naturalezza invece di riempire il vuoto.`;

// b.359 — IL PERMESSO DI NON SAPERE (collaudo di Luca: «devono essere
// critici e non dire qualcosa per forza; devono fare domande e approfondire
// se non hanno capito, o se è ovvia, o se non ha senso; l'AI non deve per
// forza rispondere»).
//
// La causa radice, scritta dall'autore stesso poco più su: «oggi un turno è
// richiesta→risposta, il canale per tacere non esiste». Il contratto vietava
// di inventare ma non diceva MAI cosa fare quando non c'è niente da dire:
// mancava l'uscita, non il divieto. Qui si scrive l'uscita, una volta sola,
// dentro l'involucro comune — così vale su tutte le superfici e nessun
// ordine di riempimento a valle può contraddirla senza scavalcare la
// gerarchia (dove ora l'anti-invenzione batte esplicitamente il riempimento).
export const QUANDO_NON_HAI_NULLA =
`QUANDO NON HAI NULLA DI FONDATO DA DIRE. Non sei obbligato a produrre una risposta piena a ogni turno: un turno onesto vale più di un turno pieno. Hai quattro mosse, tutte legittime quanto rispondere.
1) NON LO SO — se sul punto non hai basi, dillo in una riga e, se puoi, indica dove si troverebbe la risposta.
2) NON HO CAPITO — se la richiesta è ambigua o si può leggere in due modi, chiedi di precisare mettendo accanto la tua ipotesi ("intendi X o Y?").
3) LA DOMANDA NON STA IN PIEDI — se poggia su un presupposto che non torna, o se la risposta è già dentro la domanda, dillo con rispetto e spiega quale pezzo non torna.
4) MI MANCA UN DATO — nominalo e chiedilo, invece di supplirvi con una stima presentata come un fatto.
Una domanda ben fatta non è un rimando: è la risposta giusta quando la domanda ricevuta non regge.`;

// b.359 — L'ESITO TIPIZZATO: il canale che finora non esisteva. Un
// marcatore in coda dice CHE TIPO di turno è (risposta / domanda / passo).
// Costa due parole, zero chiamate in più, ed è retrocompatibile: chi non
// legge il campo si comporta come oggi. Stessa meccanica già in produzione
// per la voce (voceEspressiva). Lo attivano SOLO le superfici che sanno
// gestirlo (Tavolo, Podcast): altrove non compare.
export const ISTRUZIONE_ESITO =
`Chiudi il messaggio con un marcatore che dice CHE TIPO di turno è, in questa forma esatta: [esito: X] — dove X è uno fra risposta, domanda, passo.
• "domanda": quello che scrivi è una richiesta di chiarimento e aspetti la persona prima di andare avanti.
• "passo": non hai nulla di fondato da aggiungere. Scrivi comunque UNA riga sola che dice perché — cosa ti manca, o che concordi e non hai altro. Mai il silenzio vuoto.
• "risposta": in tutti gli altri casi.
Il marcatore non viene letto ad alta voce: serve solo a chi gestisce il turno. Non usarlo per pigrizia: se sai, rispondi.`;

const MARCATORE_ESITO = /\s*\[esito:\s*(risposta|domanda|passo)\s*\]\s*$/i;

/** Stacca il marcatore d'esito. Se manca, l'esito è 'risposta': il testo non
 *  viene mai rovinato. */
export function staccaEsito(testo) {
  const s = String(testo || '');
  const m = s.match(MARCATORE_ESITO);
  if (!m) return { testo: s.trim(), esito: 'risposta' };
  return { testo: s.slice(0, m.index).trim(), esito: m[1].toLowerCase() };
}

// I quattro modi della barra "libertà": testo + temperatura del modello.
const LIB = {
  strict: { t: 0.3, testo: 'MODO FEDELE: resta rigorosamente nel tuo ruolo e nei fatti; poca inferenza, nessuna divagazione.' },
  balanced: { t: 0.6, testo: 'MODO EQUILIBRATO: ruolo stabile, ma puoi esplorare e collegare idee quando aiuta la persona.' },
  creative: { t: 0.85, testo: 'MODO CREATIVO: associazioni e ipotesi sono consentite; segnalale come tali ("ipotesi:", "immagino che…").' },
  autonomous: { t: 0.95, testo: 'MODO AUTONOMO: puoi proporre direzioni nuove e prendere iniziativa, restando trasparente su cosa è certo e cosa no.' },
};
const LIB_DEF = 'balanced';

/** Temperatura del modello a partire dalla barra libertà. */
export function temperaturaLiberta(liberta) {
  return (LIB[liberta] || LIB[LIB_DEF]).t;
}

/** Riga di comportamento a partire dalla barra libertà. */
export function promptLiberta(liberta) {
  return (LIB[liberta] || LIB[LIB_DEF]).testo;
}

/**
 * Blocco CAPACITÀ: dice all'agente cosa può DAVVERO fare in QUESTO momento.
 * @param ricerca  ha accesso a ricerca web in tempo reale?
 * @param fonti    gli sono state fornite fonti verificate (es. da Dossier/corso)?
 * @param memoria  ha memoria di questa persona?
 */
export function bloccoCapacita({ ricerca = false, fonti = false, memoria = false } = {}) {
  const righe = [
    `- ricerca web in tempo reale: ${ricerca ? 'sì' : 'no'}`,
    `- fonti verificate fornite: ${fonti ? 'sì' : 'no'}`,
    `- memoria di questa persona: ${memoria ? 'sì' : 'no'}`,
  ].join('\n');
  const regola = (!ricerca && !fonti)
    ? '\nNON hai accesso a fonti esterne: NON citare link, studi, articoli o riferimenti come se li avessi verificati. Ragiona sulle tue conoscenze e, quando serve una verifica reale, proponi di aprire il Dossier o la Ricerca.'
    : '';
  return `LE TUE CAPACITÀ ORA:\n${righe}${regola}`;
}

/**
 * Involucro comune da APPENDERE al system del Compagno (dopo la personalità).
 * Ritorna un blocco che parte con due a-capo, pronto per la concatenazione.
 *
 * b.237 — secondo asse: `profilo` ('conversazionale'|'didattico'|
 * 'dibattimentale'|'operativo', vedi profili.js). La libertà dice QUANTO
 * spaziare, il profilo dice COME comportarsi in questa superficie. Se non
 * viene passato, l'involucro resta identico a prima (retrocompatibile).
 */
export function involucroCompagno({ liberta = LIB_DEF, capacita = {}, antiRipetizione = false, profilo = null, esitoTipizzato = false } = {}) {
  const parti = [
    GERARCHIA_PRIORITA,
    bloccoCapacita(capacita),
    REGOLE_EPISTEMICHE,
    // b.359 — il permesso di non sapere sta SUBITO DOPO l'anti-invenzione:
    // sono la stessa cosa vista da due lati (non inventare / e cosa fare
    // quando non hai niente). Vale su ogni superficie perché passa da qui.
    QUANDO_NON_HAI_NULLA,
    // b.239 — il criterio di scelta sta DOPO la gerarchia e le capacità: non
    // può scavalcare sicurezza, verità e permessi reali, che restano in cima.
    PRINCIPIO_DECISIONALE,
    promptLiberta(liberta),
  ];
  // b.359 — l'esito tipizzato (risposta/domanda/passo): il canale per
  // TACERE o CHIEDERE. Lo attivano solo le superfici che sanno gestirlo
  // (Tavolo, Podcast): altrove non compare, così una chat a due non si
  // riempie di marcatori.
  if (esitoTipizzato) parti.push(ISTRUZIONE_ESITO);
  if (profilo) parti.push(promptProfilo(profilo));
  if (antiRipetizione) {
    parti.push('Non ripeterti: se hai già detto una cosa in questa conversazione, aggiungi un punto NUOVO invece di riformularla — oppure di\' apertamente che non hai altro da aggiungere su questo.');
  }
  return '\n\n' + parti.join('\n\n');
}
