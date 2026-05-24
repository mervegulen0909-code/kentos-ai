import { expect, test } from '@playwright/test';
import {
  adminBaseURL,
  apiBaseURL,
  citizenBaseURL,
  createPublicTicket,
  getAdminAccessToken,
  gotoCitizenReport,
  gotoCitizenTrack,
  loginAdmin,
  tenantSlug,
} from './helpers';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('mobile smoke keeps admin and citizen critical pages usable at 390px', async ({ page, request }) => {
  test.setTimeout(120_000);

  await page.setViewportSize({ width: 390, height: 844 });
  const trackingToken = await createPublicTicket(request, `mobile-${Date.now()}`);
  const accessToken = await getAdminAccessToken(request);
  const ticketsResponse = await request.get(`${apiBaseURL}/tickets?q=${trackingToken}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(ticketsResponse.ok()).toBeTruthy();
  const tickets = (await ticketsResponse.json()) as { data: Array<{ id: string }> };
  const ticketId = tickets.data[0]?.id;
  expect(ticketId).toBeTruthy();

  await loginAdmin(page);
  for (const path of ['/settings', '/reports', `/tickets/${ticketId}`]) {
    await page.goto(`${adminBaseURL}${path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.locator('.sidebar-status')).toContainText('TENANT_ADMIN oturumu');
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  }

  await gotoCitizenReport(page);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole('button', { name: 'Başvuruyu oluştur' })).toBeVisible();

  await gotoCitizenTrack(page);
  await expectNoHorizontalOverflow(page);

  await page.goto(`${citizenBaseURL}/${tenantSlug}/ticket/${trackingToken}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await expect(page.getByText(`Takip kodunuz: ${trackingToken}`).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
