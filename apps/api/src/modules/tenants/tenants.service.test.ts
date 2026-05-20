/**
 * tenants.service.test.ts — TenantsService birim testleri
 * tsx ile çalıştırılır: tsx src/modules/tenants/tenants.service.test.ts
 *
 * Yaklaşım: NestJS DI ve Prisma olmadan saf iş mantığını test eder.
 *
 * Test kapsamı:
 * - normalizeRetentionOverrides() — geçersiz, negatif, aralık dışı, ondalıklı değerler
 * - readOriginList() — dizi dışı, boş string filtreleme
 * - updateRetentionSettings() mantığı — sınır değerleri
 * - aiBudgetOverrides normalizasyonu
 */
import assert from 'node:assert/strict';

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

// ── TenantsService algoritmalarının inline implementasyonu ───────────────────

type RetentionScope = 'channel-events' | 'audit-logs' | 'outbound-deliveries' | 'conversations' | 'attachments';
type TenantRetentionOverrides = Partial<Record<RetentionScope, number>>;

const RETENTION_SCOPES: RetentionScope[] = [
  'channel-events',
  'audit-logs',
  'outbound-deliveries',
  'conversations',
  'attachments',
];

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650; // ~10 yıl

function normalizeRetentionOverrides(value: unknown): TenantRetentionOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: TenantRetentionOverrides = {};
  for (const scope of RETENTION_SCOPES) {
    const raw = (value as Record<string, unknown>)[scope];
    if (raw === undefined || raw === null) continue;
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(numeric)) continue;
    if (numeric < MIN_RETENTION_DAYS || numeric > MAX_RETENTION_DAYS) continue;
    result[scope] = numeric;
  }
  return result;
}

function readOriginList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((origin) => String(origin)).filter(Boolean) : [];
}

/** updateRetentionSettings() filtreleme mantığı */
function filterRetentionSettings(dto: Record<string, unknown>): TenantRetentionOverrides {
  const incoming: TenantRetentionOverrides = {};
  for (const scope of RETENTION_SCOPES) {
    const value = dto[scope];
    if (value === undefined || value === null) continue;
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) continue;
    if (numeric < MIN_RETENTION_DAYS || numeric > MAX_RETENTION_DAYS) continue;
    incoming[scope] = numeric;
  }
  return incoming;
}

// AI bütçe normalizasyonu (normalizeTenantAiBudgetOverrides benzeri)
type AiBudgetOverrides = {
  dailyTokenBudget?: number;
  dailyCostBudgetMicros?: number;
  perRequestTokenLimit?: number;
};

function normalizeAiBudgetOverrides(value: unknown): AiBudgetOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const result: AiBudgetOverrides = {};
  if (typeof raw.dailyTokenBudget === 'number' && raw.dailyTokenBudget > 0)
    result.dailyTokenBudget = raw.dailyTokenBudget;
  if (typeof raw.dailyCostBudgetMicros === 'number' && raw.dailyCostBudgetMicros > 0)
    result.dailyCostBudgetMicros = raw.dailyCostBudgetMicros;
  if (typeof raw.perRequestTokenLimit === 'number' && raw.perRequestTokenLimit > 0)
    result.perRequestTokenLimit = raw.perRequestTokenLimit;
  return result;
}

// ── Testler ──────────────────────────────────────────────────────────────────
console.log('\nTenantsService tests\n');

// ── normalizeRetentionOverrides ───────────────────────────────────────────────
await test('normalizeRetentionOverrides — null → boş obje', () => {
  assert.deepEqual(normalizeRetentionOverrides(null), {});
});

await test('normalizeRetentionOverrides — undefined → boş obje', () => {
  assert.deepEqual(normalizeRetentionOverrides(undefined), {});
});

await test('normalizeRetentionOverrides — dizi → boş obje', () => {
  assert.deepEqual(normalizeRetentionOverrides([]), {});
  assert.deepEqual(normalizeRetentionOverrides(['audit-logs', 30]), {});
});

await test('normalizeRetentionOverrides — string → boş obje', () => {
  assert.deepEqual(normalizeRetentionOverrides('audit-logs:30'), {});
});

await test('normalizeRetentionOverrides — bilinmeyen scope → yoksayılır', () => {
  assert.deepEqual(normalizeRetentionOverrides({ unknownScope: 30, invalidKey: 90 }), {});
});

await test('normalizeRetentionOverrides — negatif değer → yoksayılır', () => {
  assert.deepEqual(normalizeRetentionOverrides({ 'audit-logs': -10 }), {});
});

await test('normalizeRetentionOverrides — sıfır → yoksayılır (min 1)', () => {
  assert.deepEqual(normalizeRetentionOverrides({ 'audit-logs': 0 }), {});
});

await test('normalizeRetentionOverrides — ondalıklı sayı → yoksayılır', () => {
  assert.deepEqual(normalizeRetentionOverrides({ 'audit-logs': 30.5 }), {});
  assert.deepEqual(normalizeRetentionOverrides({ 'conversations': 1.1 }), {});
});

await test('normalizeRetentionOverrides — sınır dışı (> MAX) → yoksayılır', () => {
  assert.deepEqual(normalizeRetentionOverrides({ 'audit-logs': 9999 }), {});
});

await test('normalizeRetentionOverrides — minimum sınırda (1) → korunur', () => {
  assert.deepEqual(normalizeRetentionOverrides({ 'audit-logs': 1 }), { 'audit-logs': 1 });
});

