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

export const TAVOLO_MAX = 4;

// Regole del dibattito (adattate da RadioChat DEBATE_FRAMEWORK), per lingua app.
const REGOLE_DIBATTITO =
`REGOLE DEL TAVOLO (valgono su tutto):
• Ascolta davvero gli altri prima di rispondere.
• Aggiungi VALORE NUOVO: mai ripetere ciò che è già stato detto.
• Se concordi con qualcuno, approfondisci o estendi il suo punto.
• Se dissenti, spiega perché con argomenti concreti.
• Tono collaborativo ma non conformista: dì la tua anche fuori dal tuo ruolo.
• L'OBIETTIVO è CONVERGERE, insieme, verso la risposta migliore possibile.`;

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
export function promptTavolo({ compagno, storia = [], ultimoUmano = '', altriQuestoGiro = [], obiettivo = '', convergenza = '', lingua = 'it' } = {}) {
  const nome = (compagno && compagno.nome) || 'Ospite';
  const persona = (compagno && compagno.personalita) || '';
  const bloccoObiettivo = obiettivo
    ? `\n\nOBIETTIVO COMUNE DELLA TAVOLA (tieni SEMPRE la rotta su questo; ogni tuo intervento deve avvicinare il gruppo al risultato): ${obiettivo}`
    : '';
  const bloccoConvergenza = convergenza ? `\n\n${convergenza}` : '';
  // b.231 — involucro comune: al Tavolo nessuno ha ricerca/fonti in tempo
  // reale, quindi le capacità lo dicono (Omar non inventa fonti). La barra
  // "libertà" del Compagno modula anche qui il comportamento.
  const involucro = involucroCompagno({
    liberta: compagno && compagno.liberta,
    capacita: { ricerca: false, fonti: false, memoria: false },
    // b.237 — al Tavolo si dibatte: steelman, prove, concessioni, convergenza.
    // Il Deep Setting del Compagno può cambiarlo per questa superficie.
    profilo: profiloEffettivo(compagno, 'tavolo'),
  });
  const system =
`${persona}
Sei ${nome}, a una tavola rotonda con una persona e altri interlocutori. Rispondi in prima persona, conciso e sostanzioso (2-3 frasi). Parli con la persona e reagisci a cosa dicono gli altri, sempre puntando al risultato. Rispondi nella lingua: ${lingua}.

${REGOLE_DIBATTITO}${bloccoObiettivo}${bloccoConvergenza}${involucro}`;

  const passato = (storia || []).slice(-8)
    .map(m => `[${m.ruolo === 'persona' ? 'persona' : m.ruolo}]: ${m.testo}`).join('\n');
  const oraAltri = (altriQuestoGiro || []).length
    ? `\n\nIn questo giro hanno già detto:\n${altriQuestoGiro.map(a => `${a.nome}: ${a.testo}`).join('\n')}`
    : '';
  const prompt =
`${passato ? passato + '\n\n' : ''}[persona]: ${ultimoUmano}${oraAltri}\n\nRispondi come ${nome}: aggiungi qualcosa di nuovo e avvicina il gruppo all'obiettivo.`;
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

/**
 * Istruzione di convergenza in base allo stato del giro (adattata da RadioChat):
 * spinge il gruppo a convergere ed evita stagnazione.
 */
export function istruzioneConvergenza(giro = 0) {
  if (giro <= 0) return 'Primi scambi: metti sul tavolo la TUA posizione distintiva sull\'obiettivo.';
  // b.231 — no falso consenso: se i dati non bastano, convergere su ciò che
  // è certo e dichiarare apertamente cosa resta incerto e perché.
  if (giro >= 2) return '⚠️ Non girate a vuoto: puntate alla conclusione migliore possibile. Se i dati NON permettono un accordo, convergete su ciò che è certo, dite chiaramente cosa resta incerto e PERCHÉ — senza fabbricare un consenso artificiale.';
  return 'Costruite l\'uno sull\'altro: convergete verso la risposta migliore, senza ripetervi e senza appiattire un disaccordo reale.';
}
