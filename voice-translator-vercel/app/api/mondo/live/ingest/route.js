import { NextResponse } from 'next/server';
import { safeCompare } from '../../../../lib/apiGuard.js';
import { ingestMondoLive } from '../../../../lib/mondo/liveIngest.js';
import { sendPushForEvents } from '../../../../lib/mondo/pushServer.js';

export const maxDuration = 60;

export async function GET(req) {
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
