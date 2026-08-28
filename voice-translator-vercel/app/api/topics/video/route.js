// GET /api/topics/video?q=...&lang=... — ricerca video YouTube (b.153)
//
// b.553 — Cache condivisa DODICI ORE, e non e' avarizia: una ricerca
// costa 100 unita E una delle sole 100 chiamate al giorno che YouTube
// concede. La stessa domanda la fa piu di una persona, e una notizia di
// stamattina va bene anche stasera. La ricerca qui e' l'eccezione: la
// strada normale e' seguire i canali (videoUfficiale.js, 1 unita).

import { NextResponse } from 'next/server';
import { redis } from '../../../lib/redis.js';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { cercaVideo, videoDisponibili } from '../../../lib/topics/video.js';
import { chiaveYouTube, cercaSuYouTube } from '../../../lib/topics/videoUfficiale.js'; // b.553 — la porta principale
import { normalizzaQuery } from '../../../lib/topics/servizio.js';

const LINGUE = new Set(['it','en','es','fr','de','pt','zh','ja','ko','th','ar','hi','ru','tr','vi']);
const TTL = 12 * 3600;   // b.553 — dodici ore: le fonti si seguono, non si rincorrono (e ogni chiamata in meno e una quota risparmiata)

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

  // ═══ b.553 — PRIMA LA PORTA PRINCIPALE ═══
  // Decisione di Luca: «niente scraping della pagina /results, in
  // produzione solo la YouTube Data API». Con la chiave si passa di li e
  // basta: se la quota e' finita NON si ripiega sullo scraper — si
  // risponde che oggi non ci sono video nuovi e si mostra cio che
  // abbiamo gia («degradazione controllata», parole sue).
  // Senza chiave resta per ora la vecchia strada: e' un ponte, non un
  // ripiego, e si toglie il giorno che la chiave c'e' (vedi CLAUDE.md).
  let esito;
  if (chiaveYouTube()) {
    try {
      esito = { disponibile: true, video: await cercaSuYouTube(q, lang, { massimo: 8 }) };
    } catch (e) {
      if (e?.quotaFinita) return NextResponse.json({ disponibile: true, video: [], quotaFinita: true });
      esito = { disponibile: true, video: [] };
    }
  } else {
    esito = await cercaVideo(q, lang);
  }
  // Si mette in cache solo un esito PIENO: una risposta vuota non deve
  // spegnere i video per dodici ore a tutti.
  if (esito.video.length > 0) {
    try { await redis('SET', k, JSON.stringify(esito), 'EX', TTL); } catch { /* senza cache si vive */ }
  }
  return NextResponse.json(esito);
}

export const GET = withApiGuard(handleGet, { maxRequests: 15, prefix: 'topics-video', skipBodyCheck: true });
