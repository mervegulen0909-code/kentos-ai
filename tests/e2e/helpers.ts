import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { ChannelType, PrismaClient } from '@kentos/database';

export const tenantSlug = 'demo-belediye';
export const adminBaseURL = process.env.E2E_ADMIN_BASE_URL ?? 'http://127.0.0.1:3001';
export const citizenBaseURL = process.env.E2E_CITIZEN_BASE_URL ?? 'http://127.0.0.1:3002';
export const apiBaseURL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3100/api/v1';
export const e2eDatabaseURL = process.env.DATABASE_URL ?? 'postgresql://kentos:kentos@127.0.0.1:5432/kentos_ai_qa?schema=public';

export async function gotoCitizenReport(page: Page) {
  await page.goto(`${citizenBaseURL}/${tenantSlug}/report`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Talebinizi belediyeye iletin.' })).toBeVisible();
}

export async function gotoCitizenTrack(page: Page) {
  await page.goto(`${citizenBaseURL}/${tenantSlug}/track`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Takip kodunuzu girin.' })).toBeVisible();
}

export async function createPublicTicket(request: APIRequestContext, suffix: string) {
  const response = await request.post(`${apiBaseURL}/public/${tenantSlug}/tickets`, {
    data: {
      description: `Playwright E2E bildirimi ${suffix}: kaldirim taslari yerinden cikmis durumda.`,
      addressText: 'Ataturk Mahallesi 12. Sokak belediye on binasi karsisi',
      displayName: 'Playwright Vatandas',
      phone: '+905551112233',
      email: 'playwright@example.com',
    },
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { trackingToken?: string | null };
  expect(payload.trackingToken).toMatch(/^TK-[A-F0-9]{16}$/);
  return payload.trackingToken as string;
}

export async function loginAdmin(page: Page) {
  await page.goto(`${adminBaseURL}/login`);
  await page.getByLabel('Belediye kodu').fill(tenantSlug);
  await page.getByLabel('E-posta').fill('admin@demo.local');
  await page.getByLabel('Sifre').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Guvenli giris yap' }).click();
  await page.waitForURL(`${adminBaseURL}/`, { timeout: 30_000 });
  await expect(page.locator('.sidebar-status')).toContainText('TENANT_ADMIN oturumu');
}

export async function getAdminAccessToken(request: APIRequestContext) {
  const response = await request.post(`${apiBaseURL}/auth/login`, {
    data: {
      tenantSlug,
      email: 'admin@demo.local',
      password: 'ChangeMe123!',
    },
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { accessToken?: string };
  expect(payload.accessToken).toBeTruthy();
  return payload.accessToken as string;
}

export async function createHandoffConversation(suffix: string) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: e2eDatabaseURL,
      },
    },
  });

  try {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: tenantSlug }, select: { id: true } });
    const now = new Date();
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: tenant.id,
        channel: ChannelType.WHATSAPP,
        externalConversationId: `e2e-handoff-${suffix}`,
        state: 'OPEN',
        handoffRequested: true,
        context: {
          messages: [
            {
              role: 'citizen',
              text: `E2E handoff ${suffix}: Cumhuriyet Caddesi 5 numara onunde cop konteyneri tasiyor.`,
              at: now.toISOString(),
            },
            {
              role: 'assistant',
              text: 'Talebiniz operator destegine aktarildi.',
              at: now.toISOString(),
            },
          ],
          latestClassification: {
            intent: 'human_handoff',
            title: `E2E operator devri ${suffix}`,
            description: `E2E handoff ${suffix}: Cumhuriyet Caddesi 5 numara onunde cop konteyneri tasiyor.`,
            missingFields: [],
            followUpQuestion: null,
          },
        },
        lastMessageAt: now,
      },
      select: { id: true },
    });

    return conversation.id;
  } finally {
    await prisma.$disconnect();
  }
}
