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
    // Una query fissata nella route (es. action=profile) e autoritativa:
    // il client non puo aggiungere un secondo valore per cambiarne il significato.
    if (!sensibili.has(k) && !target.searchParams.has(k)) target.searchParams.append(k, v);
  }
  return target;
}

async function rispostaGateway(route, response, responseHeaders) {
  // Audit b.416: il Core b.415 ha fatto un salto enorme sul DELETE USER,
  // ma non esiste ancora una prova di cancellazione TOTALE. In particolare
  // la tabella translations puo contenere testo originale/tradotto legato a
  // user_id e Mondo ha follow/like/segnalazioni con identificativi utente.
  // Oggi queste tabelle risultano vuote nel DB vivo, ma il contratto pubblico
  // non deve dipendere dal fatto che oggi non ci siano righe.
  //
  // Il gateway NON duplica la business logic di cancellazione: continua a
  // delegarla al Core. Aggiunge pero un esito macchina esplicito, cosi un
  // integratore non puo interpretare `ok:true` come certificazione di
  // cancellazione assoluta.
  if (route.method === 'DELETE' && route.pattern === '/me/data' && response.ok) {
    try {
      const tipo = response.headers.get('content-type') || '';
      if (tipo.includes('application/json')) {
        const data = await response.clone().json();
        const body = {
          ...data,
          deletionCoverage: {
            status: 'partial',
            auditedCore: 'b.416',
            retainedByPolicy: ['wallet_accounting', 'public_mondo_content'],
            notGuaranteedByCore: [
              'translation_history_rows',
              'mondo_follows',
              'mondo_comment_likes',
              'mondo_reports',
            ],
            note: 'Deletion was requested from the BarTalk Core, but this response is not a certificate of total erasure.',
          },
        };
        responseHeaders.set('content-type', 'application/json; charset=utf-8');
        responseHeaders.delete('content-length');
        return new Response(JSON.stringify(body), {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }
    } catch {
      // Se il Core cambia formato, non mascheriamo il suo risultato: si
      // inoltra la risposta originale e il test di contratto dovra segnalarlo.
    }
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
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
    // Il contratto della route vince SEMPRE sul body del client.
    // Prima era al contrario: {fixed, ...client} permetteva di cambiare action/azione.
    json = { ...json, ...(route.fixedBody || {}) };
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
  return rispostaGateway(route, response, responseHeaders);
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
