// ═══════════════════════════════════════════════════════════════
// TAVOLO — tavola rotonda di Compagni verso un OBIETTIVO COMUNE (Luca)
//
// Tu poni un tema/obiettivo, e i Compagni scelti (fino a 4, ciascuno col suo
// provider: openai/anthropic/gemini/grok) discutono per raggiungere un
// RISULTATO CONDIVISO. Non una chiacchierata: un dibattito che CONVERGE.
//
// Ripreso fedelmente dall'orchestrator di RadioChat (src/lib/prompts.ts):
//  - DEBATE_FRAMEWORK: ascolta, aggiungi valore NUOVO, costruisci o dissenti
//    con argomenti, l'obiettivo è CONVERGERE verso la risposta migliore;
//  - contesto delle risposte precedenti (consultation);
//  - istruzione di CONVERGENZA (anti-stagnazione);
//  - un OBIETTIVO (taskContext) che guida tutti;
//  - una SINTESI finale che mette a fuoco il risultato condiviso.
//
// Superficie di Life a sé: NON tocca stanza/WebRTC. Riusa la cerniera → wallet.
// I costruttori di prompt sono PURI e testabili.
// ═══════════════════════════════════════════════════════════════

import { involucroCompagno } from './contratto.js';
import { profiloEffettivo } from './profili.js';
import { regoleDibattito, bloccoRegolaDibattito, kbVoceParlata } from './orchestratore.js';

export const TAVOLO_MAX = 4;

// b.525 — LA COPIA LOCALE DELLE REGOLE E MORTA. Qui viveva ancora il
// DEBATE_FRAMEWORK originale di RadioChat («l'OBIETTIVO e CONVERGERE»),
// cioe le regole che in b.380 erano gia state bocciate da Luca e
// riscritte in orchestratore.js perche producevano un coro di
// complimenti. Il Podcast usava le nuove, il Tavolo le vecchie: stessa
// app, due filosofie di dibattito. Da oggi la fonte e UNA:
// regoleDibattito() di orchestratore.js, per tutte le superfici.

/**
 * Prompt di un turno al tavolo (per callLLM via cerniera).
 * @param compagno         chi parla ora (personalita, nome)
 * @param storia           [{ruolo:'persona'|nome, testo}] scambi precedenti
 * @param ultimoUmano      l'ultimo messaggio della persona
 * @param altriQuestoGiro  [{nome, testo}] cosa hanno già detto gli altri ORA
 * @param obiettivo        l'obiettivo comune della tavola (facoltativo)
 * @param convergenza      istruzione di convergenza (facoltativa)
 * @param lingua
 */
