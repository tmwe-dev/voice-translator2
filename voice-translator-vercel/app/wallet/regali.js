// ═══════════════════════════════════════════════════════════════
// REGALI — Un utente regala minuti a un altro.
//
// Flusso in 3 passi:
//   1. inviaRegalo: scala subito il credito a chi regala e crea
//      un codice-regalo (riga 'regalo_out' nel ledger)
//   2. il codice viaggia in un link di invito
//   3. riscattaRegalo: chi riceve incassa i secondi ('regalo_in')
//
// Se nessuno riscatta entro 30 giorni, wallet_rimborsa_regali
// (funzione SQL, da chiamare con un cron) restituisce i secondi.
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { registraMovimento, saldo } from './contabilita.js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/** Genera un codice regalo leggibile, es. GIFT-7K2Q9D */
function nuovoCodice() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // niente 0/O/1/I/L
  let c = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) c += alfabeto[b % alfabeto.length];
  return 'GIFT-' + c;
}

/**
 * Crea un regalo. Scala subito il credito di chi regala.
 * Ritorna { ok, codice } oppure { ok: false, motivo }.
 */
export async function inviaRegalo(daUtenteId, secondi, messaggio = '') {
  const importo = Math.round(secondi);
  if (importo < 60) return { ok: false, motivo: 'Minimo 1 minuto' };

  const disponibile = await saldo(daUtenteId);
  if (disponibile < importo) return { ok: false, motivo: 'Credito insufficiente' };

  const codice = nuovoCodice();
  const { error } = await db().from('gifts').insert({
    codice, da_user_id: daUtenteId, secondi: importo, messaggio,
  });
  if (error) return { ok: false, motivo: 'Errore: ' + error.message };

  await registraMovimento(daUtenteId, 'regalo_out', -importo, { codice });
  return { ok: true, codice };
}

/**
 * Riscatta un regalo. Solo una volta, non per chi l'ha creato.
 */
export async function riscattaRegalo(aUtenteId, codice) {
  const { data, error } = await db()
    .rpc('wallet_riscatta_regalo', { p_user_id: aUtenteId, p_codice: String(codice).trim().toUpperCase() });
  if (error) return { ok: false, motivo: 'Errore: ' + error.message };
  if (!data || data.length === 0 || !data[0].ok) {
    return { ok: false, motivo: data?.[0]?.motivo || 'Regalo non valido' };
  }

  const secondi = data[0].secondi;
  await registraMovimento(aUtenteId, 'regalo_in', secondi, { codice });
  return { ok: true, secondi };
}
