import { expect, test, type Page } from '@playwright/test';
import {
  adminBaseURL,
  apiBaseURL,
  citizenBaseURL,
  createHandoffConversation,
  getAdminAccessToken,
  loginAdmin,
  tenantSlug,
} from './helpers';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('full manual tour covers admin and citizen critical sections end to end', async ({ page, request }) => {
  test.setTimeout(180_000);

  const suffix = String(Date.now());
  const widgetTitle = `QA Widget ${suffix}`;
  const internalNote = `QA ic not ${suffix}`;
  const publicMessage = `QA vatandas mesaji ${suffix}`;
  const statusMessage = `QA bilgi talebi ${suffix}`;
  const citizenName = `QA Vatandas ${suffix}`;
  const citizenPhone = `+90555${suffix.slice(-7)}`;
  const citizenEmail = `qa-${suffix}@example.com`;
  const citizenDescription = `QA bildirimi ${suffix}: kaldirim taslari yerinden cikmis durumda.`;
  const citizenAddress = `Ataturk Mahallesi QA Sokak ${suffix.slice(-4)} belediye on binasi karsisi`;
  const handoffId = await createHandoffConversation(suffix);

  await loginAdmin(page);

  const successNotice = page.locator('.notice.success[role="status"]');

  await expect(page.getByRole('heading', { name: /Yetkili ekiplerin talep yuku/i })).toBeVisible();
  await expect(page.locator('.sidebar-status')).toContainText('TENANT_ADMIN oturumu');

  await page.goto(`${adminBaseURL}/reports`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Gunluk belediye operasyon raporu' })).toBeVisible();

  await page.goto(`${adminBaseURL}/queues`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Departman operasyon yogunlugu' })).toBeVisible();

  await page.goto(`${adminBaseURL}/settings`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Belediye yapilandirmasi' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Widget basligi' }).fill(widgetTitle);
  await page.getByRole('button', { name: 'Widget ayarlarini kaydet' }).click();
  await expect(successNotice).toContainText('Widget ayarlari kaydedildi.');
  await expect(page.getByRole('textbox', { name: 'Widget basligi' })).toHaveValue(widgetTitle);
  await page.getByRole('button', { name: 'Retention isi simdi calistir' }).click();
  await expect(successNotice).toContainText('Retention isi kuyruga eklendi.');

  await page.goto(`${adminBaseURL}/users`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main').getByRole('heading', { level: 1 }).last()).toContainText(/Kullan/i);
  await page.getByRole('textbox', { name: 'Arama' }).fill('admin@demo.local');
  await page.getByRole('button', { name: 'Filtrele' }).click();
  await expect(page.getByText('admin@demo.local')).toBeVisible();

  await page.goto(`${citizenBaseURL}/${tenantSlug}/report`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Talebinizi belediyeye iletin.' })).toBeVisible();
  await page.getByRole('textbox', { name: /A.*klama/i }).fill(citizenDescription);
  await page.getByRole('textbox', { name: /Adres veya konum tarifi/i }).fill(citizenAddress);
  await page.getByRole('textbox', { name: /Ad soyad/i }).fill(citizenName);
  await page.getByRole('textbox', { name: /Telefon/i }).fill(citizenPhone);
  await page.getByRole('textbox', { name: /E-posta/i }).fill(citizenEmail);
  await page.locator('button.cta[type="submit"]').click();
  await page.waitForURL(/\/demo-belediye\/ticket\/TK-[A-F0-9]{16}$/);
  const trackingToken = page.url().split('/').pop()!;
  await expect(page.getByText(`Takip kodunuz: ${trackingToken}`).first()).toBeVisible();

  await page.goto(`${citizenBaseURL}/${tenantSlug}/track`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Takip kodunuzu girin.' })).toBeVisible();
  await page.getByRole('textbox', { name: /Takip kodu/i }).fill(trackingToken);
  await page.locator('button.cta[type="submit"]').click();
  await page.waitForURL(new RegExp(`/demo-belediye/ticket/${trackingToken}$`));
  await expect(page.getByText(`Takip kodunuz: ${trackingToken}`).first()).toBeVisible();

  const accessToken = await getAdminAccessToken(request);
  const ticketsResponse = await request.get(`${apiBaseURL}/tickets?q=${trackingToken}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(ticketsResponse.ok()).toBeTruthy();
  const ticketsPayload = (await ticketsResponse.json()) as { data: Array<{ id: string }> };
  const ticketId = ticketsPayload.data[0]?.id;
  expect(ticketId).toBeTruthy();

  const ticketDetailResponse = await request.get(`${apiBaseURL}/tickets/${ticketId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(ticketDetailResponse.ok()).toBeTruthy();
  const ticketDetail = (await ticketDetailResponse.json()) as {
    citizen?: { id?: string | null } | null;
  };
  const citizenId = ticketDetail.citizen?.id ?? null;
  expect(citizenId).toBeTruthy();

  await page.goto(`${adminBaseURL}/tickets?q=${trackingToken}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Tum basvurular' })).toBeVisible();
  await expect(page.getByText('1 aktif filtre')).toBeVisible();
  await page.goto(`${adminBaseURL}/tickets/${ticketId}`, { waitUntil: 'domcontentloaded' });

  const assignmentSection = page.locator('section.card').filter({ hasText: 'Atama' }).first();
  await assignmentSection.locator('select[name="departmentId"]').selectOption({ index: 2 });
  const assigneeSelect = assignmentSection.locator('select[name="assignedToId"]');
  if (await assigneeSelect.locator('option').count() > 1) {
    await assigneeSelect.selectOption({ index: 2 });
  }
  await assignmentSection.getByRole('button', { name: 'Birime ata' }).click();
  await expect(successNotice).toContainText('Atama tamamlandi.');

  const noteSection = page.locator('section.card').filter({ hasText: 'Ic not ekle' }).first();
  await noteSection.locator('textarea[name="body"]').fill(internalNote);
  await noteSection.getByRole('button', { name: 'Notu kaydet' }).click();
  await expect(successNotice).toContainText('Ic not kaydedildi.');

  const publicMessageSection = page.locator('section.card').filter({ hasText: 'Vatandas mesaji' }).last();
  await publicMessageSection.locator('textarea[name="body"]').fill(publicMessage);
  await publicMessageSection.getByRole('button', { name: 'Mesaji gonder' }).click();
  await expect(successNotice).toContainText('Vatandas bilgilendirmesi gonderildi.');

  const statusSection = page.locator('section.card').filter({ hasText: 'Durum' }).first();
  await statusSection.locator('select[name="status"]').selectOption('WAITING_INFO');
  await statusSection.locator('input[name="publicMessage"]').fill(statusMessage);
  await statusSection.getByRole('button', { name: 'Durumu guncelle' }).click();
  await expect(successNotice).toContainText('Durum guncellendi.');

  await expect(page.getByText(internalNote)).toBeVisible();
  await expect(page.getByText(publicMessage)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Audit timeline' })).toBeVisible();
  await expect(page.getByText('Talep birime atandi')).toBeVisible();
  await expect(page.getByText('Ic not eklendi')).toBeVisible();
  await expect(page.getByText('Vatandas mesaji eklendi')).toBeVisible();
  await expect(page.getByText('Durum degistirildi')).toBeVisible();

  await page.goto(`${citizenBaseURL}/${tenantSlug}/ticket/${trackingToken}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(`Takip kodunuz: ${trackingToken}`).first()).toBeVisible();
  await expect(page.getByText(publicMessage)).toBeVisible();
  await expect(page.getByText(statusMessage)).toBeVisible();
  await expect(page.getByText(internalNote)).toHaveCount(0);

  await page.goto(`${adminBaseURL}/citizens?q=${encodeURIComponent(citizenPhone)}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main').getByRole('heading', { level: 1 }).last()).toContainText(/Vatan/i);
  await page.goto(`${adminBaseURL}/citizens/${citizenId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main').getByRole('heading', { level: 1 }).last()).toContainText('QA Vatandas');
  await expect(page.getByRole('heading', { level: 2, name: /Talepler \(/i })).toBeVisible();

  await page.goto(`${adminBaseURL}/handoffs`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Insan destegi bekleyen gorusmeler' })).toBeVisible();
  await page.goto(`${adminBaseURL}/handoffs/${handoffId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Konusma gecmisi ve AI ozetleri' })).toBeVisible();
  await page.getByRole('button', { name: 'Bu konusmadan ticket olustur' }).click();
  await page.waitForURL(/\/tickets\/[^/]+\?success=created-from-handoff$/);
  await expect(successNotice).toContainText('Operator devrinden ticket olusturuldu.');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    `${adminBaseURL}/settings`,
    `${adminBaseURL}/reports`,
    `${adminBaseURL}/tickets/${ticketId}`,
    `${citizenBaseURL}/${tenantSlug}/report`,
    `${citizenBaseURL}/${tenantSlug}/track`,
    `${citizenBaseURL}/${tenantSlug}/ticket/${trackingToken}`,
  ]) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expectNoHorizontalOverflow(page);
  }
});
