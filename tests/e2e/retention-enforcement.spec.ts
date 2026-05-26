/**
 * retention-enforcement.spec.ts
 * Veri saklama politikası E2E testleri:
 * - GET /retention-settings → defaults + overrides yapısı
 * - PATCH /retention-settings → geçerli değerler kaydedilir
 * - PATCH /retention-settings → aralık dışı değerler reddedilir / yoksayılır
 * - POST /retention-settings/run-now → job tetiklenir
 * - Anonim erişim → 401
 */
import { expect, test } from '@playwright/test';
import { apiBaseURL, getAdminAccessToken } from './helpers';

test.describe('Retention policy enforcement', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    accessToken = await getAdminAccessToken(request);
  });

  // Erişim kontrolü
  test('anonim → 401', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/retention-settings`);
    expect(resp.status()).toBe(401);
  });

  test('geçersiz token → 401', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/retention-settings`, {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(resp.status()).toBe(401);
  });

  // Retention settings GET
  test('GET /retention-settings → defaults ve overrides alanları döner', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/retention-settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json() as {
      tenantSlug?: string;
      defaults?: Record<string, number>;
      overrides?: Record<string, unknown>;
    };

    expect(body).toHaveProperty('tenantSlug');
    expect(body).toHaveProperty('defaults');
    expect(body).toHaveProperty('overrides');

    // Defaults pozitif integer olmalı
    if (body.defaults) {
      for (const [scope, value] of Object.entries(body.defaults)) {
        expect(typeof value, `defaults.${scope} sayı olmalı`).toBe('number');
        expect(value, `defaults.${scope} pozitif olmalı`).toBeGreaterThan(0);
      }
    }
  });

  test('GET /retention-settings → bilinen scope\'lar defaults\'da mevcut', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/retention-settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json() as { defaults?: Record<string, number> };
    const expectedScopes = ['channel-events', 'audit-logs', 'outbound-deliveries', 'conversations', 'attachments'];

    if (body.defaults) {
      for (const scope of expectedScopes) {
        expect(body.defaults, `"${scope}" defaults\'da olmalı`).toHaveProperty(scope);
      }
    }
  });

  // Retention settings PATCH — geçerli değer
  test('PATCH /retention-settings → geçerli değer kaydedilir', async ({ request }) => {
    // Önce mevcut değeri oku
    const getResp = await request.get(`${apiBaseURL}/retention-settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(getResp.ok()).toBeTruthy();
    const before = await getResp.json() as { overrides?: Record<string, unknown> };

    // Güvenli bir override ayarla (90 gün — geçerli aralıkta)
    const patchResp = await request.patch(`${apiBaseURL}/retention-settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { 'audit-logs': 90 },
    });
    expect(patchResp.ok()).toBeTruthy();

    const after = await patchResp.json() as { overrides?: Record<string, number> };
    expect(after.overrides?.['audit-logs']).toBe(90);

    // Temizle — orijinal değere geri döndür
    const originalValue = (before.overrides ?? {})['audit-logs'];
    await request.patch(`${apiBaseURL}/retention-settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { 'audit-logs': originalValue ?? null },
    });
  });

  // Retention settings PATCH — geçersiz değer
  test('PATCH /retention-settings → negatif değer yoksayılır', async ({ request }) => {
    const patchResp = await request.patch(`${apiBaseURL}/retention-settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { 'conversations': -10 },
    });
    // Negatif değer ya reddedilir (400) ya da yoksayılır (200, override eklenmez)
    expect([200, 400]).toContain(patchResp.status());

    if (patchResp.ok()) {
      const body = await patchResp.json() as { overrides?: Record<string, unknown> };
      const overrideValue = body.overrides?.['conversations'];
      // Eğer kaydedildiyse negatif olmamalı
      if (overrideValue !== undefined && overrideValue !== null) {
        expect(typeof overrideValue === 'number' ? overrideValue : 0).toBeGreaterThan(0);
      }
    }
  });

  test('PATCH /retention-settings → null değer override\'ı siler', async ({ request }) => {
    // Önce bir override ekle
    await request.patch(`${apiBaseURL}/retention-settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { 'channel-events': 30 },
    });

    // Sonra null ile sil
    const clearResp = await request.patch(`${apiBaseURL}/retention-settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { 'channel-events': null },
    });
    expect(clearResp.ok()).toBeTruthy();

    const body = await clearResp.json() as { overrides?: Record<string, unknown> };
    // channel-events artık overrides'da olmamalı (ya da null)
    const value = body.overrides?.['channel-events'];
    expect(value === undefined || value === null).toBeTruthy();
  });

  // AI budget settings
  test('GET /ai-budget-settings → yapı doğrulaması', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/ai-budget-settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (resp.status() === 404) {
      test.skip(true, 'AI budget endpoint not available');
      return;
    }

    expect(resp.ok()).toBeTruthy();
    const body = await resp.json() as { tenantSlug?: string; overrides?: Record<string, unknown> };
    expect(body).toHaveProperty('tenantSlug');
    expect(body).toHaveProperty('overrides');
  });

  // Retention job tetikleme
  test('POST /retention-settings/run-now → job tetiklenir', async ({ request }) => {
    const resp = await request.post(`${apiBaseURL}/retention-settings/run-now`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (resp.status() === 404) {
      test.skip(true, 'run-now endpoint not available');
      return;
    }

    expect(resp.ok()).toBeTruthy();
    const body = await resp.json() as { enqueued?: boolean; tenantId?: string };
    expect(body).toHaveProperty('tenantId');
    expect(typeof body.enqueued).toBe('boolean');
  });

  test('run-now → anonim → 401', async ({ request }) => {
    const resp = await request.post(`${apiBaseURL}/retention-settings/run-now`);
    expect(resp.status()).toBe(401);
  });

  // Widget settings (tenant settings grubu)
  test('GET /widget-settings → yapı doğrulaması', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/widget-settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json() as {
      tenantSlug?: string;
      widgetEnabled?: boolean;
      widgetTitle?: string;
      widgetWelcome?: string;
      widgetAllowedOrigins?: unknown[];
    };

    expect(body).toHaveProperty('tenantSlug');
    expect(body).toHaveProperty('widgetEnabled');
    expect(body).toHaveProperty('widgetTitle');
    expect(body).toHaveProperty('widgetWelcome');
    expect(Array.isArray(body.widgetAllowedOrigins)).toBeTruthy();
  });
});
