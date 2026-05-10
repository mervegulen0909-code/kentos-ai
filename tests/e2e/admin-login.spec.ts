import { expect, test } from '@playwright/test';
import { adminBaseURL } from './helpers';

test('admin login redirects to dashboard with seeded tenant admin', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto(`${adminBaseURL}/login`);

  await expect(page.getByRole('heading', { name: 'Operasyon paneline giris' })).toBeVisible();
  await page.getByLabel('Sifre').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Guvenli giris yap' }).click();

  await page.waitForURL(`${adminBaseURL}/`, { timeout: 30_000 });
  await expect(page.locator('.sidebar-status')).toContainText('TENANT_ADMIN oturumu', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Yetkili ekiplerin talep yuku/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Talepler' })).toBeVisible();
  await expect(page.getByText(/Dashboard verisi alinamadi\./i)).toHaveCount(0);
});
