// ═══════════════════════════════════════════════════════════════
// PODCAST — l'orchestratore dei turni (Luca)
//
// Il cuore di "ascolta i Compagni chiacchierare". È PURO: decide l'ordine
// dei turni e costruisce, per ogni turno, il prompt da dare a callLLM. Non
// chiama nessun modello, nessuna rete: così è deterministico e testabile.
//
// L'API poi farà solo il giro, turno per turno:
//   promptTurno(...) → callLLM (personalità del Compagno) → /api/translate
//   → /api/tts-elevenlabs (voce del Compagno) → prossimo turno.
//
// Ogni Compagno riceve cosa hanno detto gli altri PRIMA nello stesso
// podcast (come in RadioChat): così si rispondono davvero, non recitano
// monologhi paralleli.
// ═══════════════════════════════════════════════════════════════

import { involucroCompagno } from './contratto.js';

export const PODCAST_LIMITI = {
  MIN_COMPAGNI: 2,
  MAX_COMPAGNI: 4,
  MIN_ROUND: 1,
  // b.236 — era 10: con 4 Compagni faceva 40 turni SEQUENZIALI in una rotta
  // con maxDuration=60s (ogni turno = LLM + traduzione + TTS). Un podcast
  // lungo moriva a metà per timeout, addebitando comunque i turni già fatti.
  // 4 round × 4 Compagni = 16 turni resta il massimo finché l'orchestrazione
  // non diventa un lavoro asincrono (vedi piano: Podcast async).
  MAX_ROUND: 4,
  ROUND_PREDEFINITI: 4,
};

/** Stringe un valore fra due estremi. */
function fra(n, min, max) {
  n = Math.floor(Number(n) || 0);
  return Math.max(min, Math.min(max, n));
}

/**
 * L'ordine dei turni: round-robin. `round` giri, ognuno con tutti i
 * Compagni nell'ordine dato. Ritorna una lista piatta di turni.
 * @returns {{ordine:number, round:number, compagnoId:string}[]}
 */
export function ordineTurni(compagni, round) {
  const lista = Array.isArray(compagni) ? compagni.slice(0, PODCAST_LIMITI.MAX_COMPAGNI) : [];
  const giri = fra(round, PODCAST_LIMITI.MIN_ROUND, PODCAST_LIMITI.MAX_ROUND);
  const turni = [];
  let ordine = 0;
  for (let r = 0; r < giri; r++) {
    for (const c of lista) {
      turni.push({ ordine: ordine++, round: r + 1, compagnoId: c.id });
    }
  }
  return turni;
}

/**
 * Il prompt di UN turno, pronto per callLLM.
 * @param compagno       il Compagno di turno (con .personalita, .nome)
 * @param argomento      il tema del podcast
 * @param round          round corrente (1-based)
 * @param totaleRound    quanti round in tutto
 * @param precedenti     [{nome, testo}] cosa hanno detto gli altri finora
 * @param lingua         lingua in cui far generare (poi si traduce comunque)
 * @returns {{system:string, user:string}}
 */
export function promptTurno({ compagno, argomento, round = 1, totaleRound = 1, precedenti = [], lingua = 'it' } = {}) {
  const nome = (compagno && compagno.nome) || 'Ospite';
  const persona = (compagno && compagno.personalita) || '';
  const altri = (precedenti || [])
    .filter(p => p && p.testo)
    .map(p => `${p.nome}: ${p.testo}`)
    .join('\n\n');

  const system =
`${persona}

Sei ${nome}, ospite di un podcast/dibattito insieme ad altri esperti. Parli in prima persona, con la tua voce e il tuo punto di vista. Sii coinvolgente e conciso. Rispondi nella lingua: ${lingua}.

REGOLA DEL DIBATTITO (vale su tutto il resto): qui porti SEMPRE una tua posizione argomentata sull'argomento, guardandolo dal tuo angolo particolare. Non startene in silenzio, non rispondere che "non c'è nulla da dire/verificare", non limitarti a fare domande: contribuisci con un punto di vista, anche quando l'argomento esce dal tuo ruolo abituale.${involucroCompagno({ liberta: compagno && compagno.liberta, capacita: { ricerca: false, fonti: false, memoria: false } })}`;

  const cornice = round === 1
    ? `L'argomento del podcast è: "${argomento}". Presenta la tua posizione iniziale in modo appassionato e chiaro. Massimo 3 brevi paragrafi.`
    : `Siamo al round ${round} di ${totaleRound} sul tema "${argomento}". Rispondi a ciò che hanno detto gli altri, aggiungi un punto nuovo o una domanda provocatoria. Massimo 2 brevi paragrafi.`;

  const user = altri
    ? `${cornice}\n\nCosa hanno detto finora gli altri:\n${altri}`
    : cornice;

  return { system, user };
}

/**
 * Validazione di partenza: un podcast ha senso con almeno 2 Compagni e un
 * argomento. Ritorna { ok } oppure { ok:false, motivo }.
 */
export function validaPodcast({ compagni, argomento } = {}) {
  if (!argomento || !String(argomento).trim()) return { ok: false, motivo: 'argomento-mancante' };
  const n = Array.isArray(compagni) ? compagni.length : 0;
  if (n < PODCAST_LIMITI.MIN_COMPAGNI) return { ok: false, motivo: 'pochi-compagni' };
  return { ok: true };
}
