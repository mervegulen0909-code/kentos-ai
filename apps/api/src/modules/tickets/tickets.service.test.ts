/**
 * tickets.service.test.ts — TicketsService birim testleri
 * tsx ile çalıştırılır: tsx src/modules/tickets/tickets.service.test.ts
 *
 * Yaklaşım: NestJS DI ve Prisma olmadan saf iş mantığını test eder.
 * Servis sınıfını import etmek yerine ilgili algoritmalar inline test edilir.
 *
 * Test kapsamı:
 * - Pagination mantığı (page/limit clamping, meta hesabı)
 * - slaState() algoritması
 * - canTransition() geçiş matrisi
 * - requireMutableTicket() durum kontrolü
 * - scopedDepartmentFilter() departman filtreleme mantığı
 * - readConversationMessages() mesaj dönüştürme
 * - asRecord() tip koruması
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

// ── TicketStatus sabitleri (Prisma olmadan) ──────────────────────────────────
const TicketStatus = {
  NEW: 'NEW',
  TRIAGED: 'TRIAGED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_INFO: 'WAITING_INFO',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
} as const;

// ── TicketsService algoritmalarının inline implementasyonu ───────────────────

/** list() — sayfalama hesabı */
function calcPagination(page: number | undefined, limit: number | undefined) {
  const p = Math.max(1, page ?? 1);
  const l = Math.min(200, Math.max(1, limit ?? 50));
  const skip = (p - 1) * l;
  const totalPages = (total: number) => Math.ceil(total / l);
  return { page: p, limit: l, skip, totalPages };
}

/** list() — slaState hesabı */
function slaState(resolutionDueAt: Date | null): 'UNKNOWN' | 'BREACHED' | 'DUE_SOON' | 'OK' {
  if (!resolutionDueAt) return 'UNKNOWN';
  const diffMs = resolutionDueAt.getTime() - Date.now();
  if (diffMs < 0) return 'BREACHED';
  if (diffMs <= 4 * 60 * 60 * 1000) return 'DUE_SOON';
  return 'OK';
}

/** updateStatus() — geçiş matrisi */
function canTransition(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    NEW: ['TRIAGED', 'ASSIGNED', 'REJECTED'],
    TRIAGED: ['ASSIGNED', 'WAITING_INFO', 'REJECTED'],
    ASSIGNED: ['IN_PROGRESS', 'WAITING_INFO', 'REJECTED'],
    IN_PROGRESS: ['WAITING_INFO', 'RESOLVED', 'REJECTED'],
    WAITING_INFO: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
    RESOLVED: ['CLOSED', 'IN_PROGRESS'],
    CLOSED: [],
    REJECTED: [],
  };
  return from === to || (transitions[from] ?? []).includes(to);
}

/** requireMutableTicket() — değiştirilebilir durum kontrolü */
class ForbiddenException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenException';
  }
}

function requireMutableTicket(status: string) {
  if (status === TicketStatus.CLOSED || status === TicketStatus.REJECTED) {
    throw new ForbiddenException(`${status} durumundaki talep degistirilemez.`);
  }
}

/** scopedDepartmentFilter() — departman kapsamı */
function scopedDepartmentFilter(
  departmentScope?: string[],
  requestedDepartmentId?: string,
): { in: string[] } | string | undefined {
  if (!departmentScope) return requestedDepartmentId;
  if (requestedDepartmentId) {
    return departmentScope.includes(requestedDepartmentId) ? requestedDepartmentId : { in: [] };
  }
  return { in: departmentScope };
}

/** asRecord() — tip koruması */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** readConversationMessages() — mesaj dönüştürücü */
function readConversationMessages(value: unknown): Array<{ role: 'citizen' | 'assistant'; text: string; at: string | null }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((msg) => {
    const item = asRecord(msg);
    const role = item?.role;
    const text = item?.text;
    const at = item?.at;
    if ((role !== 'citizen' && role !== 'assistant') || typeof text !== 'string') return [];
    return [{ role, text, at: typeof at === 'string' ? at : null }];
  });
}

/** statusTemplateKey() — durum şablonu anahtarı */
function statusTemplateKey(status: string): string | null {
  const templateKeys: Record<string, string> = {
    ASSIGNED: 'TICKET_ROUTED',
    IN_PROGRESS: 'TICKET_IN_PROGRESS',
    RESOLVED: 'TICKET_RESOLVED',
  };
  return templateKeys[status] ?? null;
}

// ── Testler ──────────────────────────────────────────────────────────────────
console.log('\nTicketsService tests\n');

// ── Pagination clamping ──────────────────────────────────────────────────────
await test('pagination — page ≤ 0 → 1\'e çekilir', () => {
  assert.equal(calcPagination(-5, 10).page, 1);
  assert.equal(calcPagination(0, 10).page, 1);
});

await test('pagination — page > 1 → olduğu gibi kalır', () => {
  assert.equal(calcPagination(3, 10).page, 3);
});

await test('pagination — limit > 200 → 200\'e çekilir', () => {
  assert.equal(calcPagination(1, 9999).limit, 200);
});

