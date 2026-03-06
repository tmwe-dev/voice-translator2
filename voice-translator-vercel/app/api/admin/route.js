import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';

// ═══════════════════════════════════════════════
// Admin Dashboard API
//
// Actions:
//   stats         — platform overview (users, revenue, costs, rooms)
//   users         — paginated user list with search
//   user-detail   — single user full detail
//   usage-chart   — daily usage for chart rendering
//   top-languages — most used language pairs
//   revenue       — revenue breakdown by day
//   errors        — recent translation failures
// ═══════════════════════════════════════════════

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

function isAdmin(email) {
  return ADMIN_EMAILS.includes((email || '').toLowerCase());
}

async function handlePost(req) {
  try {
    const { action, adminEmail, page, limit, search, userId, days } = await req.json();

    if (!isAdmin(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const numDays = days || 30;
    const numLimit = Math.min(limit || 50, 200);
    const numPage = page || 0;
    const dateFrom = new Date(Date.now() - numDays * 86400000).toISOString().split('T')[0];

    // ── Platform Stats ──
    if (action === 'stats') {
      const [users, proUsers, bizUsers, activeRooms, todayUsage, todayPayments, monthlyRevenue] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_plan', 'pro'),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_plan', 'business'),
        sb.from('rooms').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('usage_daily').select('translations, tts_chars, stt_seconds, cost_eur_cents, tokens_used').eq('date', new Date().toISOString().split('T')[0]),
        sb.from('payments').select('amount_eur_cents').eq('status', 'completed').gte('created_at', new Date().toISOString().split('T')[0]),
        sb.from('payments').select('amount_eur_cents').eq('status', 'completed').gte('created_at', dateFrom),
      ]);

      const todayData = todayUsage.data || [];
      return NextResponse.json({
        totalUsers: users.count || 0,
        proUsers: proUsers.count || 0,
        businessUsers: bizUsers.count || 0,
        activeRooms: activeRooms.count || 0,
        today: {
          translations: todayData.reduce((s, r) => s + (r.translations || 0), 0),
          ttsChars: todayData.reduce((s, r) => s + (r.tts_chars || 0), 0),
          sttSeconds: todayData.reduce((s, r) => s + (r.stt_seconds || 0), 0),
          costCents: todayData.reduce((s, r) => s + (r.cost_eur_cents || 0), 0),
          tokens: todayData.reduce((s, r) => s + (r.tokens_used || 0), 0),
          revenue: (todayPayments.data || []).reduce((s, r) => s + (r.amount_eur_cents || 0), 0),
        },
        monthlyRevenue: (monthlyRevenue.data || []).reduce((s, r) => s + (r.amount_eur_cents || 0), 0),
      });
    }

    // ── User List ──
    if (action === 'users') {
      let query = sb.from('profiles')
        .select('id, email, name, tier, credits, total_spent, total_messages, subscription_plan, subscription_status, created_at')
        .order('created_at', { ascending: false })
        .range(numPage * numLimit, (numPage + 1) * numLimit - 1);

      if (search) {
        query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ users: data || [], total: count });
    }

    // ── User Detail ──
    if (action === 'user-detail') {
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
      const [profile, settings, payments, usage, translations] = await Promise.all([
        sb.from('profiles').select('*').eq('id', userId).single(),
        sb.from('user_settings').select('*').eq('user_id', userId).single(),
        sb.from('payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
        sb.from('usage_daily').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
        sb.from('translations').select('source_lang, target_lang, provider, duration_ms, cost_eur_cents, created_at')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      ]);
      return NextResponse.json({
        profile: profile.data,
        settings: settings.data,
        payments: payments.data || [],
        usage: usage.data || [],
        recentTranslations: translations.data || [],
      });
    }

    // ── Usage Chart (daily aggregated for all users) ──
    if (action === 'usage-chart') {
      const { data } = await sb
        .from('usage_daily')
        .select('date, translations, tts_chars, stt_seconds, cost_eur_cents, tokens_used')
        .gte('date', dateFrom)
        .order('date', { ascending: true });

      // Aggregate by date
      const byDate = {};
      for (const row of (data || [])) {
        if (!byDate[row.date]) byDate[row.date] = { date: row.date, translations: 0, ttsChars: 0, sttSeconds: 0, costCents: 0, tokens: 0 };
        byDate[row.date].translations += row.translations || 0;
        byDate[row.date].ttsChars += row.tts_chars || 0;
        byDate[row.date].sttSeconds += row.stt_seconds || 0;
        byDate[row.date].costCents += row.cost_eur_cents || 0;
        byDate[row.date].tokens += row.tokens_used || 0;
      }
      return NextResponse.json({ chart: Object.values(byDate) });
    }

    // ── Top Language Pairs ──
    if (action === 'top-languages') {
      const { data } = await sb
        .from('translations')
        .select('source_lang, target_lang')
        .gte('created_at', new Date(Date.now() - numDays * 86400000).toISOString())
        .limit(10000);

      const pairs = {};
      for (const row of (data || [])) {
        const key = `${row.source_lang}→${row.target_lang}`;
        pairs[key] = (pairs[key] || 0) + 1;
      }
      const sorted = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 20);
      return NextResponse.json({ pairs: sorted.map(([pair, count]) => ({ pair, count })) });
    }

    // ── Revenue Chart ──
    if (action === 'revenue') {
      const { data } = await sb
        .from('payments')
        .select('amount_eur_cents, type, plan, created_at')
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - numDays * 86400000).toISOString())
        .order('created_at', { ascending: true });

      // Aggregate by date
      const byDate = {};
      for (const row of (data || [])) {
        const date = row.created_at.split('T')[0];
        if (!byDate[date]) byDate[date] = { date, credits: 0, subscriptions: 0, total: 0 };
        const amount = row.amount_eur_cents || 0;
        if (row.type === 'subscription') byDate[date].subscriptions += amount;
        else byDate[date].credits += amount;
        byDate[date].total += amount;
      }
      return NextResponse.json({ revenue: Object.values(byDate) });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('Admin API error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'admin' });
