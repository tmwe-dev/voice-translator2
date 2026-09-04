import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fotografaTutti } from '../../../wallet/riconciliazione.js';
import { safeCompare } from '../../../lib/apiGuard.js';
import { segnaVisita } from '../../../lib/registroRotte.js';   // b.630

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
// b.630 — IL REGISTRO NON VEDEVA QUESTA ROTTA. Il conteggio delle
// visite (b.628) e agganciato a withApiGuard, e questa rotta non ci
// passa: al 3 dicembre avrebbe letto zero visite su una rotta viva.
// Trovato dal secondo revisore: le rotte fuori dalla guardia sono otto,
// non una. Qui si segna a mano, con lo stesso strumento.
  segnaVisita('/api/wallet/snapshot');

  // b.166 — CONFERMATO (caccia al tesoro): safeCompare toglie l'attacco a
  // tempo, ma senza un limite al NUMERO di tentativi un ADMIN_PASS/
  // CRON_SECRET debole o parzialmente compromesso poteva essere provato
  // senza freno — a differenza di /api/startrek (5/min) e /api/wallet/
  // admin (30/min via withApiGuard). Stesso limite di startrek: e' un
  // controllo password, non il traffico normale del cron.
  const { checkRateLimit, getRateLimitKey } = await import('../../../lib/rateLimit.js');
  const rl = await checkRateLimit(getRateLimitKey(req, 'wallet-snapshot'), 5);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const pass = req.headers.get('x-admin-pass') || req.headers.get('authorization')?.replace('Bearer ', '');
  const ok = safeCompare(pass, process.env.ADMIN_PASS) || safeCompare(pass, process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: 'no' }, { status: 401 });

  const letture = await fotografaTutti();

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } });
  // b.246 — anche i fornitori che NON si riescono a leggere vanno registrati.
  // Prima `if (l.errore) continue` li saltava in silenzio: in provider_snapshots
  // c'era solo ElevenLabs e sembrava che gli altri non avessero consumi, mentre
  // semplicemente nessuno era riuscito a interrogarli. Un buco nel controllo
  // costi che si presentava come "tutto a posto".
  for (const l of letture) {
    await db.from('provider_snapshots').insert({ provider: l.provider, dati: l });
  }
  return NextResponse.json({ letture });
}
