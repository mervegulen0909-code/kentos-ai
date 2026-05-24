import { expect, test } from '@playwright/test';
import { adminBaseURL, citizenBaseURL, loginAdmin, tenantSlug } from './helpers';

test('admin settings shows tenant widget install snippet', async ({ page }) => {
  test.setTimeout(60_000);

  await loginAdmin(page);
  await page.goto(`${adminBaseURL}/settings`, { waitUntil: 'domcontentloaded', timeout: 45_000 });

  await expect(page.getByRole('heading', { name: 'Belediye sitesine tek script ile ekle' })).toBeVisible();
  await expect(page.getByLabel('Widget kurulum kodu')).toContainText(`data-tenant="${tenantSlug}"`);
  await expect(page.getByLabel('Widget kurulum kodu')).toContainText('/widget.js');
  await expect(page.getByText('Beklenen kanal:')).toBeVisible();
  await expect(page.getByRole('link', { name: `/widget/${tenantSlug}` })).toHaveAttribute('href', `${citizenBaseURL}/widget/${tenantSlug}`);
  await expect(page.getByLabel('Widget basligi')).toHaveValue('Demo Belediyesi Asistanı');
  await expect(page.getByLabel(/Origin izin listesi/)).toContainText('http://127.0.0.1:3002');
  await expect(page.getByText(/Dashboard verisi alinamadi\./i)).toHaveCount(0);

  await page.goto(`${citizenBaseURL}/widget/${tenantSlug}`);
  await expect(page.getByRole('heading', { name: 'Demo Belediyesi Asistanı' })).toBeVisible();
});
