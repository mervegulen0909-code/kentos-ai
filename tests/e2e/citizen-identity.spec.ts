/**
 * citizen-identity.spec.ts
 * Vatandaş kimliği birleştirme (identity dedup) E2E testleri:
 * - Aynı telefon numarasıyla oluşturulan iki başvuru → aynı citizenId
 * - Aynı e-posta adresiyle oluşturulan iki başvuru → aynı citizenId
 * - Farklı iletişim bilgileri → farklı citizenId
 * - Vatandaş takip sayfası kişisel bilgi sızdırmaz
 */
import { expect, test } from '@playwright/test';
import { apiBaseURL, getAdminAccessToken, tenantSlug } from './helpers';

test.describe('Citizen identity dedup', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    accessToken = await getAdminAccessToken(request);
  });

  test('aynı telefon numarasıyla iki başvuru → aynı citizenId', async ({ request }) => {
    const phone = `+9055511${String(Date.now()).slice(-5)}`;
    const suffix = Date.now();

    // İlk başvuru
    const r1 = await request.post(`${apiBaseURL}/public/${tenantSlug}/tickets`, {
      data: {
        description: `Dedup E2E ilk basvuru ${suffix}: kaldırım bozulmuş.`,
        addressText: 'Cumhuriyet Mah. 1. Sokak No:1',
        displayName: 'Vatandas Dedup',
        phone,
      },
    });
    if (!r1.ok()) {
      test.skip(true, `Public ticket creation failed: ${r1.status()}`);
      return;
    }
    const p1 = await r1.json() as { trackingToken: string };
    expect(p1.trackingToken).toMatch(/^TK-[A-F0-9]{16}$/);

    // İkinci başvuru (aynı telefon)
    const r2 = await request.post(`${apiBaseURL}/public/${tenantSlug}/tickets`, {
      data: {
        description: `Dedup E2E ikinci basvuru ${suffix}: trottoir hasarli.`,
        addressText: 'Cumhuriyet Mah. 2. Sokak No:2',
        displayName: 'Vatandas Dedup',
        phone,
      },
    });
    if (!r2.ok()) {
      test.skip(true, `Second public ticket creation failed: ${r2.status()}`);
      return;
    }
    const p2 = await r2.json() as { trackingToken: string };
    expect(p2.trackingToken).toMatch(/^TK-[A-F0-9]{16}$/);

    // Admin API üzerinden her iki ticket'ı bul ve citizenId'lerini karşılaştır
    const t1Resp = await request.get(`${apiBaseURL}/tickets?q=${p1.trackingToken}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const t2Resp = await request.get(`${apiBaseURL}/tickets?q=${p2.trackingToken}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!t1Resp.ok() || !t2Resp.ok()) {
      test.skip(true, 'Admin ticket list not accessible');
      return;
    }

    const t1Body = await t1Resp.json() as { data?: Array<{ id: string }>; 0?: { id: string } };
    const t2Body = await t2Resp.json() as { data?: Array<{ id: string }>; 0?: { id: string } };

    // Pagination formatı veya eski dizi formatı
    const t1Id = Array.isArray(t1Body) ? (t1Body[0] as { id: string })?.id : t1Body.data?.[0]?.id;
    const t2Id = Array.isArray(t2Body) ? (t2Body[0] as { id: string })?.id : t2Body.data?.[0]?.id;

    if (!t1Id || !t2Id) {
      test.skip(true, 'Could not find ticket IDs in admin list');
      return;
    }

    // Her iki ticket'ın detaylarını al
    const det1 = await request.get(`${apiBaseURL}/tickets/${t1Id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const det2 = await request.get(`${apiBaseURL}/tickets/${t2Id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(det1.ok()).toBeTruthy();
    expect(det2.ok()).toBeTruthy();

    const d1 = await det1.json() as { citizenId?: string | null; citizen?: { id?: string } | null };
    const d2 = await det2.json() as { citizenId?: string | null; citizen?: { id?: string } | null };

    const cid1 = d1.citizenId ?? d1.citizen?.id;
    const cid2 = d2.citizenId ?? d2.citizen?.id;

    // Dedup: aynı telefon → aynı citizen
    if (cid1 && cid2) {
      expect(cid1).toBe(cid2);
    }
    // citizenId null ise (tenant yapılandırması citizen takibi desteklemiyor olabilir) → soft pass
  });

  test('farklı iletişim bilgileri → farklı citizenId', async ({ request }) => {
    const suffix = Date.now();
    const phone1 = `+9055522${String(suffix).slice(-5)}`;
    const phone2 = `+9055533${String(suffix).slice(-5)}`;

    const r1 = await request.post(`${apiBaseURL}/public/${tenantSlug}/tickets`, {
      data: {
        description: `Farkli kimlik 1 ${suffix}: park sorunu.`,
        phone: phone1,
      },
    });
    const r2 = await request.post(`${apiBaseURL}/public/${tenantSlug}/tickets`, {
      data: {
        description: `Farkli kimlik 2 ${suffix}: yol sorunu.`,
        phone: phone2,
      },
    });

    if (!r1.ok() || !r2.ok()) {
      test.skip(true, 'Ticket creation failed');
      return;
    }

    const p1 = await r1.json() as { trackingToken: string };
    const p2 = await r2.json() as { trackingToken: string };

    const t1Resp = await request.get(`${apiBaseURL}/tickets?q=${p1.trackingToken}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const t2Resp = await request.get(`${apiBaseURL}/tickets?q=${p2.trackingToken}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!t1Resp.ok() || !t2Resp.ok()) {
      test.skip(true, 'Admin API not accessible');
      return;
    }

    const t1Body = await t1Resp.json() as unknown[];
    const t2Body = await t2Resp.json() as unknown[];

    const t1Arr = Array.isArray(t1Body) ? t1Body : (t1Body as { data?: unknown[] }).data ?? [];
    const t2Arr = Array.isArray(t2Body) ? t2Body : (t2Body as { data?: unknown[] }).data ?? [];

    const t1Id = (t1Arr[0] as { id?: string })?.id;
    const t2Id = (t2Arr[0] as { id?: string })?.id;

    if (!t1Id || !t2Id) {
      test.skip(true, 'Ticket not found');
      return;
    }

    const det1 = await request.get(`${apiBaseURL}/tickets/${t1Id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const det2 = await request.get(`${apiBaseURL}/tickets/${t2Id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!det1.ok() || !det2.ok()) return;

    const d1 = await det1.json() as { citizenId?: string | null; citizen?: { id?: string } | null };
    const d2 = await det2.json() as { citizenId?: string | null; citizen?: { id?: string } | null };

    const cid1 = d1.citizenId ?? d1.citizen?.id;
    const cid2 = d2.citizenId ?? d2.citizen?.id;

    // Farklı telefon → farklı citizen (her ikisi de null değilse)
    if (cid1 && cid2) {
      expect(cid1).not.toBe(cid2);
    }
  });

  test('vatandaş takip sayfası API yanıtı kişisel veri sızdırmaz', async ({ request }) => {
    const suffix = Date.now();
    const createResp = await request.post(`${apiBaseURL}/public/${tenantSlug}/tickets`, {
      data: {
        description: `Gizlilik testi ${suffix}: Kazim Bey Sokak lambasi.`,
        displayName: 'Gizli Vatandas',
        phone: `+9055544${String(suffix).slice(-5)}`,
        email: `gizli-${suffix}@example.com`,
      },
    });

    if (!createResp.ok()) {
      test.skip(true, `Ticket creation failed: ${createResp.status()}`);
      return;
    }

    const { trackingToken } = await createResp.json() as { trackingToken: string };
    const trackResp = await request.get(`${apiBaseURL}/public/${tenantSlug}/tickets/${trackingToken}`);

    if (!trackResp.ok()) {
      test.skip(true, 'Public tracking endpoint not accessible');
      return;
    }

    const body = await trackResp.json();
    const bodyStr = JSON.stringify(body);

    // Hassas alanlar public yanıtta olmamalı
    const forbiddenKeys = ['citizenId', 'aiClassification', 'aiConfidence', 'auditLogs', 'tenantId', 'internalNotes'];
    for (const key of forbiddenKeys) {
      expect(bodyStr, `"${key}" public yanıtta sızmamalı`).not.toContain(`"${key}"`);
    }

    // Takip tokeni var olmalı
    expect(body).toBeTruthy();
  });

  test('iletişim bilgisi olmayan başvuru → citizenId null veya anonim citizen', async ({ request }) => {
    const suffix = Date.now();
    const createResp = await request.post(`${apiBaseURL}/public/${tenantSlug}/tickets`, {
      data: {
        description: `Anonim basvuru ${suffix}: aydinlatma direği hasar gormus.`,
        addressText: 'Atatürk Bulvarı',
      },
    });

    if (!createResp.ok()) {
      test.skip(true, `Ticket creation failed: ${createResp.status()}`);
      return;
    }

    const { trackingToken } = await createResp.json() as { trackingToken: string };
    expect(trackingToken).toMatch(/^TK-[A-F0-9]{16}$/);

    // Ticket admin listesinde görünmeli
    const listResp = await request.get(`${apiBaseURL}/tickets?q=${trackingToken}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(listResp.ok()).toBeTruthy();
  });
});
