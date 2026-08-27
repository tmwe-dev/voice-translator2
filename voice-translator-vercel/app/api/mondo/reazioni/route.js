// ═══════════════════════════════════════════════════════════════
// IL CONTEGGIO DELLE FACCINE (b.545).
//
// «😊 Reazione (tienilo premuto: si apre il ventaglio di emoticon come
// Instagram)» (Luca). Come per i cuori di b.544, il conteggio e' di
// tutti e vive qui, su Redis, per indirizzo di contenuto e per faccia:
// chi guarda vede cosa hanno provato gli altri, non solo se stesso.
//
// Qui pero non arriva un passo +1/-1 ma la coppia prima/dopo, perche
// cambiare faccia e' un togliere e un mettere nello stesso gesto: si
// scala la vecchia, si alza la nuova. Una delle due puo mancare (metto
// per la prima volta, oppure tolgo e basta), e se prima e dopo sono
// uguali non si tocca niente — e' il caso della chiamata ripetuta due
// volte dalla rete ballerina, e deve costare zero.
//
// Le solite tre cautele, che valgono ancora:
//   · si accettano solo le sei facce conosciute: nessuno puo inventarsi
//     un conteggio nuovo passando un id qualsiasi;
//   · il conteggio non scende mai sotto zero;
//   · le chiavi scadono dopo novanta giorni — un articolo di tre mesi fa
//     non deve occupare memoria per sempre.
// Chi reagisce non viene registrato: il «quale ho messo io» vive nel
// telefono (lib/reazioni.js), non qui. Meno cose sappiamo delle persone,
// meglio e.
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import { REAZIONI } from '../../../lib/reazioni.js';

const log = createLogger('mondo/reazioni');
const TTL = 90 * 24 * 3600;
const MAX_CHIAVI = 40;
const IDS = REAZIONI.map((r) => r.id);

const pulita = (k) => String(k || '').trim().slice(0, 200).replace(/\s/g, '');
const facciaValida = (id) => (IDS.includes(String(id || '')) ? String(id) : null);
const cella = (chiave, id) => `reaz:${chiave}:${id}`;

// Un solo passo su una sola faccia: alza o scala, mai sotto zero, e
// rinnova la scadenza. Torna quanti sono rimasti, o null se Redis tace.
async function muovi(chiave, id, passo) {
  const k = cella(chiave, id);
  let quanti = Number(await redis('INCRBY', k, String(passo))) || 0;
  if (quanti < 0) { await redis('SET', k, '0'); quanti = 0; }
  await redis('EXPIRE', k, TTL);
  return quanti;
}

async function handlePost(req) {
  try {
    const body = await req.json();
    const chiave = pulita(body?.chiave);
    const prima = facciaValida(body?.prima);
    const dopo = facciaValida(body?.dopo);
    if (!chiave) return NextResponse.json({ error: 'chiave mancante' }, { status: 400 });
    // niente e' cambiato (o non e' cambiato niente di riconoscibile):
    // si risponde bene senza scrivere una riga.
    if (prima === dopo) return NextResponse.json({ chiave, quanti: {}, salvato: true });
    const quanti = {};
    try {
      if (prima) quanti[prima] = await muovi(chiave, prima, -1);
      if (dopo) quanti[dopo] = await muovi(chiave, dopo, 1);
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
    // sei celle per contenuto, ma una sola andata e ritorno: il feed
    // chiede i numeri di venti articoli mentre scorre, e venti viaggi
    // sarebbero venti attese.
    const celle = [];
    for (const c of chiavi) for (const id of IDS) celle.push(cella(c, id));
    const valori = await redis('MGET', ...celle);
    const conteggi = {};
    chiavi.forEach((c, i) => {
      const riga = {};
      IDS.forEach((id, j) => {
        const n = Number(Array.isArray(valori) ? valori[i * IDS.length + j] : 0);
        if (Number.isFinite(n) && n > 0) riga[id] = n;
      });
      if (Object.keys(riga).length) conteggi[c] = riga;
    });
    return NextResponse.json({ conteggi });
  } catch {
    return NextResponse.json({ conteggi: {} });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 120, prefix: 'reazioni-post' });
export const GET = withApiGuard(handleGet, { maxRequests: 120, prefix: 'reazioni-get' });
