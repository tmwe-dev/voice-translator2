// ═══════════════════════════════════════════════════════════════
// mondoDB — il Mondo persistente (Fase 1).
//
// Parla SOLO con Supabase (tabelle mondo_*, migrazioni
// mondo_fase1_discussioni_commenti_follow e mondo_fase1_funzioni_contatori).
// Qui vivono le discussioni pubbliche che NON muoiono con la stanza, i
// commenti, i follow e la cache delle traduzioni a richiesta.
//
// IDENTITA: l'utente e la sua email di sessione, ma in una piazza
// pubblica l'email non compare MAI: l'autore e un id opaco =
// sha256(email) troncato. Il nome mostrato e uno snapshot.
//
// I contatori (commenti, like, importanza, viste) NON si aggiornano a
// mano: passano dalle funzioni SQL (RPC) provate dal vivo, atomiche.
//
// PRIVATO INTATTO: le chat/video private (effimere, su Redis) qui non si
// toccano. Questo file riguarda solo il Mondo.
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase.js';
import { createLogger } from './logger.js';

const log = createLogger('mondoDB');

export const GIORNI_ARCHIVIAZIONE = 15;   // silenzio oltre il quale si archivia

function db() {
  const c = getSupabaseAdmin();
  if (!c) throw new Error('Supabase non configurato');
  return c;
}

// id pubblico opaco: stabile per email, non reversibile, senza email.
// b.244 — HMAC al posto di sha256 nudo. L'impronta era il digest di un dato
// INDOVINABILE (l'email): chiunque poteva verificare "questo id e di Luca?"
// provando le email, o costruirsi una tabella per enumerare le persone della
// piazza. Con l'HMAC serve anche il segreto, che sta solo sul server.
// Le tabelle Mondo erano a ZERO righe: la migrazione non e costata nulla.
// Senza MONDO_ID_SECRET si ricade sul vecchio schema (dichiarato) per non
// spegnere la piazza: va impostato in produzione.
export function idPubblico(email) {
  if (!email) return null;
  const segreto = process.env.MONDO_ID_SECRET;
  if (segreto) {
    return 'u_' + crypto.createHmac('sha256', segreto)
      .update(String(email).trim().toLowerCase()).digest('hex').slice(0, 24);
  }
  return 'u_' + crypto.createHash('sha256')
    .update(String(email).trim().toLowerCase())
    .digest('hex').slice(0, 24);
}

// ═══════════════════════ DISCUSSIONI ═══════════════════════

export async function creaDiscussione({
  authorEmail, authorName = '', title = '', titleLang = null,
  topic = null, country = null, lang = null, media = {}, roomId = null,
}) {
  const author = idPubblico(authorEmail);
  if (!author) throw new Error('autore mancante');
  const { data, error } = await db().from('mondo_discussions').insert({
    author_user_id: author, author_name: authorName || '',
    title, title_lang: titleLang, topic, country, lang,
    media: media || {}, room_id: roomId,
  }).select('id').single();
  if (error) throw new Error('creaDiscussione: ' + error.message);
  return data.id;
}

// Feed caldo: esclude le archiviate, ordina con decadimento temporale
// ((commenti+1)/(ore+2)^1.5). Filtri opzionali argomento/paese/lingua.
export async function elencoDiscussioni({ topic = null, country = null, lang = null, limit = 30 } = {}) {
  let q = db().from('mondo_discussions')
    .select('id, author_user_id, author_name, title, title_lang, topic, country, lang, media, comment_count, view_count, created_at, last_activity_at')
    .eq('archived', false)
    // b.244 — cio che e stato nascosto (3 segnalazioni o un moderatore) esce
    // dal feed: prima il campo non esisteva nemmeno sulle discussioni.
    .eq('hidden', false)
    .order('last_activity_at', { ascending: false })
    .limit(Math.min(limit, 60));
  if (topic) q = q.eq('topic', topic);
  if (country) q = q.eq('country', country);
  if (lang) q = q.eq('lang', lang);
  const { data, error } = await q;
  if (error) throw new Error('elencoDiscussioni: ' + error.message);
  const ora = Date.now();
  return (data || []).map(d => {
    const ore = Math.max(0, (ora - new Date(d.last_activity_at).getTime()) / 3600000);
    return { ...d, _hot: (d.comment_count + 1) / Math.pow(ore + 2, 1.5) };
  }).sort((a, b) => b._hot - a._hot);
}

