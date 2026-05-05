import { expect, test } from '@playwright/test';
import { gotoCitizenReport } from './helpers';

test('citizen report submits and redirects to TK tracking page', async ({ page }) => {
  test.setTimeout(60_000);

  await gotoCitizenReport(page);

  await page.getByLabel('Açıklama').fill('Ataturk Mahallesi 12. Sokak kaldirim taslari yerinden cikmis, bebek arabasi gecemiyor.');
  await page.getByLabel('Adres veya konum tarifi').fill('Ataturk Mahallesi 12. Sokak belediye on binasi karsisi');
  await page.getByLabel('Ad soyad').fill('Playwright Vatandas');
  await page.getByLabel('Telefon').fill('+905551112233');
  await page.getByLabel('E-posta').fill('playwright@example.com');
  await page.getByRole('button', { name: 'Başvuruyu oluştur' }).click();

  await page.waitForURL(/\/demo-belediye\/ticket\/TK-[A-F0-9]{16}$/);
  await expect(page.getByText(/Takip kodunuz:/i).first()).toBeVisible();
  await expect(page.getByText(/Playwright Vatandas/i)).toHaveCount(0);
});
