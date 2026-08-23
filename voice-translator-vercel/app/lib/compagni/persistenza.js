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
import { createLogger } from '../logger.js';

const log = createLogger('compagni-persistenza');

// ═══════════════════════════════════════════════════════════════
// L'IMPRONTA DELL'UTENTE — b.413, P1.15 dell'audit
//
// Era `sha256(email)` troncato. Il difetto non e la funzione: e che
// l'email E' UN DATO INDOVINABILE. Chiunque abbia in mano un'impronta
// puo provare le email finche torna, oppure costruirsi una tabella e
// ENUMERARE le persone. Mondo era gia passato all'HMAC per questo
// motivo esatto (b.244), e il commento di Life diceva ancora «la stessa
// impronta di Mondo» — che da allora non era piu vero. Un commento che
// mente e peggio di nessun commento.
//
// LA MIGRAZIONE E' IL PUNTO DELICATO, e va spiegata. Dagli id vecchi
// NON si risale alle email: sono digest. Quindi non esiste nessuna
// migrazione di massa possibile — nessuno, nemmeno noi, sa a chi
// appartiene la riga `u_3f2a...`. L'unico momento in cui quel legame
// esiste e quando la persona TORNA: li abbiamo la sua email, e possiamo
// calcolare tutte e due le impronte.
//
// Quindi il trasloco e PIGRO: avviene alla prima apertura di Life dopo
// l'aggiornamento, per una persona alla volta, e si segna che e fatto.
// Chi non torna non perde niente: le sue righe restano dove sono, con
// la vecchia impronta, e il giorno che torna vengono spostate.
// ═══════════════════════════════════════════════════════════════

/**
 * L'impronta VECCHIA: digest dell'email. Resta esportata perche serve al
 * trasloco — e solo a quello. Nessun codice nuovo deve usarla per
 * scrivere.
 */
export function idUtenteVecchio(email) {
  if (!email) return null;
  return 'u_' + crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 24);
}

/**
 * L'impronta dell'utente. Con il segreto e un HMAC (non si puo indovinare
 * partendo dall'email); senza, si ricade sul vecchio schema DICHIARANDOLO,
 * per non spegnere Life in un ambiente che il segreto non ce l'ha.
 *
 * Stesso segreto di Mondo di proposito: due segreti per la stessa idea
 * sono due cose da ricordare, e una da dimenticare.
 */
export function idUtente(email) {
  if (!email) return null;
  const segreto = process.env.MONDO_ID_SECRET;
  if (!segreto) return idUtenteVecchio(email);
  return 'u_' + crypto.createHmac('sha256', segreto)
    .update(String(email).trim().toLowerCase()).digest('hex').slice(0, 24);
}

/** Le tabelle di Life dove vive l'impronta, e con che nome. */
const TABELLE_IDENTITA = [
  ['compagni', 'owner'],
  ['compagno_memorie', 'owner'],
  ['compiti_jobs', 'owner'],
  ['compiti_materiali', 'owner'],
  ['corsi_utente', 'owner'],
  ['imparare_progresso', 'owner'],
  ['imparare_studente', 'owner'],
  ['profilo_studente', 'owner'],
  ['pronuncia_profilo', 'owner'],
  ['corsi_pubblici', 'autore'],
];

/**
 * IL TRASLOCO PIGRO. Sposta le righe di QUESTA persona dalla vecchia
 * impronta alla nuova. Idempotente: se non c'e niente da spostare non fa
 * niente, e si puo richiamare quante volte si vuole.
 *
 * Va chiamata dove Life comincia — `elencaCompagni`, che e la prima cosa
 * che la sezione chiede quando si apre.
 *
 * @returns {Promise<number>} quante righe ha spostato (0 = niente da fare)
 */
