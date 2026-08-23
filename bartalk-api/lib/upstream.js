import { API_TIMEOUT_MS, CORE_URL, MAX_JSON_BYTES } from './config.js';
import { transformBody } from './routes.js';

function forwardHeaders(req, extra = {}) {
  const out = new Headers(extra);
  for (const name of ['x-session-mode', 'x-room-session', 'x-request-id', 'accept-language']) {
    const v = req.headers.get(name); if (v) out.set(name, v);
  }
  return out;
}

async function readJson(req, maxBytes = MAX_JSON_BYTES) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > maxBytes) { const e = new Error('Payload troppo grande'); e.status = 413; throw e; }
  let raw;
  try { raw = await req.text(); } catch { const e = new Error('Corpo non leggibile'); e.status = 400; throw e; }
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) { const e = new Error('Payload troppo grande'); e.status = 413; throw e; }
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { const e = new Error('JSON non valido'); e.status = 400; throw e; }
}

function mergeQuery(upstream, incomingUrl) {
  const target = new URL(`${CORE_URL}${upstream}`);
  const incoming = new URL(incomingUrl);
  const sensibili = new Set(['token','userToken','roomSessionToken','apiKey','authorization']);
  for (const [k, v] of incoming.searchParams) {
    if (!sensibili.has(k)) target.searchParams.append(k, v);
  }
  return target;
}

export async function callUpstream({ req, route, params, sessionToken }) {
  const method = route.upstreamMethod || route.method;
  const target = mergeQuery(route.upstream, req.url);
  if (route.queryFromParams) {
    for (const [queryName, paramName] of Object.entries(route.queryFromParams)) {
      const value = params?.[paramName];
      if (value !== undefined && value !== null && value !== '') target.searchParams.set(queryName, String(value));
    }
  }
  const headers = forwardHeaders(req);
  let body;

  if (route.auth === 'header') headers.set('Authorization', `Bearer ${sessionToken}`);

  if (route.multipart) {
    const declared = Number(req.headers.get('content-length') || 0);
    const maxMultipart = route.maxMultipartBytes || 30 * 1024 * 1024;
    if (declared > maxMultipart) { const e = new Error('Payload multipart troppo grande'); e.status = 413; throw e; }
    let form;
    try { form = await req.formData(); } catch { const e = new Error('Multipart/form-data non valido'); e.status = 400; throw e; }
    const copy = new FormData();
    for (const [k, v] of form.entries()) copy.append(k, v);
    if (route.auth === 'form:userToken') copy.set('userToken', sessionToken);
    body = copy;
  } else if (!['GET', 'HEAD'].includes(method)) {
    let json = await readJson(req, route.maxJsonBytes || MAX_JSON_BYTES);
    json = { ...(route.fixedBody || {}), ...json };
    json = transformBody(route.transform, json, params);
    if (route.auth === 'json:userToken') json.userToken = sessionToken;
    if (route.auth === 'json:token') json.token = sessionToken;
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  const response = await fetch(target, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  const responseHeaders = new Headers();
  for (const name of ['content-type', 'content-length', 'cache-control', 'x-tts-engine']) {
    const v = response.headers.get(name); if (v) responseHeaders.set(name, v);
  }
  responseHeaders.set('X-BarTalk-Core-Status', String(response.status));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}

export async function verifyCoreSession(sessionToken) {
  const r = await fetch(`${CORE_URL}/api/user?action=profile`, {
    method: 'GET', headers: { Authorization: `Bearer ${sessionToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  let data = null;
  try { data = await r.json(); } catch { /* non JSON = sessione non verificabile */ }
  if (!r.ok || !data?.email) {
    const e = new Error(r.status === 401 ? 'Sessione BarTalk non valida o scaduta' : 'Core BarTalk non disponibile per la verifica');
    e.status = r.status === 401 ? 401 : 502;
    throw e;
  }
  return data;
}
