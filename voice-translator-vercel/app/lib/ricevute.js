import { redis } from './redis.js';
import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════
// RICEVUTE — "questo pezzo l'ho gia pagato", detto dal server a se stesso
//
// Parlare e poi essere tradotti e UN gesto solo, ma passa da due rotte:
// /api/transcribe (l'audio) e /api/translate (il testo). La seconda non
// deve riaddebitare quello che ha gia pagato la prima.
//
// Fino a b.106 lo dichiarava il CLIENT, con un `giaAddebitato: true` nel
// corpo della richiesta. Che vuol dire: chiunque poteva scriverlo su ogni
// messaggio e tradurre gratis per sempre. Una riga di codice nel browser.
//
// Ora la prima rotta lascia una ricevuta e la seconda la strappa. Il
// client non ha piu voce in capitolo.
//
// TRE PROPRIETA che la rendono sicura:
//  · e legata a CHI PAGA: la ricevuta di uno non vale per un altro
//  · e legata al TESTO: non copre una frase diversa da quella trascritta
//  · si strappa: la prima traduzione la consuma, la seconda paga
//
// Dura sessanta secondi: il tempo di completare il giro fra le due
// chiamate, non abbastanza per essere riusata piu tardi.
// ═══════════════════════════════════════════════════════════════

// ═══ b.633 — UNA RICEVUTA SOLA PER DUE FRASI UGUALI: SI PAGAVA DUE VOLTE ═══
//
// Trovato dal secondo revisore della bonifica, e verificato: la chiave
// e sha256(pagante|testo). Due frasi IDENTICHE dello stesso utente
// dentro i sessanta secondi producono la STESSA chiave — e la ricevuta
// era un interruttore (SET '1' / DEL), non un contatore. Quindi:
//
//   parlo «si» → transcribe addebita la voce, SET ricevuta
//   parlo «si» → transcribe addebita la voce, SET la STESSA ricevuta
//   traduco #1 → DEL: gratis, giusto
//   traduco #2 → DEL torna 0: PAGA il testo, sopra la voce gia pagata
//
// Due voci e un testo, per due gesti che ne valevano due voci e basta.
// E non e un caso di laboratorio: in una conversazione tradotta «si»,
// «ok», «grazie», «pronto» si ripetono di continuo, e il minuto di vita
// della ricevuta li copre tutti.
//
// Adesso la ricevuta e un CONTATORE: ogni addebito ne aggiunge una, ogni
// traduzione ne toglie una. N trascrizioni pagate = N traduzioni gratis.
// La proprieta che b.107 difendeva resta identica — una ricevuta vale
// una volta sola, e il client non ha voce in capitolo — ma adesso vale
// una volta sola CIASCUNA, invece che una volta sola in tutto.
const VITA = 60; // secondi

// Il testo non si conserva in chiaro: basta la sua impronta per
// riconoscerlo, e cosi nel registro non finisce quello che si e detto.
function chiave(pagante, testo) {
  const impronta = createHash('sha256')
    .update(`${pagante}|${(testo || '').trim().slice(0, 500)}`)
    .digest('hex').slice(0, 32);
  return `ricevuta:voce:${impronta}`;
}

/** Emessa da /api/transcribe subito dopo aver addebitato l'audio. */
export async function ricevutaVoce(pagante, testo) {
  if (!pagante || !testo) return false;
  const k = chiave(pagante, testo);
  // b.633 — INCR, non SET: la seconda frase uguale AGGIUNGE una ricevuta
  // invece di sovrascrivere l'unica che c'era.
  await redis('INCR', k);
  // La vita si rinfresca a ogni emissione: sessanta secondi dall'ultima
  // voce pagata, che e la finestra che deve coprire il suo giro.
  await redis('EXPIRE', k, VITA);
  return true;
}

/**
 * Consumata da /api/translate. Ne strappa UNA: se ce ne sono tre (tre
 * voci uguali gia pagate), le prime tre traduzioni sono gratis e la
 * quarta paga. Una ricevuta vale sempre una volta sola — b.633 ne
 * cambia il numero, non la regola.
 *
 * Torna { pagata, sistemaGiu }:
 *  · pagata     — c'era una ricevuta e l'ho consumata
 *  · sistemaGiu — non ho potuto SAPERLO (Redis irraggiungibile)
 *
 * b.633 — QUELLA SECONDA VOCE E LA DIFFERENZA FRA «non risulta pagato»
 * e «non lo so». Prima erano la stessa cosa: un DEL che esplodeva
 * tornava `false` come un DEL a vuoto, e /api/translate addebitava il
 * testo SOPRA la voce gia addebitata. Con Redis giu — e le scritture,
 * a differenza delle letture, si rilanciano apposta (redis.js, b.566) —
 * OGNI messaggio vocale si pagava due volte, in silenzio.
 */
export async function strappaRicevutaVoce(pagante, testo) {
  if (!pagante || !testo) return { pagata: false, sistemaGiu: false };
  const k = chiave(pagante, testo);
  try {
    // DECR e atomico: due traduzioni concorrenti dello stesso testo non
    // possono consumare la stessa ricevuta.
    const n = parseInt(await redis('DECR', k), 10);
    if (Number.isFinite(n) && n >= 0) return { pagata: true, sistemaGiu: false };
    // Sotto zero: non c'era nessuna ricevuta da strappare. Si toglie di
    // mezzo la chiave negativa appena creata dal DECR, che altrimenti
    // resterebbe li senza scadenza.
    await redis('DEL', k).catch(() => {});
    return { pagata: false, sistemaGiu: false };
  } catch (e) {
    return { pagata: false, sistemaGiu: true, motivo: e?.message };
  }
}
