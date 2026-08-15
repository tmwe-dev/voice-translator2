// ═══════════════════════════════════════════════════════════════
// RISERVA — RESERVE → PROVIDER → COMMIT/RELEASE (b.161-bis, punto 5)
//
// Il preventivo pre-chiamata (creditoInsufficiente, b.161 punto 1)
// chiude il bypass RIPETIBILE ma non la finestra di CORSA: due
// richieste concorrenti leggono lo stesso saldo, passano entrambe il
// preventivo, e solo l'addebito finale (atomico) le distingue — la
// seconda torna "esaurito" ma il fornitore, per lei, e gia stato
// chiamato una volta di troppo.
//
// Queste tre funzioni sostituiscono, dove usate, il vecchio schema
// "controlla poi chiama poi addebita" con uno atomico:
//   riserva(costoPrevisto)  → blocca il saldo SUBITO, prima del fornitore
//   ... chiamata al fornitore ...
//   commit(riservaId, costoReale)  → se il fornitore ha risposto
//   release(riservaId)             → se il fornitore e fallito
//
// Filosofia fail-closed per la riserva stessa (coerente con la voce
// premium ElevenLabs, il voucher admin, la clonazione): se il database
// non risponde alla riserva, si BLOCCA — l'intero punto di questa
// funzione e essere la difesa piu affidabile che il wallet abbia,
// fare fail-open qui vorrebbe dire riaprire esattamente la falla che
// dovrebbe chiudere.
//
// b.164 — nota architetturale (osservazione dell'utente dopo b.163, non
// un bug: la riga 'riserva' e per definizione provvisoria). La riga di
// credit_ledger creata da wallet_riserva() e MUTABILE finche la riserva
// e 'attiva': wallet_commit/wallet_release la aggiornano in place fino
// al suo stato finale ('uso' o 'rilascio'). Questa e la reservation
// OPERATIVA — serve a bloccare il saldo subito e a far quadrare la
// reportistica (migrazione 011) senza una seconda riga di rettifica.
// Non e un ledger finanziario append-only in senso stretto: una riga
// 'attiva' puo ancora cambiare id-di-stato prima di chiudersi. Per una
// certificazione da audit finanziario puro (nessuna riga mai
// modificata, solo inserita) servirebbe una tabella separata,
// popolata SOLO da wallet_commit/wallet_release al momento della
// chiusura definitiva — un cambio di modello dati, non una
// correzione: va deciso, non e implicito in questo modulo.
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/**
 * Blocca atomicamente `secondiPrevisti` sul wallet di `utente`, PRIMA
 * di chiamare il fornitore. Se un'altra richiesta concorrente ha gia
 * ridotto il saldo (anche di un millisecondo), questa vede il saldo
 * gia ridotto e puo rifiutare correttamente.
 *
 * @returns {{ok: true, riservaId: number} | {ok: false, motivo: string}}
 */
export async function riserva(utente, secondiPrevisti, dettaglio = {}) {
  if (!utente) return { ok: false, motivo: 'utente mancante' };
  const importo = Math.ceil(secondiPrevisti);
  if (!Number.isFinite(importo) || importo <= 0) return { ok: false, motivo: 'importo non valido' };
  try {
    const { data, error } = await db().rpc('wallet_riserva', {
      p_user_id: utente, p_secondi: importo, p_dettaglio: dettaglio,
    });
    if (error) return { ok: false, motivo: 'errore db: ' + error.message };
    const r = data?.[0];
    if (!r?.ok) return { ok: false, motivo: r?.motivo || 'riserva rifiutata' };
    return { ok: true, riservaId: r.riserva_id };
  } catch (e) {
    // b.161-bis — fail-closed di proposito: vedi commento in testa al file.
    return { ok: false, motivo: 'errore: ' + e.message };
  }
}

/**
 * Conferma la riserva al costo VERO (dopo che il fornitore ha
 * risposto con successo). Se il costo reale e inferiore alla riserva,
 * la differenza torna nel wallet automaticamente. Non blocca mai
 * l'utente (l'addebito e gia avvenuto con la riserva): un errore qui
 * viene solo loggato, mai propagato — coerente con "l'addebito non
 * deve mai far cadere una risposta gia pronta".
 */
export async function commit(riservaId, secondiReali, dettaglio = {}) {
  if (!riservaId) return;
  try {
    const importo = Math.max(0, Math.round(secondiReali ?? 0));
    const { error } = await db().rpc('wallet_commit', {
      p_riserva_id: riservaId, p_secondi_reali: importo, p_dettaglio: dettaglio,
    });
    if (error) console.error('[wallet] commit riserva fallito:', riservaId, error.message);
  } catch (e) {
    console.error('[wallet] commit riserva fallito:', riservaId, e.message);
  }
}

/**
 * Restituisce l'INTERA riserva (il fornitore e fallito, o la
 * richiesta si e interrotta prima di sapere l'esito). Va chiamata
 * SEMPRE nel ramo di errore di ogni chiamata provider che ha fatto
 * una riserva — altrimenti il credito resta bloccato fino alla
 * pulizia periodica (wallet_rilascia_riserve_scadute, 10 minuti).
 */
export async function release(riservaId, motivo = '') {
  if (!riservaId) return;
  try {
    const { error } = await db().rpc('wallet_release', { p_riserva_id: riservaId, p_motivo: motivo });
    if (error) console.error('[wallet] release riserva fallito:', riservaId, error.message);
  } catch (e) {
    console.error('[wallet] release riserva fallito:', riservaId, e.message);
  }
}
