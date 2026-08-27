// ═══════════════════════════════════════════════════════════════
// I COMMENTI SOTTO UN CONTENUTO (b.545).
//
// Ordine di Luca: «possiamo permettere di commentare e inserire
// automaticamente una possibile discussione dal commento, che da solo
// apre una "stanza" aperta ad altri che vogliono commentare, e inserirla
// nell'elenco chat quando uno la commenta».
//
// I commenti di un contenuto vivono in UNA lista Redis, per indirizzo di
// contenuto — la stessa chiave dei cuori (lib/gradimento.js), cosi lo
// stesso articolo condiviso in due modi ha un filo solo.
//
// Tre cautele, le stesse del conteggio dei cuori:
//   · il testo passa da sanaCommento: niente vuoti, niente sproloqui
//     oltre i 500 caratteri, niente caratteri di controllo;
//   · la lista si ferma a 200 (LTRIM): un filo non deve poter crescere
//     per sempre dentro la memoria che paghiamo;
//   · le chiavi scadono dopo novanta giorni, come i cuori — un articolo
//     di tre mesi fa non tiene occupato niente.
// Chi commenta e' un nome, non un account: il gettone di sessione qui
// non entra mai. Meno cose sappiamo delle persone, meglio e'.
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import { sanaCommento, ordinaCommenti, serveStanza } from '../../../lib/commentiContenuto.js';

const log = createLogger('mondo/commenti');
const TTL = 90 * 24 * 3600;
const MAX_LISTA = 200;
const QUANTI_LETTI = 50;
const MAX_CHIAVI = 60;

// stessa pulizia della chiave che usa /api/mondo/gradimento: le due
// rotte parlano dello stesso contenuto e devono chiamarlo allo stesso modo.
const pulita = (k) => String(k || '').trim().slice(0, 200).replace(/\s/g, '');

// b.545 — in app/lib non esiste (ancora) un sanitize.js: la regola per il
// nome e' quella gia in uso per il soprannome pubblico in
// /api/mondo/discussioni — via le parentesi angolari, quaranta caratteri.
// Quando quel file nascera, questa riga diventa una import.
const sanaNome = (n) => String(n || '').trim().replace(/[<>]/g, '').slice(0, 40);

const sanaLingua = (l) => String(l || '').trim().slice(0, 12).replace(/[^a-zA-Z-]/g, '');

const leggiRiga = (riga) => {
  if (riga && typeof riga === 'object') return riga;
  try { return JSON.parse(riga); } catch { return null; /* riga illeggibile: la scarta ordinaCommenti, il filo resta in piedi */ }
};

async function handlePost(req) {
  try {
    const body = await req.json();
    const chiave = pulita(body?.chiave);
    const testo = sanaCommento(body?.testo);
    if (!chiave) return NextResponse.json({ error: 'chiave mancante' }, { status: 400 });
    if (!testo) return NextResponse.json({ error: 'commento vuoto' }, { status: 400 });

    const commento = {
      id: Date.now().toString(36) + randomBytes(3).toString('hex'),
      testo,
      nome: sanaNome(body?.nome),
      lingua: sanaLingua(body?.lingua),
      quando: Date.now(),
    };

    const k = `commenti:${chiave}`;
    let quanti = 0;
    try {
      quanti = Number(await redis('RPUSH', k, JSON.stringify(commento))) || 0;
      // il taglio si fa sempre, non solo quando si sfora: costa una
      // chiamata e toglie di mezzo qualunque lista cresciuta di traverso.
      await redis('LTRIM', k, String(-MAX_LISTA), '-1');
      await redis('EXPIRE', k, TTL);
      if (quanti > MAX_LISTA) quanti = MAX_LISTA;
    } catch (e) {
      // b.545 — un commento perduto va DETTO: chi ha scritto deve sapere
      // che non e' arrivato, non vederlo sparire e credere che ci sia.
      log.warn('commento non salvato', { errore: e?.message });
      return NextResponse.json({ ok: false, quanti: null, serveStanza: false });
    }
    return NextResponse.json({ ok: true, chiave, commento, quanti, serveStanza: serveStanza(quanti) });
  } catch {
    return NextResponse.json({ ok: false, quanti: null, serveStanza: false });
  }
}

async function handleGet(req) {
  const url = new URL(req.url);
  const chiave = pulita(url.searchParams.get('chiave'));
  const chiavi = (url.searchParams.get('chiavi') || '')
    .split(',').map(pulita).filter(Boolean).slice(0, MAX_CHIAVI);

  try {
    // un contenuto solo: il filo aperto, cioe gli ultimi commenti.
    if (chiave) {
      const k = `commenti:${chiave}`;
      const [righe, lunghezza] = await Promise.all([
        redis('LRANGE', k, String(-QUANTI_LETTI), '-1'),
        redis('LLEN', k),
      ]);
      const lista = ordinaCommenti((Array.isArray(righe) ? righe : []).map(leggiRiga));
      const quanti = Math.max(Number(lunghezza) || 0, lista.length);
      return NextResponse.json({ chiave, commenti: lista, quanti, serveStanza: serveStanza(quanti) });
    }

    // piu contenuti insieme: alle card serve SOLO il numero. Non si puo
    // fare con un MGET (quello legge stringhe, non liste), quindi una
    // LLEN per chiave — ecco perche il tetto di sessanta chiavi, lo stesso
    // dei cuori: una schermata di card, non l'intero archivio.
    if (chiavi.length) {
      const valori = await Promise.all(chiavi.map((c) => redis('LLEN', `commenti:${c}`).catch(() => 0)));
      const conteggi = {};
      chiavi.forEach((c, i) => {
        const n = Number(valori[i]);
        if (Number.isFinite(n) && n > 0) conteggi[c] = n;
      });
      return NextResponse.json({ conteggi });
    }

    return NextResponse.json({ conteggi: {} });
  } catch (e) {
    log.warn('lettura commenti fallita', { errore: e?.message });
    return NextResponse.json({ commenti: [], conteggi: {}, quanti: 0, serveStanza: false });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'commenti-post' });
export const GET = withApiGuard(handleGet, { maxRequests: 120, prefix: 'commenti-get', skipBodyCheck: true });
