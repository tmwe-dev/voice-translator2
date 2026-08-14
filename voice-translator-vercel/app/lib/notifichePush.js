// ═══════════════════════════════════════════════════════════════
// CHI SPEDISCE LE NOTIFICHE (b.134)
//
// Fino a b.133 il service worker aveva un gestore `push` completo — con
// badge, vibrazione, azioni "Apri chat" e "Ignora", e il click che
// riapriva la stanza giusta — e non c'era una sola riga, da nessuna
// parte, che spedisse una notifica. Un orecchio senza bocca.
//
// Questo modulo e la bocca. Sta da solo, fuori dalle rotte, perche piu
// di una rotta dovra usarlo: l'invito a una conversazione, il messaggio
// a chi non e collegato, e domani la chiamata persa.
//
// ── PERCHE LE ISCRIZIONI MORTE VANNO TOLTE SUBITO ──
//
// Quando qualcuno disinstalla l'applicazione o revoca il permesso, il
// servizio del browser (FCM, Apple, Mozilla) risponde 404 o 410. Se non
// si cancella l'iscrizione si continua a tentare per sempre: ogni
// messaggio paga il costo di una chiamata di rete destinata a fallire,
// e l'insieme cresce di dispositivi fantasma. Si tolgono qui, appena si
// scopre che sono morte.
// ═══════════════════════════════════════════════════════════════
import { redis } from './redis.js';
import { createLogger } from './logger.js';

const log = createLogger('push');

// Il servizio push esige un recapito di chi spedisce: serve a loro per
// avvisare se stiamo sbagliando qualcosa, prima di bloccarci.
const RECAPITO = process.env.VAPID_SUBJECT || 'mailto:support@bartalk.app';

export function chiaveIscrizioni(email) {
  return `push:${String(email).toLowerCase()}`;
}

// Il pacchetto si carica solo quando serve davvero. Se le chiavi non
// sono configurate non lo si importa nemmeno: cosi una installazione
// senza notifiche non paga niente e non esplode all'avvio.
let webpushCaricato = null;
async function ottieniWebPush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  if (!webpushCaricato) {
    const mod = await import('web-push');
    webpushCaricato = mod.default || mod;
    webpushCaricato.setVapidDetails(RECAPITO, pub, priv);
  }
  return webpushCaricato;
}

export function notificheAttive() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Spedisce una notifica a TUTTI i dispositivi di una persona.
 *
 * Non solleva mai: una notifica non recapitata non deve far fallire il
 * messaggio che l'ha originata. Il messaggio e la cosa importante; la
 * notifica e un avviso di cortesia.
 *
 * @returns {Promise<{inviate:number, morte:number, motivo?:string}>}
 */
export async function inviaPush(email, { titolo, corpo, url = '/', tag, roomId = null } = {}) {
  const webpush = await ottieniWebPush();
  if (!webpush) {
    return { inviate: 0, morte: 0, motivo: 'chiavi VAPID non configurate' };
  }
  if (!email || !titolo) {
    return { inviate: 0, morte: 0, motivo: 'destinatario o titolo mancante' };
  }

  const chiave = chiaveIscrizioni(email);
  let grezze = [];
  try {
    grezze = (await redis('SMEMBERS', chiave)) || [];
  } catch (e) {
    log.error('lettura iscrizioni fallita', { err: e?.message });
    return { inviate: 0, morte: 0, motivo: 'archivio non raggiungibile' };
  }
  if (!grezze.length) {
    return { inviate: 0, morte: 0, motivo: 'nessun dispositivo iscritto' };
  }

  const carico = JSON.stringify({
    title: titolo,
    body: corpo || '',
    url,
    tag: tag || (roomId ? `vt-msg-${roomId}` : 'vt-message'),
    roomId,
    msgCount: 1,
  });

  let inviate = 0;
  let morte = 0;

  // In parallelo: i dispositivi sono pochi e indipendenti, e in serie si
  // pagherebbe la latenza di ognuno dentro la richiesta dell'utente.
  await Promise.all(grezze.map(async (grezza) => {
    let iscrizione;
    try {
      iscrizione = JSON.parse(grezza);
    } catch {
      try { await redis('SREM', chiave, grezza); morte++; } catch { /* si riproverà al prossimo giro */ }
      return;
    }

    try {
      await webpush.sendNotification(iscrizione, carico);
      inviate++;
    } catch (e) {
      const stato = e?.statusCode;
      if (stato === 404 || stato === 410) {
        // Dispositivo sparito per sempre: si toglie, altrimenti si
        // tenterebbe a ogni messaggio da qui all'eternita.
        try { await redis('SREM', chiave, grezza); morte++; } catch { /* si riproverà al prossimo giro */ }
      } else {
        log.warn('notifica non recapitata', { stato, err: e?.message });
      }
    }
  }));

  return { inviate, morte };
}

/**
 * Vero solo se le due persone si conoscono davvero.
 *
 * `contacts:` viene scritto in coppia (SADD su tutte e due) da
 * /api/contacts, quindi basterebbe guardarne uno. Si guardano entrambi
 * lo stesso: se un giorno una delle due scritture fallisse a meta, il
 * risultato sarebbe qualcuno che puo notificare una persona che non lo
 * ha fra i contatti — cioe il modo in cui questa funzione diventa un
 * canale per messaggi non richiesti.
 */
export async function siConoscono(emailA, emailB) {
  const a = String(emailA || '').toLowerCase();
  const b = String(emailB || '').toLowerCase();
  if (!a || !b || a === b) return false;
  try {
    const [aHaB, bHaA] = await Promise.all([
      redis('SISMEMBER', `contacts:${a}`, b),
      redis('SISMEMBER', `contacts:${b}`, a),
    ]);
    return Number(aHaB) === 1 && Number(bHaA) === 1;
  } catch (e) {
    log.error('verifica contatti fallita', { err: e?.message });
    // In caso di dubbio NON si notifica: il silenzio e un fastidio,
    // una notifica a uno sconosciuto e un danno.
    return false;
  }
}
