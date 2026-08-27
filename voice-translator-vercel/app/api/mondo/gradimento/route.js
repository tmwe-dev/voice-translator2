// ═══════════════════════════════════════════════════════════════
// IL CONTEGGIO DEI CUORI (b.544).
//
// «Non si puo dare un mi piace a nessuno» (Luca). Il conteggio e' di
// tutti e vive qui, su Redis, per indirizzo di contenuto: chi guarda
// vede quanto e' piaciuto agli altri, non solo a se stesso.
//
// Tre cautele, tutte e tre necessarie:
//   · il passo puo essere solo +1 o -1: nessuno puo regalarsi mille cuori
//     in una chiamata;
//   · il conteggio non scende mai sotto zero;
//   · le chiavi scadono dopo novanta giorni — un articolo di tre mesi fa
//     non deve occupare memoria per sempre.
// Chi mette il cuore non viene registrato: il «l'ho gia messo io» vive
// nel telefono (lib/gradimento.js), non qui. Meno cose sappiamo delle
// persone, meglio e.
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('mondo/gradimento');
const TTL = 90 * 24 * 3600;
const MAX_CHIAVI = 60;

const pulita = (k) => String(k || '').trim().slice(0, 200).replace(/\s/g, '');

async function handlePost(req) {
  try {
    const body = await req.json();
    const chiave = pulita(body?.chiave);
    const passo = Number(body?.passo) === -1 ? -1 : 1;
    if (!chiave) return NextResponse.json({ error: 'chiave mancante' }, { status: 400 });
    const k = `cuori:${chiave}`;
    let quanti = 0;
    try {
      quanti = Number(await redis('INCRBY', k, String(passo))) || 0;
      if (quanti < 0) { await redis('SET', k, '0'); quanti = 0; }
      await redis('EXPIRE', k, TTL);
    } catch (e) {
      log.warn('conteggio non salvato', { errore: e?.message });
      return NextResponse.json({ quanti: null, salvato: false });
    }
    return NextResponse.json({ chiave, quanti, salvato: true });
  } catch {
    return NextResponse.json({ quanti: null, salvato: false });
  }
}

async function handleGet(req) {
  try {
    const url = new URL(req.url);
    const chiavi = (url.searchParams.get('chiavi') || '')
      .split(',').map(pulita).filter(Boolean).slice(0, MAX_CHIAVI);
    if (!chiavi.length) return NextResponse.json({ conteggi: {} });
    const valori = await redis('MGET', ...chiavi.map((c) => `cuori:${c}`));
    const conteggi = {};
    chiavi.forEach((c, i) => {
      const n = Number(Array.isArray(valori) ? valori[i] : 0);
      if (Number.isFinite(n) && n > 0) conteggi[c] = n;
    });
    return NextResponse.json({ conteggi });
  } catch {
    return NextResponse.json({ conteggi: {} });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 120, prefix: 'cuori-post' });
export const GET = withApiGuard(handleGet, { maxRequests: 120, prefix: 'cuori-get' });
