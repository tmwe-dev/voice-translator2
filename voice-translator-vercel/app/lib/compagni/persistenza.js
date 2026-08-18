// ═══════════════════════════════════════════════════════════════
// COMPAGNI — persistenza (Luca)
//
// I Compagni creati dall'utente, su Supabase (tabella `compagni`, RLS
// server-only). È persistenza NOSTRA di Life: non passa dal ponte (che è
// solo per le capacità di BarTalk). L'utente è identificato da
// idPubblico(email) — la stessa impronta di Mondo — così non salviamo mai
// l'email in chiaro.
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { getSupabaseAdmin } from '../supabase.js';
import { getCompagnoPredefinito } from './catalogo.js';
import { pulisciProfili } from './profili.js';

/** Impronta pubblica dell'utente (sha256 dell'email, troncato). */
export function idUtente(email) {
  if (!email) return null;
  return 'u_' + crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 24);
}

/** slug stabile dal nome, per comporre l'id del Compagno. */
function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'compagno';
}

/** Da riga DB a forma Compagno (come il catalogo). */
function daRiga(r) {
  return {
    id: r.id, nome: r.nome, ruolo: r.ruolo || '', emoji: r.emoji || '✨', colore: r.colore || '#26D9B0',
    avatar: r.avatar || '/avatars/9.png', voce: { id: r.voce_id, nome: r.voce_nome || '' },
    provider: r.provider, modello: r.modello, liberta: r.liberta, personalita: r.personalita || '',
    lingua: r.lingua || '', memoria: !!r.memoria, predefinito: false,
    // b.237 — Deep Setting: override dei profili per superficie (o null).
    profili: pulisciProfili(r.profili),
  };
}

/** Elenco dei Compagni dell'utente. */
export async function elencaCompagni(email) {
  const owner = idUtente(email);
  if (!owner) return [];
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from('compagni').select('*').eq('owner', owner).order('created_at', { ascending: true });
  if (error) return [];
  return (data || []).map(daRiga);
}

/** Crea/aggiorna un Compagno dell'utente. Ritorna il Compagno salvato o null. */
export async function salvaCompagno(email, c) {
  const owner = idUtente(email);
  if (!owner || !c || !c.nome) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const id = c.id && String(c.id).startsWith(owner) ? c.id : `${owner}_${slug(c.nome)}`;
  const riga = {
    id, owner,
    nome: String(c.nome).slice(0, 60),
    ruolo: (c.ruolo || '').slice(0, 60),
    emoji: (c.emoji || '✨').slice(0, 8),
    colore: (c.colore || '#26D9B0').slice(0, 16),
    avatar: c.avatar || '/avatars/9.png',
    voce_id: c.voce?.id || null,
    voce_nome: c.voce?.nome || null,
    provider: c.provider || 'openai',
    modello: c.modello || 'gpt-4o-mini',
    liberta: c.liberta || 'balanced',
    lingua: (c.lingua || '').slice(0, 8) || null,
    memoria: !!c.memoria,
    personalita: (c.personalita || '').slice(0, 4000),
    // b.237 — Deep Setting: si salva SOLO ciò che passa il validatore
    // (superfici note, profili esistenti); il resto si butta.
    profili: pulisciProfili(c.profili),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from('compagni').upsert(riga, { onConflict: 'id' }).select().single();
  if (error) return null;
  return daRiga(data);
}

/**
 * Risolve una lista di id a Compagni: prima i predefiniti, poi quelli
 * dell'utente. Se sono TUTTI predefiniti non tocca nemmeno il DB.
 */
export async function risolviCompagni(ids, email) {
  const arr = Array.isArray(ids) ? ids : [];
  const predef = arr.map(getCompagnoPredefinito);
  if (predef.every(Boolean)) return predef;
  const miei = email ? await elencaCompagni(email) : [];
  const mappa = new Map(miei.map(c => [c.id, c]));
  return arr.map(id => getCompagnoPredefinito(id) || mappa.get(id) || null).filter(Boolean);
}

/** Risolve un singolo id (predefinito o dell'utente). */
export async function risolviCompagno(id, email) {
  const p = getCompagnoPredefinito(id);
  if (p) return p;
  if (!email) return null;
  const miei = await elencaCompagni(email);
  return miei.find(c => c.id === id) || null;
}

/** Cancella un Compagno dell'utente (solo suo). */
export async function cancellaCompagno(email, id) {
  const owner = idUtente(email);
  if (!owner || !id) return false;
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { error } = await sb.from('compagni').delete().eq('owner', owner).eq('id', id);
  return !error;
}
