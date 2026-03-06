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
