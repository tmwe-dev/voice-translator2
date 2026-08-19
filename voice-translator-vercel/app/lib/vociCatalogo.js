// ═══════════════════════════════════════════════════════════════
// CATALOGO VOCI PER LINGUA — curato dal backend (b.262, Luca 19/8)
//
// Prima il selettore mostrava TUTTE le voci ElevenLabs (103): inutilizzabile
// e fuori controllo. Ora il backend decide quali voci esistono per ciascuna
// lingua, e quale e la PREDEFINITA di sistema (per genere).
//
// Regola di ripiego dichiarata: una lingua senza righe in tabella si
// comporta come prima (elenco pieno nel selettore, predefinite cablate in
// tts-elevenlabs). Cosi la curatela si fa lingua per lingua senza mai
// rompere quelle non ancora toccate.
// ═══════════════════════════════════════════════════════════════
import { getSupabaseAdmin } from './supabase.js';
import { createLogger } from './logger.js';

const log = createLogger('vociCatalogo');

/** Le voci approvate per una lingua, in ordine. [] = lingua non curata. */
export async function vociPerLingua(lang) {
  const sb = getSupabaseAdmin();
  if (!sb || !lang) return [];
  const base = String(lang).split(/[-_]/)[0];
  const { data, error } = await sb.from('voci_lingue')
    .select('voice_id, nome, genere, predefinita, ordine')
    .eq('lang', base)
    .order('ordine', { ascending: true });
  if (error) { log.warn('lettura catalogo fallita:', error.message); return []; }
  return data || [];
}

/** La voce predefinita di sistema per lingua+genere, o null se non curata. */
export async function predefinitaPer(lang, genere = 'female') {
  const voci = await vociPerLingua(lang);
  const d = voci.find(v => v.predefinita && v.genere === genere) || voci.find(v => v.predefinita);
  return d?.voice_id || null;
}

/** Amministrazione: aggiunge (o aggiorna) una voce per una lingua. */
export async function aggiungiVoce({ lang, voiceId, nome, genere, ordine }) {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, errore: 'database non configurato' };
  const { error } = await sb.from('voci_lingue').upsert({
    lang: String(lang).split(/[-_]/)[0],
    voice_id: voiceId, nome: nome || '', genere: genere || 'female',
    ordine: Number(ordine) || 0,
  }, { onConflict: 'lang,voice_id' });
  return error ? { ok: false, errore: error.message } : { ok: true };
}

/** Amministrazione: toglie una voce da una lingua. Non cancella la voce da ElevenLabs, ovvio. */
export async function togliVoce({ lang, voiceId }) {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, errore: 'database non configurato' };
  const { error } = await sb.from('voci_lingue').delete()
    .eq('lang', String(lang).split(/[-_]/)[0]).eq('voice_id', voiceId);
  return error ? { ok: false, errore: error.message } : { ok: true };
}

/**
 * Amministrazione: marca la predefinita di sistema per lingua+genere.
 * Atomico quanto serve: prima si spegne la vecchia dello stesso genere,
 * poi si accende la nuova — nel peggiore dei casi (crash in mezzo) resta
 * una lingua senza predefinita per quel genere, che e il ripiego gia
 * gestito da predefinitaPer (usa l'altra o le cablate).
 */
export async function impostaPredefinita({ lang, voiceId, genere }) {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, errore: 'database non configurato' };
  const base = String(lang).split(/[-_]/)[0];
  const g = genere || 'female';
  const spegni = await sb.from('voci_lingue').update({ predefinita: false })
    .eq('lang', base).eq('genere', g).eq('predefinita', true);
  if (spegni.error) return { ok: false, errore: spegni.error.message };
  const accendi = await sb.from('voci_lingue').update({ predefinita: true })
    .eq('lang', base).eq('voice_id', voiceId);
  return accendi.error ? { ok: false, errore: accendi.error.message } : { ok: true };
}

/** Amministrazione: tutto il catalogo, per il pannello. */
export async function tuttoIlCatalogo() {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from('voci_lingue')
    .select('lang, voice_id, nome, genere, predefinita, ordine')
    .order('lang').order('ordine');
  if (error) { log.warn('lettura catalogo intero fallita:', error.message); return []; }
  return data || [];
}
