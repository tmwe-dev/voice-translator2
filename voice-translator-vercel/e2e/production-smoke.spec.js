import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════
// Production smoke tests — run against the LIVE deployment.
//
// Run: BASE_URL=https://voice-translator2.vercel.app npx playwright test e2e/production-smoke.spec.js
//
// These verify:
// 1. App loads and hydrates
// 2. Health endpoint responds
// 3. Direct mode guard is LIVE — content APIs reject X-Session-Mode: direct
// 4. TaxiTalk API accepts only ciphertext
// ═══════════════════════════════════════════════

const PROD = process.env.BASE_URL || 'https://voice-translator2.vercel.app';

test.describe('Production smoke', () => {
  test('homepage loads with BarTalk title', async ({ page }) => {
    await page.goto(PROD);
    await expect(page).toHaveTitle(/BarTalk/i);
  });

  test('app hydrates without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(PROD);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('health endpoint responds', async ({ request }) => {
    const res = await request.get(`${PROD}/api/health`);
    // Health may be 200 or 404 if not present — but never 500
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Direct mode guard — LIVE privacy verification', () => {
  const BLOCKED_ROUTES = [
    { path: '/api/messages', method: 'post', body: { roomId: 'TESTROOM1', sender: 'x', original: 'test' } },
    { path: '/api/translate-free', method: 'post', body: { text: 'hello', sourceLang: 'en', targetLang: 'it' } },
    { path: '/api/summary', method: 'post', body: { roomId: 'TESTROOM1' } },
  ];

  for (const route of BLOCKED_ROUTES) {
    test(`${route.path} rejects Direct mode with 403`, async ({ request }) => {
      const res = await request[route.method](`${PROD}${route.path}`, {
        headers: { 'X-Session-Mode': 'direct', 'Content-Type': 'application/json' },
        data: route.body,
      });
      expect(res.status()).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Direct mode');
    });
  }

  test('translate-free works WITHOUT direct header (Translate mode)', async ({ request }) => {
    const res = await request.post(`${PROD}/api/translate-free`, {
      headers: { 'Content-Type': 'application/json' },
      data: { text: 'hello', sourceLang: 'en', targetLang: 'it' },
    });
    // Should NOT be 403 (may be 200 or 429 rate-limited, but not blocked)
    expect(res.status()).not.toBe(403);
  });
});

test.describe('TaxiTalk API — ciphertext-only contract', () => {
  test('rejects cleartext destination fields', async ({ request }) => {
    const res = await request.post(`${PROD}/api/taxi/destination`, {
      headers: { 'Content-Type': 'application/json' },
      data: { lat: 45.46, lng: 9.19, normalizedAddress: 'Via Roma 1' },
    });
    // No ciphertext field → 400 (never stores cleartext)
    expect(res.status()).toBe(400);
  });

  test('accepts ciphertext blob', async ({ request }) => {
    const res = await request.post(`${PROD}/api/taxi/destination`, {
      headers: { 'Content-Type': 'application/json' },
      data: { ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0LWJsb2ItZm9yLXNtb2tlLXRlc3Q' },
    });
    // 200 with id, or 429 if rate-limited — never 500
    expect([200, 201, 429]).toContain(res.status());
    if (res.status() < 400) {
      const json = await res.json();
      expect(json.id).toBeTruthy();
      // Response must NOT echo any location data
      expect(JSON.stringify(json)).not.toContain('45.46');
    }
  });
});
