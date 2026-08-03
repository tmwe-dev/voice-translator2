// ═══════════════════════════════════════════════════════════════
// CONSUMO — Traduce l'uso reale in SECONDI di credito.
//
// Domanda a cui risponde: "l'utente ha appena usato X — quanti
// secondi di credito gli scalo?"
//
// NON tocca il database e NON tocca Stripe. Solo matematica.
// ═══════════════════════════════════════════════════════════════

import { MOLTIPLICATORE_PREMIUM } from './tariffe.js';

// ═══ LE DUE REGOLE DI ADDEBITO ═══
//
// 1. CHAT E VIDEOCHIAMATE SU INVITO (1:1, "parla con chi hai davanti",
//    link di invito): paga CHI HA APERTO la conversazione. L'invitato
//    entra senza account e senza credito.
//    → scalaSeDisponibile(chiHaInvitatoId, ...)
//
// 2. STANZE COMMUNITY (Mondo, stanze pubbliche, social): OGNUNO paga
//    i PROPRI consumi. Chi apre la stanza non paga per gli altri —
//    non inviti 100 persone a tavola e paghi tu.
//    → scalaSeDisponibile(speakerId, ...) per ogni partecipante.

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
