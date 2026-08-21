import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { getSession } from '../../lib/users.js';
import { TESTING_MODE } from '../../lib/config.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('glossary');

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

// ── b.363 · NOME, DOMINIO, LINGUE E VOCI ANDAVANO IN ARCHIVIO GREZZI ──
//
// In creazione e in modifica si scriveva in database esattamente quello
// che il client mandava: `payload.name`, `payload.domain`, `payload.entries`.
// Nessun controllo di tipo, nessun tetto di lunghezza, nessun tetto al
// numero di voci. Un nome da un milione di caratteri, o una lista di
// centomila voci, entrava senza discussioni — e poi ogni traduzione se lo
// portava dentro le istruzioni mandate al modello, a pagamento.
// Un glossario vero ha un nome corto e qualche centinaio di voci.
const MAX_NOME = 100;
const MAX_DOMINIO = 60;
const MAX_LINGUA = 12;
const MAX_VOCI = 500;
const MAX_TESTO_VOCE = 200;

function parolaPulita(v, max) {
  return typeof v === 'string' && v.length <= max ? v : null;
}

// Ogni voce e' una coppia "questo si traduce cosi", piu un contesto
// facoltativo. Tutto il resto che il client ci mette dentro si butta.
function vociPulite(grezze) {
  if (grezze === undefined) return undefined;
  if (!Array.isArray(grezze)) return null;
  if (grezze.length > MAX_VOCI) return null;
  const pulite = [];
  for (const voce of grezze) {
    if (!voce || typeof voce !== 'object') return null;
    const source = parolaPulita(voce.source, MAX_TESTO_VOCE);
    const target = parolaPulita(voce.target, MAX_TESTO_VOCE);
    if (!source || !target) return null;
    const context = voce.context === undefined || voce.context === null
      ? undefined
      : parolaPulita(voce.context, MAX_TESTO_VOCE);
    if (context === null) return null;
    pulite.push(context ? { source, target, context } : { source, target });
  }
  return pulite;
}

async function handlePost(req) {
  try {
    const corpo = await req.json();
    // b.363 — `token` andava nella ricerca della sessione e `glossaryId`
    // nel filtro della query, entrambi senza guardarne il tipo.
    const action = typeof corpo?.action === 'string' ? corpo.action : null;
    const token = typeof corpo?.token === 'string' && corpo.token.length <= 200 ? corpo.token : null;
    const glossaryId = typeof corpo?.glossaryId === 'string' && corpo.glossaryId.length <= 64 ? corpo.glossaryId : null;
    const payload = corpo?.data && typeof corpo.data === 'object' && !Array.isArray(corpo.data) ? corpo.data : null;
    if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    const session = await getSession(token);
    if (!session?.email) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const sb = getSupabaseAdmin();
    // b.363 — uscita di guasto muta: dal registro sembrava che non
    // fosse successo niente. I glossari sparivano e non risultava da nessuna parte.
    if (!sb) {
      log.warn('Glossari: Supabase non configurato');
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { data: profile } = await sb.from('profiles').select('id, tier').eq('email', session.email).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const userId = profile.id;

    // Check tier (free users can't use glossaries) — skip in TESTING_MODE
    // b.159 — CONFERMATO: stesso difetto di voice-clone/route.js (audit
    // b.158, punto 13, esteso qui — l'audit citava solo voice-clone ma
    // la stessa lettura grezza c'era identica anche qui). Ora usa la
    // costante blindata di config.js.
    const testingMode = TESTING_MODE;
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

      // b.363 — vedi la nota in cima: qui entrava in archivio tutto quello
      // che arrivava, cosi com'era.
      const nome = payload?.name === undefined ? 'Nuovo Glossario' : parolaPulita(payload.name, MAX_NOME);
      const dominio = payload?.domain === undefined ? 'general' : parolaPulita(payload.domain, MAX_DOMINIO);
      const linguaDa = payload?.source_lang === undefined ? 'it' : parolaPulita(payload.source_lang, MAX_LINGUA);
      const linguaA = payload?.target_lang === undefined ? 'en' : parolaPulita(payload.target_lang, MAX_LINGUA);
      const voci = payload?.entries === undefined ? [] : vociPulite(payload.entries);
      if (nome === null || dominio === null || linguaDa === null || linguaA === null || voci === null) {
        return NextResponse.json({ error: 'Dati del glossario non validi' }, { status: 400 });
      }

      const { data, error } = await sb.from('glossaries').insert({
        user_id: userId,
        name: nome || 'Nuovo Glossario',
        domain: dominio || 'general',
        source_lang: linguaDa || 'it',
        target_lang: linguaA || 'en',
        entries: voci,
        is_active: true,
      }).select().single();

      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. La scrittura in archivio falliva in silenzio.
      if (error) {
        log.error('Creazione glossario fallita');
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    // ── Update ──
    if (action === 'update') {
      if (!glossaryId) return NextResponse.json({ error: 'glossaryId required' }, { status: 400 });
      // b.363 — stessa scrittura grezza della creazione, per giunta su un
      // glossario gia esistente: bastava una modifica per sostituire un
      // elenco sano con qualunque cosa.
      const updates = {};
      if (payload?.name !== undefined) {
        const nome = parolaPulita(payload.name, MAX_NOME);
        if (nome === null) return NextResponse.json({ error: 'Nome non valido' }, { status: 400 });
        updates.name = nome;
      }
      if (payload?.domain !== undefined) {
        const dominio = parolaPulita(payload.domain, MAX_DOMINIO);
        if (dominio === null) return NextResponse.json({ error: 'Dominio non valido' }, { status: 400 });
        updates.domain = dominio;
      }
      if (payload?.entries !== undefined) {
        const voci = vociPulite(payload.entries);
        if (voci === null) return NextResponse.json({ error: `Voci non valide (massimo ${MAX_VOCI})` }, { status: 400 });
        updates.entries = voci;
      }
      // Sono due interruttori: acceso o spento, niente altro.
      if (payload?.is_active !== undefined) {
        if (typeof payload.is_active !== 'boolean') return NextResponse.json({ error: 'is_active non valido' }, { status: 400 });
        updates.is_active = payload.is_active;
      }
      if (payload?.is_shared !== undefined) {
        if (typeof payload.is_shared !== 'boolean') return NextResponse.json({ error: 'is_shared non valido' }, { status: 400 });
        updates.is_shared = payload.is_shared;
      }
      updates.updated_at = new Date().toISOString();

      const { data, error } = await sb.from('glossaries')
        .update(updates).eq('id', glossaryId).eq('user_id', userId).select().single();
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. La scrittura in archivio falliva in silenzio.
      if (error) {
        log.error('Modifica glossario fallita');
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
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
      // b.363 — le due lingue finivano dritte nel filtro della query.
      const sourceLang = parolaPulita(payload?.source_lang, MAX_LINGUA);
      const targetLang = parolaPulita(payload?.target_lang, MAX_LINGUA);
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
    log.error('Glossary error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'glossary' });
