import { expect, test } from '@playwright/test';
import { citizenBaseURL, tenantSlug } from './helpers';

test('citizen widget preview submits through conversation shell without raw errors', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto(`${citizenBaseURL}/widget/${tenantSlug}`);

  await expect(page.getByRole('heading', { name: `${tenantSlug} için widget kabuğu` })).toBeVisible();
  await expect(page.getByText('WEB_CHAT')).toBeVisible();
  await page.getByLabel('Vatandaşın ilk mesajı').fill('Atatürk Mahallesi 12. Sokak kaldırım çöktü, bebek arabası geçemiyor. Telefonum +905551112233.');
  await page.getByLabel('Ad soyad').fill('Playwright Widget Vatandas');
  await page.getByLabel('Telefon veya e-posta').fill('+905551112233');
  await page.getByRole('button', { name: 'Sohbetten başvuru aç' }).click();

  await expect(page.getByRole('status').or(page.getByRole('alert'))).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/Internal Server Error|stack|Prisma|Exception/i)).toHaveCount(0);
  await expect(page.getByText(/Takip kodu: TK-[A-F0-9]{16}|Lütfen talebinizin konusunu|Talebiniz için ek bilgi gerekiyor/i)).toBeVisible();
});
