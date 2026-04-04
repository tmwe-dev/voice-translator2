import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { getSession } from '../../lib/users.js';

// ═══════════════════════════════════════════════
// Glossary API — Domain-specific translation rules
//
// Actions:
//   list     — get user's glossaries
//   get      — get single glossary with entries
//   create   — create new glossary
//   update   — update glossary name/entries
//   delete   — delete glossary
//   inject   — get active glossary entries for a language pair (for prompt injection)
// ═══════════════════════════════════════════════

async function handlePost(req) {
  try {
    const { action, token, glossaryId, data: payload } = await req.json();
    if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    const session = await getSession(token);
    if (!session?.email) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const { data: profile } = await sb.from('profiles').select('id, tier').eq('email', session.email).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const userId = profile.id;

    // Check tier (free users can't use glossaries) — skip in TESTING_MODE
    const testingMode = process.env.TESTING_MODE === 'true';
    if (!testingMode && profile.tier === 'free' && action !== 'list') {
      return NextResponse.json({ error: 'Glossaries require Pro or Business plan' }, { status: 403 });
    }

    // ── List ──
    if (action === 'list') {
      const { data } = await sb.from('glossaries')
        .select('id, name, domain, source_lang, target_lang, is_active, is_shared, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      return NextResponse.json({ glossaries: data || [] });
    }

    // ── Get ──
    if (action === 'get') {
      if (!glossaryId) return NextResponse.json({ error: 'glossaryId required' }, { status: 400 });
      const { data } = await sb.from('glossaries').select('*').eq('id', glossaryId).eq('user_id', userId).single();
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(data);
    }

    // ── Create ──
    if (action === 'create') {
      // Check glossary limit
      const { count } = await sb.from('glossaries').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      const limit = profile.tier === 'business' ? 999 : 5;
      if ((count || 0) >= limit) {
        return NextResponse.json({ error: `Glossary limit reached (${limit})` }, { status: 403 });
      }

      const { data, error } = await sb.from('glossaries').insert({
        user_id: userId,
        name: payload?.name || 'Nuovo Glossario',
        domain: payload?.domain || 'general',
        source_lang: payload?.source_lang || 'it',
        target_lang: payload?.target_lang || 'en',
        entries: payload?.entries || [],
        is_active: true,
      }).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // ── Update ──
    if (action === 'update') {
      if (!glossaryId) return NextResponse.json({ error: 'glossaryId required' }, { status: 400 });
      const updates = {};
      if (payload?.name !== undefined) updates.name = payload.name;
      if (payload?.domain !== undefined) updates.domain = payload.domain;
      if (payload?.entries !== undefined) updates.entries = payload.entries;
      if (payload?.is_active !== undefined) updates.is_active = payload.is_active;
      if (payload?.is_shared !== undefined) updates.is_shared = payload.is_shared;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await sb.from('glossaries')
        .update(updates).eq('id', glossaryId).eq('user_id', userId).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // ── Delete ──
    if (action === 'delete') {
      if (!glossaryId) return NextResponse.json({ error: 'glossaryId required' }, { status: 400 });
      await sb.from('glossaries').delete().eq('id', glossaryId).eq('user_id', userId);
      return NextResponse.json({ ok: true });
    }

    // ── Inject: get active glossary entries for translation prompt ──
    if (action === 'inject') {
      const sourceLang = payload?.source_lang;
      const targetLang = payload?.target_lang;
      if (!sourceLang || !targetLang) return NextResponse.json({ error: 'Languages required' }, { status: 400 });

      const { data } = await sb.from('glossaries')
        .select('name, domain, entries')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('source_lang', sourceLang)
        .eq('target_lang', targetLang);

      if (!data || data.length === 0) return NextResponse.json({ entries: [], prompt: '' });

      // Build glossary prompt section
      const allEntries = [];
      for (const g of data) {
        for (const entry of (g.entries || [])) {
          allEntries.push(entry);
        }
      }

      let prompt = '';
      if (allEntries.length > 0) {
        const lines = allEntries.map(e =>
          `"${e.source}" → "${e.target}"${e.context ? ` (${e.context})` : ''}`
        ).join('\n');
        prompt = `\n\n[GLOSSARY — Always use these translations]\n${lines}`;
      }

      return NextResponse.json({ entries: allEntries, prompt });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('Glossary error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'glossary' });
