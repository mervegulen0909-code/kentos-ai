import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { PrismaClient } from '@kentos/database';
import { apiBaseURL, citizenBaseURL, tenantSlug } from './helpers';

test('citizen erasure rejects direct citizen id and forged session token', async ({ request }) => {
  const directResponse = await request.post(`${apiBaseURL}/public/${tenantSlug}/citizen/erasure`, {
    data: { citizenId: 'forged-citizen-id' },
  });
  expect(directResponse.status()).toBe(401);

  const forgedTokenResponse = await request.post(`${apiBaseURL}/public/${tenantSlug}/citizen/erasure`, {
    data: { sessionToken: 'forged-session-token' },
  });
  expect(forgedTokenResponse.status()).toBe(401);
});

test('citizen account route cannot erase through a forged cookie', async ({ request }) => {
  const forgedSession = JSON.stringify({
    citizenId: 'forged-citizen-id',
    sessionToken: 'forged-session-token',
  });
  const response = await request.post(`${citizenBaseURL}/${tenantSlug}/account/erasure`, {
    headers: { cookie: `citizen_session_${tenantSlug}=${encodeURIComponent(forgedSession)}` },
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('Oturum') });
});

test('citizen erasure anonymizes only the authenticated disposable account', async ({ context, page }) => {
  const secret = process.env.E2E_CITIZEN_SESSION_SECRET;
  test.skip(!secret, 'E2E_CITIZEN_SESSION_SECRET is required for a disposable erasure confirmation.');

  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  try {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    const citizen = await prisma.citizen.create({
      data: {
        tenantId: tenant.id,
        displayName: 'QA Erasure Disposable',
        email: `qa-erasure-${suffix}@example.local`,
        phone: `+90555${String(Date.now()).slice(-7)}`,
      },
      select: { id: true },
    });
    const payload = Buffer.from(JSON.stringify({
      citizenId: citizen.id,
      tenantId: tenant.id,
      tenantSlug,
      exp: Math.floor(Date.now() / 1000) + 300,
    })).toString('base64url');
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');

    await context.addCookies([{
      name: `citizen_session_${tenantSlug}`,
      value: JSON.stringify({
        citizenId: citizen.id,
        displayName: 'QA Erasure Disposable',
        email: `qa-erasure-${suffix}@example.local`,
        phone: null,
        sessionToken: `${payload}.${signature}`,
      }),
      url: `${citizenBaseURL}/${tenantSlug}/account`,
    }]);

    await page.goto(`${citizenBaseURL}/${tenantSlug}/account`);
    await expect(page.getByText('QA Erasure Disposable')).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Verilerimi/ }).click();
    await expect(page.getByRole('status')).toBeVisible();

    const erased = await prisma.citizen.findUniqueOrThrow({ where: { id: citizen.id } });
    expect(erased.displayName).toBeNull();
    expect(erased.email).toBeNull();
    expect(erased.phone).toBeNull();
  } finally {
    await prisma.$disconnect();
  }
});