export function promptTavolo({ compagno, storia = [], ultimoUmano = '', altriQuestoGiro = [], obiettivo = '', convergenza = '', lingua = 'it', briefing = '', apertura = false, riassunto = '', sezioniBlocco = '', antiEco = '' } = {}) {
  const nome = (compagno && compagno.nome) || 'Ospite';
  const persona = (compagno && compagno.personalita) || '';
  const bloccoObiettivo = obiettivo
    ? `\n\nOBIETTIVO COMUNE DELLA TAVOLA (tieni la rotta su questo): ${obiettivo}
Avvicinare il gruppo al risultato vale anche in negativo: nominare un dato che manca, un'ambiguita della domanda o un presupposto non verificato E' un passo avanti.`
    : '';
  // b.391 — IL DOCUMENTO CHE AVETE DAVANTI.
  //
  // Secondo collaudo di Luca: in cima al tavolo c'era il briefing con i
  // numeri (inflazione oltre il 6%, alimentari +10%, stipendi +2,6%), e
  // due schermate sotto tutti e tre i Compagni rispondevano «mi manca un
  // dato specifico». I dati non mancavano: erano nel primo messaggio
  // della conversazione, e non arrivavano mai a loro.
  //
  // Venivano tolti apposta, e per un motivo giusto: infilati fra i turni
  // sembravano il discorso di un tale chiamato «__briefing» e sporcavano
  // la conversazione. Ma la conclusione sbagliata era buttarli — un
  // briefing non e un TURNO, e un DOCUMENTO. Quindi non entra nella
  // storia: entra nel CONTESTO, come una cosa che sta sul tavolo e che
  // tutti possono guardare.
  const bloccoBriefing = briefing
    ? `\n\nSUL TAVOLO C'E' QUESTO, e lo avete letto tutti:\n${String(briefing).slice(0, 2000)}\n\nUSALO. Se contiene un numero che risponde alla domanda, DILLO invece di dire che ti manca il dato: dire "mi manca un dato" con il dato davanti e la cosa peggiore che puoi fare qui.`
    : '';
  const bloccoConvergenza = convergenza ? `\n\n${convergenza}` : '';
  // b.533 — IL RIASSUNTO CUMULATIVO (la memoria a 3 livelli di
  // RadioChat, il pezzo che mancava): quello che e uscito dalla
  // finestra non sparisce piu — arriva compresso, come un verbale.
  const bloccoRiassunto = riassunto
    ? `\n\nPRIMA, IN SINTESI (i giri usciti dalla finestra):\n${String(riassunto).slice(0, 1200)}`
    : '';
  // b.231 — involucro comune: al Tavolo nessuno ha ricerca/fonti in tempo
  // reale, quindi le capacità lo dicono (Omar non inventa fonti). La barra
  // "libertà" del Compagno modula anche qui il comportamento.
  const involucro = involucroCompagno({
    liberta: compagno && compagno.liberta,
    capacita: { ricerca: false, fonti: false, memoria: false },
    // b.237 — al Tavolo si dibatte: steelman, prove, concessioni, convergenza.
    // Il Deep Setting del Compagno può cambiarlo per questa superficie.
    profilo: profiloEffettivo(compagno, 'tavolo'),
    // b.362 — il canale per TACERE o CHIEDERE, finalmente acceso: il
    // marcatore [esito: risposta/domanda/passo] arriva alla route, che sa
    // saltare chi passa. Era scritto da b.359 ma nessuno lo attivava.
    esitoTipizzato: true,
  });
  // b.525 — IL PRIMO GIRO PIANTA LE BANDIERE (da RadioChat, primi 4
  // turni forzati): prima ognuno stabilisce la SUA posizione
  // distintiva, poi ci si scontra. Senza questo, il dibattito parte
  // gia in cortesia.
  const bloccoApertura = apertura
    ? `\n\nPRIMO GIRO: stabilisci la TUA posizione distintiva sul tema, netta e riconoscibile. Non commentare gli altri: pianta la tua bandiera.`
    : '';
  const system =
`${persona}
Sei ${nome}, a una tavola rotonda con una persona e altri interlocutori. Rispondi in prima persona, conciso e sostanzioso (2-3 frasi). Parli con la persona e reagisci a cosa dicono gli altri, sempre puntando al risultato. Rispondi nella lingua: ${lingua}.

${regoleDibattito(lingua)}${bloccoRegolaDibattito(compagno)}${antiEco}${bloccoApertura}${bloccoObiettivo}${bloccoBriefing}${bloccoRiassunto}${bloccoConvergenza}${sezioniBlocco}${involucro}

${kbVoceParlata(lingua)}`;

  // b.525 — LA MEMORIA NON FINISCE A OTTO MESSAGGI (da RadioChat, memoria
  // a livelli): gli ultimi 8 interi, e i 12 prima CONDENSATI a una riga.
  // Al quinto giro i Compagni ricordavano solo il quarto: ora il filo
  // della discussione resta in mano a tutti.
  const tutta = storia || [];
  const interi = tutta.slice(-8);
  const prima = tutta.slice(-20, -8);
  const rigaDi = (m) => `[${m.ruolo === 'persona' ? 'persona' : m.ruolo}]: ${m.testo}`;
  const condensati = prima.length
    ? `PRIMA (in breve):\n${prima.map(m => rigaDi(m).slice(0, 110)).join('\n')}\n\n`
    : '';
  const passato = condensati + interi.map(rigaDi).join('\n');
  const oraAltri = (altriQuestoGiro || []).length
    ? `\n\nIn questo giro hanno già detto:\n${altriQuestoGiro.map(a => `${a.nome}: ${a.testo}`).join('\n')}`
    : '';
  const prompt =
`${passato ? passato + '\n\n' : ''}[persona]: ${ultimoUmano}${oraAltri}\n\nRispondi come ${nome}.`;
  // b.525 — VIA IL TRIPLO INVITO A TACERE. Qui c'era «rispondi SOLO se
  // hai qualcosa di fondato... se ti manca un dato di' quale... se non
  // hai nulla, passa»: tre uscite di sicurezza nello stesso prompt, in
  // aggiunta al canale esito dell'involucro che dice gia le stesse cose.
  // RadioChat non ne ha nemmeno una: i suoi agenti sono spinti a
  // CONTRIBUIRE. L'uscita resta una sola — il canale [esito] — e i «mi
  // manca il dato» di cortesia spariscono con lei.
  return { system, prompt };
}

/**
 * SINTESI finale: un "verbale" della tavola che mette a fuoco il RISULTATO
 * CONDIVISO raggiunto verso l'obiettivo. Neutrale (non è un Compagno), legge
 * l'intera discussione e conclude.
 */
export function promptSintesi({ obiettivo = '', discussione = [], lingua = 'it' } = {}) {
  const testo = (discussione || [])
    .map(m => `${m.ruolo === 'persona' ? 'Persona' : (m.nome || m.ruolo)}: ${m.testo}`)
    .join('\n');
  const system =
`Sei il coordinatore di una tavola rotonda. Non hai una tua opinione: il tuo compito è SINTETIZZARE la discussione in un risultato condiviso, utile e azionabile. Scrivi nella lingua: ${lingua}.`;
  const prompt =
`${obiettivo ? `Obiettivo della tavola: ${obiettivo}\n\n` : ''}Discussione:
${testo}

Scrivi una SINTESI breve e concreta con:
1) I punti su cui c'è ACCORDO.
2) Le divergenze e le INCERTEZZE rimaste aperte: riportale esplicitamente, non appiattirle in un falso accordo.
3) La CONCLUSIONE condivisa dove possibile / il prossimo passo consigliato verso l'obiettivo.
Niente ripetizioni inutili, vai al sodo. Onestà prima di completezza: se manca un dato per concludere, dillo.`;
  return { system, prompt };
}

