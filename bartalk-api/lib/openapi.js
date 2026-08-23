import { SCOPES } from './apiKey.js';
import { MAX_API_KEY_TTL_DAYS } from './config.js';
import { ROUTES } from './routes.js';

const apiSecurity = [{ bearerAuth: [] }];

function pathParameters(pattern) {
  return [...pattern.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => ({
    name: m[1], in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 200 },
  }));
}

function requestBodyFor(route) {
  if (route.local === 'exchange') {
    return {
      required: false,
      content: { 'application/json': { schema: {
        type: 'object', additionalProperties: false,
        properties: {
          scopes: { $ref: '#/components/schemas/ApiKeyScopes' },
          ttlDays: { type: 'integer', minimum: 1, maximum: MAX_API_KEY_TTL_DAYS, default: 6 },
        },
      } } },
    };
  }
  if (!['POST','PUT','PATCH','DELETE'].includes(route.method)) return undefined;
  if (route.method === 'DELETE' && !route.multipart && !route.fixedBody && !route.transform) return undefined;
  return {
    required: route.method !== 'DELETE',
    content: route.multipart
      ? { 'multipart/form-data': { schema: { type: 'object', additionalProperties: true } } }
      : { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
  };
}

function descriptionFor(route) {
  if (route.local === 'health') {
    return 'Readiness del gateway. Restituisce 200 solo se il BarTalk Core risponde e il segreto server-side necessario a emettere API key e configurato. Non espone valori segreti.';
  }
  if (route.method === 'DELETE' && route.pattern === '/me/data') {
    return 'Scope richiesto: `profile:write`. Avvia la cancellazione nel Core b.420. I metadati personali Mondo auditati vengono rimossi; ledger wallet e contenuti pubblici Mondo restano per policy. `deletionCoverage.status=partial` indica retention esplicite, non dati personali dimenticati.';
  }
  if (route.method === 'POST' && route.pattern === '/companions/:id/live-sessions') {
    return 'Scope richiesto: `companions:live`. Apre una sessione Live governata dal Core b.420. La risposta include `battitoSecondi`; il client invia heartbeat su `/live-sessions/{sessionId}/heartbeat`. b.420 serializza apertura, rinnovo e chiusura e contabilizza solo commit wallet realmente riusciti.';
  }
  if (route.method === 'POST' && route.pattern === '/live-sessions/:sessionId/heartbeat') {
    return 'Scope richiesto: `companions:live`. Heartbeat/rinnovo della sessione Live. Il `sessionId` del path e autoritativo. Se il credito termina il Core puo rispondere 402 e chiudere la sessione; 410 indica una sessione gia chiusa/scaduta.';
  }
  if (route.method === 'DELETE' && route.pattern === '/live-sessions/:sessionId') {
    return 'Scope richiesto: `companions:live`. Chiude la sessione Live e contabilizza la durata server-side. Il `sessionId` del path e autoritativo; b.420 impedisce corse fra close e heartbeat.';
  }
  if (route.method === 'GET' && route.pattern === '/realtime/ice') {
    return 'Scope richiesto: `rooms:read`. Restituisce gli ICE server del Core. Finche coturn/TURN_SECRET/TURN_URLS non sono configurati, `iceServers` puo essere vuoto e il client usa solo STUN.';
  }
  return route.scope
    ? `Scope richiesto: \`${route.scope}\`. La API key resta legata alla sessione BarTalk originaria: le route che non ricevono il token account nel Core vengono precedute da una riverifica della sessione, quindi logout/cancellazione revocano l'accesso.`
    : 'Endpoint pubblico del gateway, rate-limited per client.';
}

function successResponseFor(route) {
  if (route.local === 'health') {
    return {
      description: 'Gateway pronto',
      content: { 'application/json': { schema: {
        type: 'object', required: ['ok','apiVersion','signingConfigured','core'],
        properties: {
          ok: { type: 'boolean', const: true },
          apiVersion: { type: 'string', const: 'v1' },
          signingConfigured: { type: 'boolean', const: true },
          core: { type: 'object', properties: { ok: { type: 'boolean' }, status: { type: ['integer','null'] } } },
          requestId: { type: 'string' },
        },
      } } },
    };
  }
  if (route.method === 'DELETE' && route.pattern === '/me/data') {
    return {
      description: 'Richiesta di cancellazione eseguita dal Core; retention/policy dichiarate esplicitamente.',
      content: { 'application/json': { schema: {
        type: 'object', additionalProperties: true,
        properties: {
          ok: { type: 'boolean' },
          deleted: { type: 'array', items: { type: 'string' } },
          deletionCoverage: { $ref: '#/components/schemas/DeletionCoverage' },
        },
      } } },
    };
  }
  return { description: 'Risposta del BarTalk Core' };
}

function schemaFor(route) {
  if (route.local === 'exchange') {
    return {
      summary: 'Scambia una sessione BarTalk con una API key v1',
      description: `Authorization deve contenere la sessione BarTalk corrente. La chiave e cifrata AES-256-GCM, ha scope espliciti e TTL massimo ${MAX_API_KEY_TTL_DAYS} giorni, coerente con la vita massima della sessione Core. Un array scopes vuoto produce una chiave senza privilegi, non i default.`,
      security: [{ barTalkSession: [] }],
      requestBody: requestBodyFor(route),
      responses: {
        '201': { description: 'API key emessa' },
        '400': { description: 'JSON, scope o TTL non validi' },
        '401': { description: 'Sessione BarTalk non valida o scaduta' },
        '413': { description: 'Payload troppo grande' },
        '429': { description: 'Rate limit' },
        '502': { description: 'Core non disponibile' },
        '503': { description: 'Gateway non configurato per emettere chiavi' },
      },
    };
  }

  const parameters = pathParameters(route.pattern);
  return {
    summary: `${route.method} ${route.pattern}`,
    description: descriptionFor(route),
    security: route.public ? [] : apiSecurity,
    ...(parameters.length ? { parameters } : {}),
    ...(requestBodyFor(route) ? { requestBody: requestBodyFor(route) } : {}),
    responses: {
      '200': successResponseFor(route),
      '400': { description: 'Richiesta non valida' },
      '401': { description: 'API key, sessione BarTalk o sessione stanza non valida' },
      '402': { description: 'Credito insufficiente o terminato durante una sessione Live' },
      '403': { description: 'Scope insufficiente, ownership/membership negata o elaborazione vietata' },
      '404': { description: 'Risorsa non trovata' },
      '409': { description: 'Conflitto di stato, per esempio una seconda sessione Live gia in corso' },
      '410': { description: 'Risorsa/sessione non piu attiva' },
      '413': { description: 'Payload troppo grande' },
      '429': { description: 'Rate limit' },
      '502': { description: 'BarTalk Core non disponibile' },
      '503': { description: 'Gateway o capability non disponibile' },
      '504': { description: 'Timeout BarTalk Core' },
    },
  };
}

export function buildOpenApi(origin = 'https://api.example.com') {
  const paths = {};
  for (const r of ROUTES) {
    const p = `/api/v1${r.pattern.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
    paths[p] ||= {};
    paths[p][r.method.toLowerCase()] = schemaFor(r);
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'BarTalk API', version: '1.0.0',
      description: 'API pubblica versionata che espone soltanto capability verificate del BarTalk Core. Snapshot: Core b.420 / push #712. Preferenze server, provider-key vault e glossari legacy sono intenzionalmente esclusi finche il Core non dispone del relativo schema persistente vivo.',
    },
    servers: [{ url: origin }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'bt_live_*', description: 'API key BarTalk v1, server-side credential' },
        barTalkSession: { type: 'http', scheme: 'bearer', bearerFormat: 'BarTalk session', description: 'Usata solo per /auth/exchange' },
      },
      schemas: {
        ApiKeyScopes: { type: 'array', uniqueItems: true, items: { type: 'string', enum: SCOPES } },
        Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' }, requestId: { type: 'string' } } },
        DeletionCoverage: {
          type: 'object',
          required: ['status', 'auditedCore', 'retainedByPolicy', 'notGuaranteedByCore'],
          properties: {
            status: { type: 'string', const: 'partial' },
            auditedCore: { type: 'string', const: 'b.420' },
            retainedByPolicy: { type: 'array', items: { type: 'string' } },
            notGuaranteedByCore: { type: 'array', items: { type: 'string' }, maxItems: 0 },
            legacyInactiveSurfaces: { type: 'array', items: { type: 'string' } },
            note: { type: 'string' },
          },
        },
      },
    },
  };
}
