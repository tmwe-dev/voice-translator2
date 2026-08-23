import { randomUUID } from 'node:crypto';

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,96}$/;

export function requestIdFrom(req) {
  const incoming = (req.headers.get('x-request-id') || '').trim();
  return REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
}

export function clientAddress(req) {
  // Su Vercel/proxy il primo valore e il client originario. Non usiamo mai
  // questo dato come autenticazione: serve soltanto a separare i bucket dei
  // rate limit pubblici, evitando che tutto Internet condivida `public`.
  const raw = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const first = raw.split(',')[0].trim().slice(0, 128);
  return first || 'unknown';
}

export function publicRateIdentity(req) {
  const ua = (req.headers.get('user-agent') || '').slice(0, 160);
  return `public:${clientAddress(req)}:${ua}`;
}
