import { expect, test } from '@playwright/test';
import { createPublicTicket, gotoCitizenTrack } from './helpers';

test('citizen track accepts TK tokens and rejects legacy KNT values', async ({ page, request }) => {
  test.setTimeout(60_000);

  const trackingToken = await createPublicTicket(request, String(Date.now()));

  await gotoCitizenTrack(page);
  await page.getByLabel('Takip kodu').fill(trackingToken);
  await page.getByRole('button', { name: 'Durumu sorgula' }).click();

  await page.waitForURL(new RegExp(`/demo-belediye/ticket/${trackingToken}$`), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByText(`Takip kodunuz: ${trackingToken}`)).toBeVisible();

  await gotoCitizenTrack(page);
  await page.getByLabel('Takip kodu').fill('KNT-2026-0001');
  await page.getByRole('button', { name: 'Durumu sorgula' }).click();

  await page.waitForURL(/\/demo-belediye\/track\?error=format$/);
  await expect(page.getByText('Kod biçimi tanınmadı.')).toBeVisible();
});
