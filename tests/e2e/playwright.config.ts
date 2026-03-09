import { defineConfig, devices } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_URL ?? 'http://localhost:3002';
const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,   // tests share state (DB), run sequentially
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,

  use: {
    baseURL: DASHBOARD_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Export URLs as env so specs can reach them
  globalSetup: './global-setup.ts',

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

export { DASHBOARD_URL, API_URL, GATEWAY_URL };
