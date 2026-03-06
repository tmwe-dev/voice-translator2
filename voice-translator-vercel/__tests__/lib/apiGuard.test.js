import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock rateLimit
const mockCheckRateLimit = vi.fn();
const mockGetRateLimitKey = vi.fn();
vi.mock('../../app/lib/rateLimit.js', () => ({
  checkRateLimit: (...args) => mockCheckRateLimit(...args),
  getRateLimitKey: (...args) => mockGetRateLimitKey(...args),
}));

// Mock next/server
vi.mock('next/server', () => {
  class MockNextResponse {
    constructor(body, init = {}) {
      this._body = body;
      this.status = init.status || 200;
      this._headers = new Map(Object.entries(init.headers || {}));
    }
    get headers() {
      return {
        get: (k) => this._headers.get(k),
        set: (k, v) => this._headers.set(k, v),
      };
    }
    async json() { return JSON.parse(typeof this._body === 'string' ? this._body : '{}'); }
    static json(data, init = {}) {
      const r = new MockNextResponse(JSON.stringify(data), init);
      r.json = () => Promise.resolve(data);
      return r;
    }
  }
  return { NextResponse: MockNextResponse };
});

const { withApiGuard } = await import('../../app/lib/apiGuard.js');

function makeRequest(opts = {}) {
  const headers = new Map(Object.entries({
    'x-forwarded-for': opts.ip || '10.0.0.1',
    'content-type': 'application/json',
    ...(opts.headers || {}),
  }));
  return {
    method: opts.method || 'POST',
    url: opts.url || 'http://localhost:3000/api/test',
    headers: { get: (k) => headers.get(k) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRateLimitKey.mockReturnValue('api:10.0.0.1');
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

describe('withApiGuard', () => {
  it('calls handler when rate limit allows', async () => {
    const handler = vi.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => null, set: () => {} },
    });
    const guarded = withApiGuard(handler);
    const req = makeRequest();
    await guarded(req);
    expect(handler).toHaveBeenCalledWith(req);
  });

  it('returns 429 when IP rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 5000, remaining: 0 });
    const handler = vi.fn();
    const guarded = withApiGuard(handler);
    const res = await guarded(makeRequest());
    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 429 when user rate limited', async () => {
    // First call (IP) succeeds, second call (user) fails
    mockCheckRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 59 })
      .mockResolvedValueOnce({ allowed: false, retryAfterMs: 3000, remaining: 0 });
    const handler = vi.fn();
    const guarded = withApiGuard(handler);
    const req = makeRequest({ headers: { authorization: 'Bearer test-token-123456' } });
    const res = await guarded(req);
    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 413 for oversized body', async () => {
    const handler = vi.fn();
    const guarded = withApiGuard(handler, { maxBodySize: 1024 });
    const req = makeRequest({ headers: { 'content-length': '2048' } });
    const res = await guarded(req);
    expect(res.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  it('skips body check for GET requests', async () => {
    const handler = vi.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => null, set: () => {} },
    });
    const guarded = withApiGuard(handler, { maxBodySize: 100 });
    const req = makeRequest({ method: 'GET', headers: { 'content-length': '999999' } });
    await guarded(req);
    expect(handler).toHaveBeenCalled();
  });

  it('skips body check when skipBodyCheck is true', async () => {
    const handler = vi.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => null, set: () => {} },
    });
    const guarded = withApiGuard(handler, { skipBodyCheck: true });
    const req = makeRequest({ headers: { 'content-length': '999999999' } });
    await guarded(req);
    expect(handler).toHaveBeenCalled();
  });

  it('returns 500 on handler exception', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Crash!'));
    const guarded = withApiGuard(handler);
    const res = await guarded(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Internal server error');
  });

  it('adds rate limit headers to response', async () => {
    const mockHeaders = new Map();
    const handler = vi.fn().mockResolvedValue({
      status: 200,
      headers: { get: (k) => mockHeaders.get(k), set: (k, v) => mockHeaders.set(k, v) },
    });
    const guarded = withApiGuard(handler);
    await guarded(makeRequest());
    expect(mockHeaders.get('X-RateLimit-Limit')).toBe('60');
    expect(mockHeaders.get('X-RateLimit-Remaining')).toBeDefined();
  });

  it('uses custom prefix for rate limit key', async () => {
    const handler = vi.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => null, set: () => {} },
    });
    const guarded = withApiGuard(handler, { prefix: 'translate' });
    await guarded(makeRequest());
    expect(mockGetRateLimitKey).toHaveBeenCalledWith(expect.anything(), 'translate');
  });

  it('extracts user key from authorization header', async () => {
    const handler = vi.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => null, set: () => {} },
    });
    const guarded = withApiGuard(handler);
    await guarded(makeRequest({ headers: { authorization: 'Bearer longtoken12345678' } }));
    // Should have called checkRateLimit twice: once for IP, once for user
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(2);
  });
});
