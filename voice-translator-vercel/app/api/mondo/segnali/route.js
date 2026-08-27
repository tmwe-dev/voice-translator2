// ═══════════════════════════════════════════════════════════════
// I SEGNALI DEL FEED (b.545).
//
// Ordine di Luca: «possiamo misurare il tempo che passano gli utenti a
// vedere un video di un argomento, se commentano, oppure cliccano mi
// piace per determinare piu velocemente cosa proporre nelle sezioni
// mondo quando i materiali selezionati terminano».
//
// Qui si accumula soltanto. Il conto di CHE COSA significhino quei
// numeri sta tutto in lib/punteggioFeed.js, che e' logica pura e si puo'
// provare senza rete: questa rotta somma e restituisce, niente altro.
//
// UN HASH PER CONTENUTO — `segnali:{chiave}`, la stessa chiave dei cuori
// (lib/gradimento.js) e dei commenti, cosi lo stesso articolo condiviso
// in due modi ha una riga sola. Cinque campi, uno per segnale: HINCRBY
// e' atomico, quindi mille telefoni che scorrono insieme non si pestano
// i piedi.
//
// Le solite cautele, tutte necessarie:
//   · un segnale per volta, e passa da `sanaSegnale`: nessuno puo'
//     dichiarare dieci ore di visione per spingere il proprio articolo,
//     e per tutto cio che non e' tempo il passo e' 1;
//   · secondi tagliati a 600 per invio — dieci minuti sono gia' il
//     massimo che si guarda una slide senza staccarsi;
//   · le chiavi scadono dopo novanta giorni, come cuori e commenti: un
//     articolo di tre mesi fa non deve occupare memoria per sempre.
//
// E NIENTE DI PERSONALE. Non si registra CHI ha guardato, per quanto, o
// da dove: si somma e basta. Un contatore per contenuto non e' un
// profilo, e la differenza fra le due cose e' tutta qui. Il gettone di
// sessione in questa rotta non entra mai.
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import { sanaSegnale, conteggiDaSegnali } from '../../../lib/punteggioFeed.js';

const log = createLogger('mondo/segnali');
const TTL = 90 * 24 * 3600;

// meno chiavi dei cuori: qui ogni chiave e' un HGETALL suo, e sono le
// slide che si stanno guardando adesso — una manciata, non il giornale.
const MAX_CHIAVI = 30;

// stessa pulizia della chiave di /api/mondo/gradimento e /commenti: tre
// rotte che parlano dello stesso contenuto devono chiamarlo allo stesso
// modo, o i segnali finiscono su una riga e i cuori su un'altra.
const pulita = (k) => String(k || '').trim().slice(0, 200).replace(/\s/g, '');

async function handlePost(req) {
  try {
    const body = await req.json();
    const chiave = pulita(body?.chiave);
    if (!chiave) return NextResponse.json({ error: 'chiave mancante' }, { status: 400 });
    const segnale = sanaSegnale(body?.tipo, body?.valore);
    // b.545 — un segnale rifiutato si DICE, non si finge accumulato: se
    // il telefono manda i secondi nell'unita' sbagliata deve poterlo
    // scoprire, invece di credere per settimane di essere ascoltato.
    if (!segnale) return NextResponse.json({ error: 'segnale non valido' }, { status: 400 });

    const k = `segnali:${chiave}`;
    try {
      const quanti = Number(await redis('HINCRBY', k, segnale.tipo, String(segnale.valore))) || 0;
      await redis('EXPIRE', k, TTL);
      return NextResponse.json({ chiave, tipo: segnale.tipo, quanti, salvato: true });
    } catch (e) {
      // un segnale perduto non e' un guasto da mostrare a chi scorre:
      // l'ordine del feed sara' un po' meno informato, e basta.
      log.warn('segnale non salvato', { errore: e?.message });
      return NextResponse.json({ quanti: null, salvato: false });
    }
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

    // I cuori si chiedono INSIEME e in una sola andata: vivono ancora
    // dove li ha messi b.544 (`cuori:{chiave}`), e chi ordina il feed ha
    // bisogno di tutti e cinque i segnali in una risposta sola.
    const [righe, cuori] = await Promise.all([
      Promise.all(chiavi.map((c) => redis('HGETALL', `segnali:${c}`).catch(() => null))),
      redis('MGET', ...chiavi.map((c) => `cuori:${c}`)).catch(() => null),
    ]);

    const conteggi = {};
    chiavi.forEach((c, i) => {
      const riga = conteggiDaSegnali(righe[i]);
      // il cuore ha due case possibili: qui si prende la piu' informata
      // delle due, MAI la somma — sommarle conterebbe due volte lo
      // stesso cuore e gonfierebbe il punteggio di chi e' gia' in cima.
      const dalGradimento = Number(Array.isArray(cuori) ? cuori[i] : 0);
      if (Number.isFinite(dalGradimento) && dalGradimento > riga.cuori) riga.cuori = dalGradimento;
      conteggi[c] = riga;
    });
    return NextResponse.json({ conteggi });
  } catch {
    return NextResponse.json({ conteggi: {} });
  }
}

// piu' generoso del solito sul POST: chi scorre il feed manda un segnale
// per slide, e scorrere in fretta e' un modo di usare l'app, non un abuso.
export const POST = withApiGuard(handlePost, { maxRequests: 240, prefix: 'segnali-post' });
export const GET = withApiGuard(handleGet, { maxRequests: 120, prefix: 'segnali-get' });
