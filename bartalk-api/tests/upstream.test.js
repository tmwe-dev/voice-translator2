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
    const req = new Request('https://api.test/api/v1/contacts', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({action:'add',contactEmail:'a@example.com',token:'falso'}) });
    await callUpstream({ req, route, params, sessionToken:'vero', requestId:'req-1' });
    expect(JSON.parse(calls[0].init.body).token).toBe('vero');
    expect(calls[0].init.headers.get('x-request-id')).toBe('req-1');
  });

  it('Contacts blocca gli inviti con credito prima di raggiungere il Core', async () => {
    const { route, params } = matchRoute('POST','/contacts');
    const req = new Request('https://api.test/api/v1/contacts', {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({ action:'create-invite', giftAmount:100, token:'falso' }),
    });
    await expect(callUpstream({ req, route, params, sessionToken:'vero' })).rejects.toMatchObject({ status:400 });
    expect(calls).toHaveLength(0);
  });

  it('Contacts blocca anche accept-invite perche puo muovere credito', async () => {
    const { route, params } = matchRoute('POST','/contacts');
    const req = new Request('https://api.test/api/v1/contacts', {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({ action:'accept-invite', inviteCode:'VT-GIFT-X' }),
    });
    await expect(callUpstream({ req, route, params, sessionToken:'vero' })).rejects.toMatchObject({ status:400 });
    expect(calls).toHaveLength(0);
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
    const { route, params } = matchRoute('GET','/me');
    const req = new Request('https://api.test/api/v1/me?action=delete-data');
    await callUpstream({ req, route, params, sessionToken:'vero' });
    const u = new URL(calls[0].url);
    expect(u.searchParams.getAll('action')).toEqual(['profile']);
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

  it('heartbeat Live inoltra rinnova e sessione dal path, non dal client', async () => {
    const { route, params } = matchRoute('POST','/live-sessions/sessione-vera/heartbeat');
    const req = new Request('https://api.test/api/v1/live-sessions/sessione-vera/heartbeat', {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({ azione:'chiudi', sessioneId:'falsa', userToken:'falso' }),
    });
    await callUpstream({ req, route, params, sessionToken:'account-session' });
    const body = JSON.parse(calls[0].init.body);
    expect(body.azione).toBe('rinnova');
    expect(body.sessioneId).toBe('sessione-vera');
    expect(body.userToken).toBe('account-session');
  });

  it('learning/homework accetta il tetto Core da 6MB invece del tetto standard', async () => {
    const { route, params } = matchRoute('POST','/learning/homework');
    const payload={azione:'salva',job:{testo:'x'.repeat(600_000)}};
    const req=new Request('https://api.test/api/v1/learning/homework',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    await expect(callUpstream({req,route,params,sessionToken:'account-session'})).resolves.toBeInstanceOf(Response);
  });

  it('multipart applica il limite ai byte reali anche senza fidarsi del Content-Length', async () => {
    const matched = matchRoute('POST','/transcribe');
    const route = { ...matched.route, maxMultipartBytes: 100 };
    const form = new FormData();
    form.set('audio', new Blob(['x'.repeat(1000)], { type:'audio/webm' }), 'a.webm');
    const req = new Request('https://api.test/api/v1/transcribe', { method:'POST', body:form });
    await expect(callUpstream({ req, route, params:matched.params, sessionToken:'s' })).rejects.toMatchObject({ status:413 });
    expect(calls).toHaveLength(0);
  });

  it('non inoltra un Content-Length upstream che puo essere diventato falso', async () => {
    global.fetch = vi.fn(async (url, init) => {
      calls.push({ url:String(url), init });
      return new Response('abc', { status:200, headers:{ 'content-type':'text/plain', 'content-length':'999' } });
    });
    const { route, params } = matchRoute('GET','/wallet');
    const req = new Request('https://api.test/api/v1/wallet');
    const res = await callUpstream({ req, route, params, sessionToken:'s' });
    expect(res.headers.get('content-length')).toBeNull();
  });

  it('DELETE /me/data riflette b.420 senza inventare residui Mondo', async () => {
    global.fetch = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok:true, deleted:['profile','compagni','mondo_follows','mondo_comment_likes','mondo_segnalazioni'] }), {
        status:200,
        headers:{'content-type':'application/json'},
      });
    });
    const { route, params } = matchRoute('DELETE','/me/data');
    const req = new Request('https://api.test/api/v1/me/data', { method:'DELETE' });
    const res = await callUpstream({ req, route, params, sessionToken:'account-session' });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deletionCoverage.status).toBe('partial');
    expect(body.deletionCoverage.auditedCore).toBe('b.420');
    expect(body.deletionCoverage.notGuaranteedByCore).toEqual([]);
    expect(body.deletionCoverage.legacyInactiveSurfaces).toContain('translation_history');
    const sent = JSON.parse(calls[0].init.body);
    expect(sent.action).toBe('delete-data');
    expect(sent.token).toBe('account-session');
  });
});
