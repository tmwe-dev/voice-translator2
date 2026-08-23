// ═══════════════════════════════════════════════
// Supabase API Wrapper — Server-side CRUD
// Adapted from BarTalk v79 supabaseAPI.ts
//
// All functions use the admin client (bypasses RLS)
// For use in API routes only
//
// b.363 — QUESTO FILE ERA PER DUE TERZI UN MAGAZZINO CHIUSO: su
// ventinove funzioni ne chiamavano solo otto (le tre rotte di traduzione,
// utente e pagamenti Stripe). Le altre ventuno — cassaforte delle chiavi,
// conversazioni, glossari, statistiche, cancellazione totale del profilo,
// listino abbonamenti — non erano raggiunte da nessuna riga viva del
// programma, ma parlavano lo stesso con tabelle vere: chi leggeva il file
// credeva che quelle strade fossero in uso e che quelle tabelle fossero
// alimentate, e ogni ritocco allo schema del database costava lavoro su
// codice che nessuno eseguiva. Sono state tolte. Il vecchio testo resta
// nella storia del progetto, se un giorno servissero davvero.
//
// b.422 — E DELLE OTTO RIMASTE, SETTE PARLAVANO CON TABELLE CHE NON
// ESISTONO. Verificato sul database vivo di produzione: nello schema
// `public` non ci sono `profiles`, `user_settings`, `payments`,
// `usage_daily`, `audit_logs`. Quindi:
//
//   · getProfileByEmail  → `profiles`      : tornava SEMPRE null;
//   · getUserSettings    → `user_settings` : idem;
//   · saveUserSettings   → `user_settings` : non ha mai scritto niente;
//   · savePayment        → `payments`      : idem;
//   · logAudit           → `audit_logs`    : nessun registro e mai
//                          esistito, e il catch se ne mangiava l'errore;
//   · trackUsage         → RPC `increment_usage`, che scrive in
//                          `usage_daily`: una funzione che non puo
//                          esistere sopra una tabella che non esiste;
//   · addCreditsDB       → RPC `add_credits`, che scrive `profiles.credits`.
//
// Non era una svista da poco: getProfileByEmail era il PRIMO passo di
// quasi tutte le altre strade, e siccome tornava null, tutto quello che
// veniva dopo veniva saltato in silenzio. E' cosi che `translations` e
// rimasta a zero righe per mesi (vedi app/api/translate/route.js).
//
// Resta viva una funzione sola: saveTranslation. `translations` esiste
// davvero, ed e la fonte del rapporto costi per fornitore
// (app/wallet/costi-fornitori.js).
// ═══════════════════════════════════════════════

// b.363 — isSupabaseEnabled era importato e mai usato: portato dentro
// insieme al resto quando il file fu adattato, non lo chiamava nessuno.
import { getSupabaseAdmin } from './supabase.js';
import { createLogger } from './logger.js';
const log = createLogger('supabaseAPI');

// ── Translations ──

export async function saveTranslation(translation) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('translations')
    .insert(translation)
    .select()
    .single();
  if (error) { log.error('saveTranslation error:', error.message); return null; }
  return data;
}
