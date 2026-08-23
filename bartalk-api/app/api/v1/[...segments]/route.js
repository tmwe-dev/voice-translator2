import { randomUUID } from 'node:crypto';
import { DEFAULT_SCOPES, bearer, issueApiKey, normalizeScopes, requireApiKey } from '../../../../lib/apiKey.js';
import { matchRoute } from '../../../../lib/routes.js';
import { checkRateLimit } from '../../../../lib/rateLimit.js';
import { callUpstream, verifyCoreSession } from '../../../../lib/upstream.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 75;

function cors(headers = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Session-Mode, X-Room-Session, X-Request-Id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'X-Request-Id, X-RateLimit-Remaining, X-BarTalk-Core-Status, X-TTS-Engine',
    ...headers,
  };
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: cors(headers) });
}

async function exchange(req, requestId) {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  const gate = await checkRateLimit(`exchange:${ip}`, 'POST:/auth/exchange', 10);
  if (!gate.ok) return json({ error: 'Rate limit superato', requestId }, 429, { 'X-RateLimit-Remaining': '0' });
  const sessionToken = bearer(req);
  if (!sessionToken || sessionToken.startsWith('bt_live_')) return json({ error: 'Usa una sessione BarTalk valida, non una API key', requestId }, 401);
  let body = {};
  try { body = await req.json(); } catch { /* body opzionale */ }
  try {
    const profile = await verifyCoreSession(sessionToken);
    const scopes = normalizeScopes(body.scopes || DEFAULT_SCOPES);
    const requestedTtl = Number(body.ttlDays) || Number(process.env.BARTALK_API_KEY_TTL_DAYS || 6);
    const ttlDays = Math.max(1, Math.min(365, requestedTtl));
    const apiKey = issueApiKey({ sessionToken, subject: profile.email, scopes, ttlDays });
    return json({ apiKey, tokenType: 'Bearer', expiresInDays: ttlDays, scopes, user: { email: profile.email, name: profile.name || null, tier: profile.tier || 'free' }, requestId }, 201);
  } catch (e) { return json({ error: e.message, requestId }, e.status || 400); }
}

async function handle(req, context) {
  const p = await context.params;
  const path = '/' + (p?.segments || []).join('/');
  const found = matchRoute(req.method, path);
  const requestId = req.headers.get('x-request-id') || randomUUID();
  if (!found) return json({ error: 'Endpoint non trovato', requestId }, 404, { 'X-Request-Id': requestId });
  const { route, params } = found;

  if (route.local === 'exchange') return exchange(req, requestId);

  let apiToken = 'public';
  let sessionToken = '';
  if (!route.public) {
    try {
      const auth = requireApiKey(req, route.scope);
      apiToken = auth.token;
      sessionToken = auth.payload.session;
    } catch (e) {
      return json({ error: e.message, requestId }, e.status || 401, { 'X-Request-Id': requestId });
    }
  }

  const rl = await checkRateLimit(apiToken, `${req.method}:${route.pattern}`, route.limit || 60);
  if (!rl.ok) return json({ error: 'Rate limit superato', requestId }, 429, { 'X-Request-Id': requestId, 'X-RateLimit-Remaining': '0' });

  try {
    const upstream = await callUpstream({ req, route, params, sessionToken });
    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors({ 'X-Request-Id': requestId, 'X-RateLimit-Remaining': String(rl.remaining) }))) headers.set(k, v);
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  } catch (e) {
    const status = e?.name === 'TimeoutError' ? 504 : (e.status || 502);
    return json({ error: status === 504 ? 'Timeout BarTalk Core' : (e.message || 'BarTalk Core non disponibile'), requestId }, status, { 'X-Request-Id': requestId });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export function OPTIONS() { return new Response(null, { status: 204, headers: cors() }); }
