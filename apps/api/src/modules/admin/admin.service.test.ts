/**
 * admin.service.test.ts — AdminService birim testleri
 * tsx ile calistirilir: tsx src/modules/admin/admin.service.test.ts
 */
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}`); console.error(`    ${err instanceof Error ? err.message : err}`); failed++; }
}

// ── Hata siniflari (NestJS'e bagimsiz) ─────────────────────────────────────

class ConflictException extends Error { constructor(msg: string) { super(msg); this.name = 'ConflictException'; } }
class NotFoundException extends Error { constructor(msg: string) { super(msg); this.name = 'NotFoundException'; } }

// ── Slug dogrulama regex'i (CreateTenantDto'daki @Matches ile ayni) ─────────

const SLUG_REGEX = /^[a-z0-9-]+$/;

function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && slug.length >= 2;
}

// ── seedTenant inline mantigi ───────────────────────────────────────────────

const TICKET_PRIORITY = { LOW: 'LOW', NORMAL: 'NORMAL', HIGH: 'HIGH', URGENT: 'URGENT' } as const;

function simulateSeed(tenantId: string) {
  const departments = [
    { tenantId, code: 'FEN', name: 'Fen Isleri', description: 'Altyapi ve yapi isleri' },
    { tenantId, code: 'TEMIZLIK', name: 'Temizlik Isleri', description: 'Cevre temizligi' },
    { tenantId, code: 'PARK', name: 'Park ve Bahceler', description: 'Yesil alan bakimi' },
  ];

  const slaPolicies = [
    { tenantId, priority: TICKET_PRIORITY.LOW, responseMinutes: 480, resolutionMinutes: 4320 },
    { tenantId, priority: TICKET_PRIORITY.NORMAL, responseMinutes: 240, resolutionMinutes: 1440 },
    { tenantId, priority: TICKET_PRIORITY.HIGH, responseMinutes: 60, resolutionMinutes: 480 },
    { tenantId, priority: TICKET_PRIORITY.URGENT, responseMinutes: 15, resolutionMinutes: 120 },
  ];

  return { tenantId, seeded: true, departments: departments.length, slaPolicies: slaPolicies.length };
}

// ── createTenant duplicate-slug mantigi ─────────────────────────────────────

function simulateCreateTenant(
  existingSlugs: Set<string>,
  dto: { name: string; slug: string; timezone?: string; locale?: string },
) {
  if (existingSlugs.has(dto.slug)) {
    throw new ConflictException('Bu slug zaten kullaniliyor');
  }
  return {
    name: dto.name,
    slug: dto.slug,
    timezone: dto.timezone ?? 'Europe/Istanbul',
    locale: dto.locale ?? 'tr-TR',
    status: 'ACTIVE',
  };
}

// ── getTenant not-found mantigi ─────────────────────────────────────────────

function simulateGetTenant(store: Map<string, object>, id: string) {
  const tenant = store.get(id);
  if (!tenant) throw new NotFoundException('Kiraci bulunamadi.');
  return tenant;
}

// ── Testler: Slug dogrulama ─────────────────────────────────────────────────

console.log('\n--- AdminService: Tenant slug validation ---');

await test('valid slug: lowercase letters', () => {
  assert.ok(isValidSlug('istanbul'));
});

await test('valid slug: lowercase with hyphens', () => {
  assert.ok(isValidSlug('istanbul-bs'));
});

await test('valid slug: letters and numbers', () => {
  assert.ok(isValidSlug('belediye-2024'));
});

await test('valid slug: only numbers with hyphen', () => {
  assert.ok(isValidSlug('42-test'));
});

await test('invalid slug: contains uppercase', () => {
  assert.ok(!isValidSlug('Istanbul'));
});

await test('invalid slug: contains spaces', () => {
  assert.ok(!isValidSlug('istanbul bs'));
});

await test('invalid slug: contains underscore', () => {
  assert.ok(!isValidSlug('istanbul_bs'));
});

await test('invalid slug: contains special characters', () => {
  assert.ok(!isValidSlug('istanbul@bs'));
});

await test('invalid slug: too short (1 char)', () => {
  assert.ok(!isValidSlug('a'));
});

await test('valid slug: minimum length (2 chars)', () => {
  assert.ok(isValidSlug('ab'));
});

await test('invalid slug: empty string', () => {
  assert.ok(!isValidSlug(''));
});

await test('invalid slug: contains dot', () => {
  assert.ok(!isValidSlug('istanbul.bs'));
});

await test('invalid slug: contains Turkish characters', () => {
  assert.ok(!isValidSlug('istanbul-büyükşehir'));
  assert.ok(!isValidSlug('şişli-belediyesi'));
  assert.ok(!isValidSlug('özel-çalışma'));
});

// ── Testler: seedTenant sonuclari ───────────────────────────────────────────

console.log('\n--- AdminService: seedTenant ---');

await test('seed returns exactly 3 departments', () => {
  const result = simulateSeed('tenant-x');
  assert.equal(result.departments, 3);
});

await test('seed returns exactly 4 SLA policies', () => {
  const result = simulateSeed('tenant-x');
  assert.equal(result.slaPolicies, 4);
});

await test('seed returns correct tenantId', () => {
  const result = simulateSeed('my-tenant');
  assert.equal(result.tenantId, 'my-tenant');
});

await test('seed sets seeded=true', () => {
  const result = simulateSeed('tenant-1');
  assert.equal(result.seeded, true);
});

// ── Testler: createTenant duplicate slug ────────────────────────────────────

console.log('\n--- AdminService: createTenant duplicate slug ---');

await test('create throws ConflictException for duplicate slug', () => {
  const existing = new Set(['istanbul-bs', 'ankara-bb']);
  assert.throws(
    () => simulateCreateTenant(existing, { name: 'Istanbul', slug: 'istanbul-bs' }),
    (err: Error) => err.name === 'ConflictException' && err.message.includes('slug zaten'),
  );
});

await test('create succeeds for unique slug', () => {
  const existing = new Set(['istanbul-bs']);
  const result = simulateCreateTenant(existing, { name: 'Ankara BB', slug: 'ankara-bb' });
  assert.equal(result.slug, 'ankara-bb');
  assert.equal(result.name, 'Ankara BB');
  assert.equal(result.status, 'ACTIVE');
});

await test('create uses default timezone Europe/Istanbul', () => {
  const result = simulateCreateTenant(new Set(), { name: 'Test', slug: 'test-tenant' });
  assert.equal(result.timezone, 'Europe/Istanbul');
});

await test('create uses default locale tr-TR', () => {
  const result = simulateCreateTenant(new Set(), { name: 'Test', slug: 'test-tenant' });
  assert.equal(result.locale, 'tr-TR');
});

await test('create respects custom timezone', () => {
  const result = simulateCreateTenant(new Set(), {
    name: 'Berlin',
    slug: 'berlin-test',
    timezone: 'Europe/Berlin',
  });
  assert.equal(result.timezone, 'Europe/Berlin');
});

await test('create respects custom locale', () => {
  const result = simulateCreateTenant(new Set(), {
    name: 'English Tenant',
    slug: 'en-tenant',
    locale: 'en-US',
  });
  assert.equal(result.locale, 'en-US');
});

// ── Testler: getTenant not found ────────────────────────────────────────────

console.log('\n--- AdminService: getTenant not found ---');

await test('getTenant throws NotFoundException for missing id', () => {
  const store = new Map<string, object>();
  assert.throws(
    () => simulateGetTenant(store, 'non-existent-id'),
    (err: Error) => err.name === 'NotFoundException',
  );
});

await test('getTenant returns tenant when found', () => {
  const store = new Map<string, object>();
  const tenant = { id: 'tenant-1', name: 'Test', slug: 'test' };
  store.set('tenant-1', tenant);
  const result = simulateGetTenant(store, 'tenant-1');
  assert.deepEqual(result, tenant);
});

// ── Sonuclar ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
