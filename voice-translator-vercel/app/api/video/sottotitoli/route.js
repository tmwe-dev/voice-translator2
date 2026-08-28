// ═══════════════════════════════════════════════════════════════
// GET /api/video/sottotitoli?id=<idYouTube>&lang=<lingua> (b.551)
//
// «potremmo darla dove disponibile no??» (Luca). Questa rotta e' la
// risposta a quel «dove»: prima di offrire l'interprete bisogna sapere
// se il video ha davvero dei sottotitoli. Se non li ha, il tasto non
// compare — meglio niente che un tasto che non fa niente.
//
// TRE TENTATIVI, IN QUEST'ORDINE:
//   1. la lingua chiesta (se il video ce l'ha, e' la migliore: nessuna
//      traduzione a monte, meno errori a valle);
//   2. l'inglese, che e' la lingua che i video hanno piu' spesso;
//   3. la prima che esiste, chiesta all'elenco (`?type=list`) — anche
//      una lingua che non capiamo va bene: tanto poi traduciamo noi.
//
// NON SI RISPONDE MAI CON UN ERRORE IN FACCIA. Un video senza
// sottotitoli non e' un guasto, e' la normalita': si risponde
// `{disponibili:false, righe:[]}` e chi guarda non vede niente di rotto.
// Vale anche quando YouTube e' lento o ci chiude la porta: l'interprete
// e' un di piu', non deve poter rompere il feed.
//
// LA MEMORIA E' LUNGA, e a ragione: i sottotitoli di un video non
// cambiano piu' una volta pubblicati. Sette giorni per quelli trovati.
// Per quelli NON trovati la memoria e' corta (sei ore): un video appena
// caricato riceve i sottotitoli automatici dopo un po', e non vogliamo
// dirgli di no per una settimana per una domanda fatta troppo presto.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import { sanaSottotitoli } from '../../../lib/interpreteVideo.js';

const log = createLogger('video/sottotitoli');

const TTL_TROVATI = 7 * 24 * 3600;   // i sottotitoli di un video non cambiano
const TTL_VUOTI = 6 * 3600;          // ma possono ARRIVARE: si richiede presto
const ATTESA_MS = 8000;              // oltre, il feed ha gia' cambiato slide
const MAX_RIGHE = 3000;              // un'ora e mezza di parlato: piu' non serve

/** Un id YouTube e' fatto di lettere, cifre, trattino e trattino basso.
 *  Tutto il resto e' qualcuno che prova a farci comporre un indirizzo che
 *  non abbiamo scelto noi. */
function idValido(x) {
  const s = String(x || '').trim();
  return /^[A-Za-z0-9_-]{6,24}$/.test(s) ? s : '';
}

/** Un codice lingua, con o senza regione ('it', 'pt-BR', 'zh-Hans'). */
function linguaValida(x) {
  const s = String(x || '').trim();
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(s) ? s : '';
}

/**
 * Il formato `json3` di YouTube: un elenco di `events`, ognuno con
 * l'inizio in millesimi, la durata in millesimi e il testo spezzato in
 * pezzetti (`segs`) — i pezzetti vanno riattaccati senza spazi in mezzo,
 * perche' lo spazio, quando serve, sta gia' dentro il pezzetto.
 */
function daJson3(corpo) {
  let dati = null;
  try { dati = JSON.parse(corpo); } catch { return []; }
  const eventi = Array.isArray(dati?.events) ? dati.events : [];
  const righe = [];
  for (const e of eventi.slice(0, MAX_RIGHE)) {
    const inizioMs = Number(e?.tStartMs);
    if (!Number.isFinite(inizioMs)) continue;
    const durataMs = Number(e?.dDurationMs);
    // certi eventi non dichiarano la durata (sono marcatori): due
    // secondi e' la durata media di una riga, e comunque la ricucitura
    // in interpreteVideo.js rimette insieme i pezzi
    const durata = Number.isFinite(durataMs) && durataMs > 0 ? durataMs : 2000;
    const testo = (Array.isArray(e?.segs) ? e.segs : [])
      .map((s) => String(s?.utf8 || '')).join('');
    righe.push({
      inizio: inizioMs / 1000,
      fine: (inizioMs + durata) / 1000,
      testo,
    });
  }
  // la pulizia e' quella dell'interprete: una sola, non due che
  // divergono (le righe vuote di json3 sono tantissime)
  return sanaSottotitoli(righe);
}

