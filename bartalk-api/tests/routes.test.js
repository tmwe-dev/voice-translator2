import { describe, expect, it } from 'vitest';
import { matchRoute, ROUTES, transformBody } from '../lib/routes.js';
import { buildOpenApi } from '../lib/openapi.js';

describe('registro API', () => {
  it('risolve parametri senza ambiguita', () => {
    const m = matchRoute('POST','/companions/omar/messages');
    expect(m.route.upstream).toBe('/api/compagni/amico');
    expect(m.params.id).toBe('omar');
  });
  it('rifiuta parametri path malformati invece di lanciarli nel Core', () => {
    expect(matchRoute('GET','/conversations/%E0%A4%A')).toBe(null);
    expect(matchRoute('GET','/conversations/a%2Fb')).toBe(null);
  });
  it('non espone rotte interne pericolose', () => {
    const targets = ROUTES.map(r => r.upstream || '').join(' ');
    for (const banned of ['/api/admin','/api/debug','/api/test-login','/api/translate-test','/api/tts-test','/api/stripe']) {
      expect(targets).not.toContain(banned);
    }
  });
  it('la cancellazione compagno non accetta un id dichiarato nel body', () => {
    expect(transformBody('companionDelete', { id:'falso' }, { id:'vero' }).id).toBe('vero');
  });
  it('OpenAPI copre ogni rotta registrata', () => {
    const spec = buildOpenApi('https://api.test');
    for (const r of ROUTES) {
      const p = `/api/v1${r.pattern.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
      expect(spec.paths[p]?.[r.method.toLowerCase()]).toBeTruthy();
    }
  });
});
