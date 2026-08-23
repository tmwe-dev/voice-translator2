import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callUpstream } from '../lib/upstream.js';
import { matchRoute } from '../lib/routes.js';

describe('adattatore Core', () => {
  let calls;
  beforeEach(() => {
    calls = [];
    global.fetch = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok:true }), { status:200, headers:{'content-type':'application/json'} });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('Contacts usa token e sovrascrive quello dichiarato dal client', async () => {
    const { route, params } = matchRoute('POST','/contacts');
    const req = new Request('https://api.test/api/v1/contacts', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({action:'list',token:'falso'}) });
    await callUpstream({ req, route, params, sessionToken:'vero' });
    expect(JSON.parse(calls[0].init.body).token).toBe('vero');
  });

  it('fixedBody e autoritativo: il client non puo trasformare riscatta in invia', async () => {
    const { route, params } = matchRoute('POST','/wallet/gifts/redeem');
    const req = new Request('https://api.test/api/v1/wallet/gifts/redeem', {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({ azione:'invia', codice:'REGALO-1', minuti:600 })
    });
    await callUpstream({ req, route, params, sessionToken:'vero' });
    const body = JSON.parse(calls[0].init.body);
    expect(body.azione).toBe('riscatta');
    expect(calls[0].init.headers.get('authorization')).toBe('Bearer vero');
  });

  it('la query fissata dalla route non puo essere duplicata dal client', async () => {
    const { route, params } = matchRoute('GET','/preferences');
    const req = new Request('https://api.test/api/v1/preferences?action=delete-data');
    await callUpstream({ req, route, params, sessionToken:'vero' });
    const u = new URL(calls[0].url);
    expect(u.searchParams.getAll('action')).toEqual(['get-prefs']);
  });

  it('Glossary usa token e non userToken', async () => {
    const { route, params } = matchRoute('GET','/glossaries');
    const req = new Request('https://api.test/api/v1/glossaries');
    await callUpstream({ req, route, params, sessionToken:'vero' });
    const body=JSON.parse(calls[0].init.body);
    expect(body.token).toBe('vero');
    expect(body.userToken).toBeUndefined();
  });

  it('GET messaggi inoltra X-Room-Session senza sostituirla con la sessione account', async () => {
    const { route, params } = matchRoute('GET','/messages');
    const req = new Request('https://api.test/api/v1/messages?room=ABC&name=Luca', { headers:{'x-room-session':'room-secret'} });
    await callUpstream({ req, route, params, sessionToken:'account-session' });
    expect(calls[0].init.headers.get('x-room-session')).toBe('room-secret');
    expect(calls[0].init.headers.get('authorization')).toBeNull();
  });

  it('id conversazione nel percorso diventa query autorevole del Core', async () => {
    const { route, params } = matchRoute('GET','/conversations/conv-1');
    const req = new Request('https://api.test/api/v1/conversations/conv-1?id=tentativo-falso');
    await callUpstream({ req, route, params, sessionToken:'account-session' });
    const u=new URL(calls[0].url);
    expect(u.searchParams.get('id')).toBe('conv-1');
    expect(calls[0].init.headers.get('authorization')).toBe('Bearer account-session');
  });

  it('learning/homework accetta il tetto Core da 6MB invece del tetto standard', async () => {
    const { route, params } = matchRoute('POST','/learning/homework');
    const payload={azione:'salva',job:{testo:'x'.repeat(600_000)}};
    const req=new Request('https://api.test/api/v1/learning/homework',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    await expect(callUpstream({req,route,params,sessionToken:'account-session'})).resolves.toBeInstanceOf(Response);
  });
});
