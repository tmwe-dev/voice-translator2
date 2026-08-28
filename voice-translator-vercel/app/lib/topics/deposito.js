// ═══════════════════════════════════════════════════════════════
// IL DEPOSITO DELLE FONTI — la casa vera del registro (b.553)
//
// Ordine di Luca: «le liste di fonti passino su Supabase — il Source
// Graph ha bisogno di una casa vera con la sua storia».
//
// Aveva ragione e il motivo e' semplice: fino a ieri le liste stavano in
// Redis con trenta giorni di vita. Redis e' una CACHE — roba che si puo
// perdere senza danno. Ma «chi ci ha dato roba buona, dove, e quante
// volte» non e' cache: e' l'unica cosa che il Mondo accumula e che i
// motori di ricerca non hanno. Se scade da sola, ogni mese ricominciamo
// da capo e il patrimonio non esiste.
//
// DUE TAVOLE, non una. Una fonte e' una sola al mondo (il dominio), ma
// il suo MERITO cambia da paese a paese e da settore a settore: Le Monde
// vale in Francia e sull'estero, non sul calcio italiano.
//
// TRE NUMERI per fonte e ambito, e ognuno dice una cosa diversa:
//   · apparizioni — quante volte e' uscita nei risultati (altri la
//     considerano pertinente qui)
//   · letture     — quante volte l'abbiamo aperta all'origine
//   · articoli    — quanto ci ha dato davvero
// Una fonte che compare sempre ma non pubblica mai non merita la
// lettura, e questi tre numeri lo dicono senza bisogno di indovinare.
//
// SE SUPABASE NON C'E' (prove, sviluppo, chiave mancante) tutto qui
// dentro torna vuoto o non fa niente, e il Mondo funziona come prima:
// il deposito e' un vantaggio, mai una condizione.
// ═══════════════════════════════════════════════════════════════
import { getSupabaseAdmin } from '../supabase.js';

const nudo = (d) => String(d || '').trim().toLowerCase()
  .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

/** LE FONTI CHE SEGUIAMO qui, in ordine di merito. */
export async function fontiDelPosto({ paese = '', settore = '', quante = 12 } = {}) {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from('mondo_fonti_ambito')
    .select('apparizioni, letture, articoli, mondo_fonti!inner(dominio, nome, feed)')
    .eq('paese', paese || '')
    .eq('settore', settore || '')
    .order('apparizioni', { ascending: false })
    .order('articoli', { ascending: false })
    .limit(quante);
  if (error || !Array.isArray(data)) return [];
  return data.map((r) => ({
    dominio: r.mondo_fonti?.dominio || '',
    nome: r.mondo_fonti?.nome || '',
    feed: r.mondo_fonti?.feed || '',
    apparizioni: r.apparizioni || 0,
    letture: r.letture || 0,
    articoli: r.articoli || 0,
  })).filter((f) => f.dominio);
}

/**
 * DISCOVER: le fonti viste in una ricerca entrano nel registro.
 * Si contano i domini e si manda tutto in una chiamata sola: la
 * scoperta non deve costare piu della ricerca che l'ha prodotta.
 */
export async function fontiViste(articoli, { paese = '', settore = '' } = {}) {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const conti = new Map();
  for (const a of (Array.isArray(articoli) ? articoli : [])) {
    const d = nudo(a?.dominio || a?.url || '');
    if (!d || !d.includes('.')) continue;
    const v = conti.get(d) || { dominio: d, nome: a?.fonte || '', quante: 0 };
    v.quante += 1;
    if (!v.nome && a?.fonte) v.nome = a.fonte;
    conti.set(d, v);
  }
  if (!conti.size) return 0;
  const { data, error } = await db.rpc('mondo_fonti_viste', {
    voci: [...conti.values()].slice(0, 40), p_paese: paese || '', p_settore: settore || '',
  });
  return error ? 0 : (data || 0);
}

/** Quanto ha reso una fonte che abbiamo letto all'origine. */
export async function fonteLetta(dominio, articoli = 0, { paese = '', settore = '' } = {}) {
  const db = getSupabaseAdmin();
  if (!db || !nudo(dominio)) return;
  await db.rpc('mondo_fonte_letta', {
    p_dominio: nudo(dominio), p_articoli: articoli, p_paese: paese || '', p_settore: settore || '',
  });
}

/**
 * IL FLUSSO DI UNA FONTE, ricordato per sempre.
 * Trovarlo costa una visita alla home e fino a cinque tentativi: e' la
 * cosa piu cara del registro, e va fatta UNA volta nella vita. Anche il
 * «non ce l'ha» si ricorda (stringa vuota), altrimenti lo ricercheremmo
 * ogni giorno per i siti che l'RSS non ce l'hanno.
 */
export async function feedRicordato(dominio) {
  const db = getSupabaseAdmin();
  const d = nudo(dominio);
  if (!db || !d) return null;
  const { data, error } = await db
    .from('mondo_fonti').select('feed, feed_provato_il').eq('dominio', d).maybeSingle();
  if (error || !data || !data.feed_provato_il) return null;
  return data.feed || '';
}

export async function ricordaFeed(dominio, feed) {
  const db = getSupabaseAdmin();
  const d = nudo(dominio);
  if (!db || !d) return;
  await db.from('mondo_fonti')
    .upsert({ dominio: d, feed: feed || '', feed_provato_il: new Date().toISOString() }, { onConflict: 'dominio' });
}
