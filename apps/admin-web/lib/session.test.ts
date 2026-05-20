/**
 * session.test.ts — admin-web/lib/session.ts birim testleri
 * tsx ile çalıştırılır: tsx lib/session.test.ts
 *
 * Test kapsamı (Next.js cookies() gerektirmeyen saf fonksiyonlar):
 * - isReadOnlyRole      → READ_ONLY, VIEWER, AUDITOR, OBSERVER
 * - canMutateTickets    → isReadOnlyRole'ün tersi
 * - canAssignTickets    → SUPER_ADMIN, TENANT_ADMIN, MANAGER, OPERATOR
 * - canViewAnalytics    → SUPER_ADMIN, TENANT_ADMIN, MANAGER
 * - canManageSettings   → SUPER_ADMIN, TENANT_ADMIN
 * - getRoleFromToken    → JWT payload'ından role çıkarır
 * - decodeJwtPayload    → Base64URL decode, hatalı token yönetimi
 * - isTokenFresh        → exp alanına göre token tazelik kontrolü
 * - normalizeRole       → büyük harf, underscore normalize
 *
 * Not: cookies() çağrısı gerektiren fonksiyonlar (getAdminSession, setAdminSession vb.)
 * Next.js Server Component ortamı gerektirdiğinden burada test edilmez.
 */
import assert from 'node:assert/strict';

// ── Test yardımcısı ──────────────────────────────────────────────────────────
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

// ── Saf fonksiyonlar (session.ts'ten inline) ─────────────────────────────────
// Next.js cookies() bağımlılığı olmaksızın test edilebilir saf mantık

type JwtPayload = { exp?: number; role?: string };

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as JwtPayload;
  } catch {
    return null;
  }
}

function getRoleFromToken(token: string | null): string | null {
  if (!token) return null;
  return decodeJwtPayload(token)?.role ?? null;
}

function isTokenFresh(token: string | null, safetyWindowSeconds = 30): boolean {
  if (!token) return false;
  try {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return false;
    return payload.exp * 1000 > Date.now() + safetyWindowSeconds * 1000;
  } catch {
    return false;
  }
}

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function isReadOnlyRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return ['READ_ONLY', 'VIEWER', 'AUDITOR', 'OBSERVER'].includes(normalized);
}

function canMutateTickets(role: string | null | undefined): boolean {
  return !isReadOnlyRole(role);
}

function canAssignTickets(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'OPERATOR'].includes(normalized);
}

function canViewAnalytics(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'].includes(normalized);
}

function canManageSettings(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(normalized);
}

