import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,           // E2E testleri sıralı çalışmalı (DB state paylaşımlı)
  forbidOnly: isCI,               // CI'da test.only yasak
  retries: isCI ? 1 : 0,         // CI'da bir yeniden deneme
  workers: 1,                     // Tek worker — DB state kirlenmesini önler
  reporter: isCI ? 'github' : 'list',
  timeout: 60_000,                // Test başına 60 saniye
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.E2E_ADMIN_BASE_URL ?? 'http://127.0.0.1:3001',
    trace: isCI ? 'on-first-retry' : 'off',
    screenshot: isCI ? 'only-on-failure' : 'off',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  outputDir: '../test-results',
});
