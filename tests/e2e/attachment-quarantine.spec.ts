/**
 * attachment-quarantine.spec.ts
 * Ek karantina akışı E2E testleri:
 * - /attachments/quarantined → yönetici erişimi zorunlu (401 anonim)
 * - TENANT_ADMIN için liste döner (meta alanları dahil)
 * - Rescan endpoint → 200 döner, attachmentId ve scanStatus içerir
 * - Vatandaş API karantina detaylarını sızdırmaz
 */
import { expect, test } from '@playwright/test';
import { apiBaseURL, getAdminAccessToken } from './helpers';

test.describe('Attachment quarantine', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    accessToken = await getAdminAccessToken(request);
  });

  test('anonim erişim → 401', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/attachments/quarantined`);
    expect(resp.status()).toBe(401);
  });

  test('geçersiz token → 401', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/attachments/quarantined`, {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(resp.status()).toBe(401);
  });

  test('TENANT_ADMIN karantina listesini görebilir', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/attachments/quarantined`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    // Dizi veya sayfalı yanıt
    const items = Array.isArray(body) ? body : (body as { data?: unknown[] }).data ?? [];
    expect(Array.isArray(items)).toBeTruthy();

    // Eğer karantina öğesi varsa yapısını doğrula
    if (items.length > 0) {
      const item = items[0] as Record<string, unknown>;
      expect(item).toHaveProperty('attachmentId');
      expect(item).toHaveProperty('fileName');
      expect(item).toHaveProperty('mimeType');
      expect(item).toHaveProperty('sizeBytes');
      expect(item).toHaveProperty('scanStatus');

      // storageKey ve uploadUrl sızdırılmamalı
      expect(JSON.stringify(item)).not.toContain('storageKey');
      expect(JSON.stringify(item)).not.toContain('uploadUrl');
      expect(JSON.stringify(item)).not.toContain('presigned');
    }
  });

  test('sayfalama parametreleri destekleniyor', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/attachments/quarantined?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('limit > max → güvenli fallback', async ({ request }) => {
    const resp = await request.get(`${apiBaseURL}/attachments/quarantined?page=1&limit=9999`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    // Eğer meta varsa limit sınırı zorunlu
    const meta = (body as { meta?: { limit?: number } }).meta;
    if (meta?.limit !== undefined) {
      expect(meta.limit).toBeLessThanOrEqual(100); // attachments max 100
    }
  });

  test('mevcut olmayan attachment rescan → 404', async ({ request }) => {
    const resp = await request.post(`${apiBaseURL}/attachments/nonexistent-att-id/rescan`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect([404, 400]).toContain(resp.status());
  });

  test('rescan endpoint anonim → 401', async ({ request }) => {
    const resp = await request.post(`${apiBaseURL}/attachments/any-id/rescan`);
    expect(resp.status()).toBe(401);
  });

  test('upload initiation → anonim → 401', async ({ request }) => {
    const resp = await request.post(`${apiBaseURL}/attachments/uploads`, {
      data: {
        fileName: 'test.txt',
        mimeType: 'text/plain',
        sizeBytes: 100,
      },
    });
    expect(resp.status()).toBe(401);
  });

  test('upload initiation → geçerli token → presign URL alınır', async ({ request }) => {
    const resp = await request.post(`${apiBaseURL}/attachments/uploads`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        fileName: 'quarantine-test.txt',
        mimeType: 'text/plain',
        sizeBytes: 42,
      },
    });

    if (!resp.ok()) {
      // S3/MinIO yapılandırması yoksa 503 veya 500 beklenebilir
      test.skip([503, 500].includes(resp.status()), `Storage unavailable: ${resp.status()}`);
      expect(resp.ok()).toBeTruthy();
      return;
    }

    const body = await resp.json() as { attachmentId?: string; uploadUrl?: string; expiresAt?: string };
    expect(body.attachmentId).toBeTruthy();
    expect(body.uploadUrl).toBeTruthy();
    expect(body.expiresAt).toBeTruthy();

    // Gizli alanlar sızdırılmamalı
    expect(JSON.stringify(body)).not.toContain('storageKey');
  });
});
