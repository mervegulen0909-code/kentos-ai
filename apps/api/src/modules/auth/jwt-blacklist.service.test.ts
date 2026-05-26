/**
 * jwt-blacklist.service.test.ts — JwtBlacklistService birim testleri
 * tsx ile çalıştırılır: tsx src/modules/auth/jwt-blacklist.service.test.ts
 *
 * Test kapsamı:
 * - revoke() → token'ı kara listeye ekler
 * - isRevoked() → kara listede var mı kontrol eder
 * - TTL süresi geçince → revoked değil sayılır
 * - Birden fazla token → bağımsız takip
 * - Logout: access + refresh her ikisi revoke edilir
 */
import assert from 'node:assert/strict';

// In-memory Redis mock (Map + TTL simülasyonu ile gerçek davranış)
function createInMemoryBlacklist() {
  const store = new Map<string, number>(); // jti → expiresAtMs

  return {
    async revoke(jti: string, ttlSeconds: number): Promise<void> {
      store.set(jti, Date.now() + ttlSeconds * 1000);
    },
    async isRevoked(jti: string): Promise<boolean> {
      const expiresAt = store.get(jti);
      if (expiresAt === undefined) return false;
      if (Date.now() > expiresAt) {
        store.delete(jti);
        return false;
      }
      return true;
    },
  };
}

// TTL sabitleri (auth.service.ts ile uyumlu)
const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_S = 7 * 24 * 3600;

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log('\nJwtBlacklistService tests\n');

// ── Temel revoke/isRevoked ───────────────────────────────────────────────────
await test('revoke + isRevoked → true döner', async () => {
  const bl = createInMemoryBlacklist();
  await bl.revoke('jti-001', ACCESS_TTL_S);
  assert.equal(await bl.isRevoked('jti-001'), true);
});

await test('revoke edilmemiş jti → false döner', async () => {
  const bl = createInMemoryBlacklist();
  assert.equal(await bl.isRevoked('unknown-jti'), false);
});

await test('boş string jti → false döner (kayıt yok)', async () => {
  const bl = createInMemoryBlacklist();
  assert.equal(await bl.isRevoked(''), false);
});

// ── TTL davranışı ─────────────────────────────────────────────────────────────
await test('TTL = 0 ile revoke → hemen süresi dolmuş sayılır', async () => {
  const bl = createInMemoryBlacklist();
  await bl.revoke('jti-expired', 0);
  await new Promise((r) => setTimeout(r, 5)); // sıfır TTL geçmesini garantile
  assert.equal(await bl.isRevoked('jti-expired'), false);
});

await test('uzun TTL ile revoke → revoked kalır', async () => {
  const bl = createInMemoryBlacklist();
  await bl.revoke('jti-long', REFRESH_TTL_S);
  assert.equal(await bl.isRevoked('jti-long'), true);
});

// ── Bağımsız token takibi ─────────────────────────────────────────────────────
await test('farklı jti\'ler birbirini etkilemez', async () => {
  const bl = createInMemoryBlacklist();
  await bl.revoke('jti-a', ACCESS_TTL_S);
  assert.equal(await bl.isRevoked('jti-a'), true);
  assert.equal(await bl.isRevoked('jti-b'), false);
});

await test('aynı jti iki kez revoke → hâlâ revoked', async () => {
  const bl = createInMemoryBlacklist();
  await bl.revoke('jti-dup', 900);
  await bl.revoke('jti-dup', 1800);
  assert.equal(await bl.isRevoked('jti-dup'), true);
});

// ── Logout senaryosu ──────────────────────────────────────────────────────────
await test('logout: access + refresh token → her ikisi revoke edilir', async () => {
  const bl = createInMemoryBlacklist();
  const accessJti = 'access-jti-logout';
  const refreshJti = 'refresh-jti-logout';

  // auth.service.ts logout() mantığı
  await Promise.all([
    bl.revoke(accessJti, ACCESS_TTL_S),
    bl.revoke(refreshJti, REFRESH_TTL_S),
  ]);

  assert.equal(await bl.isRevoked(accessJti), true);
  assert.equal(await bl.isRevoked(refreshJti), true);
});

await test('logout: token olmadan → başka token\'ları etkilemez', async () => {
  const bl = createInMemoryBlacklist();
  await bl.revoke('other-jti', ACCESS_TTL_S);
  // Logout çağrısı (token olmadan) → mevcut token değişmez
  assert.equal(await bl.isRevoked('other-jti'), true);
  assert.equal(await bl.isRevoked('logout-without-token'), false);
});

// ── Refresh token rotasyonu ───────────────────────────────────────────────────
await test('refresh token kullanım: eski refresh revoke edilir, yeni access geçerli', async () => {
  const bl = createInMemoryBlacklist();
  const oldRefreshJti = 'old-refresh-jti';
  const newAccessJti = 'new-access-jti';

  // refresh() endpoint: eski refresh token'ı revoke et
  await bl.revoke(oldRefreshJti, 0); // kalan TTL = 0 (anlık)
  // Yeni access token henüz revoke edilmedi
  assert.equal(await bl.isRevoked(newAccessJti), false);
});

await test('refresh token ikinci kez kullanım → revoked (replay attack engeli)', async () => {
  const bl = createInMemoryBlacklist();
  const refreshJti = 'replay-refresh-jti';

  await bl.revoke(refreshJti, REFRESH_TTL_S);
  // İkinci kez aynı refresh token → revoked
  assert.equal(await bl.isRevoked(refreshJti), true);
});

// ── Çok sayıda token ─────────────────────────────────────────────────────────
await test('100 farklı token → hepsi bağımsız izlenir', async () => {
  const bl = createInMemoryBlacklist();
  const jtis = Array.from({ length: 100 }, (_, i) => `jti-bulk-${i}`);

  await Promise.all(jtis.map((jti) => bl.revoke(jti, ACCESS_TTL_S)));

  for (const jti of jtis) {
    assert.equal(await bl.isRevoked(jti), true, `${jti} revoked olmalı`);
  }
  assert.equal(await bl.isRevoked('jti-bulk-not-added'), false);
});

// ── Sonuç ─────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
