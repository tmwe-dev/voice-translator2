import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SCOPES, SCOPES, issueApiKey, normalizeScopes, readApiKey } from '../lib/apiKey.js';
import { MAX_API_KEY_TTL_DAYS } from '../lib/config.js';

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

  it('gli scope di default non regalano scritture sensibili ne capability legacy', () => {
    expect(DEFAULT_SCOPES).toContain('translate');
    for (const s of ['wallet:write','profile:write','companions:write','keys:read','keys:write','glossary:read','glossary:write']) {
      expect(DEFAULT_SCOPES).not.toContain(s);
    }
    expect(SCOPES).not.toContain('keys:write');
    expect(SCOPES).not.toContain('glossary:write');
  });

  it('scopes vuoto significa davvero zero privilegi, non default', () => {
    expect(normalizeScopes([])).toEqual([]);
    const k = issueApiKey({ sessionToken: 'x', scopes: [], now: 0, ttlDays: 1 });
    expect(readApiKey(k, { now: 1 }).scopes).toEqual([]);
  });

  it('un valore scopes non-array viene rifiutato', () => {
    expect(() => normalizeScopes('translate')).toThrow(/array/);
  });

  it('il TTL non puo superare la vita massima della sessione Core', () => {
    const k = issueApiKey({ sessionToken: 'x', scopes: ['translate'], now: 0, ttlDays: 365 });
    const p = readApiKey(k, { now: 1 });
    expect(p.exp).toBe(MAX_API_KEY_TTL_DAYS * 86400000);
  });

  it('una chiave alterata viene rifiutata', () => {
    const k = issueApiKey({ sessionToken: 'x', scopes: ['translate'] });
    const i = Math.floor(k.length / 2);
    const bad = k.slice(0, i) + (k[i] === 'A' ? 'B' : 'A') + k.slice(i + 1);
    expect(() => readApiKey(bad)).toThrow(/alterata|non valida/);
  });

  it('una chiave spropositata viene rifiutata prima della decodifica', () => {
    expect(() => readApiKey('bt_live_' + 'A'.repeat(5000))).toThrow(/non valida/);
  });

  it('una chiave scaduta viene rifiutata', () => {
    const k = issueApiKey({ sessionToken: 'x', scopes: ['translate'], now: 0, ttlDays: 1 });
    expect(() => readApiKey(k, { now: 86400001 })).toThrow(/scaduta/);
  });
});
