// ═══════════════════════════════════════════════════════════════
// IL REGISTRO DELLE VISITE (b.628)
//
// A che serve. L'audit della b.627 si e chiuso con una domanda senza
// risposta: quali delle 84 rotte non serve piu a nessuno? Il codice
// dice chi PUO essere chiamato; per sapere chi VIENE chiamato serve il
// traffico vero — e su Vercel il traffico vero si perde, perche i
// registri durano un giorno e una rotta che lavora una volta al mese,
// in un giorno, non si vede. Il Protocollo su questo non lascia scelta:
// «due settimane dichiarano morto tutto cio che vive a trimestre».
//
// Quindi il conto si tiene dove non si dimentica: una riga per rotta
// in Supabase (migrazione 015), con il primo e l'ultimo passaggio.
//
// COSA NON REGISTRA. Nessuna persona, nessun indirizzo, nessun
// contenuto: solo il nome della rotta. Non e un registro di chi
// naviga, e l'elenco delle porte ancora usate.
//
// TRE REGOLE, e sono tutte e tre «non disturbare»:
//   1. non si aspetta   — la richiesta dell'utente non rallenta di un
//                         millisecondo: si parte e si lascia andare;
//   2. non si lamenta   — se il registro non risponde, pazienza: un
//                         conteggio perso non vale un errore in faccia
//                         a chi sta traducendo;
//   3. non insiste      — una sola scrittura per richiesta, senza
//                         ritentativi: e una misura, non un pagamento.
// ═══════════════════════════════════════════════════════════════

import { createLogger } from './logger.js';

const log = createLogger('registroRotte');

// Una rotta sola puo essere chiamata molte volte al secondo (la
// campanella, il polling dei messaggi). Non serve scrivere ogni volta
// per sapere se e viva: basta sapere CHE e viva. Si scrive al massimo
// una volta al minuto per rotta, per istanza — il conteggio resta
// indicativo, la data dell'ultimo passaggio resta esatta al minuto, e
// il database non prende una raffica per niente.
const FINESTRA_MS = 60_000;
const ultimoInvio = new Map();

/** Il nome della rotta dalla richiesta: solo il percorso, mai la query. */
export function nomeRotta(req) {
  try {
    return new URL(req.url).pathname || '?';
  } catch {
    return '?';
  }
}

/**
 * Segna che qualcuno e passato di qui. Non si attende: chi chiama
 * prosegue subito.
 */
export function segnaVisita(rotta) {
  if (!rotta || rotta === '?') return;

  const adesso = Date.now();
  const precedente = ultimoInvio.get(rotta) || 0;
  if (adesso - precedente < FINESTRA_MS) return;
  ultimoInvio.set(rotta, adesso);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chiave) return;   // senza registro non si rompe niente

  // fuoco e dimentica: nessun await da parte di chi chiama
  fetch(`${url}/rest/v1/rpc/segna_visita_rotta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: chiave,
      Authorization: `Bearer ${chiave}`,
    },
    body: JSON.stringify({ p_rotta: rotta }),
  }).catch((e) => {
    // il registro che non risponde non e un guasto del prodotto:
    // resta scritto qui, e non arriva mai all'utente.
    log.warn('visita non registrata', { rotta, motivo: e?.message });
  });
}
