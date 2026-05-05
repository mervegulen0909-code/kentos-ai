import { defineConfig, devices } from '@playwright/test';

const adminBaseURL = process.env.E2E_ADMIN_BASE_URL ?? 'http://127.0.0.1:3001';
const citizenBaseURL = process.env.E2E_CITIZEN_BASE_URL ?? 'http://127.0.0.1:3002';
const apiBaseURL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3100/api/v1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @kentos/api dev',
      url: `${apiBaseURL}/health`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        PORT: '3100',
        DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://kentos:kentos@127.0.0.1:5432/kentos_ai?schema=public',
        REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
        CORS_ORIGIN: `${adminBaseURL},${citizenBaseURL}`,
        INTERNAL_API_KEY: process.env.INTERNAL_API_KEY ?? 'change-me-internal',
        WIDGET_ORIGIN_ALLOWLIST: process.env.WIDGET_ORIGIN_ALLOWLIST ?? citizenBaseURL,
        PUBLIC_RATE_LIMIT_MAX: process.env.PUBLIC_RATE_LIMIT_MAX ?? '240',
        PUBLIC_RATE_LIMIT_WINDOW_MS: process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? '60000',
      },
    },
    {
      command: 'pnpm --filter @kentos/admin-web exec next dev --hostname 127.0.0.1 -p 3001',
      url: `${adminBaseURL}/login`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        NEXT_PUBLIC_API_BASE_URL: apiBaseURL,
      },
    },
    {
      command: 'pnpm --filter @kentos/citizen-web exec next dev --hostname 127.0.0.1 -p 3002',
      url: `${citizenBaseURL}/`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        NEXT_PUBLIC_API_BASE_URL: apiBaseURL,
      },
    },
  ],
});
