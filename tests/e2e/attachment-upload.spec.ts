import { expect, test } from '@playwright/test';
import {
  adminBaseURL,
  apiBaseURL,
  citizenBaseURL,
  getAdminAccessToken,
  gotoCitizenReport,
  loginAdmin,
  tenantSlug,
} from './helpers';

const safeLeakPattern = /storageKey|uploadUrl|presigned|audit|internal note|AI reasoning|reasoningSummary/i;

test('citizen and admin attachment uploads keep public metadata safe', async ({ page, request }) => {
  test.setTimeout(120_000);

  const suffix = String(Date.now());
  const citizenAttachmentName = `citizen-attachment-${suffix}.txt`;
  const internalAttachmentName = `internal-attachment-${suffix}.txt`;
  const publicAttachmentName = `public-message-attachment-${suffix}.txt`;

  await gotoCitizenReport(page);
  await page.locator('#description').fill(`Playwright attachment ${suffix}: park girisindeki kilitli taslar yerinden cikti.`);
  await page.locator('#addressText').fill('Ataturk Mahallesi 12. Sokak park girisi');
  await page.locator('#displayName').fill('Playwright Dosya Vatandas');
  await page.locator('#phone').fill('+905551112233');
  await page.locator('#email').fill('playwright-attachment@example.com');
  await page.locator('input[name="attachment"]').setInputFiles({
    name: citizenAttachmentName,
    mimeType: 'text/plain',
    buffer: Buffer.from(`citizen attachment smoke ${suffix}`, 'utf8'),
  });
  await page.locator('form.report-card button[type="submit"]').click();

  await page.waitForURL(/\/demo-belediye\/ticket\/TK-[A-F0-9]{16}$/, { timeout: 60_000 });
  const trackingToken = page.url().match(/\/ticket\/(TK-[A-F0-9]{16})$/)?.[1];
  expect(trackingToken).toBeTruthy();
  await expect(page.locator('body')).toContainText(citizenAttachmentName, { timeout: 30_000 });
  await expect(page.getByText(/Takip kodunuz:/i).first()).toBeVisible();
  await expect(page.getByText(/Playwright Dosya Vatandas/i)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(safeLeakPattern);

  const accessToken = await getAdminAccessToken(request);
  const ticketsResponse = await request.get(`${apiBaseURL}/tickets?q=${trackingToken}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(ticketsResponse.ok()).toBeTruthy();
  const tickets = (await ticketsResponse.json()) as Array<{ id: string }>;
  expect(tickets[0]?.id).toBeTruthy();
  const ticketId = tickets[0].id;

  await loginAdmin(page);
  await page.goto(`${adminBaseURL}/tickets/${ticketId}`);
  await expect(page.locator('body')).toContainText(citizenAttachmentName, { timeout: 30_000 });

  await page.locator('textarea[name="body"]').first().fill(`Ic not eki smoke ${suffix}`);
  await page.locator('input[name="attachment"]').first().setInputFiles({
    name: internalAttachmentName,
    mimeType: 'text/plain',
    buffer: Buffer.from(`internal attachment smoke ${suffix}`, 'utf8'),
  });
  await page.getByRole('button', { name: 'Notu kaydet' }).click();
  await page.waitForURL(new RegExp(`/tickets/${ticketId}\\?success=internal-note-added$`), { timeout: 60_000 });
  await expect(page.locator('body')).toContainText(internalAttachmentName, { timeout: 30_000 });

  await page.locator('textarea[name="body"]').nth(1).fill(`Vatandas mesaji eki smoke ${suffix}`);
  await page.locator('input[name="attachment"]').nth(1).setInputFiles({
    name: publicAttachmentName,
    mimeType: 'text/plain',
    buffer: Buffer.from(`public message attachment smoke ${suffix}`, 'utf8'),
  });
  await page.getByRole('button', { name: 'Mesaji gonder' }).click();
  await page.waitForURL(new RegExp(`/tickets/${ticketId}\\?success=public-message-sent$`), { timeout: 60_000 });
  await expect(page.locator('body')).toContainText(publicAttachmentName, { timeout: 30_000 });

  await page.goto(`${citizenBaseURL}/${tenantSlug}/ticket/${trackingToken}`);
  await expect(page.locator('body')).toContainText(publicAttachmentName, { timeout: 30_000 });
  await expect(page.getByText(internalAttachmentName)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(safeLeakPattern);
});
