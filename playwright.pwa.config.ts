import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './pwa-e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4202' + (process.env['PWA_BASE_PATH'] ?? '/'),
    locale: 'en-US',
    headless: true,
    launchOptions: process.env['CHROMIUM_PATH']
      ? { executablePath: process.env['CHROMIUM_PATH'] }
      : {},
  },
  webServer: {
    command: 'node scripts/serve-pwa.mjs',
    url: 'http://127.0.0.1:4202',
    reuseExistingServer: false,
  },
});
