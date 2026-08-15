// ═══════════════════════════════════════════════════════════════
// REGALI — Un utente regala minuti a un altro.
//
// Flusso in 2 passi, ciascuno atomico dentro il database:
//   1. inviaRegalo: wallet_regala verifica il saldo, crea il
//      codice-regalo e scala il credito — in una sola transazione
//      (blocco advisory come wallet_usa, migration 008).
//   2. il codice viaggia in un link di invito
//   3. riscattaRegalo: wallet_riscatta_regalo marca il regalo come
//      riscattato E accredita i secondi — sempre in una sola
//      transazione, cosi non puo restare "riscattato ma non
//      accreditato" se qualcosa si interrompe a meta.
//
// b.157 — PRIMA questi tre passi vivevano in chiamate JS separate
// (leggi saldo -> inserisci il regalo -> scala): due invii
// concorrenti dello stesso utente potevano leggere lo stesso saldo
// di partenza e passare entrambi, portando il wallet sotto zero. E
// se lo scalo falliva DOPO che il regalo era gia stato creato, il
// codice restava valido senza che nessuno fosse stato addebitato.
// Ora tutto il "leggi + verifica + scrivi" vive in una funzione SQL
// sola, con lo stesso lock che gia protegge wallet_usa.
//
// Se nessuno riscatta entro 30 giorni, wallet_rimborsa_regali
// (funzione SQL, da chiamare con un cron) restituisce i secondi.
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

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
 * Crea un regalo. Verifica saldo, crea il codice e scala il credito
 * di chi regala — atomico (wallet_regala, migration 008).
 * Ritorna { ok, codice } oppure { ok: false, motivo }.
 */
export async function inviaRegalo(daUtenteId, secondi, messaggio = '') {
  const importo = Math.round(secondi);
  if (importo < 60) return { ok: false, motivo: 'Minimo 1 minuto' };

  const codice = nuovoCodice();
  const { data, error } = await db()
    .rpc('wallet_regala', { p_user_id: daUtenteId, p_secondi: importo, p_codice: codice, p_messaggio: messaggio });
  if (error) return { ok: false, motivo: 'Errore: ' + error.message };
  if (!data || data.length === 0 || !data[0].ok) {
    return { ok: false, motivo: data?.[0]?.motivo || 'Invio non riuscito' };
  }

  return { ok: true, codice };
}

/**
 * Riscatta un regalo. Solo una volta, non per chi l'ha creato.
 * Marca il regalo E accredita i secondi in un'unica transazione
 * (wallet_riscatta_regalo, migration 008).
 */
export async function riscattaRegalo(aUtenteId, codice) {
  const { data, error } = await db()
    .rpc('wallet_riscatta_regalo', { p_user_id: aUtenteId, p_codice: String(codice).trim().toUpperCase() });
  if (error) return { ok: false, motivo: 'Errore: ' + error.message };
  if (!data || data.length === 0 || !data[0].ok) {
    return { ok: false, motivo: data?.[0]?.motivo || 'Regalo non valido' };
  }

  return { ok: true, secondi: data[0].secondi };
}

/**
 * b.161 — CONFERMATO (quarto audit esterno, punto 8): wallet_rimborsa_regali
 * esisteva gia (migration 004), gia blindata (permessi solo a service_role,
 * migration 006) e gia coperta da un test che verifica quei permessi
 * (wallet-sicurezza-b154.test.js) — ma NULLA la chiamava mai. Nessuna
 * rotta API, nessuna voce in vercel.json. Chi regalava minuti mai
 * riscattati non li rivedeva indietro: restavano scalati per sempre nel
 * suo wallet, senza errore e senza nessun segnale.
 *
 * Rimborsa (atomico, dentro la funzione SQL stessa: marca rimborsato E
 * accredita in un colpo solo) tutti i regali non riscattati da oltre
 * 30 giorni. Da chiamare una volta al giorno (vedi vercel.json).
 * @returns {number} quanti regali sono stati rimborsati in questo giro
 */
export async function rimborsaRegaliScaduti() {
  const { data, error } = await db().rpc('wallet_rimborsa_regali');
  if (error) throw new Error('Rimborso regali fallito: ' + error.message);
  return data ?? 0;
}
