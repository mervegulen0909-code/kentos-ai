import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const tenantSlug = 'demo-belediye';
export const adminBaseURL = process.env.E2E_ADMIN_BASE_URL ?? 'http://127.0.0.1:3001';
export const citizenBaseURL = process.env.E2E_CITIZEN_BASE_URL ?? 'http://127.0.0.1:3002';
export const apiBaseURL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3100/api/v1';

export async function gotoCitizenReport(page: Page) {
  await page.goto(`${citizenBaseURL}/${tenantSlug}/report`);
  await expect(page.getByRole('heading', { name: 'Talebinizi belediyeye iletin.' })).toBeVisible();
}

export async function gotoCitizenTrack(page: Page) {
  await page.goto(`${citizenBaseURL}/${tenantSlug}/track`);
  await expect(page.getByRole('heading', { name: 'Takip kodunuzu girin.' })).toBeVisible();
}

export async function createPublicTicket(request: APIRequestContext, suffix: string) {
  const response = await request.post(`${apiBaseURL}/public/${tenantSlug}/tickets`, {
    data: {
      description: `Playwright E2E bildirimi ${suffix}: kaldirim taslari yerinden cikmis durumda.`,
      addressText: 'Ataturk Mahallesi 12. Sokak belediye on binasi karsisi',
      displayName: 'Playwright Vatandas',
      phone: '+905551112233',
      email: 'playwright@example.com',
    },
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { trackingToken?: string | null };
  expect(payload.trackingToken).toMatch(/^TK-[A-F0-9]{16}$/);
  return payload.trackingToken as string;
}
