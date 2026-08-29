import webpush from 'web-push';
import { readPushSubscriptions, removePushSubscription } from './liveStore.js';

let configurato = false;

function config() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || '';
  if (!publicKey || !privateKey || !subject) return null;
  if (!configurato) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configurato = true;
  }
  return { publicKey };
}

export function pushPublicKey() {
  return config()?.publicKey || '';
}

function pertinente(evento, preferences) {
  const p = preferences || {};
  if (p.breaking === 'off') return false;
  if (evento?.important) return true; // il mondo importante supera la bolla personale
  if (p.breaking !== 'all') return false;
  const topics = new Set(Array.isArray(p.topics) ? p.topics : []);
  const countries = new Set((Array.isArray(p.countries) ? p.countries : []).map((x) => String(x).toUpperCase()));
  if (!topics.size && !countries.size) return true;
  if ((evento?.topics || []).some((t) => topics.has(t))) return true;
  if ((evento?.countries || []).some((c) => countries.has(String(c).toUpperCase()))) return true;
  return false;
}

function payload(evento) {
  const fonti = Number(evento?.sourceCount) || 0;
  const stato = evento?.status === 'confirmed' ? 'confermato' : evento?.status === 'developing' ? 'in sviluppo' : 'da verificare';
  return JSON.stringify({
    title: evento?.important ? 'Mondo Live · Importante' : 'Mondo Live',
    body: `${evento?.title || 'Nuovo evento'}${fonti ? ` · ${fonti} fonti · ${stato}` : ''}`.slice(0, 220),
    tag: `mondo-live-${evento?.id || 'evento'}`,
    url: '/',
    mondoEventId: evento?.id || null,
    msgCount: 1,
  });
}

/** Invia al massimo tre eventi per giro per evitare raffiche di notifiche. */
export async function sendPushForEvents(events) {
  if (!config()) return { enabled: false, sent: 0, removed: 0 };
  const nuovi = (Array.isArray(events) ? events : []).slice(0, 12);
  if (!nuovi.length) return { enabled: true, sent: 0, removed: 0 };
  const subs = await readPushSubscriptions();
  let sent = 0;
  let removed = 0;
  for (const s of subs) {
    const scelti = nuovi.filter((e) => pertinente(e, s.preferences)).slice(0, 3);
    for (const e of scelti) {
      try {
        await webpush.sendNotification(s.subscription, payload(e), { TTL: 300, urgency: e.important ? 'high' : 'normal' });
        sent += 1;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await removePushSubscription(s.id);
          removed += 1;
          break;
        }
      }
    }
  }
  return { enabled: true, sent, removed };
}
