// ═══════════════════════════════════════════════════════════════
// CONTABILITÀ — Il registro dei crediti (ledger).
//
// UNA regola sola: ogni movimento è una riga nella tabella
// credit_ledger. Il saldo è la somma delle righe. Fine.
//
// Tipi di movimento:
//   'acquisto'  → +secondi (da Stripe)
//   'benvenuto' → +secondi (bonus primo accesso)
//   'voucher'   → +secondi (codice promozionale)
//   'regalo_in' → +secondi (ricevuto da un amico)
//   'regalo_out'→ -secondi (regalato a un amico)
//   'omaggio'   → +secondi (regalo dell'admin dal pannello Sesamo)
//   'uso'       → -secondi (conversazione, TTS, riassunto)
//
// Questo file parla SOLO con Supabase. Niente Stripe qui dentro.
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

function db() {
  // Service role: solo lato server. Mai esporre al client.
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/**
 * Scrive un movimento nel registro.
 * @param {string} utenteId - id utente (email o user id)
 * @param {string} tipo - uno dei tipi elencati sopra
 * @param {number} secondi - positivo per accrediti, negativo per addebiti
 * @param {object} dettaglio - info extra (es. { pacchetto: 'pack_m' })
 */
export async function registraMovimento(utenteId, tipo, secondi, dettaglio = {}) {
  const { error } = await db().from('credit_ledger').insert({
    user_id: utenteId,
    tipo,
    secondi: Math.round(secondi),
    dettaglio,
  });
  if (error) throw new Error('Ledger: ' + error.message);
}

/**
 * b.154 — come registraMovimento, ma per gli acquisti Stripe: se lo
 * stesso Stripe Session ID è già stato accreditato (indice unico
 * `idx_ledger_stripe_session`, migration 007), NON accredita di
 * nuovo — ritorna { duplicato: true } invece di lanciare, cosi il
 * webhook può rispondere comunque 200 a Stripe (altrimenti Stripe
 * ritenta all'infinito un evento che in realtà è già a posto).
 *
 * Questo esiste perché il webhook Stripe può consegnare lo stesso
 * evento più di una volta (retry, resend manuale, doppio deploy): la
 * garanzia vive nel vincolo DB, non in un controllo JS che una corsa
 * fra due richieste concorrenti potrebbe aggirare.
 */
export async function registraAcquistoStripe(utenteId, secondi, dettaglio) {
  const { error } = await db().from('credit_ledger').insert({
    user_id: utenteId,
    tipo: 'acquisto',
    secondi: Math.round(secondi),
    dettaglio,
  });
  if (error) {
    // 23505 = violazione di vincolo unico: questo Stripe Session ID
    // è già stato accreditato. Non è un errore, è la prova che ha
    // già funzionato una volta.
    if (error.code === '23505') return { duplicato: true };
    throw new Error('Ledger acquisto: ' + error.message);
  }
  return { duplicato: false };
}

/**
 * Saldo attuale = somma di tutti i movimenti.
 */
export async function saldo(utenteId) {
  const { data, error } = await db()
    .rpc('wallet_saldo', { p_user_id: utenteId });
  if (error) throw new Error('Saldo: ' + error.message);
  return data || 0;
}

/**
 * Uso di oggi e del mese corrente (solo movimenti negativi, in positivo).
 */
export async function usoOggiEMese(utenteId) {
  const { data, error } = await db()
    .rpc('wallet_uso', { p_user_id: utenteId });
  if (error) throw new Error('Uso: ' + error.message);
  return { oggi: data?.[0]?.oggi || 0, mese: data?.[0]?.mese || 0 };
}

/**
 * Storico acquisti (per la pagina Profilo).
 */
export async function storicoAcquisti(utenteId, limite = 50) {
  const { data, error } = await db()
    .from('credit_ledger')
    .select('created_at, tipo, secondi, dettaglio')
    .eq('user_id', utenteId)
    .in('tipo', ['acquisto', 'voucher', 'regalo_in', 'benvenuto', 'omaggio'])
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw new Error('Storico: ' + error.message);
  return data || [];
}

/**
 * Scala il credito per un uso, MA solo se il saldo basta.
 * Ritorna true se scalato, false se credito insufficiente.
 * (Il controllo+scrittura atomici vivono nella funzione SQL wallet_usa.)
 */
export async function scalaSeDisponibile(utenteId, secondi, dettaglio = {}) {
  const { data, error } = await db()
    .rpc('wallet_usa', { p_user_id: utenteId, p_secondi: Math.round(secondi), p_dettaglio: dettaglio });
  if (error) throw new Error('Scala: ' + error.message);
  return data === true;
}
