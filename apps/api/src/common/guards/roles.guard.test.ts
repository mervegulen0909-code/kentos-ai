/**
 * roles.guard.test.ts — RolesGuard birim testleri
 * tsx ile çalıştırılır: tsx src/common/guards/roles.guard.test.ts
 *
 * Test kapsamı:
 * - Rol dekoratörü olmayan endpoint → her zaman izin ver
 * - Eşleşen rol → izin ver
 * - Eşleşmeyen rol → reddet
 * - User yoksa → reddet
 * - Multi-rol dekoratörü
 */
import assert from 'node:assert/strict';

// RolesGuard.canActivate() mantığı inline (NestJS DI olmadan)
function canActivate(requiredRoles: string[] | undefined, userRole: string | undefined): boolean {
  if (!requiredRoles?.length) return true;
  return Boolean(userRole && requiredRoles.includes(userRole));
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log('\nRolesGuard tests\n');

// ── Rol dekoratörü yok ───────────────────────────────────────────────────────
test('@Roles dekoratörü yok (undefined) → her zaman true', () => {
  assert.equal(canActivate(undefined, undefined), true);
  assert.equal(canActivate(undefined, 'OPERATOR'), true);
  assert.equal(canActivate(undefined, 'ADMIN'), true);
});

test('@Roles([]) boş dizi → her zaman true', () => {
  assert.equal(canActivate([], 'OPERATOR'), true);
  assert.equal(canActivate([], undefined), true);
});

// ── Tek rol ──────────────────────────────────────────────────────────────────
test('@Roles([ADMIN]) — ADMIN kullanıcı → true', () => {
  assert.equal(canActivate(['ADMIN'], 'ADMIN'), true);
});

test('@Roles([ADMIN]) — OPERATOR kullanıcı → false', () => {
  assert.equal(canActivate(['ADMIN'], 'OPERATOR'), false);
});

test('@Roles([ADMIN]) — user yok → false', () => {
  assert.equal(canActivate(['ADMIN'], undefined), false);
});

// ── Multi-rol ────────────────────────────────────────────────────────────────
test('@Roles([ADMIN, MANAGER]) — MANAGER → true', () => {
  assert.equal(canActivate(['ADMIN', 'MANAGER'], 'MANAGER'), true);
});

test('@Roles([ADMIN, MANAGER]) — OPERATOR → false', () => {
  assert.equal(canActivate(['ADMIN', 'MANAGER'], 'OPERATOR'), false);
});

test('@Roles([ADMIN, MANAGER, OPERATOR]) — OPERATOR → true (son eleman)', () => {
  assert.equal(canActivate(['ADMIN', 'MANAGER', 'OPERATOR'], 'OPERATOR'), true);
});

// ── Edge case'ler ─────────────────────────────────────────────────────────────
test('büyük/küçük harf duyarlı — "admin" ≠ "ADMIN"', () => {
  assert.equal(canActivate(['ADMIN'], 'admin'), false);
});

test('boş string rol → false', () => {
  assert.equal(canActivate(['ADMIN'], ''), false);
});

test('tüm roller — eşleşme garantili', () => {
  const allRoles = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'OPERATOR', 'VIEWER'];
  for (const role of allRoles) {
    assert.equal(canActivate(allRoles, role), true, `${role} eşleşmeli`);
  }
});

// ── Kiracı izolasyonu simülasyonu ─────────────────────────────────────────────
// RolesGuard tenantId kontrolü yapmaz; bu JWT guard tarafından sağlanır.
// Ancak rol bazlı erişim kiracı kapsamında çalışmalı.
test('super admin değil ise başka tenant kaynaklarına erişemez (rol yeterli değil → false)', () => {
  // ADMIN rolü var ama sadece kendi tenantı için geçerli; burada SUPER_ADMIN gerekiyor
  assert.equal(canActivate(['SUPER_ADMIN'], 'ADMIN'), false);
});

// ── Sonuç ─────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
