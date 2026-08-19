// ═══════════════════════════════════════════════════════════════
// b.282 — CREDENZIALI TEMPORANEE PER IL RELAY (coturn, REST auth)
//
// Il relay proprio (coturn su una macchina nostra) non deve avere una
// password fissa dentro il JavaScript del sito: chiunque la leggerebbe
// e userebbe il nostro ponte gratis. Lo schema e quello che coturn
// chiama "REST API auth" (use-auth-secret):
//
//   nome utente  = scadenza-unix (+ un'etichetta)
//   password     = base64( HMAC-SHA1( segreto, nome utente ) )
//
// Il SEGRETO vive solo sul server (variabile TURN_SECRET, mai
// NEXT_PUBLIC): il telefono riceve una coppia che vale poche ore e poi
// muore da sola. Coturn, che conosce lo stesso segreto, verifica senza
// bisogno di un database di utenti.
// ═══════════════════════════════════════════════════════════════
import { createHmac } from 'crypto';

/**
 * @param {string} segreto   TURN_SECRET, condiviso col coturn (static-auth-secret)
 * @param {string[]} urls    gli indirizzi del relay (turn:/turns:)
 * @param {number} ttlSecondi durata della coppia (default 4 ore)
 * @returns {{username:string, credential:string, urls:string[], scadenza:number}}
 */
export function generaCredenzialiTURN(segreto, urls, ttlSecondi = 4 * 3600) {
  const scadenza = Math.floor(Date.now() / 1000) + ttlSecondi;
  const username = `${scadenza}:bartalk`;
  const credential = createHmac('sha1', segreto).update(username).digest('base64');
  return { username, credential, urls, scadenza };
}
