import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { getSession } from '../../lib/users.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('admin');

// ═══════════════════════════════════════════════
// Admin Dashboard API
//
// Azioni:
//   top-languages — le coppie di lingue piu tradotte (tabella `translations`)
//
// Auth: sessione valida + email in ADMIN_EMAILS
//
// ═══════════════════════════════════════════════════════════════
// b.422 — IL CRUSCOTTO MOSTRAVA ZERI, NON DATI.
//
// Fino a ieri questa rotta rispondeva a sette azioni: stats, users,
// user-detail, usage-chart, top-languages, revenue, errors. Sei su
// sette interrogavano `profiles`, `rooms`, `usage_daily`, `payments`,
// `user_settings` — e verificato sul database vivo di produzione:
// NESSUNA DI QUESTE CINQUE TABELLE ESISTE nello schema `public`.
//
// Non tornavano errori: Supabase risponde con un errore che il codice
// leggeva come «zero righe». Quindi il pannello si apriva, si popolava
// di zeri e di tabelle vuote, e aveva l'aria di un cruscotto che
// funziona su un servizio senza clienti. E' la forma peggiore di
// guasto: non si vede, e chi guarda prende decisioni su numeri finti.
//
// Resta `top-languages`, che legge `translations` — l'unica tabella
// vera di questa rotta. I conti VERI del prodotto (economia, servizi
// AI, voucher, consumo per utente) stanno da un'altra parte e non sono
// mai passati di qui: /api/wallet/admin, pannello "Wallet" di /sesamo.
// ═══════════════════════════════════════════════════════════════

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

function isAdmin(email) {
  return ADMIN_EMAILS.includes((email || '').toLowerCase());
}

async function handlePost(req) {
  try {
    const { action, token, days } = await req.json();

    // Session-based auth: verify token, then check admin whitelist
    const session = token ? await getSession(token) : null;
    const verifiedEmail = session?.email;

    if (!verifiedEmail || !isAdmin(verifiedEmail)) {
      return NextResponse.json({ error: 'Unauthorized — valid admin session required' }, { status: 403 });
    }

    const sb = getSupabaseAdmin();
    // b.363 — uscita di guasto muta: dal registro sembrava che non
    // fosse successo niente. Il cruscotto restava vuoto e nessuno sapeva perche.
    if (!sb) {
      log.warn('Cruscotto amministrazione: Supabase non configurato');
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const numDays = days || 30;

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

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    log.error('Admin API error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'admin' });
