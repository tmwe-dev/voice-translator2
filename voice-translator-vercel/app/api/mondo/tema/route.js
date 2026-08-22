// ═══════════════════════════════════════════════════════════════
// GET /api/mondo/tema?topic=... — COSA NE PENSA IL MONDO
//
// b.400. Il documento di Luca la chiama la funzione distintiva: preso un
// tema, confrontare le conversazioni fra Paesi.
//
// E pone il limite nello stesso paragrafo: «mai inventare percentuali o
// consenso». Quindi da qui non esce nessuna sintesi di cosa pensa un
// Paese e nessuna percentuale: escono CONTI — quante discussioni aperte
// su quel tema in ogni Paese, e quanti commenti dentro — piu il campione
// su cui sono stati fatti. Chi legge vede dove se ne parla e quanto, e ci
// entra a leggere con i suoi occhi.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createLogger } from '../../../lib/logger.js';
import { withApiGuard } from '../../../lib/apiGuard.js';

const log = createLogger('api-mondo-tema');

async function handleGet(req) {
  const url = new URL(req.url);
  const topic = (url.searchParams.get('topic') || '').trim().slice(0, 80);
  if (!topic) return NextResponse.json({ error: 'tema mancante' }, { status: 400 });
  try {
    const { paesiDelTema } = await import('../../../lib/mondoDB.js');
    const esito = await paesiDelTema(topic);
    return NextResponse.json({ topic, ...esito });
  } catch (e) {
    log.error('GET:', e.message);
    // b.236, stessa cura del resto di Mondo: un guasto non si traveste da
    // "nessuno ne parla". Sono due cose diverse e chi guarda deve saperlo.
    return NextResponse.json({ error: 'confronto non disponibile' }, { status: 503 });
  }
}

export const GET = withApiGuard(handleGet, { maxRequests: 30, prefix: 'mondo-tema', skipBodyCheck: true });
