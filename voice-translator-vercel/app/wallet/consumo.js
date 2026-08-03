// ═══════════════════════════════════════════════════════════════
// CONSUMO — Traduce l'uso reale in SECONDI di credito.
//
// Domanda a cui risponde: "l'utente ha appena usato X — quanti
// secondi di credito gli scalo?"
//
// NON tocca il database e NON tocca Stripe. Solo matematica.
// ═══════════════════════════════════════════════════════════════

import { MOLTIPLICATORE_PREMIUM } from './tariffe.js';

// ═══ REGOLA FONDAMENTALE: PAGA L'HOST ═══
// Chi crea la stanza (host) paga TUTTA la conversazione, anche i
// secondi parlati dagli invitati. L'invitato entra senza account e
// senza credito. Quindi: ogni addebito va SEMPRE al wallet dell'host
// della stanza, mai a chi sta parlando in quel momento.
// → chiamare sempre: scalaSeDisponibile(hostId, ...) — MAI speakerId.

/**
 * Un pezzo di conversazione vocale.
 * @param {number} secondiParlato - durata dell'audio processato
 * @param {boolean} vocePremium - true se il TTS era ElevenLabs
 * @returns {number} secondi di credito da scalare
 */
export function costoConversazione(secondiParlato, vocePremium) {
  const base = Math.ceil(secondiParlato);
  return vocePremium ? base * MOLTIPLICATORE_PREMIUM : base;
}

/**
 * Un messaggio di solo testo (senza voce).
 * Costa come 5 secondi di conversazione: piccolo ma non zero.
 */
export function costoMessaggioTesto() {
  return 5;
}

/**
 * Sintesi vocale ElevenLabs "a caratteri" (es. riascolto di un messaggio).
 * ElevenLabs fattura a caratteri; ~17 caratteri = 1 secondo di parlato.
 * Applichiamo il moltiplicatore premium come per la conversazione.
 */
export function costoElevenLabsCaratteri(caratteri) {
  const secondiParlato = Math.ceil(caratteri / 17);
  return secondiParlato * MOLTIPLICATORE_PREMIUM;
}

/**
 * Riassunto AI di fine conversazione: costo fisso, 10 secondi.
 */
export function costoRiassunto() {
  return 10;
}