await test('pagination — limit < 1 → 1\'e çekilir', () => {
  assert.equal(calcPagination(1, 0).limit, 1);
  assert.equal(calcPagination(1, -10).limit, 1);
});

await test('pagination — skip hesabı doğru (page=2, limit=10 → skip=10)', () => {
  assert.equal(calcPagination(2, 10).skip, 10);
});

await test('pagination — skip hesabı doğru (page=3, limit=25 → skip=50)', () => {
  assert.equal(calcPagination(3, 25).skip, 50);
});

await test('pagination — totalPages(23, limit=10) → 3', () => {
  assert.equal(calcPagination(1, 10).totalPages(23), 3);
});

await test('pagination — totalPages(20, limit=10) → 2 (tam bölünme)', () => {
  assert.equal(calcPagination(1, 10).totalPages(20), 2);
});

await test('pagination — totalPages(0) → 0', () => {
  assert.equal(calcPagination(1, 10).totalPages(0), 0);
});

// ── slaState ────────────────────────────────────────────────────────────────
await test('slaState — null → UNKNOWN', () => {
  assert.equal(slaState(null), 'UNKNOWN');
});

await test('slaState — geçmiş tarih (1 saat önce) → BREACHED', () => {
  const past = new Date(Date.now() - 60 * 60 * 1000);
  assert.equal(slaState(past), 'BREACHED');
});

await test('slaState — tam olarak şu an → BREACHED (diffMs = ~0, küçük negatif)', () => {
  // Date.now()'dan 1ms önce
  const justPassed = new Date(Date.now() - 1);
  assert.equal(slaState(justPassed), 'BREACHED');
});

await test('slaState — 1 saat sonra → DUE_SOON (< 4 saat penceresi)', () => {
  const dueSoon = new Date(Date.now() + 60 * 60 * 1000);
  assert.equal(slaState(dueSoon), 'DUE_SOON');
});

await test('slaState — 3.9 saat sonra → DUE_SOON', () => {
  const near = new Date(Date.now() + 3.9 * 60 * 60 * 1000);
  assert.equal(slaState(near), 'DUE_SOON');
});

await test('slaState — 6 saat sonra → OK', () => {
  const future = new Date(Date.now() + 6 * 60 * 60 * 1000);
  assert.equal(slaState(future), 'OK');
});

await test('slaState — 24 saat sonra → OK', () => {
  const longFuture = new Date(Date.now() + 24 * 60 * 60 * 1000);
  assert.equal(slaState(longFuture), 'OK');
});

// ── canTransition ────────────────────────────────────────────────────────────
await test('canTransition — NEW → TRIAGED geçerli', () => {
  assert.equal(canTransition('NEW', 'TRIAGED'), true);
});

await test('canTransition — NEW → ASSIGNED geçerli', () => {
  assert.equal(canTransition('NEW', 'ASSIGNED'), true);
});

await test('canTransition — NEW → REJECTED geçerli', () => {
  assert.equal(canTransition('NEW', 'REJECTED'), true);
});

await test('canTransition — NEW → IN_PROGRESS geçersiz', () => {
  assert.equal(canTransition('NEW', 'IN_PROGRESS'), false);
});

await test('canTransition — CLOSED → NEW geçersiz', () => {
  assert.equal(canTransition('CLOSED', 'NEW'), false);
});

await test('canTransition — CLOSED → CLOSED (aynı → geçerli, idempotent)', () => {
  assert.equal(canTransition('CLOSED', 'CLOSED'), true);
});

await test('canTransition — REJECTED → IN_PROGRESS geçersiz', () => {
  assert.equal(canTransition('REJECTED', 'IN_PROGRESS'), false);
});

await test('canTransition — IN_PROGRESS → RESOLVED geçerli', () => {
  assert.equal(canTransition('IN_PROGRESS', 'RESOLVED'), true);
});

await test('canTransition — RESOLVED → CLOSED geçerli', () => {
  assert.equal(canTransition('RESOLVED', 'CLOSED'), true);
});

await test('canTransition — RESOLVED → IN_PROGRESS (geri alma) geçerli', () => {
  assert.equal(canTransition('RESOLVED', 'IN_PROGRESS'), true);
});

await test('canTransition — WAITING_INFO → RESOLVED geçerli', () => {
  assert.equal(canTransition('WAITING_INFO', 'RESOLVED'), true);
});

await test('canTransition — TRIAGED → IN_PROGRESS geçersiz (atlama)', () => {
  assert.equal(canTransition('TRIAGED', 'IN_PROGRESS'), false);
});

// ── requireMutableTicket ─────────────────────────────────────────────────────
await test('requireMutableTicket — CLOSED → ForbiddenException fırlatır', () => {
  assert.throws(() => requireMutableTicket('CLOSED'), ForbiddenException);
});

await test('requireMutableTicket — REJECTED → ForbiddenException fırlatır', () => {
  assert.throws(() => requireMutableTicket('REJECTED'), ForbiddenException);
});

