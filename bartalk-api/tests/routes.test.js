import { describe, expect, it } from 'vitest';
import { matchRoute, requiresSessionProbe, ROUTES, transformBody } from '../lib/routes.js';
import { buildOpenApi } from '../lib/openapi.js';

describe('registro API', () => {
  it('risolve parametri senza ambiguita', () => {
    const m = matchRoute('POST','/companions/omar/messages');
    expect(m.route.upstream).toBe('/api/compagni/amico');
    expect(m.params.id).toBe('omar');
  });

  it('espone il dimentica senza fidarsi dell id nel body', () => {
    const m = matchRoute('DELETE','/companions/omar/memory');
    expect(m.route.upstream).toBe('/api/compagni/mie');
    expect(transformBody('companionForget', { id:'falso' }, { id:'omar' }))
      .toMatchObject({ id:'omar', azione:'dimentica' });
  });

  it('usa il wallet contabile attuale come saldo pubblico', () => {
    expect(matchRoute('GET','/wallet').route.upstream).toBe('/api/wallet/saldo');
  });

  it('espone il battito Live e il path decide sessione/azione', () => {
    const m = matchRoute('POST','/live-sessions/sessione-vera/heartbeat');
    expect(m.route.upstream).toBe('/api/compagni/live/session');
    expect(m.route.scope).toBe('companions:live');
    expect(transformBody('liveRenew', { azione:'chiudi', sessioneId:'falsa' }, m.params))
      .toMatchObject({ azione:'rinnova', sessioneId:'sessione-vera' });
  });

  it('le route senza sessione inoltrata richiedono una riverifica Core', () => {
    expect(requiresSessionProbe(matchRoute('GET','/voices').route)).toBe(true);
    expect(requiresSessionProbe(matchRoute('GET','/topics/search').route)).toBe(true);
    expect(requiresSessionProbe(matchRoute('GET','/messages').route)).toBe(true);
    expect(requiresSessionProbe(matchRoute('GET','/community').route)).toBe(true);
    expect(requiresSessionProbe(matchRoute('GET','/wallet').route)).toBe(false);
    expect(requiresSessionProbe(matchRoute('POST','/translate').route)).toBe(false);
    expect(requiresSessionProbe(matchRoute('POST','/learning/scans/deposit').route)).toBe(false);
  });

  it('rifiuta parametri path malformati invece di lanciarli nel Core', () => {
    expect(matchRoute('GET','/conversations/%E0%A4%A')).toBe(null);
    expect(matchRoute('GET','/conversations/a%2Fb')).toBe(null);
  });

  it('i contatti espongono soltanto azioni non finanziarie note', () => {
    expect(transformBody('contactsWrite', { action:'add', contactEmail:'a@example.com' }, {}))
      .toMatchObject({ action:'add' });
    expect(transformBody('contactsWrite', { action:'create-invite' }, {}))
      .toMatchObject({ action:'create-invite' });

    for (const body of [
      { action:'create-invite', giftAmount:100 },
      { action:'accept-invite', inviteCode:'VT-GIFT-1' },
      { action:'future-core-action' },
    ]) {
      try {
        transformBody('contactsWrite', body, {});
        throw new Error('la trasformazione doveva rifiutare');
      } catch (e) {
        expect(e.status).toBe(400);
      }
    }
  });

  it('non espone rotte interne, mutazioni finanziarie non idempotenti o superfici legacy rotte', () => {
    const targets = ROUTES.map(r => r.upstream || '').join(' ');
    for (const banned of [
      '/api/admin','/api/debug','/api/test-login','/api/translate-test','/api/tts-test',
      '/api/stripe','/api/wallet/admin','/api/wallet/webhook','/api/wallet/cron-rilascia-riserve',
      '/api/wallet/cron-rimborso-regali','/api/keys','/api/glossary'
    ]) expect(targets).not.toContain(banned);
    expect(ROUTES.some(r => r.pattern === '/wallet/gifts' && r.method === 'POST')).toBe(false);
    expect(ROUTES.some(r => r.pattern === '/preferences')).toBe(false);
    expect(ROUTES.some(r => r.pattern === '/provider-keys')).toBe(false);
    expect(ROUTES.some(r => r.pattern.startsWith('/glossaries'))).toBe(false);
  });

  it('la cancellazione compagno non accetta un id dichiarato nel body', () => {
    expect(transformBody('companionDelete', { id:'falso' }, { id:'vero' }).id).toBe('vero');
  });

  it('OpenAPI copre ogni rotta registrata e solo quelle registrate', () => {
    const spec = buildOpenApi('https://api.test');
    for (const r of ROUTES) {
      const p = `/api/v1${r.pattern.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
      expect(spec.paths[p]?.[r.method.toLowerCase()]).toBeTruthy();
    }
    expect(spec.paths['/api/v1/live-sessions/{sessionId}/heartbeat']?.post).toBeTruthy();
    expect(spec.paths['/api/v1/provider-keys']).toBeUndefined();
    expect(spec.paths['/api/v1/preferences']).toBeUndefined();
    expect(spec.paths['/api/v1/glossaries']).toBeUndefined();
    expect(spec.info.description).toMatch(/b\.420/);
  });
});
