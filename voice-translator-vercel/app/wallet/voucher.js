// ═══════════════════════════════════════════════════════════════
// VOUCHER — Codici promozionali.
//
// Tu crei i codici (da Supabase o dal pannello admin).
// L'utente inserisce il codice → riceve i secondi → riga nel ledger.
// Un codice può avere usi massimi e scadenza. Un utente può usare
// lo stesso codice UNA volta sola (garantito dalla funzione SQL).
//
// b.157 — la riga nel ledger veniva scritta con una SECONDA chiamata
// da JS, dopo che wallet_riscatta_voucher aveva gia marcato il
// codice come usato: un guasto proprio in mezzo lasciava il voucher
// "consumato" senza che nessuno fosse stato accreditato. Ora la
// scrittura vive nella STESSA transazione della funzione SQL
// (migration 008).
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('wallet-voucher');

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/**
 * Riscatta un voucher per un utente.
 * Ritorna { ok: true, secondi } oppure { ok: false, motivo }.
 */
export async function riscattaVoucher(utenteId, codice) {
  const pulito = String(codice || '').trim().toUpperCase();
  if (!pulito) return { ok: false, motivo: 'Codice vuoto' };

  // La funzione SQL fa tutto in un colpo solo (atomico):
  // verifica esistenza, scadenza, usi rimasti, doppio riscatto, E
  // scrive il movimento nel ledger — stessa transazione (migration 008).
  const { data, error } = await db()
    .rpc('wallet_riscatta_voucher', { p_user_id: utenteId, p_codice: pulito });
  // b.363 — il messaggio d'errore del database tornava DRITTO al client:
  // racconta a chi guarda la struttura interna (nomi di funzioni, di colonne,
  // vincoli). Il dettaglio va nel registro, all'utente va una frase.
  if (error) {
    log.error('riscatto voucher fallito', { motivo: error.message });
    return { ok: false, motivo: 'Codice non valido' };
  }
  if (!data || data.length === 0 || !data[0].ok) {
    return { ok: false, motivo: data?.[0]?.motivo || 'Codice non valido' };
  }

  return { ok: true, secondi: data[0].secondi };
}
