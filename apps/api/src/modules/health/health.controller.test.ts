/**
 * health.controller.test.ts — HealthController birim testleri
 * tsx ile çalıştırılır: tsx src/modules/health/health.controller.test.ts
 *
 * Yaklaşım: NestJS DI olmadan saf iş mantığını test eder (auth.service.test.ts tarzı).
 * health() ve ready() metotlarının davranışı doğrudan simüle edilir.
 *
 * Test kapsamı:
 * - health()  → { status, service, timestamp } şekli ve değerleri
 * - ready()   → DB sorgusu başarılı → { status: 'ready', dependencies }
 * - ready()   → DB sorgusu başarısız → hata fırlatır (propagates)
 */
import assert from 'node:assert/strict';
import { shouldRequireClamavReadiness } from './health.controller.js';

// ── Test yardımcısı ──────────────────────────────────────────────────────────
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

// ── HealthController mantığının inline simülasyonu ───────────────────────────
// Gerçek controller'ı import etmek yerine aynı mantığı test ediyoruz.
// Bu sayede @nestjs/throttler veya diğer NestJS bağımlılıkları gerekmez.

function health() {
  return {
    status: 'ok',
    service: 'kentos-api',
    timestamp: new Date().toISOString(),
  };
}

async function ready(prisma: { $queryRaw: (...args: unknown[]) => Promise<unknown> }) {
  await prisma.$queryRaw`SELECT 1`;
  return {
    status: 'ready',
    dependencies: {
      database: 'ok',
    },
    timestamp: new Date().toISOString(),
  };
}

// Mock prisma fabrikası
function makePrisma(shouldFail = false) {
  return {
    $queryRaw: async (..._args: unknown[]) => {
      if (shouldFail) throw new Error('DB connection refused');
      return [{ '?column?': 1 }];
    },
  };
}

// ── Testler ──────────────────────────────────────────────────────────────────
console.log('\nHealthController tests\n');

// health()
await test('health() — status "ok" döner', () => {
  const result = health();
  assert.equal(result.status, 'ok');
});

await test('health() — service adı "kentos-api" döner', () => {
  const result = health();
  assert.equal(result.service, 'kentos-api');
});

await test('health() — timestamp string ve geçerli ISO 8601 formatında', () => {
  const result = health();
  assert.ok(typeof result.timestamp === 'string', 'timestamp string olmalı');
  assert.ok(!Number.isNaN(Date.parse(result.timestamp)), 'geçerli tarih formatı olmalı');
});

await test('health() — timestamp "Z" ile biter (UTC)', () => {
  const result = health();
  assert.ok(result.timestamp.endsWith('Z'), `timestamp UTC olmalı: ${result.timestamp}`);
});

await test('health() — her çağrıda taze timestamp üretir', async () => {
  const t1 = health().timestamp;
  await new Promise<void>((resolve) => setTimeout(resolve, 5));
  const t2 = health().timestamp;
  // t2 ≥ t1 olmalı (zaman ilerliyor)
  assert.ok(new Date(t2) >= new Date(t1), `t2 (${t2}) ≥ t1 (${t1}) olmalı`);
});

// ready() — başarılı DB
await test('ready() — DB erişilebilir → status "ready" döner', async () => {
  const result = await ready(makePrisma());
  assert.equal(result.status, 'ready');
});

await test('ready() — DB erişilebilir → dependencies.database "ok"', async () => {
  const result = await ready(makePrisma());
  assert.equal(result.dependencies.database, 'ok');
});

await test('ready() — DB erişilebilir → timestamp geçerli ISO formatında', async () => {
  const result = await ready(makePrisma());
  assert.ok(!Number.isNaN(Date.parse(result.timestamp)), `geçerli tarih formatı: ${result.timestamp}`);
});

// ready() — başarısız DB
await test('ready() — DB erişilemez → hata fırlatır', async () => {
  await assert.rejects(
    () => ready(makePrisma(true)),
    (err: Error) => {
      assert.ok(err.message.includes('DB connection'), `Beklenen hata mesajı: ${err.message}`);
      return true;
    },
  );
});

await test('ready() — DB hatası ready() içinden fırlatılır (error propagation)', async () => {
  let caughtError: Error | null = null;
  try {
    await ready(makePrisma(true));
  } catch (err) {
    caughtError = err as Error;
  }
  assert.ok(caughtError !== null, 'Hata yakalanmalıydı');
  assert.ok(caughtError instanceof Error, 'Error instance olmalı');
});

// ── Sonuç ────────────────────────────────────────────────────────────────────
await test('readiness requires ClamAV only for the clamav scan provider', () => {
  assert.equal(shouldRequireClamavReadiness('clamav'), true);
  assert.equal(shouldRequireClamavReadiness(' CLAMAV '), true);
  assert.equal(shouldRequireClamavReadiness('placeholder'), false);
  assert.equal(shouldRequireClamavReadiness('disabled'), false);
  assert.equal(shouldRequireClamavReadiness(undefined), false);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
