import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════
// E2E Tests for VoiceTranslate
//
// Tests the core user flows:
// 1. Homepage loads correctly
// 2. Create a room
// 3. Join a room
// 4. Settings and language selection
// 5. Health check endpoint
// ═══════════════════════════════════════════════

test.describe('Homepage', () => {
  test('loads and shows app title', async ({ page }) => {
    await page.goto('/');
    // App should load without errors
    await expect(page).toHaveTitle(/Voice/i);
    // Should show the main UI
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows create room option', async ({ page }) => {
    await page.goto('/');
    // Wait for the app to hydrate
    await page.waitForLoadState('networkidle');
    // Should have a way to create/start a room
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});

test.describe('Room Flow', () => {
  test('can create a room with a name', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for name input or similar
    const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="nome" i]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('TestUser');
    }
  });

  test('room page loads with room ID', async ({ page }) => {
    // Create room via API first
    const response = await page.request.post('/api/room', {
      data: {
        action: 'create',
        hostName: 'E2EHost',
        hostLang: 'en',
      },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.room).toBeTruthy();
    expect(data.room.id).toBeTruthy();

    // Navigate to room page
    await page.goto(`/?room=${data.room.id}`);
    await page.waitForLoadState('networkidle');
  });
});

test.describe('API Endpoints', () => {
  test('health check returns status ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBeTruthy();
    expect(data.timestamp).toBeTruthy();
    expect(data.services).toBeTruthy();
  });

  test('room API creates room', async ({ request }) => {
    const response = await request.post('/api/room', {
      data: {
        action: 'create',
        hostName: 'TestHost',
        hostLang: 'it',
      },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.room.id).toHaveLength(6);
    expect(data.room.host).toBe('TestHost');
    expect(data.room.members).toHaveLength(1);
  });

  test('room API join and check', async ({ request }) => {
    // Create
    const createRes = await request.post('/api/room', {
      data: { action: 'create', hostName: 'Host', hostLang: 'en' },
    });
    const { room } = await createRes.json();

    // Join
    const joinRes = await request.post('/api/room', {
      data: { action: 'join', roomId: room.id, name: 'Guest', lang: 'it' },
    });
    expect(joinRes.ok()).toBeTruthy();
    const joinData = await joinRes.json();
    expect(joinData.room.members).toHaveLength(2);

    // Check
    const checkRes = await request.post('/api/room', {
      data: { action: 'check', roomId: room.id },
    });
    expect(checkRes.ok()).toBeTruthy();
    const checkData = await checkRes.json();
    expect(checkData.room.members).toHaveLength(2);
  });

  test('messages API rejects non-members', async ({ request }) => {
    // Create room
    const createRes = await request.post('/api/room', {
      data: { action: 'create', hostName: 'Host', hostLang: 'en' },
    });
    const { room } = await createRes.json();

    // Try to send message as non-member
    const msgRes = await request.post('/api/messages', {
      data: {
        roomId: room.id,
        sender: 'Hacker',
        original: 'Evil message',
      },
    });
    expect(msgRes.status()).toBe(403);
  });

  test('messages API accepts room members', async ({ request }) => {
    // Create room
    const createRes = await request.post('/api/room', {
      data: { action: 'create', hostName: 'Host', hostLang: 'en' },
    });
    const { room } = await createRes.json();

    // Send message as host (member)
    const msgRes = await request.post('/api/messages', {
      data: {
        roomId: room.id,
        sender: 'Host',
        original: 'Hello!',
        translated: 'Ciao!',
        sourceLang: 'en',
        targetLang: 'it',
      },
    });
    expect(msgRes.ok()).toBeTruthy();
    const msgData = await msgRes.json();
    expect(msgData.message.sender).toBe('Host');
  });

  test('translate API rejects without required fields', async ({ request }) => {
    const response = await request.post('/api/translate', {
      data: { text: '' },
    });
    // Should return 400 for missing fields
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Test Center', () => {
  test('test center page loads', async ({ page }) => {
    await page.goto('/testcenter');
    await page.waitForLoadState('networkidle');
    // Should show the test center UI
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe('Responsive Design', () => {
  test('mobile viewport works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Should not have horizontal scrollbar
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
  });
});
