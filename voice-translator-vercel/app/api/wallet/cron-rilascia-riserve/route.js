import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../../../lib/logger.js';
import { safeCompare, withApiGuard } from '../../../lib/apiGuard.js';

const log = createLogger('cronRilasciaRiserve');

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ═══ CRON RILASCIO RISERVE SCADUTE — b.162-bis, lacuna trovata nel proprio
// audit ("cosa manca per il 10"): wallet_rilascia_riserve_scadute()
// (migrazione 010, b.161-bis) esiste da quando e' stata scritta ma non
// era mai stata agganciata a nessun cron — release()/commit() coprono
// gia ogni errore che passa dal catch della stessa invocazione
// serverless (transcribe/translate/tts), ma una riserva 'attiva' il cui
// processo muore SENZA passare dal catch (timeout Vercel, OOM) restava
// bloccata per sempre, non per 10 minuti come il commento della
// migrazione prometteva. GET (con x-admin-pass o CRON_SECRET): rilascia
// ogni riserva ancora 'attiva' da piu di 10 minuti. Stesso schema di
// cron-rimborso-regali (safeCompare, timing-safe).
async function handleGet(req) {
  // b.166 — CONFERMATO (caccia al tesoro): stesso buco delle due rotte
  // gemelle — safeCompare ma nessun limite al numero di tentativi.
  const { checkRateLimit, getRateLimitKey } = await import('../../../lib/rateLimit.js');
  const rl = await checkRateLimit(getRateLimitKey(req, 'wallet-cron-riserve'), 5);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const pass = req.headers.get('x-admin-pass') || req.headers.get('authorization')?.replace('Bearer ', '');
  const ok = safeCompare(pass, process.env.ADMIN_PASS) || safeCompare(pass, process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: 'no' }, { status: 401 });

  try {
    const { data, error } = await db().rpc('wallet_rilascia_riserve_scadute');
    if (error) throw error;
    const rilasciate = data ?? 0;
    if (rilasciate > 0) log.info(`Rilasciate ${rilasciate} riserve scadute (>10min attive)`);
    return NextResponse.json({ rilasciate });
  } catch (e) {
    log.error('Rilascio riserve scadute fallito:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// b.363 — rotta di manutenzione protetta da una password, ma fuori dalla
// guardia comune: il conteggio interno c'era, il resto delle protezioni
// condivise no. La chiave della guardia e distinta da quella interna, per
// non far contare due volte la stessa chiamata.
export const GET = withApiGuard(handleGet, { maxRequests: 10, prefix: 'wallet-cron-riserve-guard', skipBodyCheck: true });
