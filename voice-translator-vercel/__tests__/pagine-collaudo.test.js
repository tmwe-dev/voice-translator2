// Le pagine di collaudo non devono essere raggiungibili in produzione.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const originale = { ...process.env };

async function caricaMiddleware() {
  vi.resetModules();
  return (await import('../middleware.js')).middleware;
}

function richiesta(percorso) {
  return {
    method: 'GET',
    nextUrl: { pathname: percorso },
    headers: { get: () => null },
  };
}

describe('pagine di collaudo', () => {
  beforeEach(() => { process.env = { ...originale }; });
  afterEach(() => { process.env = { ...originale }; });

  it('in produzione rispondono 404 se il flag è spento', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.STRUMENTI_COLLAUDO;
    const middleware = await caricaMiddleware();
    for (const p of ['/testcenter', '/debug', '/startrek', '/debug/qualcosa']) {
      expect(middleware(richiesta(p)).status, p).toBe(404);
    }
  });

  it('con il flag acceso restano disponibili', async () => {
    process.env.NODE_ENV = 'production';
    process.env.STRUMENTI_COLLAUDO = '1';
    const middleware = await caricaMiddleware();
    expect(middleware(richiesta('/testcenter')).status).not.toBe(404);
  });

  it('le pagine vere non vengono toccate', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.STRUMENTI_COLLAUDO;
    const middleware = await caricaMiddleware();
    for (const p of ['/', '/landing', '/account', '/privacy', '/sesamo']) {
      expect(middleware(richiesta(p)).status, p).not.toBe(404);
    }
  });
});
