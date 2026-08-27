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
import { profiloEffettivo } from './profili.js';
import { regoleDibattito, bloccoRegolaDibattito, kbVoceParlata } from './orchestratore.js';

export const PODCAST_LIMITI = {
  MIN_COMPAGNI: 2,
  MAX_COMPAGNI: 4,
  MIN_ROUND: 1,
  // b.236 — abbassato a 4: con 4 Compagni erano 40 turni SEQUENZIALI dentro
  // un limite di 60 secondi, e il podcast moriva a metà avendo già addebitato.
  // b.244 — RIALZATO a 10: il motivo del taglio era il timeout, e il timeout
  // non c'è più. Ora il client chiede UN TURNO per volta e li incatena da sé:
  // nessuna richiesta può scadere, qualunque sia la lunghezza del podcast.
  MAX_ROUND: 10,
  ROUND_PREDEFINITI: 4,
};

// ── b.409 · QUANTE RICHIESTE PUO' FARE UN PODCAST ONESTO ──
//
// In b.244 il podcast e passato da UNA richiesta per tutto a UNA
// RICHIESTA PER TURNO: era la cura giusta per i timeout. Ma il tetto di
// frequenza della rotta e rimasto quello di prima — dieci al minuto —
// cioe un numero dimensionato per un'architettura che non esiste piu.
//
// Il contratto della rotta permette MAX_COMPAGNI x MAX_ROUND turni, piu
// la richiesta finale che dice «e finita». Il tetto lo si RICAVA da li,
// non lo si sceglie: se domani qualcuno alza MAX_ROUND, il tetto lo
// segue da solo e nessuno deve ricordarsene.
//
// QUANDO SI VEDEVA. Non sempre — ed e giusto dirlo: mentre la voce
// parla, fra un turno e l'altro passano dieci-venti secondi, e in un
// minuto ci stanno tre o quattro richieste. Ma quando la voce NON parte
// (credito della voce premium finito, fornitore giu, riproduzione
// negata dal telefono, suoneria in silenzioso) il giro resta solo
// generazione: due-quattro secondi a turno, quindi quindici-trenta
// richieste al minuto. Cioe il 429 arrivava addosso a chi stava gia
// avendo una giornata storta, e il podcast si fermava a meta.
//
// Il tetto per IP resta una rete anti-abuso — deve stare SOPRA il flusso
// legittimo, non tagliarlo.
export const PODCAST_RICHIESTE_MAX =
  PODCAST_LIMITI.MAX_COMPAGNI * PODCAST_LIMITI.MAX_ROUND   // i turni possibili
  + 1                                                       // la richiesta che chiude
  + 8;                                                      // margine per ritentativi

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
export function promptTurno({ compagno, argomento, round = 1, totaleRound = 1, precedenti = [], lingua = 'it', convergenza = '' } = {}) {
  const nome = (compagno && compagno.nome) || 'Ospite';
  const persona = (compagno && compagno.personalita) || '';
  const altri = (precedenti || [])
    .filter(p => p && p.testo)
    .map(p => `${p.nome}: ${p.testo}`)
    .join('\n\n');

  const system =
`${persona}

Sei ${nome}, in un podcast a piu voci, IN TEMPO REALE, come persone vere al bar — non in un'aula. Parli in prima persona, con la tua voce. Rispondi nella lingua: ${lingua}.

${regoleDibattito(lingua)}${bloccoRegolaDibattito(compagno)}${convergenza ? `\n${convergenza}` : ''}
Quando hai una posizione fondata, dilla BREVE e viva: quando ti aggancia una frase di un altro, nominalo e reagisci a QUELLA. Niente monologhi. Se su questo giro non hai nulla di fondato, va bene dirlo in una riga e passare: al bar succede.${involucroCompagno({ liberta: compagno && compagno.liberta, capacita: { ricerca: false, fonti: false, memoria: false }, profilo: profiloEffettivo(compagno, 'podcast'), esitoTipizzato: true })}\n\n${kbVoceParlata(lingua)}`;

  // b.303 — turni BREVI e umani (come RadioChat): 2-4 frasi, non paragrafi.
  const cornice = round === 1
    ? `Il tema e: "${argomento}". Apri con la TUA posizione, viva e diretta: 2-3 frasi, come parlando, non un saggio.`
    : `Round ${round} di ${totaleRound} su "${argomento}". Aggancia UNA cosa detta da un altro (nominalo), reagisci e aggiungi il TUO punto. Massimo 2-3 frasi. A volte basta una battuta secca.`;

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