export async function getDiscussione(id) {
  const { data, error } = await db().from('mondo_discussions').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('getDiscussione: ' + error.message);
  // b.363 — NASCOSTA VUOL DIRE NASCOSTA: una discussione tolta da tre
  // segnalazioni o da un moderatore restava leggibile con il link diretto
  // e si poteva ancora commentare. L'elenco la filtrava, l'apertura no.
  if (data && data.hidden) return null;
  return data || null;
}

export async function contaVista(id) {
  // b.363 — il client non LANCIA sugli errori SQL: li restituisce. Il vecchio
  // try/catch prendeva solo i guasti di rete, quindi il contatore poteva
  // fallire per sempre in silenzio.
  try {
    const { error } = await db().rpc('mondo_conta_vista', { p_discussion: id });
    if (error) log.warn('contaVista:', error.message);
  } catch (e) { log.warn('contaVista:', e.message); } // il contatore vista non e critico
}

// ═══════════════════════ COMMENTI ═══════════════════════

export async function commenti(discussionId, { limit = 100 } = {}) {
  const { data, error } = await db().from('mondo_comments')
    .select('id, discussion_id, author_user_id, author_name, text, lang, parent_id, like_count, reply_count, importance, created_at')
    .eq('discussion_id', discussionId).eq('hidden', false)
    .order('created_at', { ascending: true })
    .limit(Math.min(limit, 300));
  if (error) throw new Error('commenti: ' + error.message);
  return data || [];
}

export async function commenta({ discussionId, authorEmail, authorName = '', text, lang = null, parentId = null }) {
  const author = idPubblico(authorEmail);
  if (!author) throw new Error('autore mancante');
  if (!text || !text.trim()) throw new Error('testo vuoto');
  // b.363 — sotto una discussione NASCOSTA o ARCHIVIATA non si commenta:
  // l'elenco la toglieva, ma chi aveva il link continuava a scriverci.
  const { data: disc } = await db().from('mondo_discussions')
    .select('hidden, archived').eq('id', discussionId).maybeSingle();
  if (!disc || disc.hidden || disc.archived) throw new Error('discussione non aperta ai commenti');
  const { data, error } = await db().from('mondo_comments').insert({
    discussion_id: discussionId, author_user_id: author, author_name: authorName || '',
    text: text.trim().slice(0, 4000), lang, parent_id: parentId,
  }).select('id').single();
  if (error) throw new Error('commenta: ' + error.message);
  // contatori atomici (funzione provata dal vivo)
  const { error: e2 } = await db().rpc('mondo_dopo_commento', { p_discussion: discussionId, p_parent: parentId });
  if (e2) log.warn('mondo_dopo_commento:', e2.message);
  return data.id;
}

// ═══════════════════════ MI PIACE (idempotente) ═══════════════════════

// b.363 — restituisce il conteggio VERO. Prima tornava vuoto e il cuore
// veniva contato dal telefono: dopo un ricarico l'elenco dei "gia messi"
// ripartiva vuoto, si toccava di nuovo, il server (giustamente) non
// contava nulla e lo schermo mostrava un cuore in piu che non esisteva.
export async function mettiMiPiace({ commentId, email }) {
  const uid = idPubblico(email);
  if (!uid) throw new Error('utente mancante');
  const { error } = await db().from('mondo_comment_likes').insert({ comment_id: commentId, user_id: uid });
  const gia = !!(error && /duplicate|unique/i.test(error.message));
  if (error && !gia) throw new Error('mettiMiPiace: ' + error.message);
  const { error: e2 } = await db().rpc('mondo_ricalcola_like', { p_comment: commentId });
  if (e2) log.warn('mondo_ricalcola_like:', e2.message);
  const { data } = await db().from('mondo_comments').select('like_count').eq('id', commentId).maybeSingle();
  return { gia, like_count: data?.like_count ?? null };
}

