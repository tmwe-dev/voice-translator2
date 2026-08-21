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
// ═══════════════════════════════════════════════

// b.363 — isSupabaseEnabled era importato e mai usato: portato dentro
// insieme al resto quando il file fu adattato, non lo chiamava nessuno.
import { getSupabaseAdmin } from './supabase.js';
import { createLogger } from './logger.js';
const log = createLogger('supabaseAPI');

// ── Profile ──

export async function getProfileByEmail(email) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  if (error) return null;
  return data;
}

// ── Settings ──

export async function getUserSettings(userId) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function saveUserSettings(userId, settings) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('user_settings')
    .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) { log.error('saveSettings error:', error.message); return null; }
  return data;
}

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

// ── Payments ──

export async function savePayment(payment) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('payments')
    .insert(payment)
    .select()
    .single();
  if (error) { log.error('savePayment error:', error.message); return null; }
  return data;
}

// ── Usage Analytics ──

export async function trackUsage(userId, stats) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  try {
    await sb.rpc('increment_usage', {
      p_user_id: userId,
      p_translations: stats.translations || 0,
      p_tts_chars: stats.ttsChars || 0,
      p_stt_seconds: stats.sttSeconds || 0,
      p_cost_cents: stats.costCents || 0,
      p_tokens: stats.tokens || 0,
    });
  } catch (e) {
    log.error('trackUsage error:', e.message);
  }
}

// ── Credits (atomic operations via RPC) ──

export async function addCreditsDB(userId, amount) {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { data, error } = await sb.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) { log.error('addCredits error:', error.message); return 0; }
  return data;
}

// ── Audit Log ──

export async function logAudit(userId, action, resource, details, ipAddress) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  try {
    await sb.from('audit_logs').insert({
      user_id: userId,
      action,
      resource,
      details: details || {},
      ip_address: ipAddress,
    });
  } catch (e) {
    log.error('logAudit error:', e.message);
  }
}
