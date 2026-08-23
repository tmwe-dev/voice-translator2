import { API_TIMEOUT_MS, CORE_URL, MAX_JSON_BYTES } from './config.js';
import { transformBody } from './routes.js';

function forwardHeaders(req, extra = {}) {
  const out = new Headers(extra);
  // x-request-id arriva gia normalizzato dal gateway: non inoltriamo il
  // valore grezzo controllabile dal chiamante.
  for (const name of ['x-session-mode', 'x-room-session', 'accept-language']) {
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

async function readMultipart(req, maxBytes) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > maxBytes) { const e = new Error('Payload multipart troppo grande'); e.status = 413; throw e; }
  const contentType = req.headers.get('content-type') || '';
  if (!/^multipart\/form-data;/i.test(contentType)) { const e = new Error('Multipart/form-data richiesto'); e.status = 400; throw e; }

  let raw;
  try { raw = await req.arrayBuffer(); } catch { const e = new Error('Corpo multipart non leggibile'); e.status = 400; throw e; }
  // Il Content-Length puo mancare o mentire: il limite autorevole e sui byte
  // letti realmente prima di affidare il corpo al parser multipart.
  if (raw.byteLength > maxBytes) { const e = new Error('Payload multipart troppo grande'); e.status = 413; throw e; }

  try {
    const bounded = new Request('http://bartalk.local/multipart', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: raw,
    });
    return await bounded.formData();
  } catch {
    const e = new Error('Multipart/form-data non valido'); e.status = 400; throw e;
  }
}

function mergeQuery(upstream, incomingUrl) {
  const target = new URL(`${CORE_URL}${upstream}`);
  const incoming = new URL(incomingUrl);
  const sensibili = new Set(['token','userToken','roomSessionToken','apiKey','authorization']);
  for (const [k, v] of incoming.searchParams) {
    if (!sensibili.has(k) && !target.searchParams.has(k)) target.searchParams.append(k, v);
  }
  return target;
}

async function rispostaGateway(route, response, responseHeaders) {
  // Core b.420: b.419 ha chiuso i metadati personali Mondo; b.420 non cambia
  // il perimetro GDPR ma e lo snapshot corrente auditato. Restano per policy
  // ledger wallet e contenuti pubblici Mondo. La vecchia translation_history
  // e inattiva nel backend vivo e non viene spacciata per dato cancellato.
  if (route.method === 'DELETE' && route.pattern === '/me/data' && response.ok) {
    try {
      const tipo = response.headers.get('content-type') || '';
      if (tipo.includes('application/json')) {
        const data = await response.clone().json();
        const body = {
          ...data,
          deletionCoverage: {
            status: 'partial',
            auditedCore: 'b.420',
            retainedByPolicy: ['wallet_accounting', 'public_mondo_content'],
            notGuaranteedByCore: [],
            legacyInactiveSurfaces: ['translation_history'],
            note: 'Core b.420 deletes the audited personal surfaces. Wallet accounting and public Mondo content remain by policy; legacy translation history is inactive and is not represented as deleted.',
          },
        };
        responseHeaders.set('content-type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(body), {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }
    } catch { /* formato Core cambiato: inoltra la risposta originale */ }
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}

export async function callUpstream({ req, route, params, sessionToken, requestId = '' }) {
  const method = route.upstreamMethod || route.method;
  const target = mergeQuery(route.upstream, req.url);
  if (route.queryFromParams) {
    for (const [queryName, paramName] of Object.entries(route.queryFromParams)) {
      const value = params?.[paramName];
      if (value !== undefined && value !== null && value !== '') target.searchParams.set(queryName, String(value));
    }
  }
  const headers = forwardHeaders(req, requestId ? { 'X-Request-Id': requestId } : {});
  let body;

  if (route.auth === 'header') headers.set('Authorization', `Bearer ${sessionToken}`);

  if (route.multipart) {
    const maxMultipart = route.maxMultipartBytes || 30 * 1024 * 1024;
    const form = await readMultipart(req, maxMultipart);
    const copy = new FormData();
    for (const [k, v] of form.entries()) copy.append(k, v);
    if (route.auth === 'form:userToken') copy.set('userToken', sessionToken);
    body = copy;
  } else if (!['GET', 'HEAD'].includes(method)) {
    let json = await readJson(req, route.maxJsonBytes || MAX_JSON_BYTES);
    // Il contratto della route vince SEMPRE sul body del client.
    json = { ...json, ...(route.fixedBody || {}) };
    json = transformBody(route.transform, json, params);
    if (route.auth === 'json:userToken') json.userToken = sessionToken;
    if (route.auth === 'json:token') json.token = sessionToken;
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  const response = await fetch(target, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  const responseHeaders = new Headers();
  // Non copiare content-length: fetch puo decomprimere/trasformare il body e
  // quel numero diventerebbe falso. Il runtime calcola il framing corretto.
  for (const name of ['content-type', 'cache-control', 'x-tts-engine', 'retry-after']) {
    const v = response.headers.get(name); if (v) responseHeaders.set(name, v);
  }
  responseHeaders.set('X-BarTalk-Core-Status', String(response.status));
  return rispostaGateway(route, response, responseHeaders);
}

export async function verifyCoreSession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.length > 512) {
    const e = new Error('Sessione BarTalk non valida o scaduta'); e.status = 401; throw e;
  }
  let r;
  try {
    r = await fetch(`${CORE_URL}/api/user?action=profile`, {
      method: 'GET', headers: { Authorization: `Bearer ${sessionToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    const e = new Error('Core BarTalk non disponibile per la verifica'); e.status = 502; throw e;
  }
  let data = null;
  try { data = await r.json(); } catch { /* non JSON = sessione non verificabile */ }
  if (!r.ok || !data?.email) {
    const e = new Error(
      r.status === 401 || r.status === 404
        ? 'Sessione BarTalk non valida o scaduta'
        : r.status === 429 ? 'Rate limit del Core' : 'Core BarTalk non disponibile per la verifica'
    );
    e.status = r.status === 401 || r.status === 404 ? 401 : r.status === 429 ? 429 : 502;
    throw e;
  }
  return data;
}
