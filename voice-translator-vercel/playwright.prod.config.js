import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for PRODUCTION smoke tests.
 * No local webServer — targets the live deployment.
 *
 * Run: npx playwright test --config=playwright.prod.config.js
 * Override target: BASE_URL=https://... npx playwright test --config=playwright.prod.config.js
 */
export default defineConfig({
  testDir: './e2e',
  // b.587 — il vecchio pattern eseguiva soltanto lo smoke generale:
  // production-video.spec.js esisteva ma non veniva mai lanciato dalla CI.
  testMatch: ['production-smoke.spec.js', 'production-video.spec.js'],
  fullyParallel: true,
  retries: 1,
  reporter: 'list',

  use: {
    baseURL: process.env.BASE_URL || 'https://voice-translator2.vercel.app',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
