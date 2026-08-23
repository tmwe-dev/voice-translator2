const R = (method, pattern, scope, upstream, auth, opts = {}) => ({ method, pattern, scope, upstream, auth, limit: 60, ...opts });

// Solo capability di prodotto concrete e stabili. Test/debug/admin/cron/webhook/Stripe raw non sono esposti.
// Una rotta Core esistente NON basta: la capability deve essere realmente operativa sul backend vivo.
// Per questo v1 non pubblica preferenze server, /api/keys e glossari: oggi dipendono dallo schema
// Supabase legacy `profiles/user_settings/api_keys_vault/glossaries`, non presente in produzione.
export const ROUTES = [
  { method: 'GET', pattern: '/health', local: 'health', public: true, limit: 20 },
  { method: 'POST', pattern: '/auth/exchange', local: 'exchange', public: true, limit: 10 },

  R('GET', '/me', 'profile:read', '/api/user?action=profile', 'header'),
  R('PATCH', '/me', 'profile:write', '/api/user', 'json:token', { upstreamMethod: 'POST', fixedBody: { action: 'update' } }),
  R('DELETE', '/me/data', 'profile:write', '/api/user', 'json:token', { upstreamMethod: 'POST', fixedBody: { action: 'delete-data' }, limit: 5 }),

  // Wallet contabile attuale. Lo storico compatibilita e Redis-backed nel Core.
  R('GET', '/wallet', 'wallet:read', '/api/wallet/saldo', 'header'),
  R('GET', '/wallet/payments', 'wallet:read', '/api/user', 'json:token', { upstreamMethod: 'POST', fixedBody: { action: 'payments' } }),
  R('POST', '/wallet/topups', 'wallet:write', '/api/wallet/ricarica', 'header', { limit: 10 }),
  R('POST', '/wallet/gifts/redeem', 'wallet:write', '/api/wallet/regalo', 'header', { fixedBody: { azione: 'riscatta' }, limit: 10 }),
  R('POST', '/wallet/vouchers/redeem', 'wallet:write', '/api/wallet/voucher', 'header', { limit: 10 }),

  R('POST', '/translate', 'translate', '/api/translate', 'json:userToken', { limit: 120 }),
  R('POST', '/transcribe', 'speech:stt', '/api/transcribe', 'form:userToken', { limit: 30, multipart: true }),
  R('POST', '/tts', 'speech:tts', '/api/tts', 'json:userToken', { binary: true }),
  R('POST', '/tts/elevenlabs', 'speech:tts', '/api/tts-elevenlabs', 'json:userToken', { binary: true }),
  R('GET', '/voices', 'speech:tts', '/api/voci', 'none'),
  R('POST', '/voices/clone', 'voice:clone', '/api/voice-clone', 'form:userToken', { multipart: true, limit: 10 }),

  R('GET', '/companions', 'companions:read', '/api/compagni/mie', 'json:userToken', { upstreamMethod: 'POST', fixedBody: { azione: 'elenco' } }),
  R('POST', '/companions', 'companions:write', '/api/compagni/mie', 'json:userToken', { fixedBody: { azione: 'salva' }, transform: 'companionCreate' }),
  R('DELETE', '/companions/:id/memory', 'companions:write', '/api/compagni/mie', 'json:userToken', { upstreamMethod: 'POST', fixedBody: { azione: 'dimentica' }, transform: 'companionForget', limit: 20 }),
  R('DELETE', '/companions/:id', 'companions:write', '/api/compagni/mie', 'json:userToken', { upstreamMethod: 'POST', fixedBody: { azione: 'cancella' }, transform: 'companionDelete' }),
  R('POST', '/companions/:id/messages', 'companions:chat', '/api/compagni/amico', 'json:userToken', { transform: 'companionMessage', limit: 40 }),
  R('POST', '/companions/:id/live-sessions', 'companions:live', '/api/compagni/live/session', 'json:userToken', { transform: 'liveOpen', limit: 10 }),
  R('POST', '/live-sessions/:sessionId/heartbeat', 'companions:live', '/api/compagni/live/session', 'json:userToken', { transform: 'liveRenew', limit: 60 }),
  R('DELETE', '/live-sessions/:sessionId', 'companions:live', '/api/compagni/live/session', 'json:userToken', { upstreamMethod: 'POST', transform: 'liveClose', limit: 20 }),
  R('POST', '/podcast/turns', 'companions:podcast', '/api/compagni/podcast', 'json:userToken', { limit: 60 }),
  R('POST', '/table', 'companions:chat', '/api/compagni/tavolo', 'json:userToken', { limit: 40 }),
  R('POST', '/learning/course', 'learning', '/api/compagni/corso', 'json:userToken', { limit: 30 }),
  R('POST', '/learning/dossier', 'learning', '/api/compagni/dossier', 'json:userToken', { limit: 20 }),
  R('POST', '/companions/avatar', 'companions:write', '/api/compagni/avatar', 'json:userToken', { limit: 10 }),
  R('POST', '/companions/generate', 'companions:write', '/api/compagni/genera', 'json:userToken', { limit: 20 }),
  R('POST', '/learning/scans/deposit', null, '/api/compiti', 'none', { public: true, fixedBody: { azione: 'scanDeposita' }, limit: 60, maxJsonBytes: 6 * 1024 * 1024 }),
  R('POST', '/learning/scans/retrieve', 'learning', '/api/compiti', 'json:userToken', { fixedBody: { azione: 'scanRitira' }, limit: 60 }),
  R('POST', '/learning/homework', 'learning', '/api/compiti', 'json:userToken', { limit: 60, maxJsonBytes: 6 * 1024 * 1024 }),

  R('GET', '/topics/search', 'topics:read', '/api/topics/search', 'query', { stream: true, limit: 15 }),

  // Queste superfici usano Redis/capability token nel Core. Dove la sessione
  // account non viene inoltrata, il gateway la riverifica prima della chiamata.
  R('GET', '/rooms', 'rooms:read', '/api/room', 'none'),
  R('POST', '/rooms', 'rooms:write', '/api/room', 'json:userToken'),
  R('GET', '/messages', 'messages:read', '/api/messages', 'none'),
  R('POST', '/messages', 'messages:write', '/api/messages', 'none'),
  R('PATCH', '/messages', 'messages:write', '/api/messages', 'none'),
  R('GET', '/conversations', 'messages:read', '/api/conversation', 'json:userToken', { upstreamMethod: 'POST', fixedBody: { action: 'list' } }),
  R('GET', '/conversations/:id', 'messages:read', '/api/conversation', 'header', { queryFromParams: { id: 'id' } }),
  R('DELETE', '/conversations/:id', 'messages:write', '/api/conversation', 'json:userToken', { upstreamMethod: 'POST', fixedBody: { action: 'delete' }, transform: 'conversationDelete' }),
  R('POST', '/conversations/end', 'messages:write', '/api/conversation', 'none', { fixedBody: { action: 'end' } }),
  R('POST', '/reactions', 'messages:write', '/api/reazioni', 'none', { limit: 120 }),
  R('GET', '/realtime/ice', 'rooms:read', '/api/turn', 'none', { limit: 120 }),
  R('POST', '/realtime/group-video', 'rooms:write', '/api/stanza-video', 'none', { limit: 180 }),
  R('GET', '/contacts', 'contacts:read', '/api/contacts', 'json:token', { upstreamMethod: 'POST', fixedBody: { action: 'list' } }),
  // Il Core multiplexa anche inviti-regalo dentro /api/contacts. La v1 espone
  // solo azioni non finanziarie: niente creazione/accettazione di gift invite.
  R('POST', '/contacts', 'contacts:write', '/api/contacts', 'json:token', { transform: 'contactsWrite' }),
  R('POST', '/summary', 'summary', '/api/summary', 'json:userToken'),
  R('POST', '/moderation', 'moderation', '/api/moderazione', 'none'),
  R('GET', '/community', 'community:read', '/api/mondo', 'none'),
  R('POST', '/community', 'community:write', '/api/mondo', 'none'),
  R('POST', '/peepoff', 'peepoff', '/api/peepoff', 'json:userToken'),
  R('POST', '/taxi/destination', 'taxi', '/api/taxi/destination', 'none', { limit: 30 }),
  R('GET', '/taxi/destination', 'taxi', '/api/taxi/destination', 'none', { limit: 60 }),
  R('DELETE', '/taxi/destination', 'taxi', '/api/taxi/destination', 'none', { limit: 30 }),
];

