import { NextResponse } from 'next/server';
import { safeCompare } from '../../../../lib/apiGuard.js';
import { ingestMondoLive } from '../../../../lib/mondo/liveIngest.js';
import { sendPushForEvents } from '../../../../lib/mondo/pushServer.js';
import { segnaVisita } from '../../../../lib/registroRotte.js';   // b.630

export const maxDuration = 60;

export async function GET(req) {
// b.630 — IL REGISTRO NON VEDEVA QUESTA ROTTA. Il conteggio delle
// visite (b.628) e agganciato a withApiGuard, e questa rotta non ci
// passa: al 3 dicembre avrebbe letto zero visite su una rotta viva.
// Trovato dal secondo revisore: le rotte fuori dalla guardia sono otto,
// non una. Qui si segna a mano, con lo stesso strumento.
  segnaVisita('/api/mondo/live/ingest');

  const pass = req.headers.get('x-admin-pass') || req.headers.get('authorization')?.replace('Bearer ', '');
  const ok = safeCompare(pass, process.env.CRON_SECRET) || safeCompare(pass, process.env.ADMIN_PASS);
  if (!ok) return NextResponse.json({ error: 'no' }, { status: 401 });

  try {
    const esito = await ingestMondoLive();
    const push = await sendPushForEvents(esito.newEvents || []);
    return NextResponse.json({
      ok: true,
      when: esito.when,
      queries: esito.queries,
      candidates: esito.candidates,
      events: esito.events,
      newEvents: esito.newEvents?.length || 0,
      push,
    });
  } catch (e) {
    return NextResponse.json({ error: 'live ingest failed', detail: String(e?.message || e).slice(0, 160) }, { status: 503 });
  }
}
