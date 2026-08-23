import { DEFAULT_SCOPES, bearer, issueApiKey, normalizeScopes, requireApiKey } from '../../../../lib/apiKey.js';
import { API_KEY_TTL_DAYS, MAX_API_KEY_TTL_DAYS } from '../../../../lib/config.js';
import { gatewayHealth } from '../../../../lib/health.js';
import { checkRateLimit } from '../../../../lib/rateLimit.js';
import { matchRoute, requiresSessionProbe } from '../../../../lib/routes.js';
import { publicRateIdentity, requestIdFrom } from '../../../../lib/requestMeta.js';
import { callUpstream, verifyCoreSession } from '../../../../lib/upstream.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 75;

function cors(headers = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Session-Mode, X-Room-Session, X-Request-Id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'X-Request-Id, X-RateLimit-Remaining, X-BarTalk-Core-Status, X-TTS-Engine, X-BarTalk-API-Version',
    'X-BarTalk-API-Version': '1',
    ...headers,
  };
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: cors(headers) });
}

async function exchangeBody(req) {
  const max = 16 * 1024;
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > max) { const e = new Error('Payload troppo grande'); e.status = 413; throw e; }
  const raw = await req.text();
  if (Buffer.byteLength(raw, 'utf8') > max) { const e = new Error('Payload troppo grande'); e.status = 413; throw e; }
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { const e = new Error('JSON non valido'); e.status = 400; throw e; }
}

async function exchange(req, requestId) {
  const gate = await checkRateLimit(publicRateIdentity(req), 'POST:/auth/exchange', 10);
  if (!gate.ok) return json({ error: 'Rate limit superato', requestId }, 429, { 'X-RateLimit-Remaining': '0', 'X-Request-Id': requestId });

  const sessionToken = bearer(req);
  if (!sessionToken || sessionToken.startsWith('bt_live_')) {
    return json({ error: 'Usa una sessione BarTalk valida, non una API key', requestId }, 401, { 'X-Request-Id': requestId });
  }

  let body;
  try { body = await exchangeBody(req); }
  catch (e) { return json({ error: e.message, requestId }, e.status || 400, { 'X-Request-Id': requestId }); }

  try {
    const profile = await verifyCoreSession(sessionToken);
    const scopes = normalizeScopes(body.scopes);
    if (body.ttlDays !== undefined && (!Number.isInteger(body.ttlDays) || body.ttlDays < 1 || body.ttlDays > MAX_API_KEY_TTL_DAYS)) {
      return json({ error: `ttlDays deve essere un intero fra 1 e ${MAX_API_KEY_TTL_DAYS}`, requestId }, 400, { 'X-Request-Id': requestId });
    }
    const ttlDays = body.ttlDays ?? API_KEY_TTL_DAYS;
    let apiKey;
    try {
      apiKey = issueApiKey({ sessionToken, subject: profile.email, scopes, ttlDays });
    } catch (e) {
      if (String(e?.message || '').includes('BARTALK_API_SIGNING_SECRET')) {
        return json({ error: 'Emissione API key non disponibile', requestId }, 503, { 'X-Request-Id': requestId });
      }
      throw e;
    }
    return json({
      apiKey,
      tokenType: 'Bearer',
      expiresInDays: ttlDays,
      scopes,
      user: { email: profile.email, name: profile.name || null, tier: profile.tier || 'free' },
      requestId,
    }, 201, { 'X-Request-Id': requestId, 'X-RateLimit-Remaining': String(gate.remaining) });
  } catch (e) {
    return json({ error: e.message, requestId }, e.status || 400, { 'X-Request-Id': requestId });
  }
}

async function handle(req, context) {
  const p = await context.params;
  const path = '/' + (p?.segments || []).join('/');
  const found = matchRoute(req.method, path);
  const requestId = requestIdFrom(req);
  if (!found) return json({ error: 'Endpoint non trovato', requestId }, 404, { 'X-Request-Id': requestId });
  const { route, params } = found;

  if (route.local === 'exchange') return exchange(req, requestId);

  let apiToken = '';
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

  // Le porte pubbliche hanno un bucket PER CLIENT, non un unico bucket
  // globale `public` capace di far bloccare tutti da un singolo chiamante.
  const rateIdentity = route.public ? publicRateIdentity(req) : apiToken;
  const rl = await checkRateLimit(rateIdentity, `${req.method}:${route.pattern}`, route.limit || 60);
  if (!rl.ok) return json({ error: 'Rate limit superato', requestId }, 429, { 'X-Request-Id': requestId, 'X-RateLimit-Remaining': '0' });

  if (route.local === 'health') {
    const health = await gatewayHealth();
    return json({ ...health, requestId }, health.ok ? 200 : 503, {
      'X-Request-Id': requestId,
      'X-RateLimit-Remaining': String(rl.remaining),
    });
  }

  // Alcune capability Core (Topics, voci, room/message capability-token,
  // Mondo, Taxi...) non ricevono la sessione account. La API key pero e
  // dichiaratamente legata a quella sessione: la riverifichiamo qui, cosi
  // logout/cancellazione revocano SUBITO anche queste porte.
  if (requiresSessionProbe(route)) {
    try { await verifyCoreSession(sessionToken); }
    catch (e) { return json({ error: e.message, requestId }, e.status || 401, { 'X-Request-Id': requestId }); }
  }

  try {
    const upstream = await callUpstream({ req, route, params, sessionToken, requestId });
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
