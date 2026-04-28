import { defineConfig, devices } from '@playwright/test';

const isSmoke = process.env.SMOKE === '1';
// Smoke tests run against a live deployment; all other tests use the dev server.
const baseURL = isSmoke
  ? (process.env.PLAYWRIGHT_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:5173')
  : 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: isSmoke
    ? [['list'], ['html', { open: 'never' }]]
    : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // ── Smoke project (post-deployment, no dev server) ──────────────────────
    {
      name: 'smoke',
      testMatch: '**/smoke.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    // ── Full e2e projects (local dev server) ────────────────────────────────
    {
      name: 'chromium',
      testIgnore: '**/smoke.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: '**/smoke.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  // Dev server only for non-smoke runs
  webServer: isSmoke
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
      },
});
