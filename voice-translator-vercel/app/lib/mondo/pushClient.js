'use client';

function base64UrlToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function configurazione() {
  const r = await fetch('/api/mondo/push', { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  return d?.enabled && d?.publicKey ? d : null;
}

async function salva(subscription, preferences) {
  const r = await fetch('/api/mondo/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON ? subscription.toJSON() : subscription, preferences }),
    signal: AbortSignal.timeout(8000),
  });
  return r.ok;
}

export function pushDisponibile() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/** Sincronizza SOLO se l'utente aveva gia autorizzato: mai popup spontanei. */
export async function syncMondoPush(preferences) {
  if (!pushDisponibile() || Notification.permission !== 'granted') return { enabled: false, reason: 'permission' };
  try {
    const cfg = await configurazione();
    if (!cfg) return { enabled: false, reason: 'server' };
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(cfg.publicKey) });
    }
    const ok = await salva(sub, preferences);
    return { enabled: ok, subscription: sub };
  } catch { return { enabled: false, reason: 'error' }; }
}

/** Da chiamare solo da un gesto esplicito sul campanello. */
export async function enableMondoPush(preferences) {
  if (!pushDisponibile()) return { enabled: false, reason: 'unsupported' };
  const permesso = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permesso !== 'granted') return { enabled: false, reason: permesso };
  return syncMondoPush(preferences);
}

export async function disableMondoPush() {
  if (!pushDisponibile()) return { enabled: false };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { enabled: false };
    const endpoint = sub.endpoint;
    await fetch('/api/mondo/push', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }), signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    await sub.unsubscribe();
  } catch {}
  return { enabled: false };
}
