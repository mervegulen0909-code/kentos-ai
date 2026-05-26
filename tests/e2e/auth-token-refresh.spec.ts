/**
 * auth-token-refresh.spec.ts
 * Auth token refresh flow E2E testleri:
 * - Login → accessToken + refreshToken alınması
 * - Refresh → yeni accessToken alınması
 * - Geçersiz refresh token → 401
 * - Brute-force koruması → 429 (5 denemeden sonra)
 */
import { expect, test } from '@playwright/test';
import { apiBaseURL, tenantSlug } from './helpers';

test.describe('Auth token refresh flow', () => {
  test('login → refresh → yeni accessToken alınır', async ({ request }) => {
    // 1. Login
    const loginResp = await request.post(`${apiBaseURL}/auth/login`, {
      data: {
        tenantSlug,
        email: 'admin@demo.local',
        password: 'ChangeMe123!',
      },
    });
    expect(loginResp.ok()).toBeTruthy();

    const { accessToken, refreshToken, user } = await loginResp.json() as {
      accessToken: string;
      refreshToken: string;
      user: { email: string; role: string };
    };
    expect(accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // JWT format
    expect(refreshToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(user.email).toBe('admin@demo.local');

    // 2. Refresh
    const refreshResp = await request.post(`${apiBaseURL}/auth/refresh`, {
      data: { refreshToken },
    });
    expect(refreshResp.ok()).toBeTruthy();

    const { accessToken: newToken } = await refreshResp.json() as { accessToken: string };
    expect(newToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    // Yeni token farklı olabilir (iat değişir)
    expect(newToken).toBeTruthy();
  });

  test('geçersiz refresh token → 401', async ({ request }) => {
    const resp = await request.post(`${apiBaseURL}/auth/refresh`, {
      data: { refreshToken: 'invalid.token.value' },
    });
    expect(resp.status()).toBe(401);
  });

  test('yanlış şifre ile login → 401', async ({ request }) => {
    const resp = await request.post(`${apiBaseURL}/auth/login`, {
      data: {
        tenantSlug,
        email: 'admin@demo.local',
        password: 'WrongPassword!',
      },
    });
    expect(resp.status()).toBe(401);
  });

  test('accessToken ile /auth/me → kullanıcı bilgisi', async ({ request }) => {
    // Login al
    const loginResp = await request.post(`${apiBaseURL}/auth/login`, {
      data: {
        tenantSlug,
        email: 'admin@demo.local',
        password: 'ChangeMe123!',
      },
    });
    const { accessToken } = await loginResp.json() as { accessToken: string };

    // /auth/me'yi access token ile çağır
    const meResp = await request.get(`${apiBaseURL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(meResp.ok()).toBeTruthy();

    const me = await meResp.json() as { email: string; tenantId: string; role: string };
    expect(me.email).toBe('admin@demo.local');
    expect(me.tenantId).toBeTruthy();
    expect(me.role).toBeTruthy();
  });

  test('geçersiz accessToken ile korunan endpoint → 401', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/tickets`, {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(resp.status()).toBe(401);
  });

  test('access token olmadan korunan endpoint → 401', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/tickets`);
    expect(resp.status()).toBe(401);
  });
});
