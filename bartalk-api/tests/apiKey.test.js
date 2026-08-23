import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SCOPES, issueApiKey, readApiKey } from '../lib/apiKey.js';

beforeEach(() => { process.env.BARTALK_API_SIGNING_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'; });

describe('API key cifrata e legata alla sessione', () => {
  it('round-trip conserva sessione e scope senza esporli in chiaro', () => {
    const k = issueApiKey({ sessionToken: 'sessione-segreta-123', subject: 'u@example.com', scopes: ['translate'], now: 1000, ttlDays: 2 });
    expect(k.startsWith('bt_live_')).toBe(true);
    expect(k).not.toContain('sessione-segreta-123');
    expect(k).not.toContain('u@example.com');
    const p = readApiKey(k, { now: 2000 });
    expect(p.session).toBe('sessione-segreta-123');
    expect(p.scopes).toEqual(['translate']);
  });
  it('gli scope di default non regalano scritture sensibili', () => {
    expect(DEFAULT_SCOPES).toContain('translate');
    expect(DEFAULT_SCOPES).not.toContain('wallet:write');
    expect(DEFAULT_SCOPES).not.toContain('keys:write');
    expect(DEFAULT_SCOPES).not.toContain('profile:write');
    expect(DEFAULT_SCOPES).not.toContain('companions:write');
  });
  it('una chiave alterata viene rifiutata', () => {
    const k = issueApiKey({ sessionToken: 'x', scopes: ['translate'] });
    const bad = k.slice(0,-1) + (k.endsWith('A') ? 'B' : 'A');
    expect(() => readApiKey(bad)).toThrow(/alterata|non valida/);
  });
  it('una chiave scaduta viene rifiutata', () => {
    const k = issueApiKey({ sessionToken: 'x', scopes: ['translate'], now: 0, ttlDays: 1 });
    expect(() => readApiKey(k, { now: 86400001 })).toThrow(/scaduta/);
  });
});