/** La prima lingua che l'elenco dichiara. L'elenco e' XML, e per leggere
 *  un attributo non serve un lettore di XML: serve l'attributo. */
function primaLinguaDellElenco(xml) {
  const m = String(xml || '').match(/lang_code="([^"]+)"/);
  return m ? linguaValida(m[1]) : '';
}

async function chiediAYouTube(indirizzo) {
  try {
    const r = await fetch(indirizzo, {
      // senza un'intestazione da browser YouTube risponde vuoto piu'
      // spesso: non e' un trucco, e' la stessa richiesta che farebbe il
      // lettore incorporato
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BarTalk/1.0)', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(ATTESA_MS),
    });
    if (!r.ok) return '';
    return await r.text();
  } catch (e) {
    if (e?.name !== 'AbortError') log.warn('YouTube muto', { errore: e?.message || String(e) });
    return '';
  }
}

async function scaricaLingua(id, lingua) {
  const p = new URLSearchParams({ v: id, lang: lingua, fmt: 'json3' });
  const corpo = await chiediAYouTube(`https://www.youtube.com/api/timedtext?${p.toString()}`);
  if (!corpo) return [];
  return daJson3(corpo);
}

async function handleGet(req) {
  const vuoto = { disponibili: false, righe: [], lingua: '' };
  try {
    const url = new URL(req.url);
    const id = idValido(url.searchParams.get('id'));
    const chiesta = linguaValida(url.searchParams.get('lang')) || 'en';
    if (!id) return NextResponse.json(vuoto);

    const chiave = `sottotitoli:${id}:${chiesta.toLowerCase()}`;
    try {
      const memoria = await redis('GET', chiave);
      if (memoria) {
        const d = typeof memoria === 'string' ? JSON.parse(memoria) : memoria;
        if (d && Array.isArray(d.righe)) return NextResponse.json(d);
      }
    } catch (e) {
      // memoria illeggibile: si va a chiedere, non si fallisce
      log.warn('memoria non letta', { errore: e?.message || String(e) });
    }

    // ── i tre tentativi ──
    const provate = new Set();
    let righe = [];
    let lingua = '';
    for (const candidata of [chiesta, 'en']) {
      const c = candidata.toLowerCase();
      if (provate.has(c)) continue;
      provate.add(c);
      righe = await scaricaLingua(id, candidata);
      if (righe.length) { lingua = candidata; break; }
    }
    if (!righe.length) {
      const elenco = await chiediAYouTube(`https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(id)}`);
      const prima = primaLinguaDellElenco(elenco);
      if (prima && !provate.has(prima.toLowerCase())) {
        righe = await scaricaLingua(id, prima);
        if (righe.length) lingua = prima;
      }
    }

    const risposta = righe.length
      ? { disponibili: true, righe: righe.slice(0, MAX_RIGHE), lingua }
      : vuoto;

    try {
      await redis('SET', chiave, JSON.stringify(risposta), 'EX', String(righe.length ? TTL_TROVATI : TTL_VUOTI));
    } catch (e) {
      // non aver salvato non cambia la risposta di oggi: si richiedera'
      log.warn('memoria non scritta', { errore: e?.message || String(e) });
    }

    return NextResponse.json(risposta);
  } catch (e) {
    // Nessun errore in faccia a chi guarda: l'interprete e' un di piu'.
    log.warn('sottotitoli non recuperati', { errore: e?.message || String(e) });
    return NextResponse.json(vuoto);
  }
}

export const GET = withApiGuard(handleGet, {
  maxRequests: 90, prefix: 'video-sottotitoli', skipBodyCheck: true,
});