await test('normalizeRetentionOverrides — maksimum sınırda (3650) → korunur', () => {
  assert.deepEqual(normalizeRetentionOverrides({ 'audit-logs': 3650 }), { 'audit-logs': 3650 });
});

await test('normalizeRetentionOverrides — geçerli integer değer → korunur', () => {
  assert.deepEqual(normalizeRetentionOverrides({ 'audit-logs': 90 }), { 'audit-logs': 90 });
});

await test('normalizeRetentionOverrides — string sayı → integer\'a dönüştürülür', () => {
  const result = normalizeRetentionOverrides({ conversations: '180' });
  assert.equal(result['conversations'], 180);
});

await test('normalizeRetentionOverrides — birden fazla geçerli scope → hepsi korunur', () => {
  const result = normalizeRetentionOverrides({
    'audit-logs': 90,
    'conversations': 180,
    'attachments': 365,
  });
  assert.equal(result['audit-logs'], 90);
  assert.equal(result['conversations'], 180);
  assert.equal(result['attachments'], 365);
});

await test('normalizeRetentionOverrides — karışık geçerli/geçersiz → sadece geçerliler', () => {
  const result = normalizeRetentionOverrides({
    'audit-logs': 90,      // geçerli
    'conversations': -5,   // negatif → yok say
    'attachments': 30.5,   // ondalıklı → yok say
    'unknownKey': 60,      // bilinmeyen → yok say
  });
  assert.deepEqual(result, { 'audit-logs': 90 });
});

// ── readOriginList ────────────────────────────────────────────────────────────
await test('readOriginList — null → boş dizi', () => {
  assert.deepEqual(readOriginList(null), []);
});

await test('readOriginList — obje → boş dizi', () => {
  assert.deepEqual(readOriginList({ a: 1 }), []);
});

await test('readOriginList — string → boş dizi', () => {
  assert.deepEqual(readOriginList('https://example.com'), []);
});

await test('readOriginList — boş dizi → boş dizi', () => {
  assert.deepEqual(readOriginList([]), []);
});

await test('readOriginList — geçerli originler → korunur', () => {
  assert.deepEqual(readOriginList(['https://a.com', 'https://b.org']), ['https://a.com', 'https://b.org']);
});

await test('readOriginList — boş string → filtrelenir', () => {
  const result = readOriginList(['https://a.com', '', 'https://b.org']);
  assert.ok(!result.includes(''), 'boş string filtrelenmeli');
  assert.ok(result.includes('https://a.com'));
  assert.ok(result.includes('https://b.org'));
});

await test('readOriginList — non-string değerler → string\'e çevrilir', () => {
  const result = readOriginList([123, true, 'https://a.com']);
  assert.ok(result.includes('123'));
  assert.ok(result.includes('true'));
  assert.ok(result.includes('https://a.com'));
});

// ── filterRetentionSettings ───────────────────────────────────────────────────
await test('filterRetentionSettings — boş dto → boş obje', () => {
  assert.deepEqual(filterRetentionSettings({}), {});
});

await test('filterRetentionSettings — null değer → yoksayılır', () => {
  assert.deepEqual(filterRetentionSettings({ 'audit-logs': null }), {});
});

await test('filterRetentionSettings — undefined değer → yoksayılır', () => {
  assert.deepEqual(filterRetentionSettings({ 'audit-logs': undefined }), {});
});

await test('filterRetentionSettings — geçersiz aralık → yoksayılır', () => {
  assert.deepEqual(filterRetentionSettings({ 'audit-logs': -1, 'conversations': 9999 }), {});
});

await test('filterRetentionSettings — geçerli değer → korunur', () => {
  const result = filterRetentionSettings({ 'audit-logs': 365, 'conversations': 90 });
  assert.equal(result['audit-logs'], 365);
  assert.equal(result['conversations'], 90);
});

// ── normalizeAiBudgetOverrides ────────────────────────────────────────────────
await test('normalizeAiBudgetOverrides — null → boş obje', () => {
  assert.deepEqual(normalizeAiBudgetOverrides(null), {});
});

await test('normalizeAiBudgetOverrides — pozitif değer → korunur', () => {
  const result = normalizeAiBudgetOverrides({ dailyTokenBudget: 50000 });
  assert.equal(result.dailyTokenBudget, 50000);
});

await test('normalizeAiBudgetOverrides — negatif değer → yoksayılır', () => {
  const result = normalizeAiBudgetOverrides({ dailyTokenBudget: -100 });
  assert.equal(result.dailyTokenBudget, undefined);
});

await test('normalizeAiBudgetOverrides — sıfır → yoksayılır', () => {
  const result = normalizeAiBudgetOverrides({ perRequestTokenLimit: 0 });
  assert.equal(result.perRequestTokenLimit, undefined);
});

await test('normalizeAiBudgetOverrides — birden fazla alan → hepsi normalize edilir', () => {
  const result = normalizeAiBudgetOverrides({
    dailyTokenBudget: 100000,
    dailyCostBudgetMicros: 5000000,
    perRequestTokenLimit: 4096,
  });
  assert.equal(result.dailyTokenBudget, 100000);
  assert.equal(result.dailyCostBudgetMicros, 5000000);
  assert.equal(result.perRequestTokenLimit, 4096);
});

// ── Sonuç ────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
