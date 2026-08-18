// ═══════════════════════════════════════════════════════════════
// MODERAZIONE DELLA PIAZZA — segnalare, nascondere, riaprire (Luca, b.244)
//
// Mondo aveva account, nickname, discussioni persistenti… e nessun freno:
// nessuna segnalazione, nessun blocco, e un campo `hidden` sui commenti che
// nessun endpoint sapeva accendere. In uno spazio pubblico è il buco più
// serio che ci fosse.
//
// LE REGOLE, decise con Luca:
//  · a 3 segnalazioni un contenuto si nasconde DA SÉ (e chiunque può
//    segnalare, una volta sola: lo garantisce la chiave primaria);
//  · a mano possono moderare due persone soltanto — l'amministratore, e chi
//    ha aperto la discussione (a casa propria si fa ordine);
//  · nascondere NON cancella: si può riaprire, e per l'archiviazione
//    automatica resta il lavoro pigro che c'era già.
//
// Nascondere e non cancellare è una scelta: un moderatore che sbaglia deve
// poter tornare indietro, e un contenuto rimosso per sempre non lascia
// verificare l'errore.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from './supabase.js';
import { createLogger } from './logger.js';

const log = createLogger('moderazione-mondo');

/** Quante segnalazioni servono perché un contenuto si nasconda da solo. */
export const SOGLIA_NASCONDI = 3;

const TIPI = { discussione: 'mondo_discussions', commento: 'mondo_comments', corso: 'corsi_pubblici' };

/** Il tipo è uno dei tre che conosciamo? */
export function tipoValido(tipo) {
  return Object.prototype.hasOwnProperty.call(TIPI, tipo);
}

/**
 * Chi può moderare a mano: l'amministratore, oppure l'autore del contenuto.
 * PURA: la si prova senza database.
 * @param {string} idUtente      impronta pubblica di chi chiede
 * @param {string} idAutore      impronta pubblica di chi ha scritto
 * @param {string} emailUtente   email di sessione (per il confronto con l'admin)
 * @param {string} emailAdmin    ADMIN_EMAIL della piattaforma
 */
export function puoModerareContenuto({ idUtente, idAutore, emailUtente, emailAdmin } = {}) {
  const admin = !!emailAdmin && !!emailUtente
    && String(emailUtente).trim().toLowerCase() === String(emailAdmin).trim().toLowerCase();
  const autore = !!idUtente && !!idAutore && idUtente === idAutore;
  return admin || autore;
}

/**
 * Registra una segnalazione e, se si è raggiunta la soglia, nasconde.
 * Una persona può segnalare lo stesso contenuto una volta sola.
 * @returns {{ok:boolean, segnalazioni:number, nascosto:boolean}}
 */
export async function segnala({ tipo, contenuto, segnalante, motivo = '' } = {}) {
  const sb = getSupabaseAdmin();
  if (!sb || !tipoValido(tipo) || !contenuto || !segnalante) return { ok: false, segnalazioni: 0, nascosto: false };

  // upsert e non insert: risegnalare non è un errore, semplicemente non conta due volte.
  const { error } = await sb.from('mondo_segnalazioni').upsert({
    tipo, contenuto: String(contenuto), segnalante,
    motivo: String(motivo || '').slice(0, 300),
  }, { onConflict: 'tipo,contenuto,segnalante' });
  if (error) { log.warn('segnalazione non salvata:', error.message); return { ok: false, segnalazioni: 0, nascosto: false }; }

  const { count } = await sb.from('mondo_segnalazioni')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', tipo).eq('contenuto', String(contenuto));
  const segnalazioni = count || 0;

  let nascosto = false;
  if (segnalazioni >= SOGLIA_NASCONDI) {
    nascosto = await impostaVisibilita({ tipo, contenuto, nascondi: true });
    if (nascosto) log.info('contenuto nascosto dalle segnalazioni', { tipo, contenuto, segnalazioni });
  }
  return { ok: true, segnalazioni, nascosto };
}

/** Accende o spegne `hidden` sul contenuto. */
export async function impostaVisibilita({ tipo, contenuto, nascondi = true } = {}) {
  const sb = getSupabaseAdmin();
  if (!sb || !tipoValido(tipo) || !contenuto) return false;
  const { error } = await sb.from(TIPI[tipo]).update({ hidden: !!nascondi }).eq('id', String(contenuto));
  if (error) { log.warn('visibilità non aggiornata:', error.message); return false; }
  return true;
}

/** L'autore di un contenuto (per sapere se chi chiede può moderarlo). */
export async function autoreDi({ tipo, contenuto } = {}) {
  const sb = getSupabaseAdmin();
  if (!sb || !tipoValido(tipo) || !contenuto) return null;
  const colonna = tipo === 'corso' ? 'owner' : 'author_user_id';
  const { data, error } = await sb.from(TIPI[tipo]).select(colonna).eq('id', String(contenuto)).maybeSingle();
  if (error || !data) return null;
  return data[colonna] || null;
}

/** Quante segnalazioni ha preso un contenuto (per la vista di chi modera). */
export async function contaSegnalazioni({ tipo, contenuto } = {}) {
  const sb = getSupabaseAdmin();
  if (!sb || !tipoValido(tipo) || !contenuto) return 0;
  const { count } = await sb.from('mondo_segnalazioni')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', tipo).eq('contenuto', String(contenuto));
  return count || 0;
}
