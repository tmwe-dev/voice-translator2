import { describe, expect, it } from 'vitest';
import { matchRoute, ROUTES, transformBody } from '../lib/routes.js';
import { buildOpenApi } from '../lib/openapi.js';

describe('registro API', () => {
  it('risolve parametri senza ambiguita', () => {
    const m = matchRoute('POST','/companions/omar/messages');
    expect(m.route.upstream).toBe('/api/compagni/amico');
    expect(m.params.id).toBe('omar');
  });
  it('espone il dimentica del Core b.411 senza fidarsi dell id nel body', () => {
    const m = matchRoute('DELETE','/companions/omar/memory');
    expect(m.route.upstream).toBe('/api/compagni/mie');
    expect(transformBody('companionForget', { id:'falso' }, { id:'omar' }))
      .toMatchObject({ id:'omar', azione:'dimentica' });
  });
  it('usa il wallet contabile attuale come saldo pubblico', () => {
    expect(matchRoute('GET','/wallet').route.upstream).toBe('/api/wallet/saldo');
  });
  it('separa gli scope delle chiavi provider e del wallet in scrittura', () => {
    expect(matchRoute('POST','/provider-keys').route.scope).toBe('keys:write');
    expect(matchRoute('POST','/wallet/topups').route.scope).toBe('wallet:write');
  });
  it('espone il battito Live b.418 e il path decide sessione/azione', () => {
    const m = matchRoute('POST','/live-sessions/sessione-vera/heartbeat');
    expect(m.route.upstream).toBe('/api/compagni/live/session');
    expect(m.route.scope).toBe('companions:live');
    expect(transformBody('liveRenew', { azione:'chiudi', sessioneId:'falsa' }, m.params))
      .toMatchObject({ azione:'rinnova', sessioneId:'sessione-vera' });
  });
  it('rifiuta parametri path malformati invece di lanciarli nel Core', () => {
    expect(matchRoute('GET','/conversations/%E0%A4%A')).toBe(null);
    expect(matchRoute('GET','/conversations/a%2Fb')).toBe(null);
  });
  it('non espone rotte interne o finanziarie non idempotenti', () => {
    const targets = ROUTES.map(r => r.upstream || '').join(' ');
    for (const banned of [
      '/api/admin','/api/debug','/api/test-login','/api/translate-test','/api/tts-test',
      '/api/stripe','/api/wallet/admin','/api/wallet/webhook','/api/wallet/cron-rilascia-riserve',
      '/api/wallet/cron-rimborso-regali'
    ]) expect(targets).not.toContain(banned);
    expect(ROUTES.some(r => r.pattern === '/wallet/gifts' && r.method === 'POST')).toBe(false);
  });
  it('la cancellazione compagno non accetta un id dichiarato nel body', () => {
    expect(transformBody('companionDelete', { id:'falso' }, { id:'vero' }).id).toBe('vero');
  });
  it('OpenAPI copre ogni rotta registrata, heartbeat incluso', () => {
    const spec = buildOpenApi('https://api.test');
    for (const r of ROUTES) {
      const p = `/api/v1${r.pattern.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
      expect(spec.paths[p]?.[r.method.toLowerCase()]).toBeTruthy();
    }
    expect(spec.paths['/api/v1/live-sessions/{sessionId}/heartbeat']?.post).toBeTruthy();
  });
});
