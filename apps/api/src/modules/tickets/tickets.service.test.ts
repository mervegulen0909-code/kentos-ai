/**
 * tickets.service.test.ts - TicketsService unit tests
 *
 * Runs with tsx:
 *   tsx src/modules/tickets/tickets.service.test.ts
 *
 * Strategy:
 * - Keep tests framework-light by validating the service's core algorithms inline.
 * - Cover pagination, SLA state, transition guards, department scoping, and
 *   public-routing message rules without requiring Nest DI or Prisma.
 */
import assert from 'node:assert/strict';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ok ${name}`);
    passed++;
  } catch (err) {
    console.error(`  fail ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

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

function calcPagination(page: number | undefined, limit: number | undefined) {
  const normalizedPage = Math.max(1, page ?? 1);
  const normalizedLimit = Math.min(200, Math.max(1, limit ?? 50));
  const skip = (normalizedPage - 1) * normalizedLimit;
  const totalPages = (total: number) => Math.ceil(total / normalizedLimit);
  return { page: normalizedPage, limit: normalizedLimit, skip, totalPages };
}

function slaState(resolutionDueAt: Date | null): 'UNKNOWN' | 'BREACHED' | 'DUE_SOON' | 'OK' {
  if (!resolutionDueAt) return 'UNKNOWN';
  const diffMs = resolutionDueAt.getTime() - Date.now();
  if (diffMs < 0) return 'BREACHED';
  if (diffMs <= 4 * 60 * 60 * 1000) return 'DUE_SOON';
  return 'OK';
}

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

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

function statusTemplateKey(status: string): string | null {
  const templateKeys: Record<string, string> = {
    ASSIGNED: 'TICKET_ROUTED',
    IN_PROGRESS: 'TICKET_IN_PROGRESS',
    RESOLVED: 'TICKET_RESOLVED',
  };
  return templateKeys[status] ?? null;
}

function shouldCreatePublicRoutingMessage(
  ticket: { departmentId?: string | null },
  nextDepartmentId: string,
): boolean {
  return ticket.departmentId !== nextDepartmentId;
}

console.log('\nTicketsService tests\n');

await test('pagination clamps page <= 0 to 1', () => {
  assert.equal(calcPagination(-5, 10).page, 1);
  assert.equal(calcPagination(0, 10).page, 1);
});

await test('pagination keeps valid page value', () => {
  assert.equal(calcPagination(3, 10).page, 3);
});

await test('pagination clamps limit > 200', () => {
  assert.equal(calcPagination(1, 9999).limit, 200);
});

await test('pagination clamps limit < 1', () => {
  assert.equal(calcPagination(1, 0).limit, 1);
  assert.equal(calcPagination(1, -10).limit, 1);
});

await test('pagination computes skip for page=2 limit=10', () => {
  assert.equal(calcPagination(2, 10).skip, 10);
});

await test('pagination computes skip for page=3 limit=25', () => {
  assert.equal(calcPagination(3, 25).skip, 50);
});

await test('pagination totalPages(23, 10) -> 3', () => {
  assert.equal(calcPagination(1, 10).totalPages(23), 3);
});

await test('pagination totalPages(20, 10) -> 2', () => {
  assert.equal(calcPagination(1, 10).totalPages(20), 2);
});

await test('pagination totalPages(0) -> 0', () => {
  assert.equal(calcPagination(1, 10).totalPages(0), 0);
});

await test('slaState null -> UNKNOWN', () => {
  assert.equal(slaState(null), 'UNKNOWN');
});

await test('slaState past due -> BREACHED', () => {
  const past = new Date(Date.now() - 60 * 60 * 1000);
  assert.equal(slaState(past), 'BREACHED');
});

await test('slaState just passed -> BREACHED', () => {
  const justPassed = new Date(Date.now() - 1);
  assert.equal(slaState(justPassed), 'BREACHED');
});

