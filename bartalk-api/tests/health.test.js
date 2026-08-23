import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gatewayHealth } from '../lib/health.js';

const SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';

describe('readiness del gateway', () => {
  beforeEach(() => { process.env.BARTALK_API_SIGNING_SECRET = SECRET; });
  afterEach(() => { vi.restoreAllMocks(); process.env.BARTALK_API_SIGNING_SECRET = SECRET; });

  it('e verde solo quando segreto e Core sono entrambi disponibili', async () => {
    global.fetch = vi.fn(async () => new Response('{"ok":true}', { status:200, headers:{'content-type':'application/json'} }));
    const h = await gatewayHealth();
    expect(h.ok).toBe(true);
    expect(h.signingConfigured).toBe(true);
    expect(h.core).toEqual({ ok:true, status:200 });
  });

  it('non finge readiness se manca il segreto di firma', async () => {
    delete process.env.BARTALK_API_SIGNING_SECRET;
    global.fetch = vi.fn(async () => new Response('{"ok":true}', { status:200 }));
    const h = await gatewayHealth();
    expect(h.ok).toBe(false);
    expect(h.signingConfigured).toBe(false);
  });

  it('non finge readiness se il Core e irraggiungibile', async () => {
    global.fetch = vi.fn(async () => { throw new Error('down'); });
    const h = await gatewayHealth();
    expect(h.ok).toBe(false);
    expect(h.core.ok).toBe(false);
  });
});
