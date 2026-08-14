// GET /api/topics/video?q=...&lang=... — ricerca video YouTube (b.153)
// Cache condivisa 30 minuti: una ricerca costa 100 unita di quota,
// e la stessa query la fa piu di una persona.

import { NextResponse } from 'next/server';
import { redis } from '../../../lib/redis.js';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { cercaVideo, videoDisponibili } from '../../../lib/topics/video.js';
import { normalizzaQuery } from '../../../lib/topics/servizio.js';

const LINGUE = new Set(['it','en','es','fr','de','pt','zh','ja','ko','th','ar','hi','ru','tr','vi']);
const TTL = 30 * 60;

async function handleGet(req) {
  const url = new URL(req.url);
  const q = normalizzaQuery(url.searchParams.get('q') || '');
  const lang = LINGUE.has(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'en';
  if (!q) return NextResponse.json({ disponibile: videoDisponibili(), video: [] });

  const k = `topics:video:${lang}:${q}`;
  try {
    const salvato = await redis('GET', k);
    if (salvato) return NextResponse.json({ ...JSON.parse(salvato), daCache: true });
  } catch { /* la cache non risponde: si cerca da capo, nessun dramma */ }

  const esito = await cercaVideo(q, lang);
  // Si mette in cache solo un esito PIENO: una lettura fallita della
  // pagina non deve spegnere i video per mezz'ora a tutti.
  if (esito.video.length > 0) {
    try { await redis('SET', k, JSON.stringify(esito), 'EX', TTL); } catch { /* senza cache si vive */ }
  }
  return NextResponse.json(esito);
}

export const GET = withApiGuard(handleGet, { maxRequests: 15, prefix: 'topics-video', skipBodyCheck: true });