export async function assicuraIdentita(email) {
  if (!email) return 0;
  const nuovo = idUtente(email);
  const vecchio = idUtenteVecchio(email);
  if (!nuovo || nuovo === vecchio) return 0;   // senza segreto non c'e niente da traslocare
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  let spostate = 0;
  for (const [tabella, colonna] of TABELLE_IDENTITA) {
    try {
      const { data, error } = await sb.from(tabella)
        .update({ [colonna]: nuovo }).eq(colonna, vecchio).select(colonna);
      if (error) {
        // Un guasto su una tabella non deve impedire il trasloco delle
        // altre: meglio nove tabelle spostate e una da riprovare che
        // zero. E non e distruttivo — la riga resta dov'e.
        log.warn('trasloco identita non riuscito', { tabella, motivo: error.message });
        continue;
      }
      spostate += (data || []).length;
    } catch (e) {
      log.warn('trasloco identita esploso', { tabella, motivo: e?.message || 'ignoto' });
    }
  }
  if (spostate) log.info('identita traslocata', { righe: spostate });
  return spostate;
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
    avatar: r.avatar || '/avatars/9.webp', voce: { id: r.voce_id, nome: r.voce_nome || '' },
    provider: r.provider, modello: r.modello, liberta: r.liberta, personalita: r.personalita || '',
    lingua: r.lingua || '', memoria: !!r.memoria, predefinito: false,
    // b.317 — audit D5/D6: genere e barre ora SOPRAVVIVONO al salvataggio.
    // Prima si perdevano: riaprire una "Marilyn" e premere Ridisegna dava un
    // volto neutro, e toccare UNA barra azzerava le altre cinque.
    genere: r.genere || 'neutral',
    barre: r.barre && typeof r.barre === 'object' ? r.barre : null,
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
  // b.413 · P1.15 — QUI COMINCIA LIFE, e qui si trasloca. E' l'unico
  // momento in cui abbiamo insieme l'email e il bisogno di leggere:
  // dagli id vecchi non si risale alle email, quindi una migrazione di
  // massa non esiste. Idempotente e senza rumore: quando non c'e niente
  // da spostare, non fa niente.
  await assicuraIdentita(email);
  const { data, error } = await sb.from('compagni').select('*').eq('owner', owner).order('created_at', { ascending: true });
  if (error) return [];
  return (data || []).map(daRiga);
}

// b.363 — L'AVATAR ERA L'UNICO CAMPO SENZA MISURA. Quando il deposito
// immagini non riesce, la rotta avatar restituisce il PNG intero come
// dataUrl: megabyte di base64 che finivano dritti in una riga di
// database, ricaricati a ogni elenco dei Compagni. Qui si accetta un
// percorso interno, un indirizzo web corto, o un'immagine incorporata
// solo se sta sotto una soglia ragionevole.
const TETTO_DATAURL = 300 * 1024; // ~300 KB di base64
const AVATAR_PREDEFINITO = '/avatars/9.webp';

// b.363 — non piu esportata: la usa solo questo file. Era offerta a tutto
// il progetto senza che nessuno la chiedesse.
function avatarSicuro(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return AVATAR_PREDEFINITO;
  if (s.startsWith('/')) return s.slice(0, 200);
  if (/^https?:\/\//i.test(s)) return s.length <= 500 ? s : AVATAR_PREDEFINITO;
  if (s.startsWith('data:image/')) return s.length <= TETTO_DATAURL ? s : AVATAR_PREDEFINITO;
  return AVATAR_PREDEFINITO;
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
    avatar: avatarSicuro(c.avatar),
    voce_id: c.voce?.id ? String(c.voce.id).slice(0, 64) : null,
    voce_nome: c.voce?.nome ? String(c.voce.nome).slice(0, 80) : null,
    provider: c.provider || 'openai',
    modello: c.modello || 'gpt-4o-mini',
    liberta: c.liberta || 'balanced',
    lingua: (c.lingua || '').slice(0, 8) || null,
    memoria: !!c.memoria,
    // b.317 — audit D5/D6: genere e barre si salvano (colonne aggiunte in DB).
    genere: ['male', 'female', 'neutral'].includes(c.genere) ? c.genere : 'neutral',
    barre: c.barre && typeof c.barre === 'object' ? c.barre : null,
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
  // b.411 · P1.16 — PRIMA I RICORDI, POI LA SCHEDA. Verificato sul
  // database vivo: fra le due tabelle non c'e nessun vincolo e quindi
  // nessuna cascata. Cancellando solo la scheda, i ricordi restavano li
  // per sempre — dati personali di cui nessuna schermata sa piu niente.
  //
  // L'ordine conta: se saltasse la corrente in mezzo, meglio un Compagno
  // senza ricordi (che si vede, e si puo ricancellare) che dei ricordi
  // senza Compagno (che non si vedono piu).
  const { error: guastoMemorie } = await sb.from('compagno_memorie')
    .delete().eq('owner', owner).eq('compagno_id', id);
  if (guastoMemorie) return false;   // non si cancella la scheda se i ricordi restano
  const { error } = await sb.from('compagni').delete().eq('owner', owner).eq('id', id);
  return !error;
}
