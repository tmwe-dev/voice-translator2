import { describe, expect, it } from 'vitest';
import { GET as llms } from '../app/llms.txt/route.js';
import { GET as quickstart } from '../app/quickstart.md/route.js';
import { GET as manifest } from '../app/developer.json/route.js';

describe('developer portal pubblico', () => {
  const req = new Request('https://api.bartalk.test/entry');

  it('llms.txt contiene tutti i riferimenti necessari senza segreti', async () => {
    const res = llms(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('https://api.bartalk.test/openapi');
    expect(text).toContain('https://api.bartalk.test/quickstart.md');
    expect(text).toContain('https://api.bartalk.test/api/v1');
    expect(text).toContain('Do not call the internal Voice Translator');
    expect(text).not.toMatch(/BARTALK_API_SIGNING_SECRET\s*=\s*\S+/);
  });

  it('quickstart e auto-contenuto e punta alla OpenAPI dello stesso host', async () => {
    const res = quickstart(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const text = await res.text();
    expect(text).toContain('https://api.bartalk.test/openapi');
    expect(text).toContain('POST /api/v1/auth/exchange');
    expect(text).toContain('server-side');
  });

  it('developer.json e un manifest machine-readable coerente col runtime', async () => {
    const res = manifest(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.baseUrl).toBe('https://api.bartalk.test/api/v1');
    expect(body.openapi).toBe('https://api.bartalk.test/openapi');
    expect(body.aiInstructions).toBe('https://api.bartalk.test/llms.txt');
    expect(body.integrationPolicy.publicApiOnly).toBe(true);
    expect(body.integrationPolicy.internalCoreAccess).toBe(false);
  });
});
