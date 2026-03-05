// ═══════════════════════════════════════════════
// Supabase API Wrapper — Server-side CRUD
// Adapted from BarTalk v79 supabaseAPI.ts
//
// All functions use the admin client (bypasses RLS)
// For use in API routes only
// ═══════════════════════════════════════════════

import { getSupabaseAdmin, isSupabaseEnabled } from './supabase.js';

// ── Profile ──

export async function getProfile(userId) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) { console.error('[Supabase] getProfile error:', error.message); return null; }
  return data;
}

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

export async function updateProfile(userId, updates) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) { console.error('[Supabase] updateProfile error:', error.message); return null; }
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
  if (error) { console.error('[Supabase] saveSettings error:', error.message); return null; }
  return data;
}

// ── API Keys Vault ──

export async function getVaultKeys(userId) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('api_keys_vault')
    .select('provider, model, created_at')
    .eq('user_id', userId);
  if (error) return [];
  return data;
}

export async function saveVaultKey(userId, provider, encryptedKey, model) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('api_keys_vault')
    .upsert({
      user_id: userId,
      provider,
      encrypted_key: encryptedKey,
      model,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) { console.error('[Supabase] saveVaultKey error:', error.message); return null; }
  return data;
}

export async function getVaultKey(userId, provider) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('api_keys_vault')
    .select('encrypted_key, model')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();
  if (error) return null;
  return data;
}

export async function deleteVaultKey(userId, provider) {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { error } = await sb
    .from('api_keys_vault')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);
  return !error;
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
  if (error) { console.error('[Supabase] saveTranslation error:', error.message); return null; }
  return data;
}

export async function getUserTranslations(userId, limit = 50, offset = 0) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('translations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return [];
  return data;
}

// ── Conversations ──

export async function saveConversation(conversation) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('conversations')
    .insert(conversation)
    .select()
    .single();
  if (error) { console.error('[Supabase] saveConversation error:', error.message); return null; }
  return data;
}

export async function getUserConversations(userId, limit = 50) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data;
}

export async function getConversation(conversationId) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();
  if (error) return null;
  return data;
}

// ── Glossaries ──

export async function getUserGlossaries(userId) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('glossaries')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) return [];
  return data;
}

export async function saveGlossary(glossary) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('glossaries')
    .upsert({ ...glossary, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) { console.error('[Supabase] saveGlossary error:', error.message); return null; }
  return data;
}

export async function getGlossary(glossaryId) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('glossaries')
    .select('*')
    .eq('id', glossaryId)
    .single();
  if (error) return null;
  return data;
}

export async function deleteGlossary(glossaryId, userId) {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { error } = await sb
    .from('glossaries')
    .delete()
    .eq('id', glossaryId)
    .eq('user_id', userId);
  return !error;
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
  if (error) { console.error('[Supabase] savePayment error:', error.message); return null; }
  return data;
}

export async function getUserPayments(userId, limit = 50) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
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
    console.error('[Supabase] trackUsage error:', e.message);
  }
}

export async function getUserAnalytics(userId, days = 30) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_user_analytics', {
    p_user_id: userId,
    p_days: days,
  });
  if (error) return null;
  return data?.[0] || null;
}

export async function getDailyUsage(userId, days = 30) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('usage_daily')
    .select('*')
    .eq('user_id', userId)
    .gte('date', new Date(Date.now() - days * 86400000).toISOString().split('T')[0])
    .order('date', { ascending: true });
  if (error) return [];
  return data;
}

// ── Credits (atomic operations via RPC) ──

export async function deductCreditsDB(userId, amount) {
  const sb = getSupabaseAdmin();
  if (!sb) return -1;
  const { data, error } = await sb.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) { console.error('[Supabase] deductCredits error:', error.message); return -1; }
  return data;
}

export async function addCreditsDB(userId, amount) {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { data, error } = await sb.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) { console.error('[Supabase] addCredits error:', error.message); return 0; }
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
    console.error('[Supabase] logAudit error:', e.message);
  }
}

// ── GDPR: Delete all user data ──

export async function deleteAllUserData(userId) {
  const sb = getSupabaseAdmin();
  if (!sb) return { deleted: [] };
  const deleted = [];
  try {
    // Order matters: children first
    await sb.from('audit_logs').delete().eq('user_id', userId); deleted.push('audit_logs');
    await sb.from('translations').delete().eq('user_id', userId); deleted.push('translations');
    await sb.from('conversations').delete().eq('user_id', userId); deleted.push('conversations');
    await sb.from('glossaries').delete().eq('user_id', userId); deleted.push('glossaries');
    await sb.from('payments').delete().eq('user_id', userId); deleted.push('payments');
    await sb.from('contacts').delete().eq('user_id', userId); deleted.push('contacts');
    await sb.from('api_keys_vault').delete().eq('user_id', userId); deleted.push('api_keys');
    await sb.from('user_settings').delete().eq('user_id', userId); deleted.push('settings');
    await sb.from('usage_daily').delete().eq('user_id', userId); deleted.push('usage');
    await sb.from('profiles').delete().eq('id', userId); deleted.push('profile');
    // Finally delete from auth
    await sb.auth.admin.deleteUser(userId); deleted.push('auth');
  } catch (e) {
    console.error('[Supabase] deleteAllUserData error:', e.message);
  }
  return { deleted };
}

// ── Subscription Plans ──

export async function getSubscriptionPlans() {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_eur_monthly', { ascending: true });
  if (error) return [];
  return data;
}

// ── Admin: Platform stats ──

export async function getPlatformStats() {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const [users, todayUsage, todayPayments, activeRooms] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('usage_daily').select('translations, cost_eur_cents, tokens_used').eq('date', new Date().toISOString().split('T')[0]),
      sb.from('payments').select('amount_eur_cents').eq('status', 'completed').gte('created_at', new Date().toISOString().split('T')[0]),
      sb.from('rooms').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    return {
      totalUsers: users.count || 0,
      activeRooms: activeRooms.count || 0,
      todayTranslations: todayUsage.data?.reduce((s, r) => s + (r.translations || 0), 0) || 0,
      todayCostCents: todayUsage.data?.reduce((s, r) => s + (r.cost_eur_cents || 0), 0) || 0,
      todayTokens: todayUsage.data?.reduce((s, r) => s + (r.tokens_used || 0), 0) || 0,
      todayRevenueCents: todayPayments.data?.reduce((s, r) => s + (r.amount_eur_cents || 0), 0) || 0,
    };
  } catch (e) {
    console.error('[Supabase] getPlatformStats error:', e.message);
    return null;
  }
}
