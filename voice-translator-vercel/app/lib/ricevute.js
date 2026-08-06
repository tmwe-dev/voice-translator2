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
  await redis('SET', chiave(pagante, testo), '1', 'EX', VITA);
  return true;
}

/**
 * Consumata da /api/translate. Restituisce true UNA sola volta per
 * ricevuta: il DEL la strappa, cosi una seconda traduzione dello stesso
 * testo paga come deve.
 */
export async function strappaRicevutaVoce(pagante, testo) {
  if (!pagante || !testo) return false;
  const k = chiave(pagante, testo);
  const c = await redis('DEL', k);
  return c === 1 || c === '1';
}
