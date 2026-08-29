import { acquireIngestLock, getLastIngestAt, readLiveEvents, releaseIngestLock } from '../../../lib/mondo/liveStore.js';
import { ingestMondoLive } from '../../../lib/mondo/liveIngest.js';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PRIMO_ACCESSO_MS = 2 * 60 * 60 * 1000;

function lista(v, max = 30) {
  return String(v || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, max);
}

function ts(e) {
  const n = Number(e?.updatedAt || e?.firstSeenAt);
  if (Number.isFinite(n) && n > 0) return n;
  const d = new Date(e?.publishedAt || 0).getTime();
  return Number.isFinite(d) ? d : 0;
}

function interessa(e, { topics, countries, breaking }) {
  if (e?.important) return true; // il mondo importante non si filtra via
  const t = new Set(topics);
  const c = new Set(countries.map((x) => String(x).toUpperCase()));
  if ((e?.topics || []).some((x) => t.has(x))) return true;
  if ((e?.countries || []).some((x) => c.has(String(x).toUpperCase()))) return true;
  return breaking === 'all';
}

export async function GET(req) {
  // EventSource si riconnette da solo. Il limite lascia ampio margine a
  // riconnessioni reali ma impedisce di trasformare il bus in uno scraper.
  const rl = await checkRateLimit(getRateLimitKey(req, 'mondo-live-sse'), 30);
  if (!rl.allowed) {
    return new Response('Too many live connections', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  const url = new URL(req.url);
  const rawSince = Math.max(0, Number(url.searchParams.get('since')) || 0);
  // Il primo ingresso non deve chiamare "breaking" le 36 ore del deposito:
  // mostra al massimo le ultime due ore. Dopo, il cursore utente e' preciso.
  const since = rawSince || (Date.now() - PRIMO_ACCESSO_MS);
  const topics = lista(url.searchParams.get('topics'));
  const countries = lista(url.searchParams.get('countries'), 8);
  const breaking = ['important', 'all', 'off'].includes(url.searchParams.get('breaking'))
    ? url.searchParams.get('breaking') : 'important';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let cursor = since;
      let chiuso = false;
      const send = (event, data) => {
        if (chiuso) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); }
        catch { chiuso = true; }
      };

      send('heartbeat', { status: breaking === 'off' ? 'off' : 'connecting', when: Date.now(), lastIngestAt: await getLastIngestAt() });
      if (breaking === 'off') {
        try { controller.close(); } catch { /* stream gia chiuso dal browser */ }
        return;
      }

      try {
        let lastIngestAt = await getLastIngestAt();
        // Il cron e' la strada principale. Questo e' il paracadute: se un
        // deploy o il provider ha saltato il cron, UN solo client riaccende
        // il redattore server; tutti gli altri continuano ad ascoltare.
        if (!lastIngestAt || Date.now() - lastIngestAt > 3 * 60 * 1000) {
          send('heartbeat', { status: 'refreshing', when: Date.now(), lastIngestAt });
          const lock = await acquireIngestLock();
          if (lock) {
            try {
              const r = await ingestMondoLive();
              lastIngestAt = r.when;
            } catch {
              // La coda salvata resta valida; l'heartbeat dichiara il
              // ripristino invece di fingere che il mondo sia calmo.
            } finally {
              await releaseIngestLock(lock);
            }
          }
        }

        for (let giro = 0; giro < 7 && !chiuso; giro += 1) {
          const eventi = (await readLiveEvents({ since: cursor, limit: 120 }))
            .filter((e) => interessa(e, { topics, countries, breaking }));
          if (eventi.length) {
            const newest = Math.max(cursor, ...eventi.map(ts));
            send('events', { events: eventi, cursor: newest, serverTime: Date.now() });
            cursor = newest;
          }
          lastIngestAt = await getLastIngestAt();
          const age = lastIngestAt ? Date.now() - lastIngestAt : null;
          send('heartbeat', {
            status: age !== null && age <= 4 * 60 * 1000 ? 'live' : 'recovering',
            when: Date.now(),
            lastIngestAt,
            age,
          });
          if (giro < 6) await sleep(7500);
        }
      } catch {
        send('heartbeat', { status: 'recovering', when: Date.now(), lastIngestAt: await getLastIngestAt() });
      } finally {
        if (!chiuso) {
          try { controller.close(); } catch { /* stream gia chiuso dal browser */ }
        }
      }
    },
    cancel() {
      // Il ciclo vede il controller chiuso al prossimo invio e termina.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
