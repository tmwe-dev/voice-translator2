import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { getSession } from '../../lib/users.js';

// ═══════════════════════════════════════════════
// User Analytics API
//
// Actions:
//   summary     — 30-day overview stats
//   daily       — daily breakdown for chart
//   languages   — most used language pairs
//   providers   — provider usage breakdown
//   glossaries  — glossary list + management
// ═══════════════════════════════════════════════

export async function POST(req) {
  try {
    const { action, token, days } = await req.json();
    if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    // Verify session
    const session = await getSession(token);
    if (!session?.email) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const numDays = days || 30;
    const dateFrom = new Date(Date.now() - numDays * 86400000).toISOString().split('T')[0];

    // Get user ID from email
    const { data: profile } = await sb.from('profiles').select('id').eq('email', session.email).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const userId = profile.id;

    // ── Summary ──
    if (action === 'summary') {
      const { data } = await sb.rpc('get_user_analytics', { p_user_id: userId, p_days: numDays });
      const analytics = data?.[0] || {};

      // Also get recent translations count by language
      const { data: langData } = await sb
        .from('translations')
        .select('source_lang, target_lang')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - numDays * 86400000).toISOString())
        .limit(5000);

      const langPairs = {};
      for (const t of (langData || [])) {
        const key = `${t.source_lang}→${t.target_lang}`;
        langPairs[key] = (langPairs[key] || 0) + 1;
      }
      const topPairs = Object.entries(langPairs).sort((a, b) => b[1] - a[1]).slice(0, 10);

      return NextResponse.json({
        ...analytics,
        topLanguagePairs: topPairs.map(([pair, count]) => ({ pair, count })),
        period: numDays,
      });
    }

    // ── Daily Breakdown ──
    if (action === 'daily') {
      const { data } = await sb
        .from('usage_daily')
        .select('*')
        .eq('user_id', userId)
        .gte('date', dateFrom)
        .order('date', { ascending: true });

      return NextResponse.json({ daily: data || [] });
    }

    // ── Language Usage ──
    if (action === 'languages') {
      const { data } = await sb
        .from('translations')
        .select('source_lang, target_lang, provider, duration_ms')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - numDays * 86400000).toISOString())
        .limit(10000);

      const pairs = {};
      const providers = {};
      let totalDuration = 0;

      for (const t of (data || [])) {
        const pairKey = `${t.source_lang}→${t.target_lang}`;
        pairs[pairKey] = (pairs[pairKey] || 0) + 1;
        providers[t.provider || 'unknown'] = (providers[t.provider || 'unknown'] || 0) + 1;
        totalDuration += t.duration_ms || 0;
      }

      return NextResponse.json({
        languagePairs: Object.entries(pairs).sort((a, b) => b[1] - a[1]).map(([pair, count]) => ({ pair, count })),
        providers: Object.entries(providers).sort((a, b) => b[1] - a[1]).map(([provider, count]) => ({ provider, count })),
        totalTranslations: (data || []).length,
        avgDurationMs: (data || []).length > 0 ? Math.round(totalDuration / data.length) : 0,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('Analytics error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
