// ═══════════════════════════════════════════════════════════════
// STUDENTE — quello che il Maestro ricorda di te (Luca, b.242)
//
// Fino a b.241 Impara non salvava NIENTE: né dove eri arrivato, né come era
// andata, né cosa avevi faticato. Ogni lezione ripartiva da zero. Con un
// Maestro smemorato non esistono né la motivazione ("cinque minuti fa non ci
// riuscivi, adesso sì"), né il ripasso mirato, né un percorso che si adatta:
// sono tutte cose che richiedono di ricordare.
//
// DUE REGOLE che tengono onesto questo modulo:
//
//  1. Si ricorda A PAROLE, non con punteggi inventati. "motivazione = 72%"
//     è un numero che nessuno ha misurato; "fatica coi tempi passati" si può
//     usare davvero. L'unico numero che salviamo è il punteggio di una prova,
//     che è misurato per davvero.
//  2. È un dato personale: chiave = impronta pubblica (mai l'email), lettura
//     e scrittura SOLO dal server, come per la memoria dei Compagni.
//
// Le funzioni PURE (riassunto/unione) stanno in fondo e sono testabili senza
// rete; quelle che toccano il database falliscono in silenzio — il corso deve
// funzionare anche se il ricordo non si salva.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from '../../supabase.js';
import { idUtente } from '../persistenza.js';
// Le funzioni PURE (unione, riassunto, chiave) vivono in imparare.js, che non
// tocca la rete: cosi i costruttori di prompt non si trascinano dietro il
// client Supabase. Qui si riesportano per comodita di chi usa questo modulo.
import { unisciOsservazioni, chiaveCorso } from './imparare.js';
export { unisciOsservazioni, chiaveCorso, riassuntoProgresso } from './imparare.js';

const MAX_OSSERVAZIONI = 12;
const MAX_DA_RIVEDERE = 15;

// ── Osservazioni sullo studente (a parole) ──

/** Cosa il Maestro sa di questa persona. Ritorna [] se non sa niente. */
export async function leggiOsservazioni(email) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from('imparare_studente').select('osservazioni').eq('owner', owner).maybeSingle();
  if (error || !data) return [];
  return Array.isArray(data.osservazioni) ? data.osservazioni : [];
}

/** Aggiunge osservazioni nuove, senza doppioni e senza crescere all'infinito. */
export async function aggiungiOsservazioni(email, nuove = []) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb) return false;
  const attuali = await leggiOsservazioni(email);
  const unite = unisciOsservazioni(attuali, nuove);
  const { error } = await sb.from('imparare_studente')
    .upsert({ owner, osservazioni: unite, updated_at: new Date().toISOString() }, { onConflict: 'owner' });
  return !error;
}

// ── Progresso dentro un corso ──

/**
 * Registra com'è andata una prova. `daRivedere` sono le cose sbagliate:
 * servono al ripasso, non a dare un voto alla persona.
 */
export async function salvaEsito(email, { corso, lezione = 0, punteggio = null, daRivedere = [] } = {}) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb || !corso) return false;
  const { error } = await sb.from('imparare_progresso').upsert({
    owner,
    corso: chiaveCorso(corso),
    lezione: Number(lezione) || 0,
    punteggio: punteggio === null ? null : Math.max(0, Math.min(100, Math.round(Number(punteggio) || 0))),
    da_rivedere: (Array.isArray(daRivedere) ? daRivedere : []).slice(0, MAX_DA_RIVEDERE).map(String),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner,corso,lezione' });
  return !error;
}

/** Il cammino fatto in questo corso. */
export async function leggiProgresso(email, corso) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb || !corso) return [];
  const { data, error } = await sb.from('imparare_progresso')
    .select('lezione, punteggio, da_rivedere')
    .eq('owner', owner).eq('corso', chiaveCorso(corso))
    .order('lezione', { ascending: true });
  if (error || !data) return [];
  return data;
}
