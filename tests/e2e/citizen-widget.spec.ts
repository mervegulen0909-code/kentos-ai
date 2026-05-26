import { expect, test } from '@playwright/test';
import { citizenBaseURL, tenantSlug } from './helpers';

test('citizen widget preview submits through conversation shell without raw errors', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto(`${citizenBaseURL}/widget/${tenantSlug}`);

  await expect(page.getByRole('heading', { name: 'Demo Belediyesi Asistanı' })).toBeVisible();
  await expect(page.getByText('WEB_CHAT')).toBeVisible();
  await page.getByLabel('Vatandasin ilk mesaji').fill('Ataturk Mahallesi 12. Sokak kaldirim coktu, bebek arabasi gecemiyor. Telefonum +905551112233.');
  await page.getByLabel('Ad soyad').fill('Playwright Widget Vatandas');
  await page.getByLabel('Telefon veya e-posta').fill('+905551112233');
  await page.getByRole('button', { name: 'Canli sohbet akisini baslat' }).click();

  await expect(page.getByRole('button', { name: 'Canli sohbet akisini baslat' })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/Internal Server Error|stack|Prisma|Exception/i)).toHaveCount(0);
  await expect(page.locator('small').filter({ hasText: 'Konusma kaydi:' })).toBeVisible();
  await expect(page.getByText('Beklenen bilgiler:', { exact: false })).toBeVisible();

  const conversationText = await page.locator('small').filter({ hasText: 'Konusma kaydi:' }).textContent();
  const firstConversationId = conversationText?.replace('Konusma kaydi:', '').trim();
  expect(firstConversationId).toBeTruthy();

  await page.getByLabel('Vatandasin ek bilgisi').fill('YOL_KALDIRIM kategorisi icin Ataturk Mahallesi 12. Sokak konumunda devam ediyor. Telefonum 05551112233.');
  await page.getByRole('button', { name: 'Canli sohbet akisini baslat' }).click();

  await expect(page.getByText(/Internal Server Error|stack|Prisma|Exception/i)).toHaveCount(0);
  await expect(page.getByText(/Takip kodu:/)).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('small').filter({ hasText: `Konusma kaydi: ${firstConversationId}` })).toBeVisible();
});