function compile(pattern) {
  const names = [];
  const source = pattern.split('/').map((part) => {
    if (part.startsWith(':')) { names.push(part.slice(1)); return '([^/]+)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { regex: new RegExp(`^${source}$`), names };
}

const COMPILED = ROUTES.map((route) => ({ ...route, ...compile(route.pattern) }));

function safeDecode(value) {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded.length > 200 || decoded.includes('/')) return null;
    return decoded;
  } catch { return null; }
}

export function matchRoute(method, path) {
  for (const route of COMPILED) {
    if (route.method !== method.toUpperCase()) continue;
    const m = route.regex.exec(path);
    if (!m) continue;
    const params = {};
    for (let i = 0; i < route.names.length; i++) {
      const decoded = safeDecode(m[i + 1]);
      if (decoded === null) return null;
      params[route.names[i]] = decoded;
    }
    return { route, params };
  }
  return null;
}

export function requiresSessionProbe(route) {
  if (!route || route.public || route.local) return false;
  return !new Set(['header', 'json:token', 'json:userToken', 'form:userToken']).has(route.auth);
}

function badRequest(message) {
  const e = new Error(message); e.status = 400; return e;
}

export function transformBody(name, body, params) {
  if (!name) return body;
  if (name === 'companionCreate') return { ...body, compagno: body.compagno || body };
  if (name === 'companionDelete') return { ...body, id: params.id };
  if (name === 'companionForget') return { ...body, id: params.id, azione: 'dimentica' };
  if (name === 'companionMessage') {
    return {
      ...body,
      compagnoId: params.id,
      messaggi: body.messaggi || body.messages || [],
      superficie: body.superficie || body.surface || 'amico',
      obiettivi: body.obiettivi || body.goals || [],
    };
  }
  if (name === 'liveOpen') return { ...body, azione: 'apri', compagnoId: params.id };
  if (name === 'liveRenew') return { ...body, azione: 'rinnova', sessioneId: params.sessionId };
  if (name === 'liveClose') return { ...body, azione: 'chiudi', sessioneId: params.sessionId };
  if (name === 'conversationDelete') return { ...body, action: 'delete', convId: params.id };
  if (name === 'contactsWrite') {
    const action = typeof body?.action === 'string' ? body.action : '';
    const allowed = new Set(['heartbeat', 'offline', 'add', 'remove', 'start-chat', 'create-invite', 'get-gift-info']);
    if (!allowed.has(action)) throw badRequest('Azione contatti non pubblicata dalla API v1');
    // Anche `create-invite` e consentita soltanto nella forma NON finanziaria.
    // La presenza stessa di giftAmount viene rifiutata: non la ignoriamo in
    // silenzio per evitare che un client creda di aver creato un regalo.
    if (action === 'create-invite' && Object.prototype.hasOwnProperty.call(body, 'giftAmount')) {
      throw badRequest('Gli inviti con credito non sono pubblicati dalla API v1');
    }
    return body;
  }
  return body;
}
