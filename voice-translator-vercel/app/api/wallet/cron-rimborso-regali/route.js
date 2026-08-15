import { NextResponse } from 'next/server';
import { rimborsaRegaliScaduti } from '../../../wallet/regali.js';
import { createLogger } from '../../../lib/logger.js';
import { safeCompare } from '../../../lib/apiGuard.js';

const log = createLogger('cronRimborsoRegali');

// ═══ CRON RIMBORSO REGALI — punto 8 dell'ordine di intervento (b.161) ═══
// GET (con x-admin-pass o CRON_SECRET): rimborsa i regali non riscattati
// da oltre 30 giorni (wallet_rimborsa_regali, gia esistente e blindata
// da b.154/migration 006 — qui la si chiama soltanto, per la prima volta).
// Da chiamare una volta al giorno con un cron Vercel (vedi vercel.json).
// Stesso schema di /api/wallet/snapshot, ma con safeCompare (timing-safe,
// vedi la correzione gemella in api/wallet/admin/route.js in questo
// stesso giro) invece di un confronto diretto.
export async function GET(req) {
  // b.166 — CONFERMATO (caccia al tesoro): stesso buco di /api/wallet/
  // snapshot — safeCompare ma nessun limite al numero di tentativi.
  const { checkRateLimit, getRateLimitKey } = await import('../../../lib/rateLimit.js');
  const rl = await checkRateLimit(getRateLimitKey(req, 'wallet-cron-regali'), 5);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const pass = req.headers.get('x-admin-pass') || req.headers.get('authorization')?.replace('Bearer ', '');
  const ok = safeCompare(pass, process.env.ADMIN_PASS) || safeCompare(pass, process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: 'no' }, { status: 401 });

  try {
    const rimborsati = await rimborsaRegaliScaduti();
    if (rimborsati > 0) log.info(`Rimborsati ${rimborsati} regali scaduti (>30gg non riscattati)`);
    return NextResponse.json({ rimborsati });
  } catch (e) {
    log.error('Rimborso regali fallito:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
