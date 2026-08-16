// ═══════════════════════════════════════════════════════════════
// GET /api/topics/search — la ricerca argomenti, in diretta
//
// Risponde in NDJSON: una riga JSON per ogni stadio del lavoro
// (stanze → cache|cerca → fonti → leggo×N → raggruppo → fine), cosi
// l'interfaccia puo mostrare il processo di Cobra mentre avviene,
// invece di una rotellina muta. L'ultima riga porta i risultati.
//
//   ?q=formula+1        la query (obbligatoria)
//   &lang=de            lingua dell'interfaccia (predefinita: en)
//   &cat=sport          categoria per il TTL della cache
//   &fresh=1            salta la cache condivisa (bottone Aggiorna)
//
// La guardia comune limita la frequenza: la ricerca fresca costa
// banda, e un limite stretto tiene il conto in ordine.
// ═══════════════════════════════════════════════════════════════

import { withApiGuard } from '../../../lib/apiGuard.js';
import { cercaArgomenti } from '../../../lib/topics/servizio.js';
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('topics');

// b.150 — con la riserva Google la ricerca fresca puo superare i 10s
// predefiniti delle funzioni Vercel: due richieste in piu per articolo
// per sbucciare i rimbalzi. Il tempo massimo va dichiarato, o la
// funzione muore a meta stream.
export const maxDuration = 60;

const LINGUE = new Set(['it','en','es','fr','de','pt','zh','ja','ko','th','ar','hi','ru','tr','vi']);
const CATEGORIE = new Set(['notizie','sport','tecnologia','economia','scienza','arte']);

async function handleGet(req) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').slice(0, 120);
  const lang = LINGUE.has(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'en';
  const cat = CATEGORIE.has(url.searchParams.get('cat')) ? url.searchParams.get('cat') : 'notizie';
  const fresca = url.searchParams.get('fresh') === '1';
  // b.185 — seconda modalita opt-in: ?deep=1 apre piu fonti (Wikipedia
  // accanto alle notizie); &fonti=N (3..10) dice quanto approfondire.
  const profonda = url.searchParams.get('deep') === '1';
  const fontiRaw = parseInt(url.searchParams.get('fonti') || '6', 10);
  const fonti = Number.isFinite(fontiRaw) ? Math.max(3, Math.min(fontiRaw, 10)) : 6;

  if (!q.trim()) {
    return new Response(JSON.stringify({ stadio: 'errore', motivo: 'query vuota' }) + '\n', {
      status: 400, headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const riga = (obj) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); }
        catch { /* client andato via: il lavoro si conclude comunque */ }
      };
      try {
        const esito = await cercaArgomenti(q, lang, {
          categoria: cat, fresca, profonda, fonti,
          racconta: (stadio, dati) => riga({ stadio, ...dati }),
        });
        riga({ stadio: 'fine', ...esito });
      } catch (e) {
        log.error('ricerca fallita:', e.message);
        riga({ stadio: 'errore', motivo: 'ricerca fallita' });
      } finally {
        try { controller.close(); } catch { /* lo stream era gia stato chiuso dal client che se n'e andato */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const GET = withApiGuard(handleGet, { maxRequests: 15, prefix: 'topics', skipBodyCheck: true });
