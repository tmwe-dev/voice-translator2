import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fotografaTutti } from '../../../wallet/riconciliazione.js';
import { safeCompare } from '../../../lib/apiGuard.js';

// ═══ SNAPSHOT CONTATORI PROVIDER ═══
// GET (con x-admin-pass o CRON_SECRET): legge i contatori veri dei
// provider e li salva in provider_snapshots. Da chiamare ogni ora
// con un cron Vercel. Il monitor admin confronta interno vs provider.
//
// b.161 — CONFERMATO dal vivo (log Vercel, 7 giorni): questa rotta
// riceve la chiamata del cron ogni ora, regolarmente, e risponde SEMPRE
// 401 — e il motivo per cui provider_snapshots e ancora a 0 righe (vedi
// punto 4 dell'ordine di intervento). Il confronto e stato comunque
// portato a safeCompare (timing-safe, coerente con admin/route.js e con
// la nuova cron-rimborso-regali) mentre si era qui: non risolve da solo
// il 401 (il sospetto resta CRON_SECRET non impostato su Vercel — una
// credenziale, non deducibile dal codice), ma toglie la stessa
// debolezza di temporizzazione gia corretta altrove.
export async function GET(req) {
  const pass = req.headers.get('x-admin-pass') || req.headers.get('authorization')?.replace('Bearer ', '');
  const ok = safeCompare(pass, process.env.ADMIN_PASS) || safeCompare(pass, process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: 'no' }, { status: 401 });

  const letture = await fotografaTutti();

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } });
  for (const l of letture) {
    if (l.errore) continue;
    await db.from('provider_snapshots').insert({ provider: l.provider, dati: l });
  }
  return NextResponse.json({ letture });
}
