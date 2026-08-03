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
  testMatch: 'production-smoke.spec.js',
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
