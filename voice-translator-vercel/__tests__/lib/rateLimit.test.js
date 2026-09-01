import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis
const mockRedis = vi.fn();
vi.mock('../../app/lib/redis.js', () => ({
  redis: (...args) => mockRedis(...args),
}));

const { checkRateLimit, getRateLimitKey } = await import('../../app/lib/rateLimit.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkRateLimit', () => {
  it('allows first request', async () => {
    mockRedis.mockResolvedValueOnce(1) // INCR returns 1
      .mockResolvedValueOnce(1); // EXPIRE
    const result = await checkRateLimit('test:127.0.0.1', 30);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });

  it('sets TTL on first request in window', async () => {
    mockRedis.mockResolvedValueOnce(1) // INCR returns 1 (first request)
      .mockResolvedValueOnce(1); // EXPIRE
    await checkRateLimit('test:ip1', 30, 60000);
    expect(mockRedis).toHaveBeenCalledWith('EXPIRE', 'rl:test:ip1', 60);
  });

  it('does not set TTL on subsequent requests', async () => {
    mockRedis.mockResolvedValueOnce(5); // INCR returns 5 (not first)
    await checkRateLimit('test:ip2', 30);
    // Only INCR should be called, not EXPIRE
    expect(mockRedis).toHaveBeenCalledTimes(1);
  });

  it('blocks requests over limit', async () => {
    mockRedis.mockResolvedValueOnce(31) // INCR - over limit
      .mockResolvedValueOnce(45); // TTL
    const result = await checkRateLimit('test:ip3', 30);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('b.590 — ripara da solo un contatore oltre il tetto ma SENZA scadenza (bug dal vivo del 1/9)', async () => {
    // INCR oltre il tetto, ma TTL torna -1: la chiave non ha mai preso
    // una scadenza (l'EXPIRE del primo colpo non e' mai arrivato).
    // Senza la riparazione bloccherebbe per sempre chiunque condivida
    // quella chiave, anche con un solo utente al minuto.
    mockRedis.mockResolvedValueOnce(999) // INCR - ben oltre il tetto
      .mockResolvedValueOnce(-1) // TTL - nessuna scadenza mai impostata
      .mockResolvedValueOnce(1); // EXPIRE riparatore
    const result = await checkRateLimit('test:senza-scadenza', 30, 60000);
    expect(result.allowed).toBe(true);
    expect(mockRedis).toHaveBeenCalledWith('EXPIRE', 'rl:test:senza-scadenza', 60);
  });

  it('non ripara (blocca normalmente) se la chiave ha davvero una scadenza in corso', async () => {
    // Stesso INCR oltre il tetto, ma stavolta TTL torna un numero
    // positivo: la finestra e' sana, sta solo davvero esaurendo il
    // tetto. Qui il blocco resta un blocco, come prima di b.590.
    mockRedis.mockResolvedValueOnce(999)
      .mockResolvedValueOnce(45);
    const result = await checkRateLimit('test:scadenza-sana', 30, 60000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(45000);
  });

  it('allows exactly at limit', async () => {
    mockRedis.mockResolvedValueOnce(30); // INCR returns exactly maxRequests
    const result = await checkRateLimit('test:ip4', 30);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('fails open on Redis error', async () => {
    mockRedis.mockRejectedValueOnce(new Error('Redis down'));
    const result = await checkRateLimit('test:broken', 30);
    expect(result.allowed).toBe(true);
  });

  it('uses custom window size', async () => {
    mockRedis.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    await checkRateLimit('test:custom', 10, 120000);
    expect(mockRedis).toHaveBeenCalledWith('EXPIRE', 'rl:test:custom', 120);
  });
});

describe('getRateLimitKey', () => {
  it('extracts IP from x-forwarded-for', () => {
    const req = { headers: new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }) };
    expect(getRateLimitKey(req, 'api')).toBe('api:1.2.3.4');
  });

  it('falls back to unknown without header', () => {
    const req = { headers: new Headers() };
    expect(getRateLimitKey(req, 'api')).toBe('api:unknown');
  });

  it('includes prefix', () => {
    const req = { headers: new Headers({ 'x-forwarded-for': '10.0.0.1' }) };
    expect(getRateLimitKey(req, 'translate')).toBe('translate:10.0.0.1');
  });
});
