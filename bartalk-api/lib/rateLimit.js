import { createHash } from 'node:crypto';

const memory = new Map();

function fingerprint(token) {
  return createHash('sha256').update(token || 'anon').digest('hex').slice(0, 24);
}

async function redisCommand(command) {
  const url = process.env.API_REDIS_URL;
  const token = process.env.API_REDIS_TOKEN;
  if (!url || !token) return null;
  const r = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(2500),
  });
  if (!r.ok) throw new Error(`Redis ${r.status}`);
  return r.json();
}

async function distributed(key, limit) {
  const first = await redisCommand(['SET', key, '1', 'EX', 60, 'NX']);
  if (first?.result === 'OK') return { ok: true, remaining: limit - 1, distributed: true };
  const inc = await redisCommand(['INCR', key]);
  const count = Number(inc?.result || 0);
  return { ok: count <= limit, remaining: Math.max(0, limit - count), distributed: true };
}

function local(key, limit, now = Date.now()) {
  const bucket = Math.floor(now / 60000);
  const compound = `${key}:${bucket}`;
  const n = (memory.get(compound) || 0) + 1;
  memory.set(compound, n);
  if (memory.size > 2000) {
    for (const k of memory.keys()) if (!k.endsWith(`:${bucket}`)) memory.delete(k);
  }
  return { ok: n <= limit, remaining: Math.max(0, limit - n), distributed: false };
}

export async function checkRateLimit(apiToken, routeKey, limit = 60) {
  const key = `bartalk-api:rl:${fingerprint(apiToken)}:${routeKey}`;
  if (process.env.API_REDIS_URL && process.env.API_REDIS_TOKEN) {
    try { return await distributed(key, limit); } catch { /* Core applica comunque i propri limiti */ }
  }
  return local(key, limit);
}
