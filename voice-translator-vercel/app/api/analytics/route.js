import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession } from '../../lib/users.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('analytics');

// ═══════════════════════════════════════════════════════════════
// b.422 — LE STATISTICHE PERSONALI NON SONO MAI ARRIVATE AL PRIMO PASSO.
//
// Questa rotta offriva quattro azioni — summary, daily, languages,
// providers — e tutte e quattro cominciavano dalla stessa riga:
//
//     const { data: profile } = await sb.from('profiles')
//       .select('id').eq('email', session.email).single();
//     if (!profile) return ... 404 'Profile not found'
//
// Verificato sul database vivo di produzione: `public.profiles` NON
// ESISTE. Quindi OGNI chiamata usciva con 404 alla riga sopra, sempre,
// per chiunque. Le azioni sotto — che leggevano `usage_daily` (anche
// lei inesistente), la funzione `get_user_analytics` e `translations`
// filtrata per `user_id` — non sono mai state eseguite nemmeno una
// volta.
//
// E non sono nemmeno recuperabili: `translations` esiste, ma il suo
// `user_id` nasceva come chiave esterna verso `profiles`, quindi non
// c'e piu nessun modo di dire quali traduzioni siano di chi. Senza
// quel filtro le stesse query risponderebbero con i dati di TUTTI a
// chiunque sia collegato — che non e la stessa funzione con meno
// precisione, e un'altra funzione e sbagliata.
//
// Restano la porta e la sua guardia, perche l'indirizzo e ancora
// bersagliato da fuori (vedi sotto) e una porta che si apre e peggio di
// una che risponde "azione sconosciuta".
//
// ── DA GUARDARE, NON RISOLTO QUI ──
// app/lib/monitor.js manda a /api/analytics due `navigator.sendBeacon`
// (errori del browser e metriche). Non sono mai stati accettati: il
// beacon non porta nessun `token`, quindi si e sempre fermato al 401
// della riga qui sotto — molto prima di `profiles`. Gli errori veri li
// raccoglie Sentry (sentry.client.config.js). Toccare il monitoraggio
// non e parte di questa pulizia: qui si annota e basta.
// ═══════════════════════════════════════════════════════════════

async function handlePost(req) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    // Verify session
    const session = await getSession(token);
    if (!session?.email) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    log.error('Analytics error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'analytics' });