await test('slaState 1 hour out -> DUE_SOON', () => {
  const dueSoon = new Date(Date.now() + 60 * 60 * 1000);
  assert.equal(slaState(dueSoon), 'DUE_SOON');
});

await test('slaState 3.9 hours out -> DUE_SOON', () => {
  const near = new Date(Date.now() + 3.9 * 60 * 60 * 1000);
  assert.equal(slaState(near), 'DUE_SOON');
});

await test('slaState 6 hours out -> OK', () => {
  const future = new Date(Date.now() + 6 * 60 * 60 * 1000);
  assert.equal(slaState(future), 'OK');
});

await test('slaState 24 hours out -> OK', () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  assert.equal(slaState(future), 'OK');
});

await test('canTransition NEW -> TRIAGED', () => {
  assert.equal(canTransition('NEW', 'TRIAGED'), true);
});

await test('canTransition NEW -> ASSIGNED', () => {
  assert.equal(canTransition('NEW', 'ASSIGNED'), true);
});

await test('canTransition NEW -> REJECTED', () => {
  assert.equal(canTransition('NEW', 'REJECTED'), true);
});

await test('canTransition NEW -> IN_PROGRESS is invalid', () => {
  assert.equal(canTransition('NEW', 'IN_PROGRESS'), false);
});

await test('canTransition CLOSED -> NEW is invalid', () => {
  assert.equal(canTransition('CLOSED', 'NEW'), false);
});

await test('canTransition CLOSED -> CLOSED is idempotent', () => {
  assert.equal(canTransition('CLOSED', 'CLOSED'), true);
});

await test('canTransition REJECTED -> IN_PROGRESS is invalid', () => {
  assert.equal(canTransition('REJECTED', 'IN_PROGRESS'), false);
});

await test('canTransition IN_PROGRESS -> RESOLVED', () => {
  assert.equal(canTransition('IN_PROGRESS', 'RESOLVED'), true);
});

await test('canTransition RESOLVED -> CLOSED', () => {
  assert.equal(canTransition('RESOLVED', 'CLOSED'), true);
});

await test('canTransition RESOLVED -> IN_PROGRESS rollback', () => {
  assert.equal(canTransition('RESOLVED', 'IN_PROGRESS'), true);
});

await test('canTransition WAITING_INFO -> RESOLVED', () => {
  assert.equal(canTransition('WAITING_INFO', 'RESOLVED'), true);
});

await test('canTransition TRIAGED -> IN_PROGRESS is invalid', () => {
  assert.equal(canTransition('TRIAGED', 'IN_PROGRESS'), false);
});

await test('requireMutableTicket throws for CLOSED', () => {
  assert.throws(() => requireMutableTicket('CLOSED'), ForbiddenException);
});

await test('requireMutableTicket throws for REJECTED', () => {
  assert.throws(() => requireMutableTicket('REJECTED'), ForbiddenException);
});

await test('requireMutableTicket allows NEW', () => {
  assert.doesNotThrow(() => requireMutableTicket('NEW'));
});

await test('requireMutableTicket allows IN_PROGRESS', () => {
  assert.doesNotThrow(() => requireMutableTicket('IN_PROGRESS'));
});

await test('requireMutableTicket allows RESOLVED', () => {
  assert.doesNotThrow(() => requireMutableTicket('RESOLVED'));
});

await test('scopedDepartmentFilter returns requested id without scope', () => {
  assert.equal(scopedDepartmentFilter(undefined, 'dep-1'), 'dep-1');
});

await test('scopedDepartmentFilter returns undefined without scope or request', () => {
  assert.equal(scopedDepartmentFilter(undefined, undefined), undefined);
});

await test('scopedDepartmentFilter returns matching requested id inside scope', () => {
  assert.equal(scopedDepartmentFilter(['dep-1', 'dep-2'], 'dep-1'), 'dep-1');
});

await test('scopedDepartmentFilter rejects out-of-scope requested id', () => {
  assert.deepEqual(scopedDepartmentFilter(['dep-1'], 'dep-99'), { in: [] });
});

