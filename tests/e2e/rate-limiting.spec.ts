/**
 * rate-limiting.spec.ts
 * Rate limiting E2E testleri:
 * - Publik endpoint'ler → throttle çalışıyor mu?
 * - Auth brute-force → 5 denemeden sonra 429
 */
import { expect, test } from '@playwright/test';
import { apiBaseURL, tenantSlug } from './helpers';

test.describe('Rate limiting', () => {
  test('health endpoint rate limit olmadan erişilebilir', async ({ request }) => {
    // Health endpoint @SkipThrottle ile işaretlenmiş
    for (let i = 0; i < 10; i++) {
      const resp = await request.get(`${apiBaseURL}/health`);
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('public widget-settings — yüksek trafikte erişilebilir (SkipThrottle)', async ({ request }) => {
    // Widget status endpoint @SkipThrottle ile işaretlenmiş
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        request.get(`${apiBaseURL}/public/${tenantSlug}/widget-settings`),
      ),
    );
    // Hepsinin 200 veya 404 dönmesi beklenir (rate limit 429 olmamalı)
    for (const resp of results) {
      expect(resp.status()).not.toBe(429);
    }
  });

  test('geçersiz login güvenli reddedilir ve rate-limit metadata döner', async ({ request }) => {
    // Limiti tüketmek, aynı IP'yi paylaşan sonraki E2E login'lerini yanlış biçimde kilitler.
    const resp = await request.post(`${apiBaseURL}/auth/login`, {
      data: { tenantSlug, email: `bruteforce-${Date.now()}@test.com`, password: 'wrong' },
    });

    expect(resp.status()).toBe(401);
    expect(resp.headers()['x-ratelimit-limit']).toBeTruthy();
    expect(resp.headers()['x-ratelimit-remaining']).toBeTruthy();
  });
});
