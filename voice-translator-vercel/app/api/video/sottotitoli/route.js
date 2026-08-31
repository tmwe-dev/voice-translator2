// ═══════════════════════════════════════════════════════════════
// GET /api/video/sottotitoli?id=<idYouTube>&lang=<lingua> (b.551 → b.586)
//
// L'interprete vive solo se esiste testo temporizzato. Da b.586 non si
// indovina piu la traccia: prima si legge l'elenco di YouTube e poi si
// chiede QUELLA traccia con lingua, kind (per esempio `asr`) e name.
//
// Un guasto di YouTube non e' «questo video non ha sottotitoli».
// I due casi restano distinti: un no certo puo avere una memoria corta;
// un timeout/403/risposta anomala torna `temporaneo:true` e non viene
// congelato in cache come falso negativo.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import { sanaSottotitoli } from '../../../lib/interpreteVideo.js';
import { tracceDaElenco, ordinaTracce, parametriTraccia } from '../../../lib/tracceSottotitoli.js';

const log = createLogger('video/sottotitoli');

const TTL_TROVATI = 7 * 24 * 3600;
const TTL_VUOTI = 5 * 60;            // un no certo si ricontrolla presto
const ATTESA_MS = 8000;
const MAX_RIGHE = 3000;
const VERSIONE_CACHE = 'v2';         // scarta i falsi negativi b.551/b.581

function idValido(x) {
  const s = String(x || '').trim();
  return /^[A-Za-z0-9_-]{6,24}$/.test(s) ? s : '';
}

function linguaValida(x) {
  const s = String(x || '').trim();
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(s) ? s : '';
}

function daJson3(corpo) {
  let dati = null;
  try { dati = JSON.parse(corpo); } catch { return []; }
  const eventi = Array.isArray(dati?.events) ? dati.events : [];
  const righe = [];
  for (const e of eventi.slice(0, MAX_RIGHE)) {
    const inizioMs = Number(e?.tStartMs);
    if (!Number.isFinite(inizioMs)) continue;
    const durataMs = Number(e?.dDurationMs);
    const durata = Number.isFinite(durataMs) && durataMs > 0 ? durataMs : 2000;
    const testo = (Array.isArray(e?.segs) ? e.segs : [])
      .map((s) => String(s?.utf8 || '')).join('');
    righe.push({
      inizio: inizioMs / 1000,
      fine: (inizioMs + durata) / 1000,
      testo,
    });
  }
  return sanaSottotitoli(righe);
}

/**
 * Restituisce anche se la richiesta e' ARRIVATA davvero a YouTube.
 * Prima un 403 e un video senza tracce diventavano entrambi stringa
 * vuota: era impossibile non mettere in cache un falso «non disponibile».
 */
async function chiediAYouTube(indirizzo) {
  try {
    const r = await fetch(indirizzo, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BarTalk/1.0)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(ATTESA_MS),
    });
    if (!r.ok) {
      log.warn('YouTube non ha risposto', { stato: r.status });
      return { ok: false, corpo: '', stato: r.status };
    }
    return { ok: true, corpo: await r.text(), stato: r.status };
  } catch (e) {
    if (e?.name !== 'AbortError') log.warn('YouTube muto', { errore: e?.message || String(e) });
    return { ok: false, corpo: '', stato: 0 };
  }
}

async function scaricaTraccia(id, traccia) {
  const p = parametriTraccia(id, traccia);
  const esito = await chiediAYouTube(`https://www.youtube.com/api/timedtext?${p.toString()}`);
  if (!esito.ok || !esito.corpo) return { ok: esito.ok, righe: [] };
  return { ok: true, righe: daJson3(esito.corpo) };
}

/**
 * Ripiego soltanto se l'elenco delle tracce non e' raggiungibile.
 * Alcuni video continuano a rispondere all'indirizzo diretto anche se
 * `type=list` viene filtrato a monte.
 */