await test('scopedDepartmentFilter returns full scope when request missing', () => {
  assert.deepEqual(scopedDepartmentFilter(['dep-1', 'dep-2'], undefined), { in: ['dep-1', 'dep-2'] });
});

await test('scopedDepartmentFilter keeps empty scope explicit', () => {
  assert.deepEqual(scopedDepartmentFilter([], undefined), { in: [] });
});

await test('asRecord returns object values', () => {
  const obj = { a: 1 };
  assert.equal(asRecord(obj), obj);
});

await test('asRecord rejects arrays', () => {
  assert.equal(asRecord([1, 2, 3]), null);
});

await test('asRecord rejects null', () => {
  assert.equal(asRecord(null), null);
});

await test('asRecord rejects strings', () => {
  assert.equal(asRecord('string'), null);
});

await test('asRecord rejects numbers', () => {
  assert.equal(asRecord(42), null);
});

await test('readConversationMessages returns [] for non-arrays', () => {
  assert.deepEqual(readConversationMessages(null), []);
  assert.deepEqual(readConversationMessages('string'), []);
  assert.deepEqual(readConversationMessages({}), []);
});

await test('readConversationMessages returns [] for empty arrays', () => {
  assert.deepEqual(readConversationMessages([]), []);
});

await test('readConversationMessages keeps valid citizen messages', () => {
  const result = readConversationMessages([{ role: 'citizen', text: 'Merhaba', at: '2025-01-01T10:00:00Z' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.role, 'citizen');
  assert.equal(result[0]!.text, 'Merhaba');
  assert.equal(result[0]!.at, '2025-01-01T10:00:00Z');
});

await test('readConversationMessages keeps valid assistant messages', () => {
  const result = readConversationMessages([{ role: 'assistant', text: 'Nasil yardimci olabilirim?' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.role, 'assistant');
});

await test('readConversationMessages fills missing timestamps with null', () => {
  const result = readConversationMessages([{ role: 'citizen', text: 'Test' }]);
  assert.equal(result[0]!.at, null);
});

await test('readConversationMessages filters invalid roles', () => {
  const result = readConversationMessages([
    { role: 'system', text: 'Sistem mesaji' },
    { role: 'citizen', text: 'Vatandas mesaji' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.role, 'citizen');
});

await test('readConversationMessages filters non-string text', () => {
  const result = readConversationMessages([
    { role: 'citizen', text: 123 },
    { role: 'citizen', text: 'gecerli' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.text, 'gecerli');
});

await test('statusTemplateKey ASSIGNED -> TICKET_ROUTED', () => {
  assert.equal(statusTemplateKey('ASSIGNED'), 'TICKET_ROUTED');
});

await test('statusTemplateKey IN_PROGRESS -> TICKET_IN_PROGRESS', () => {
  assert.equal(statusTemplateKey('IN_PROGRESS'), 'TICKET_IN_PROGRESS');
});

await test('statusTemplateKey RESOLVED -> TICKET_RESOLVED', () => {
  assert.equal(statusTemplateKey('RESOLVED'), 'TICKET_RESOLVED');
});

await test('statusTemplateKey NEW -> null', () => {
  assert.equal(statusTemplateKey('NEW'), null);
});

await test('statusTemplateKey CLOSED -> null', () => {
  assert.equal(statusTemplateKey('CLOSED'), null);
});

await test('shouldCreatePublicRoutingMessage returns true for first department assignment', () => {
  assert.equal(shouldCreatePublicRoutingMessage({ departmentId: null }, 'dep-1'), true);
});

await test('shouldCreatePublicRoutingMessage returns false for same-department reassign', () => {
  assert.equal(shouldCreatePublicRoutingMessage({ departmentId: 'dep-1' }, 'dep-1'), false);
});

await test('shouldCreatePublicRoutingMessage returns true for department change', () => {
  assert.equal(shouldCreatePublicRoutingMessage({ departmentId: 'dep-1' }, 'dep-2'), true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
