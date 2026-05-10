import { expect, test } from '@playwright/test';
import {
  adminBaseURL,
  apiBaseURL,
  createHandoffConversation,
  getAdminAccessToken,
  loginAdmin,
} from './helpers';

test('admin handoff creates a ticket and keeps session chrome consistent', async ({ page, request }) => {
  test.setTimeout(90_000);

  const suffix = String(Date.now());
  const handoffId = await createHandoffConversation(suffix);

  await loginAdmin(page);

  await page.goto(`${adminBaseURL}/tickets?status=NEW`);
  await expect(page.locator('.sidebar-status')).toContainText('TENANT_ADMIN oturumu');
  await expect(page.getByText('Oturum bekleniyor')).toHaveCount(0);

  await page.goto(`${adminBaseURL}/handoffs/${handoffId}`);
  await expect(page.getByRole('heading', { name: 'Konusma gecmisi ve AI ozetleri' })).toBeVisible();
  await page.getByRole('button', { name: 'Bu konusmadan ticket olustur' }).click();
  await page.waitForURL(/\/tickets\/[^/]+\?success=created-from-handoff$/, { timeout: 45_000 });

  const ticketId = page.url().match(/\/tickets\/([^/?]+)/)?.[1];
  expect(ticketId).toBeTruthy();
  await expect(page.locator('.sidebar-status')).toContainText('TENANT_ADMIN oturumu');
  await expect(page.locator('.notice.error')).toHaveCount(0);
  await expect(page.getByText('Operator devrinden ticket olusturuldu.')).toBeVisible();

  const accessToken = await getAdminAccessToken(request);
  const retryResponse = await request.post(`${apiBaseURL}/tickets/handoffs/${handoffId}/create-ticket`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  expect(retryResponse.ok()).toBeTruthy();
  const retryPayload = (await retryResponse.json()) as { ticketId?: string; ticketNo?: string; trackingToken?: string | null };
  expect(retryPayload.ticketId).toBe(ticketId);
  expect(retryPayload.ticketNo).toMatch(/^KNT-\d{4}-\d{6}$/);
  if (retryPayload.trackingToken !== null) {
    expect(retryPayload.trackingToken).toMatch(/^TK-[A-F0-9]{16}$/);
  }
});