async function scaricaAllaCieca(id, lingua) {
  const p = new URLSearchParams({ v: id, lang: lingua, fmt: 'json3' });
  const esito = await chiediAYouTube(`https://www.youtube.com/api/timedtext?${p.toString()}`);
  if (!esito.ok || !esito.corpo) return [];
  return daJson3(esito.corpo);
}

async function handleGet(req) {
  const vuoto = { disponibili: false, righe: [], lingua: '' };
  try {
    const url = new URL(req.url);
    const id = idValido(url.searchParams.get('id'));
    const chiesta = linguaValida(url.searchParams.get('lang')) || 'en';
    if (!id) return NextResponse.json(vuoto);

    const chiave = `sottotitoli:${VERSIONE_CACHE}:${id}:${chiesta.toLowerCase()}`;
    try {
      const memoria = await redis('GET', chiave);
      if (memoria) {
        const d = typeof memoria === 'string' ? JSON.parse(memoria) : memoria;
        if (d && Array.isArray(d.righe)) return NextResponse.json(d);
      }
    } catch (e) {
      log.warn('memoria non letta', { errore: e?.message || String(e) });
    }

    // PRIMA si chiede quali tracce esistono: e' l'unico modo per non
    // perdere `kind=asr` dei sottotitoli automatici.
    const lista = await chiediAYouTube(
      `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(id)}`,
    );

    let righe = [];
    let lingua = '';
    let tracceDichiarate = [];
    let downloadRiuscito = false;

    if (lista.ok) {
      tracceDichiarate = tracceDaElenco(lista.corpo);
      for (const traccia of ordinaTracce(tracceDichiarate, chiesta)) {
        const esito = await scaricaTraccia(id, traccia);
        downloadRiuscito = downloadRiuscito || esito.ok;
        if (!esito.righe.length) continue;
        righe = esito.righe;
        lingua = traccia.lingua;
        break;
      }
    } else {
      // L'elenco e' irraggiungibile: proviamo due porte dirette, ma un
      // loro fallimento NON diventa un «no» da ricordare.
      const provate = new Set();
      for (const candidata of [chiesta, 'en']) {
        const c = candidata.toLowerCase();
        if (provate.has(c)) continue;
        provate.add(c);
        const trovate = await scaricaAllaCieca(id, candidata);
        if (!trovate.length) continue;
        righe = trovate;
        lingua = candidata;
        break;
      }
    }

    if (righe.length) {
      const risposta = {
        disponibili: true,
        righe: righe.slice(0, MAX_RIGHE),
        lingua,
      };
      try {
        await redis('SET', chiave, JSON.stringify(risposta), 'EX', String(TTL_TROVATI));
      } catch (e) {
        log.warn('memoria non scritta', { errore: e?.message || String(e) });
      }
      return NextResponse.json(risposta);
    }

    // Lista raggiunta e ZERO tracce: e' l'unico «no» sufficientemente
    // certo da ricordare. Cinque minuti, non sei ore.
    if (lista.ok && tracceDichiarate.length === 0) {
      try {
        await redis('SET', chiave, JSON.stringify(vuoto), 'EX', String(TTL_VUOTI));
      } catch (e) {
        log.warn('memoria vuota non scritta', { errore: e?.message || String(e) });
      }
      return NextResponse.json(vuoto);
    }

    // C'erano tracce ma il download e' arrivato vuoto, oppure YouTube non
    // ha risposto: non si mente dicendo che il video non le possiede.
    return NextResponse.json({
      ...vuoto,
      temporaneo: true,
      motivo: lista.ok && tracceDichiarate.length && downloadRiuscito
        ? 'traccia_vuota'
        : 'sorgente_non_raggiungibile',
    });
  } catch (e) {
    log.warn('sottotitoli non recuperati', { errore: e?.message || String(e) });
    return NextResponse.json({ ...vuoto, temporaneo: true, motivo: 'errore_temporaneo' });
  }
}

export const GET = withApiGuard(handleGet, {
  maxRequests: 90, prefix: 'video-sottotitoli', skipBodyCheck: true,
});
