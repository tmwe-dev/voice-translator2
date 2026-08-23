import { describe, expect, it } from 'vitest';
import { clientAddress, publicRateIdentity, requestIdFrom } from '../lib/requestMeta.js';

describe('metadati richiesta non diventano autorita', () => {
  it('accetta un request id corto e sicuro', () => {
    const req = new Request('https://api.test', { headers:{ 'x-request-id':'client-123:abc' } });
    expect(requestIdFrom(req)).toBe('client-123:abc');
  });

  it('sostituisce request id troppo lunghi o con caratteri strani', () => {
    const req = new Request('https://api.test', { headers:{ 'x-request-id':'x'.repeat(200) } });
    const id = requestIdFrom(req);
    expect(id).not.toBe('x'.repeat(200));
    expect(id.length).toBeLessThanOrEqual(96);
  });

  it('usa il primo indirizzo della catena proxy solo come bucket', () => {
    const req = new Request('https://api.test', { headers:{ 'x-forwarded-for':'203.0.113.7, 10.0.0.1', 'user-agent':'ua' } });
    expect(clientAddress(req)).toBe('203.0.113.7');
    expect(publicRateIdentity(req)).toContain('203.0.113.7');
  });

  it('due client pubblici non condividono lo stesso rate bucket', () => {
    const a = new Request('https://api.test', { headers:{ 'x-forwarded-for':'203.0.113.7', 'user-agent':'ua' } });
    const b = new Request('https://api.test', { headers:{ 'x-forwarded-for':'203.0.113.8', 'user-agent':'ua' } });
    expect(publicRateIdentity(a)).not.toBe(publicRateIdentity(b));
  });
});