// I cuori che questa persona ha gia messo, fra quelli mostrati: serve a
// ricostruire lo stato dopo un ricarico della pagina.
export async function mieiMiPiace({ email, commentIds = [] }) {
  const uid = idPubblico(email);
  if (!uid || !commentIds.length) return [];
  const { data, error } = await db().from('mondo_comment_likes')
    .select('comment_id').eq('user_id', uid).in('comment_id', commentIds.slice(0, 300));
  if (error) { log.warn('mieiMiPiace:', error.message); return []; }
  return (data || []).map((r) => r.comment_id);
}

// ═══════════════════════ FOLLOW ═══════════════════════

export async function segui(followerEmail, followedPublicId) {
  const follower = idPubblico(followerEmail);
  if (!follower || !followedPublicId || follower === followedPublicId) return;
  const { error } = await db().from('mondo_follows')
    .insert({ follower_user_id: follower, followed_user_id: followedPublicId });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error('segui: ' + error.message);
}

// b.363 — CHI SEGUO, FRA QUESTI. Serve a ricostruire lo stato dopo un
// ricarico: prima l'elenco dei seguiti ripartiva vuoto a ogni apertura e le
// etichette "Segui / Seguito" dicevano il falso finche non si toccava.
export async function mieiSeguiti({ email, publicIds = [] }) {
  const follower = idPubblico(email);
  if (!follower || !publicIds.length) return [];
  const { data, error } = await db().from('mondo_follows')
    .select('followed_user_id').eq('follower_user_id', follower)
    .in('followed_user_id', publicIds.slice(0, 300));
  if (error) { log.warn('mieiSeguiti:', error.message); return []; }
  return (data || []).map((r) => r.followed_user_id);
}

export async function smettiSeguire(followerEmail, followedPublicId) {
  const follower = idPubblico(followerEmail);
  if (!follower) return;
  const { error } = await db().from('mondo_follows').delete()
    .eq('follower_user_id', follower).eq('followed_user_id', followedPublicId);
  if (error) throw new Error('smettiSeguire: ' + error.message);
}

export async function contaSeguaci(publicId) {
  const { count, error } = await db().from('mondo_follows')
    .select('*', { count: 'exact', head: true }).eq('followed_user_id', publicId);
  if (error) throw new Error('contaSeguaci: ' + error.message);
  return count || 0;
}

// Il nome piu recente con cui una persona ha firmato (snapshot).
export async function nomePersona(publicId) {
  const { data } = await db().from('mondo_comments').select('author_name')
    .eq('author_user_id', publicId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (data?.author_name) return data.author_name;
  const { data: d2 } = await db().from('mondo_discussions').select('author_name')
    .eq('author_user_id', publicId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return d2?.author_name || '';
}

// Il profilo pubblico completo: nome, seguaci, e cosa ha fatto.
export async function profiloPersona(publicId) {
  const [nome, seguaci, attivita] = await Promise.all([
    nomePersona(publicId), contaSeguaci(publicId), attivitaPersona(publicId),
  ]);
  return { publicId, nome, seguaci, ...attivita };
}

// La "persona": dove ha commentato / cosa ha aperto (profilo pubblico).
export async function attivitaPersona(publicId, { limit = 30 } = {}) {
  const [disc, com] = await Promise.all([
    db().from('mondo_discussions').select('id, title, topic, country, created_at')
      .eq('author_user_id', publicId).eq('archived', false)
      .order('created_at', { ascending: false }).limit(limit),
    db().from('mondo_comments').select('id, discussion_id, text, created_at')
      .eq('author_user_id', publicId).eq('hidden', false)
      .order('created_at', { ascending: false }).limit(limit),
  ]);
  return { discussioni: disc.data || [], commenti: com.data || [] };
}

// ═══════════════════════ RETENTION ═══════════════════════

// Archivia le discussioni ferme da piu di N giorni (default 15). Restano
// leggibili, escono solo dal feed caldo. Da chiamare da un cron.
export async function archiviaInattive(giorni = GIORNI_ARCHIVIAZIONE) {
  const soglia = new Date(Date.now() - giorni * 86400000).toISOString();
  const { data, error } = await db().from('mondo_discussions')
    .update({ archived: true }).eq('archived', false).lt('last_activity_at', soglia).select('id');
  if (error) throw new Error('archiviaInattive: ' + error.message);
  return (data || []).length;
}
