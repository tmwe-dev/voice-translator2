import { SCOPES } from './apiKey.js';
import { ROUTES } from './routes.js';

const apiSecurity = [{ bearerAuth: [] }];

function pathParameters(pattern) {
  return [...pattern.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => ({
    name: m[1], in: 'path', required: true, schema: { type: 'string', minLength: 1 },
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
          ttlDays: { type: 'integer', minimum: 1, maximum: 365, default: 6 },
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

function schemaFor(route) {
  if (route.local === 'exchange') {
    return {
      summary: 'Scambia una sessione BarTalk con una API key v1',
      description: 'Authorization deve contenere la sessione BarTalk corrente. La chiave emessa eredita la validita della sessione Core e gli scope richiesti.',
      security: [{ barTalkSession: [] }],
      requestBody: requestBodyFor(route),
      responses: {
        '201': { description: 'API key emessa' },
        '401': { description: 'Sessione BarTalk non valida o scaduta' },
        '429': { description: 'Rate limit' },
        '502': { description: 'Core non disponibile' },
      },
    };
  }

  const parameters = pathParameters(route.pattern);
  return {
    summary: `${route.method} ${route.pattern}`,
    description: route.scope
      ? `Scope richiesto: \`${route.scope}\`. Il gateway trasporta la richiesta; la business logic autorevole resta nel BarTalk Core.`
      : 'Endpoint pubblico del gateway.',
    security: route.public ? [] : apiSecurity,
    ...(parameters.length ? { parameters } : {}),
    ...(requestBodyFor(route) ? { requestBody: requestBodyFor(route) } : {}),
    responses: {
      '200': { description: 'Risposta del BarTalk Core' },
      '400': { description: 'Richiesta non valida' },
      '401': { description: 'API key, sessione BarTalk o sessione stanza non valida' },
      '402': { description: 'Credito insufficiente' },
      '403': { description: 'Scope insufficiente, membership negata o elaborazione vietata' },
      '404': { description: 'Risorsa non trovata' },
      '413': { description: 'Payload troppo grande' },
      '429': { description: 'Rate limit' },
      '502': { description: 'BarTalk Core non disponibile' },
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
      description: 'API pubblica versionata che espone capability verificate del BarTalk Core senza duplicarne business logic, wallet, memoria o provider routing.',
    },
    servers: [{ url: origin }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'bt_live_*', description: 'API key BarTalk v1' },
        barTalkSession: { type: 'http', scheme: 'bearer', bearerFormat: 'BarTalk session', description: 'Usata solo per /auth/exchange' },
      },
      schemas: {
        ApiKeyScopes: { type: 'array', uniqueItems: true, items: { type: 'string', enum: SCOPES } },
        Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' }, requestId: { type: 'string' } } },
      },
    },
  };
}