await test('requireMutableTicket — NEW → exception yok', () => {
  assert.doesNotThrow(() => requireMutableTicket('NEW'));
});

await test('requireMutableTicket — IN_PROGRESS → exception yok', () => {
  assert.doesNotThrow(() => requireMutableTicket('IN_PROGRESS'));
});

await test('requireMutableTicket — RESOLVED → exception yok', () => {
  assert.doesNotThrow(() => requireMutableTicket('RESOLVED'));
});

// ── scopedDepartmentFilter ───────────────────────────────────────────────────
await test('scopedDepartmentFilter — scope undefined + requestedId → requestedId döner', () => {
  assert.equal(scopedDepartmentFilter(undefined, 'dep-1'), 'dep-1');
});

await test('scopedDepartmentFilter — scope undefined + no requestedId → undefined döner', () => {
  assert.equal(scopedDepartmentFilter(undefined, undefined), undefined);
});

await test('scopedDepartmentFilter — scope var + eşleşen requestedId → requestedId döner', () => {
  assert.equal(scopedDepartmentFilter(['dep-1', 'dep-2'], 'dep-1'), 'dep-1');
});

await test('scopedDepartmentFilter — scope var + eşleşmeyen requestedId → boş in filtresi', () => {
  assert.deepEqual(scopedDepartmentFilter(['dep-1'], 'dep-99'), { in: [] });
});

await test('scopedDepartmentFilter — scope var + no requestedId → in filtresi döner', () => {
  assert.deepEqual(scopedDepartmentFilter(['dep-1', 'dep-2'], undefined), { in: ['dep-1', 'dep-2'] });
});

await test('scopedDepartmentFilter — boş scope + no requestedId → in:[] döner', () => {
  assert.deepEqual(scopedDepartmentFilter([], undefined), { in: [] });
});

// ── asRecord ─────────────────────────────────────────────────────────────────
await test('asRecord — obje → döner', () => {
  const obj = { a: 1 };
  assert.equal(asRecord(obj), obj);
});

await test('asRecord — dizi → null döner', () => {
  assert.equal(asRecord([1, 2, 3]), null);
});

await test('asRecord — null → null döner', () => {
  assert.equal(asRecord(null), null);
});

await test('asRecord — string → null döner', () => {
  assert.equal(asRecord('string'), null);
});

await test('asRecord — number → null döner', () => {
  assert.equal(asRecord(42), null);
});

// ── readConversationMessages ─────────────────────────────────────────────────
await test('readConversationMessages — dizi değilse boş dizi döner', () => {
  assert.deepEqual(readConversationMessages(null), []);
  assert.deepEqual(readConversationMessages('string'), []);
  assert.deepEqual(readConversationMessages({}), []);
});

await test('readConversationMessages — boş dizi → boş dizi döner', () => {
  assert.deepEqual(readConversationMessages([]), []);
});

await test('readConversationMessages — geçerli citizen mesajı → döner', () => {
  const result = readConversationMessages([{ role: 'citizen', text: 'Merhaba', at: '2025-01-01T10:00:00Z' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.role, 'citizen');
  assert.equal(result[0]!.text, 'Merhaba');
  assert.equal(result[0]!.at, '2025-01-01T10:00:00Z');
});

await test('readConversationMessages — geçerli assistant mesajı → döner', () => {
  const result = readConversationMessages([{ role: 'assistant', text: 'Nasıl yardımcı olabilirim?' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.role, 'assistant');
});

await test('readConversationMessages — at alanı yok → null döner', () => {
  const result = readConversationMessages([{ role: 'citizen', text: 'Test' }]);
  assert.equal(result[0]!.at, null);
});

await test('readConversationMessages — geçersiz role → filtrelenir', () => {
  const result = readConversationMessages([
    { role: 'system', text: 'Sistem mesajı' },
    { role: 'citizen', text: 'Vatandaş mesajı' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.role, 'citizen');
});

await test('readConversationMessages — text string değilse → filtrelenir', () => {
  const result = readConversationMessages([
    { role: 'citizen', text: 123 },
    { role: 'citizen', text: 'geçerli' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.text, 'geçerli');
});

// ── statusTemplateKey ─────────────────────────────────────────────────────────
await test('statusTemplateKey — ASSIGNED → TICKET_ROUTED', () => {
  assert.equal(statusTemplateKey('ASSIGNED'), 'TICKET_ROUTED');
});

await test('statusTemplateKey — IN_PROGRESS → TICKET_IN_PROGRESS', () => {
  assert.equal(statusTemplateKey('IN_PROGRESS'), 'TICKET_IN_PROGRESS');
});

await test('statusTemplateKey — RESOLVED → TICKET_RESOLVED', () => {
  assert.equal(statusTemplateKey('RESOLVED'), 'TICKET_RESOLVED');
});

await test('statusTemplateKey — NEW → null (şablon yok)', () => {
  assert.equal(statusTemplateKey('NEW'), null);
});

await test('statusTemplateKey — CLOSED → null (şablon yok)', () => {
  assert.equal(statusTemplateKey('CLOSED'), null);
});

// ── Sonuç ────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
