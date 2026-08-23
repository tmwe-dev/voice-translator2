// ═══════════════════════════════════════════════════════════════
// CANCELLARE UN ACCOUNT — una porta sola (b.415)
//
// L'audit esterno: «la cancellazione account/dati centrale elimina
// soprattutto cio che vive in Redis. Nel frattempo esistono dati utente
// anche in Supabase, Life, Compagni, corsi, pronuncia, compiti, Mondo,
// PeepOff, wallet, provider esterni. Serve un unico DELETE USER».
//
// VERIFICATO: era vero. `deleteUserData` toccava profilo, sessione
// corrente, pagamenti, codici, referral e prestiti — tutto e solo su
// Redis. Su Supabase restava tutto: i Compagni, i loro ricordi, i corsi,
// i compiti, il profilo studente, gli errori di pronuncia, i dispositivi
// PeepOff con le loro chiavi pubbliche. E le sessioni aperte sugli ALTRI
// telefoni restavano valide fino alla scadenza naturale, sette giorni.
//
// Qui c'e la catena intera, in un posto solo. Il punto non e scrivere
// piu codice: e che quando qualcuno chiede di sparire, cio che sparisce
// non deve dipendere da quale file si ricordava di esistere.
//
// DUE COSE CHE NON FA, e sono dichiarate perche non siano scoperte per
// caso da un altro audit:
//
//  1. IL PORTAFOGLIO NON SI CANCELLA. Le scritture contabili restano per
//     obbligo di legge — e gia scritto nella risposta all'utente, ed e
//     giusto cosi. Non e una dimenticanza.
//
//  2. I CONTENUTI PUBBLICI DI MONDO NON SI CANCELLANO QUI. Una
//     discussione con dentro le risposte di altre persone non e solo
//     tua: cancellarla porta via anche loro, e anonimizzarla e un'altra
//     cosa ancora. E' una DECISIONE DI PRODOTTO, non una riga di codice,
//     e non la prendo io. Finche non e presa, la risposta all'utente lo
//     dice invece di lasciarglielo credere.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from './supabase.js';
import { redis } from './redis.js';
import { createLogger } from './logger.js';
import { idUtente, idUtenteVecchio } from './compagni/persistenza.js';
import { emailInIndirizzo } from './peepoff/indirizzo.js';

const log = createLogger('cancellazione');

// Le tabelle di Life, con la colonna che porta l'impronta.
const TABELLE_LIFE = [
  ['compagno_memorie', 'owner'],
  ['compagni', 'owner'],
  ['compiti_jobs', 'owner'],
  ['compiti_materiali', 'owner'],
  ['corsi_utente', 'owner'],
  ['imparare_progresso', 'owner'],
  ['imparare_studente', 'owner'],
  ['profilo_studente', 'owner'],
  ['pronuncia_profilo', 'owner'],
];

/**
 * Cancella i dati personali su Supabase.
 *
 * SI CANCELLA SOTTO TUTTE E DUE LE IMPRONTE, e non e una ridondanza:
 * dopo b.413 l'impronta e un HMAC, ma le righe di chi non e ancora
 * tornato hanno ancora quella vecchia. Cancellare solo la nuova
 * lascerebbe indietro proprio i dati di chi non usa l'app da un po' —
 * cioe, con ogni probabilita, di chi sta chiedendo di sparire.
 *
 * @returns {Promise<{cancellati: string[], mancati: string[]}>}
 */
export async function cancellaDatiPersistenti(email) {
  const cancellati = [];
  const mancati = [];
  const sb = getSupabaseAdmin();
  if (!sb || !email) return { cancellati, mancati };

  const impronte = [...new Set([idUtente(email), idUtenteVecchio(email)].filter(Boolean))];

  for (const [tabella, colonna] of TABELLE_LIFE) {
    let fatta = true;
    for (const impronta of impronte) {
      const { error } = await sb.from(tabella).delete().eq(colonna, impronta);
      if (error) { fatta = false; log.warn('cancellazione non riuscita', { tabella, motivo: error.message }); }
    }
    (fatta ? cancellati : mancati).push(tabella);
  }

  // PeepOff non usa l'impronta: usa l'indirizzo `nome#dominio` ricavato
  // dall'email. Dentro ci sono le chiavi pubbliche del dispositivo e la
  // presenza — nessun contenuto, ma e comunque roba della persona.
  const indirizzo = emailInIndirizzo(email);
  if (indirizzo) {
    const a = await sb.from('peepoff_dispositivi').delete().eq('address', indirizzo);
    const b = await sb.from('peepoff_segnali').delete().eq('da_address', indirizzo);
    (!a.error && !b.error ? cancellati : mancati).push('peepoff');
  }

  return { cancellati, mancati };
}

/**
 * REVOCA TUTTE LE SESSIONI, non solo quella da cui stai chiedendo.
 *
 * Prima si cancellava `session:<gettone corrente>` e basta: chi era
 * entrato anche dal telefono restava dentro fino alla scadenza naturale,
 * sette giorni. Per un account che sta venendo cancellato, sette giorni
 * di accesso residuo sono un'eternita.
 *
 * L'elenco delle sessioni per email lo tiene `createSession` (users.js).
 * Se il deposito non risponde, resta valida la cancellazione della
 * sessione corrente — che e cio che si faceva prima, quindi non si
 * peggiora niente.
 */
export async function revocaTutteLeSessioni(email) {
  if (!email) return 0;
  const chiave = `sessioni:${String(email).toLowerCase()}`;
  try {
    const gettoni = await redis('SMEMBERS', chiave);
    if (!Array.isArray(gettoni) || !gettoni.length) return 0;
    for (const g of gettoni) await redis('DEL', `session:${g}`);
    await redis('DEL', chiave);
    return gettoni.length;
  } catch (e) {
    log.warn('revoca sessioni non riuscita', { motivo: e?.message || 'ignoto' });
    return 0;
  }
}
