import { expect, test } from '@playwright/test';
import { apiBaseURL, tenantSlug } from './helpers';

test.describe('Rate limiting', () => {
  test('health endpoint remains reachable without throttling', async ({ request }) => {
    for (let i = 0; i < 10; i++) {
      const resp = await request.get(`${apiBaseURL}/health`);
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('public widget-settings remains available under burst traffic', async ({ request }) => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => request.get(`${apiBaseURL}/public/${tenantSlug}/widget-settings`)),
    );

    for (const resp of results) {
      expect(resp.status()).not.toBe(429);
    }
  });

  test('invalid login returns 401 and still exposes rate-limit headers', async ({ request }) => {
    const resp = await request.post(`${apiBaseURL}/auth/login`, {
      data: {
        tenantSlug,
        email: `bruteforce-${Date.now()}@test.com`,
        // Keep the password shape valid so the request reaches auth logic and not DTO validation.
        password: 'WrongPass123!',
      },
    });

    expect(resp.status()).toBe(401);
    expect(resp.headers()['x-ratelimit-limit']).toBeTruthy();
    expect(resp.headers()['x-ratelimit-remaining']).toBeTruthy();
  });
});
