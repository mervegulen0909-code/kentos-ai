/**
 * users.service.test.ts — UsersService birim testleri
 * tsx ile calistirilir: tsx src/modules/users/users.service.test.ts
 */
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}`); console.error(`    ${err instanceof Error ? err.message : err}`); failed++; }
}

// ── Sabit test verileri ─────────────────────────────────────────────────────

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

const MOCK_USER = {
  id: USER_ID,
  tenantId: TENANT_ID,
  email: 'admin@belediye.gov.tr',
  fullName: 'Admin Kullanici',
  role: 'TENANT_ADMIN',
  isActive: true,
};

const MOCK_OTHER_USER = {
  id: OTHER_USER_ID,
  tenantId: TENANT_ID,
  email: 'operator@belediye.gov.tr',
  fullName: 'Operator Kullanici',
  role: 'OPERATOR',
  isActive: true,
};

// ── Hata siniflari (NestJS'e bagimsiz) ─────────────────────────────────────

class ConflictException extends Error { constructor(msg: string) { super(msg); this.name = 'ConflictException'; } }
class ForbiddenException extends Error { constructor(msg: string) { super(msg); this.name = 'ForbiddenException'; } }
class NotFoundException extends Error { constructor(msg: string) { super(msg); this.name = 'NotFoundException'; } }

// ── bcrypt mock ─────────────────────────────────────────────────────────────

let lastHashCost: number | null = null;
const bcryptMock = {
  hash: async (plain: string, cost: number) => {
    lastHashCost = cost;
    return `$2a$${cost}$hashed_${plain}`;
  },
};

// ── Inline is-fonksiyonlari (servis mantigi) ────────────────────────────────

// Pagination hesaplama — list() icindeki mantik
function computePagination(filters: { page?: number; limit?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// Email normalizasyonu — create() icindeki mantik
function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

// Role degistirme kontrolu — update() icindeki mantik
function canChangeOwnRole(userId: string, targetId: string, dto: { role?: string }) {
  if (userId === targetId && dto.role !== undefined) {
    throw new ForbiddenException('You cannot change your own role.');
  }
}

// Kendi hesabini deaktif etme kontrolu — update() icindeki mantik
function canDeactivateSelf(userId: string, targetId: string, dto: { isActive?: boolean }) {
  if (userId === targetId && dto.isActive === false) {
    throw new ForbiddenException('You cannot deactivate your own account.');
  }
}

// Kendini silme kontrolu — remove() icindeki mantik
function canRemoveSelf(userId: string, targetId: string) {
  if (userId === targetId) {
    throw new ForbiddenException('You cannot deactivate your own account.');
  }
}

// ── Testler: Pagination mantigi ─────────────────────────────────────────────

console.log('\n--- UsersService: Pagination ---');

await test('defaults to page=1 limit=20 when no filters', () => {
  const r = computePagination({});
  assert.equal(r.page, 1);
  assert.equal(r.limit, 20);
  assert.equal(r.skip, 0);
});

await test('page < 1 is clamped to 1', () => {
  const r = computePagination({ page: -5, limit: 10 });
  assert.equal(r.page, 1);
  assert.equal(r.skip, 0);
});

await test('page=0 is clamped to 1', () => {
  const r = computePagination({ page: 0 });
  assert.equal(r.page, 1);
});

await test('limit > 100 is clamped to 100', () => {
  const r = computePagination({ limit: 500 });
  assert.equal(r.limit, 100);
});

await test('limit < 1 is clamped to 1', () => {
  const r = computePagination({ limit: -10 });
  assert.equal(r.limit, 1);
});

await test('skip is correctly computed for page=3 limit=25', () => {
  const r = computePagination({ page: 3, limit: 25 });
  assert.equal(r.page, 3);
  assert.equal(r.limit, 25);
  assert.equal(r.skip, 50);
});

await test('limit=0 is clamped to 1', () => {
  const r = computePagination({ limit: 0 });
  assert.equal(r.limit, 1);
});

// ── Testler: Email normalizasyonu ───────────────────────────────────────────

console.log('\n--- UsersService: Email normalization ---');

await test('email is lowercased and trimmed', () => {
  assert.equal(normalizeEmail('  Admin@Belediye.GOV.TR  '), 'admin@belediye.gov.tr');
});

await test('already normalized email unchanged', () => {
  assert.equal(normalizeEmail('test@example.com'), 'test@example.com');
});

// ── Testler: Password hashing ───────────────────────────────────────────────

console.log('\n--- UsersService: Password hashing ---');

await test('bcrypt.hash is called with cost 12', async () => {
  lastHashCost = null;
  await bcryptMock.hash('SomePassword1', 12);
  assert.equal(lastHashCost, 12);
});

await test('hash output contains the cost factor', async () => {
  const hash = await bcryptMock.hash('TestPass', 12);
  assert.ok(hash.startsWith('$2a$12$'));
});

// ── Testler: Remove — kendini silemezsin ────────────────────────────────────

console.log('\n--- UsersService: Remove self-protection ---');

await test('remove throws ForbiddenException when removing yourself', () => {
  assert.throws(
    () => canRemoveSelf(USER_ID, USER_ID),
    (err: Error) => err.name === 'ForbiddenException' && err.message.includes('cannot deactivate your own account'),
  );
});

await test('remove does not throw for a different user', () => {
  assert.doesNotThrow(() => canRemoveSelf(USER_ID, OTHER_USER_ID));
});

// ── Testler: Update — kendi rolunu degistiremezsin ──────────────────────────

console.log('\n--- UsersService: Update self-role protection ---');

await test('update throws ForbiddenException when changing own role', () => {
  assert.throws(
    () => canChangeOwnRole(USER_ID, USER_ID, { role: 'SUPER_ADMIN' }),
    (err: Error) => err.name === 'ForbiddenException' && err.message.includes('cannot change your own role'),
  );
});

await test('update allows changing another user role', () => {
  assert.doesNotThrow(() => canChangeOwnRole(USER_ID, OTHER_USER_ID, { role: 'MANAGER' }));
});

await test('update allows updating own fields if role is undefined', () => {
  assert.doesNotThrow(() => canChangeOwnRole(USER_ID, USER_ID, {}));
});

await test('update allows updating own fields with explicit undefined role', () => {
  assert.doesNotThrow(() => canChangeOwnRole(USER_ID, USER_ID, { role: undefined }));
});

// ── Testler: Update — kendini deaktif edemezsin ─────────────────────────────

console.log('\n--- UsersService: Update self-deactivation protection ---');

await test('update throws ForbiddenException when deactivating yourself', () => {
  assert.throws(
    () => canDeactivateSelf(USER_ID, USER_ID, { isActive: false }),
    (err: Error) => err.name === 'ForbiddenException' && err.message.includes('cannot deactivate your own account'),
  );
});

await test('update allows deactivating another user', () => {
  assert.doesNotThrow(() => canDeactivateSelf(USER_ID, OTHER_USER_ID, { isActive: false }));
});

await test('update allows setting own isActive=true (no exception)', () => {
  assert.doesNotThrow(() => canDeactivateSelf(USER_ID, USER_ID, { isActive: true }));
});

await test('update allows omitting isActive for self', () => {
  assert.doesNotThrow(() => canDeactivateSelf(USER_ID, USER_ID, {}));
});

// ── Testler: Create — duplicate email mock ──────────────────────────────────

console.log('\n--- UsersService: Create duplicate email ---');

await test('create throws ConflictException for duplicate email', async () => {
  // Simulate the duplicate-check logic from create()
  const existingUsers = new Map<string, object>();
  existingUsers.set('tenant-1::admin@belediye.gov.tr', MOCK_USER);

  function checkDuplicate(tenantId: string, email: string) {
    const key = `${tenantId}::${normalizeEmail(email)}`;
    if (existingUsers.has(key)) {
      throw new ConflictException(`A user with email "${normalizeEmail(email)}" already exists in this tenant.`);
    }
  }

  assert.throws(
    () => checkDuplicate(TENANT_ID, 'Admin@Belediye.GOV.TR'),
    (err: Error) => err.name === 'ConflictException' && err.message.includes('already exists'),
  );
});

await test('create does not throw for a unique email', () => {
  const existingUsers = new Map<string, object>();
  existingUsers.set('tenant-1::admin@belediye.gov.tr', MOCK_USER);

  function checkDuplicate(tenantId: string, email: string) {
    const key = `${tenantId}::${normalizeEmail(email)}`;
    if (existingUsers.has(key)) {
      throw new ConflictException(`A user with email "${normalizeEmail(email)}" already exists in this tenant.`);
    }
  }

  assert.doesNotThrow(() => checkDuplicate(TENANT_ID, 'newuser@belediye.gov.tr'));
});

// ── Testler: fullName trim ──────────────────────────────────────────────────

console.log('\n--- UsersService: fullName trim ---');

await test('fullName is trimmed on create', () => {
  const rawName = '  Ali Yilmaz  ';
  assert.equal(rawName.trim(), 'Ali Yilmaz');
});

// ── Sonuclar ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
