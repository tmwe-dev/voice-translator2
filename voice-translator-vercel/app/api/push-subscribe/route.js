// ═══════════════════════════════════════════════════════════════
// LE ISCRIZIONI ALLE NOTIFICHE (b.134)
//
// Questa rotta esisteva gia da mesi. Teneva le iscrizioni cosi:
//
//     const subscriptions = new Map();
//
// Una mappa in memoria di processo, su Vercel, dove ogni invocazione
// puo essere un processo nuovo e non ce n'e uno solo. Il commento sopra
// lo ammetteva — "lost on cold start, but works for demo" — e nessuna
// demo l'ha mai usata: cercando in tutta la cartella `app/`, NESSUNO
// chiamava questa rotta. Zero iscrizioni scritte, in un secchio bucato.
//
// E la chiave pubblica VAPID era un segnaposto copiato da un esempio in
// rete, senza la privata corrispondente: anche avendo un'iscrizione,
// nessuna notifica sarebbe mai partita.
//
// ── COSA CAMBIA ──
//
// Le iscrizioni vivono su Redis, accanto ai contatti che stanno gia li
// (`contacts:{email}`, `presence:{email}`). Un utente puo avere piu
// dispositivi — telefono e computer — quindi la chiave e un insieme.
//
//     push:{email} → SET di iscrizioni serializzate
//
// E l'identita non si dichiara: si dimostra col gettone di sessione,
// come in tutte le altre rotte dopo b.123. Prima bastava mandare uno
// `userId` qualsiasi nel corpo per scrivere l'iscrizione di chiunque —
// e per farsi recapitare le notifiche altrui.
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession } from '../../lib/users.js';
import { redis } from '../../lib/redis.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('push-subscribe');

// Un'iscrizione dura finche il browser non la revoca. Trenta giorni di
// TTL evitano che l'insieme cresca all'infinito con i dispositivi che
// non tornano piu; chi usa l'applicazione la rinnova a ogni avvio.
const TTL_ISCRIZIONE = 60 * 60 * 24 * 30;

export function chiaveIscrizioni(email) {
  return `push:${String(email).toLowerCase()}`;
}

async function identifica(req, corpo) {
  const token = corpo?.token;
  if (!token) return null;
  const session = await getSession(token);
  return session?.email ? String(session.email).toLowerCase() : null;
}

// POST — salva l'iscrizione di QUESTO dispositivo per QUESTO utente
async function handlePost(request) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo non leggibile' }, { status: 400 });
  }

  const { subscription } = corpo || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    // Senza le due chiavi non si puo cifrare il messaggio: un'iscrizione
    // monca e' peggio di nessuna, perche fa credere di essere raggiungibili.
    return NextResponse.json({ error: 'Iscrizione incompleta' }, { status: 400 });
  }

  const email = await identifica(request, corpo);
  if (!email) {
    return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
  }

  try {
    const chiave = chiaveIscrizioni(email);
    // Si toglie prima l'eventuale iscrizione con lo stesso endpoint:
    // il browser rigenera le chiavi ogni tanto e resterebbero due voci
    // per lo stesso dispositivo, con una che fallisce per sempre.
    const esistenti = (await redis('SMEMBERS', chiave)) || [];
    for (const grezza of esistenti) {
      try {
        if (JSON.parse(grezza)?.endpoint === subscription.endpoint) {
          await redis('SREM', chiave, grezza);
        }
      } catch { /* voce illeggibile: la si lascia, scadra da sola col TTL */ }
    }

    await redis('SADD', chiave, JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      creata: Date.now(),
    }));
    await redis('EXPIRE', chiave, TTL_ISCRIZIONE);

    const quante = (await redis('SCARD', chiave)) || 1;
    return NextResponse.json({ ok: true, dispositivi: Number(quante) });
  } catch (e) {
    log.error('salvataggio iscrizione fallito', { err: e?.message });
    return NextResponse.json({ error: 'Iscrizione non salvata' }, { status: 500 });
  }
}

// DELETE — questo dispositivo non vuole piu notifiche
async function handleDelete(request) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo non leggibile' }, { status: 400 });
  }

  const email = await identifica(request, corpo);
  if (!email) {
    return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
  }

  const endpoint = corpo?.endpoint || corpo?.subscription?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: 'Manca l\'indirizzo del dispositivo' }, { status: 400 });
  }

  try {
    const chiave = chiaveIscrizioni(email);
    const esistenti = (await redis('SMEMBERS', chiave)) || [];
    let tolte = 0;
    for (const grezza of esistenti) {
      try {
        if (JSON.parse(grezza)?.endpoint === endpoint) {
          await redis('SREM', chiave, grezza);
          tolte++;
        }
      } catch { /* voce illeggibile: scadra da sola col TTL */ }
    }
    return NextResponse.json({ ok: true, tolte });
  } catch (e) {
    log.error('rimozione iscrizione fallita', { err: e?.message });
    return NextResponse.json({ error: 'Rimozione non riuscita' }, { status: 500 });
  }
}

// GET — la chiave pubblica con cui il browser costruisce l'iscrizione
async function handleGet() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || null;
  if (!publicKey) {
    // Meglio dirlo che restituire un segnaposto: con una chiave finta
    // il browser accetta l'iscrizione e poi nessuna notifica arriva mai,
    // e non si capisce da dove viene il silenzio. Era esattamente il
    // caso di prima.
    return NextResponse.json(
      { error: 'Notifiche non configurate', motivo: 'VAPID_PUBLIC_KEY non impostata' },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey });
}

// ── b.118 · anche questa passa dalla guardia comune ──
// La caccia al tesoro l'ha trovata scoperta: rispondeva 500 a un corpo
// malformato, e non aveva il limite di frequenza condiviso. Aveva un
// limite suo, scritto a mano — che e proprio il modo in cui una rotta
// si dimentica per strada le protezioni aggiunte a tutte le altre.
export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'push-subscribe' });
export const GET = withApiGuard(handleGet, { maxRequests: 30, prefix: 'push-subscribe', skipBodyCheck: true });
export const DELETE = withApiGuard(handleDelete, { maxRequests: 30, prefix: 'push-subscribe' });
