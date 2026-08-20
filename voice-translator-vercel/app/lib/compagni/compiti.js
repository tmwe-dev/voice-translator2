// ═══════════════════════════════════════════════════════════════
// COMPITI — l'agenda di studio e i materiali (b.332, Ondata 1)
//
// La sezione "Ripetizioni e Compiti" di Luca: ogni studente arriva a casa
// con un calendario da rispettare, lezioni da apprendere, appunti da
// studiare. Qui vivono i JOBS (cosa studiare, per quando, in che stato)
// e i MATERIALI (appunti fotografati, PDF, testi) da cui l'AI costruira
// lezioni e test su misura (Ondate 2-3).
//
// Stesse regole delle altre memorie personali: chiave = impronta pubblica
// (mai l'email), lettura/scrittura solo dal server, fallimenti silenziosi.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from '../supabase.js';
import { idUtente } from './persistenza.js';

function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'job';
}

const STATI = ['da_fare', 'in_corso', 'fatto'];

/** Salva (o aggiorna) un job dell'agenda. */
export async function salvaJob(email, j = {}) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb || !j.titolo) return null;
  const id = j.id && String(j.id).startsWith(owner) ? j.id : `${owner}_${slug(j.titolo)}_${Date.now().toString(36)}`;
  const riga = {
    id, owner,
    titolo: String(j.titolo).slice(0, 160),
    materia: (j.materia || '').slice(0, 60) || null,
    note: (j.note || '').slice(0, 1000) || null,
    scadenza: j.scadenza || null,
    stato: STATI.includes(j.stato) ? j.stato : 'da_fare',
    obiettivo_id: (j.obiettivoId || '').slice(0, 80) || null,
    materiale_id: (j.materialeId || '').slice(0, 120) || null,
    aggiornato: new Date().toISOString(),
  };
  const { data, error } = await sb.from('compiti_jobs').upsert(riga, { onConflict: 'id' }).select().single();
  if (error) return null;
  return daRigaJob(data);
}

export async function elencaJobs(email) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from('compiti_jobs').select('*')
    .eq('owner', owner).order('scadenza', { ascending: true, nullsFirst: false }).limit(100);
  if (error || !data) return [];
  return data.map(daRigaJob);
}

export async function cambiaStatoJob(email, id, stato) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb || !STATI.includes(stato)) return false;
  const { error } = await sb.from('compiti_jobs').update({ stato, aggiornato: new Date().toISOString() })
    .eq('id', id).eq('owner', owner);
  return !error;
}

export async function eliminaJob(email, id) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb) return false;
  const { error } = await sb.from('compiti_jobs').delete().eq('id', id).eq('owner', owner);
  return !error;
}

function daRigaJob(r) {
  return {
    id: r.id, titolo: r.titolo, materia: r.materia || '', note: r.note || '',
    scadenza: r.scadenza || null, stato: r.stato || 'da_fare',
    obiettivoId: r.obiettivo_id || null, materialeId: r.materiale_id || null,
  };
}

// ── MATERIALI (Ondata 2 li riempira con OCR/PDF; qui il contenitore) ──

export async function salvaMateriale(email, m = {}) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb || !(m.testo || m.tabella)) return null;
  const id = `${owner}_${slug(m.titolo || 'materiale')}_${Date.now().toString(36)}`;
  const riga = {
    id, owner,
    titolo: (m.titolo || 'Materiale').slice(0, 160),
    materia: (m.materia || '').slice(0, 60) || null,
    origine: (m.origine || 'testo').slice(0, 20),
    testo: (m.testo || '').slice(0, 40000),
    tabella: m.tabella && typeof m.tabella === 'object' ? m.tabella : null,
  };
  const { data, error } = await sb.from('compiti_materiali').upsert(riga, { onConflict: 'id' }).select().single();
  if (error) return null;
  return { id: data.id, titolo: data.titolo, materia: data.materia || '', origine: data.origine };
}

export async function elencaMateriali(email) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from('compiti_materiali')
    .select('id, titolo, materia, origine, creato').eq('owner', owner)
    .order('creato', { ascending: false }).limit(50);
  if (error || !data) return [];
  return data;
}

export async function leggiMateriale(email, id) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from('compiti_materiali').select('*')
    .eq('id', id).eq('owner', owner).maybeSingle();
  if (error || !data) return null;
  return data;
}

// ═══ b.342 — IL TELEFONO COME SCANNER (QR dal PC) ═══
// Dal PC si mostra un QR; il telefono lo inquadra, apre /scan, scatta la
// foto e la DEPOSITA qui con il codice usa-e-getta (sid). Il PC la RITIRA
// e la legge in locale (Tesseract, gratis). Il deposito non chiede login:
// il sid e il lasciapassare, vive pochi minuti e si consuma al ritiro.

export async function depositaScansione(sid, dato) {
  const sb = getSupabaseAdmin();
  if (!sb || !sid || !dato) return false;
  // pulizia: i depositi hanno vita breve, qualunque cosa succeda
  await sb.from('compiti_scansioni').delete().lt('creato', new Date(Date.now() - 15 * 60 * 1000).toISOString());
  const { error } = await sb.from('compiti_scansioni')
    .upsert({ sid: String(sid).slice(0, 64), dato: String(dato).slice(0, 4 * 1024 * 1024), creato: new Date().toISOString() }, { onConflict: 'sid' });
  return !error;
}

export async function ritiraScansione(sid) {
  const sb = getSupabaseAdmin();
  if (!sb || !sid) return null;
  const { data } = await sb.from('compiti_scansioni').select('dato').eq('sid', String(sid).slice(0, 64)).maybeSingle();
  if (!data?.dato) return null;
  await sb.from('compiti_scansioni').delete().eq('sid', String(sid).slice(0, 64));
  return data.dato;
}
