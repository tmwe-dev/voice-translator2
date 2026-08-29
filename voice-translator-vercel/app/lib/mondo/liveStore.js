import { redis } from '../redis.js';

// ═══════════════════════════════════════════════════════════════
// MONDO LIVE — STATO CONDIVISO DEL RADAR (b.580)
//
// Redis tiene soltanto la finestra calda: eventi delle ultime 36 ore,
// ultimo passaggio del motore e sottoscrizioni push. Non e' il profilo
// editoriale dell'utente e non e' un archivio storico.
// ═══════════════════════════════════════════════════════════════

const KEY_EVENTS = 'mondo:live:events:v1';
const KEY_HEARTBEAT = 'mondo:live:last-ingest:v1';
const KEY_SUBS = 'mondo:live:push:v1';
const KEY_INGEST_LOCK = 'mondo:live:ingest-lock:v1';
const MAX_EVENTS = 160;
const MAX_AGE = 36 * 3600 * 1000;

function json(x, fallback) {
  if (!x) return fallback;
  if (typeof x === 'object') return x;
  try { return JSON.parse(x); } catch { return fallback; }
}

function timestamp(e) {
  const n = Number(e?.updatedAt || e?.firstSeenAt);
  if (Number.isFinite(n) && n > 0) return n;
  const d = new Date(e?.publishedAt || 0).getTime();
  return Number.isFinite(d) ? d : 0;
}

function dedupe(events) {
  const map = new Map();
  for (const e of (Array.isArray(events) ? events : [])) {
    if (!e?.id || !e?.title) continue;
    const key = e.fingerprint || e.id;
    const old = map.get(key);
    if (!old) { map.set(key, e); continue; }
    const fonti = [];
    const viste = new Set();
    for (const f of [...(old.sources || []), ...(e.sources || [])]) {
      const k = String(f?.url || f?.dominio || f?.fonte || '').toLowerCase();
      if (!k || viste.has(k)) continue;
      viste.add(k); fonti.push(f);
    }
    map.set(key, {
      ...old,
      ...e,
      id: old.id,
      firstSeenAt: Math.min(Number(old.firstSeenAt) || Date.now(), Number(e.firstSeenAt) || Date.now()),
      updatedAt: Math.max(timestamp(old), timestamp(e), Date.now()),
      sources: fonti.slice(0, 20),
      sourceCount: Math.max(fonti.length, Number(old.sourceCount) || 0, Number(e.sourceCount) || 0),
      important: !!(old.important || e.important),
      score: Math.max(Number(old.score) || 0, Number(e.score) || 0),
    });
  }
  return [...map.values()];
}

export async function readLiveEvents({ since = 0, limit = MAX_EVENTS, now = Date.now() } = {}) {
  const raw = await redis('GET', KEY_EVENTS).catch(() => null);
  const list = json(raw, []);
  const min = now - MAX_AGE;
  return (Array.isArray(list) ? list : [])
    .filter((e) => timestamp(e) >= min && timestamp(e) > (Number(since) || 0))
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || timestamp(b) - timestamp(a))
    .slice(0, Math.max(1, Math.min(Number(limit) || MAX_EVENTS, MAX_EVENTS)));
}

/** Salva e restituisce solo gli eventi che prima non esistevano. */
export async function saveLiveEvents(events, { now = Date.now() } = {}) {
  const prima = await readLiveEvents({ since: 0, limit: MAX_EVENTS, now });
  const vecchi = new Set(prima.map((e) => e.fingerprint || e.id));
  const uniti = dedupe([...prima, ...(Array.isArray(events) ? events : [])])
    .filter((e) => timestamp(e) >= now - MAX_AGE)
    .sort((a, b) => timestamp(b) - timestamp(a))
    .slice(0, MAX_EVENTS);
  await redis('SET', KEY_EVENTS, JSON.stringify(uniti), 'EX', String(Math.ceil(MAX_AGE / 1000) + 3600));
  return uniti.filter((e) => !vecchi.has(e.fingerprint || e.id));
}

export async function getLastIngestAt() {
  const v = await redis('GET', KEY_HEARTBEAT).catch(() => null);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function setLastIngestAt(ts = Date.now()) {
  await redis('SET', KEY_HEARTBEAT, String(ts), 'EX', '86400');
  return ts;
}

/**
 * Un solo redattore alla volta. Serve soprattutto quando il cron e' in
 * ritardo e molte persone aprono Mondo nello stesso istante: il primo
 * riaccende l'ingest, gli altri ascoltano il deposito gia condiviso.
 */
export async function acquireIngestLock(ttlSeconds = 70) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const r = await redis('SET', KEY_INGEST_LOCK, token, 'NX', 'EX', String(ttlSeconds)).catch(() => null);
  return r === 'OK' ? token : null;
}

export async function releaseIngestLock(token) {
  if (!token) return false;
  const corrente = await redis('GET', KEY_INGEST_LOCK).catch(() => null);
  if (corrente !== token) return false;
  await redis('DEL', KEY_INGEST_LOCK).catch(() => null);
  return true;
}

function hashEndpoint(endpoint) {
  let h = 2166136261;
  for (const c of String(endpoint || '')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export async function savePushSubscription(subscription, preferences = {}) {
  const endpoint = String(subscription?.endpoint || '');
  if (!endpoint) throw new Error('subscription senza endpoint');
  const id = hashEndpoint(endpoint);
  const record = {
    subscription,
    preferences: {
      topics: (Array.isArray(preferences?.topics) ? preferences.topics : []).slice(0, 30),
      countries: (Array.isArray(preferences?.countries) ? preferences.countries : []).map((x) => String(x).toUpperCase()).slice(0, 8),
      breaking: ['important', 'all', 'off'].includes(preferences?.breaking) ? preferences.breaking : 'important',
      lang: String(preferences?.lang || 'en').slice(0, 8),
    },
    updatedAt: Date.now(),
  };
  await redis('HSET', KEY_SUBS, id, JSON.stringify(record));
  return id;
}

export async function removePushSubscription(endpointOrId) {
  const raw = String(endpointOrId || '');
  if (!raw) return 0;
  const id = raw.startsWith('http') ? hashEndpoint(raw) : raw;
  return redis('HDEL', KEY_SUBS, id).catch(() => 0);
}

export async function readPushSubscriptions() {
  const h = await redis('HGETALL', KEY_SUBS).catch(() => ({}));
  if (!h) return [];
  // Upstash puo restituire un oggetto o una lista [campo,valore,...].
  const pairs = Array.isArray(h)
    ? h.reduce((a, v, i) => { if (i % 2 === 0) a.push([v, h[i + 1]]); return a; }, [])
    : Object.entries(h);
  const out = [];
  for (const [id, raw] of pairs) {
    const r = json(raw, null);
    if (!r?.subscription?.endpoint) continue;
    out.push({ id, ...r });
  }
  return out;
}
