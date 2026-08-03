import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fotografaTutti } from '../../../wallet/riconciliazione.js';

// ═══ SNAPSHOT CONTATORI PROVIDER ═══
// GET (con x-admin-pass o CRON_SECRET): legge i contatori veri dei
// provider e li salva in provider_snapshots. Da chiamare ogni ora
// con un cron Vercel. Il monitor admin confronta interno vs provider.
export async function GET(req) {
  const pass = req.headers.get('x-admin-pass') || req.headers.get('authorization')?.replace('Bearer ', '');
  const ok = (process.env.ADMIN_PASS && pass === process.env.ADMIN_PASS)
    || (process.env.CRON_SECRET && pass === process.env.CRON_SECRET);
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