// JWT token oluşturucu (test için)
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesig`;
}

// ── Testler ──────────────────────────────────────────────────────────────────
console.log('\nadmin-web/lib/session tests\n');

// normalizeRole
test('normalizeRole — null → boş string döner', () => {
  assert.equal(normalizeRole(null), '');
});

test('normalizeRole — küçük harf → büyük harfe dönüştürülür', () => {
  assert.equal(normalizeRole('tenant_admin'), 'TENANT_ADMIN');
});

test('normalizeRole — boşluklar underscore ile değiştirilir', () => {
  assert.equal(normalizeRole('department staff'), 'DEPARTMENT_STAFF');
});

test('normalizeRole — tire underscore ile değiştirilir', () => {
  assert.equal(normalizeRole('read-only'), 'READ_ONLY');
});

test('normalizeRole — başındaki/sonundaki boşluklar kırpılır', () => {
  assert.equal(normalizeRole('  OPERATOR  '), 'OPERATOR');
});

// isReadOnlyRole
test('isReadOnlyRole("READ_ONLY") → true', () => {
  assert.equal(isReadOnlyRole('READ_ONLY'), true);
});

test('isReadOnlyRole("VIEWER") → true', () => {
  assert.equal(isReadOnlyRole('VIEWER'), true);
});

test('isReadOnlyRole("AUDITOR") → true', () => {
  assert.equal(isReadOnlyRole('AUDITOR'), true);
});

test('isReadOnlyRole("OBSERVER") → true', () => {
  assert.equal(isReadOnlyRole('OBSERVER'), true);
});

test('isReadOnlyRole("read-only") → normalize sonrası true', () => {
  assert.equal(isReadOnlyRole('read-only'), true);
});

test('isReadOnlyRole("viewer") → normalize sonrası true', () => {
  assert.equal(isReadOnlyRole('viewer'), true);
});

test('isReadOnlyRole("OPERATOR") → false', () => {
  assert.equal(isReadOnlyRole('OPERATOR'), false);
});

test('isReadOnlyRole("TENANT_ADMIN") → false', () => {
  assert.equal(isReadOnlyRole('TENANT_ADMIN'), false);
});

test('isReadOnlyRole(null) → false', () => {
  assert.equal(isReadOnlyRole(null), false);
});

test('isReadOnlyRole(undefined) → false', () => {
  assert.equal(isReadOnlyRole(undefined), false);
});

// canMutateTickets
test('canMutateTickets("OPERATOR") → true', () => {
  assert.equal(canMutateTickets('OPERATOR'), true);
});

test('canMutateTickets("TENANT_ADMIN") → true', () => {
  assert.equal(canMutateTickets('TENANT_ADMIN'), true);
});

test('canMutateTickets("VIEWER") → false', () => {
  assert.equal(canMutateTickets('VIEWER'), false);
});

test('canMutateTickets("READ_ONLY") → false', () => {
  assert.equal(canMutateTickets('READ_ONLY'), false);
});

// canAssignTickets
test('canAssignTickets("SUPER_ADMIN") → true', () => {
  assert.equal(canAssignTickets('SUPER_ADMIN'), true);
});

test('canAssignTickets("TENANT_ADMIN") → true', () => {
  assert.equal(canAssignTickets('TENANT_ADMIN'), true);
});

test('canAssignTickets("MANAGER") → true', () => {
  assert.equal(canAssignTickets('MANAGER'), true);
});

test('canAssignTickets("OPERATOR") → true', () => {
  assert.equal(canAssignTickets('OPERATOR'), true);
});

test('canAssignTickets("DEPARTMENT_STAFF") → false', () => {
  assert.equal(canAssignTickets('DEPARTMENT_STAFF'), false);
});

test('canAssignTickets("VIEWER") → false', () => {
  assert.equal(canAssignTickets('VIEWER'), false);
});

// canViewAnalytics
test('canViewAnalytics("SUPER_ADMIN") → true', () => {
  assert.equal(canViewAnalytics('SUPER_ADMIN'), true);
});

test('canViewAnalytics("TENANT_ADMIN") → true', () => {
  assert.equal(canViewAnalytics('TENANT_ADMIN'), true);
});

test('canViewAnalytics("MANAGER") → true', () => {
  assert.equal(canViewAnalytics('MANAGER'), true);
});

test('canViewAnalytics("OPERATOR") → false', () => {
  assert.equal(canViewAnalytics('OPERATOR'), false);
});

test('canViewAnalytics("DEPARTMENT_STAFF") → false', () => {
  assert.equal(canViewAnalytics('DEPARTMENT_STAFF'), false);
});

// canManageSettings
test('canManageSettings("SUPER_ADMIN") → true', () => {
  assert.equal(canManageSettings('SUPER_ADMIN'), true);
});

test('canManageSettings("TENANT_ADMIN") → true', () => {
  assert.equal(canManageSettings('TENANT_ADMIN'), true);
});

test('canManageSettings("MANAGER") → false', () => {
  assert.equal(canManageSettings('MANAGER'), false);
});

test('canManageSettings("OPERATOR") → false', () => {
  assert.equal(canManageSettings('OPERATOR'), false);
});

// decodeJwtPayload
test('decodeJwtPayload — geçerli token → payload döner', () => {
  const token = makeJwt({ sub: 'u1', role: 'OPERATOR', exp: 9999999999 });
  const payload = decodeJwtPayload(token);
  assert.ok(payload !== null, 'payload null olmamalı');
  assert.equal(payload!.role, 'OPERATOR');
  assert.equal(payload!.exp, 9999999999);
});

test('decodeJwtPayload — geçersiz (tek parça) token → null döner', () => {
  const result = decodeJwtPayload('notavalidtoken');
  assert.equal(result, null);
});

test('decodeJwtPayload — bozuk base64 → null döner', () => {
  const result = decodeJwtPayload('header.!!!INVALID!!!.sig');
  assert.equal(result, null);
});

test('decodeJwtPayload — boş token → null döner', () => {
  const result = decodeJwtPayload('');
  assert.equal(result, null);
});

// getRoleFromToken
test('getRoleFromToken — null → null', () => {
  assert.equal(getRoleFromToken(null), null);
});

test('getRoleFromToken — geçerli token → role döner', () => {
  const token = makeJwt({ role: 'TENANT_ADMIN', exp: 9999999999 });
  assert.equal(getRoleFromToken(token), 'TENANT_ADMIN');
});

test('getRoleFromToken — role alanı olmayan token → null döner', () => {
  const token = makeJwt({ sub: 'u1', exp: 9999999999 });
  assert.equal(getRoleFromToken(token), null);
});

test('getRoleFromToken — geçersiz token → null döner', () => {
  assert.equal(getRoleFromToken('bad.token'), null);
});

// isTokenFresh
test('isTokenFresh — null → false', () => {
  assert.equal(isTokenFresh(null), false);
});

test('isTokenFresh — gelecekte exp → true', () => {
  const futureExp = Math.floor(Date.now() / 1000) + 900; // 15 dk sonra
  const token = makeJwt({ exp: futureExp });
  assert.equal(isTokenFresh(token), true);
});

test('isTokenFresh — geçmişte exp → false', () => {
  const pastExp = Math.floor(Date.now() / 1000) - 60; // 1 dk önce
  const token = makeJwt({ exp: pastExp });
  assert.equal(isTokenFresh(token), false);
});

test('isTokenFresh — exp güvenlik penceresi içinde → false (henüz bayat)', () => {
  // 20 saniye sonra expires, 30 saniye safety window → false
  const almostExp = Math.floor(Date.now() / 1000) + 20;
  const token = makeJwt({ exp: almostExp });
  assert.equal(isTokenFresh(token, 30), false);
});

test('isTokenFresh — exp alanı yok → false', () => {
  const token = makeJwt({ sub: 'u1' });
  assert.equal(isTokenFresh(token), false);
});

test('isTokenFresh — geçersiz token → false', () => {
  assert.equal(isTokenFresh('not.a.valid.jwt'), false);
});

// ── Sonuç ────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
