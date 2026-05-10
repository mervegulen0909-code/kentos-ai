import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeOverrides, runRetentionJob } from './retention.processor.js';

function buildModel(rows: Array<{ id?: string; storageKey?: string }> = []) {
  const calls = { count: 0, deleteMany: 0, findMany: 0, lastWhere: null as unknown };
  return {
    calls,
    count: async (input: { where: unknown }) => {
      calls.count += 1;
      calls.lastWhere = input.where;
      return rows.length;
    },
    deleteMany: async (input: { where: unknown }) => {
      calls.deleteMany += 1;
      calls.lastWhere = input.where;
      return { count: rows.length };
    },
    findMany: async (input: { where: unknown }) => {
      calls.findMany += 1;
      calls.lastWhere = input.where;
      return rows.map((row, index) => ({
        id: row.id ?? `row-${index}`,
        storageKey: row.storageKey ?? `attachments/tenant-1/file-${index}.txt`,
      }));
    },
  };
}

function buildDeps(options: {
  attachments?: Array<{ storageKey: string }>;
  retentionOverrides?: unknown;
} = {}) {
  const attachmentRows = options.attachments ?? [{ storageKey: 'attachments/tenant-1/old.txt' }];
  const base = buildModel();
  const attachment = buildModel(attachmentRows);
  const deletedKeys: string[] = [];
  const tenantCalls = { findUnique: 0 };
  return {
    deletedKeys,
    tenantCalls,
    deps: {
      prisma: {
        tenant: {
          findUnique: async () => {
            tenantCalls.findUnique += 1;
            return options.retentionOverrides === undefined
              ? null
              : { retentionOverrides: options.retentionOverrides };
          },
        },
        channelEvent: base,
        outboundDelivery: buildModel(),
        auditLog: buildModel(),
        conversation: buildModel(),
        attachment,
      },
      deleteAttachmentObjects: async (keys: string[]) => {
        deletedKeys.push(...keys);
        return { deleted: keys.length, errors: [] };
      },
    },
  };
}

test('retention defaults attachment scope to dry-run', async () => {
  const { deps, deletedKeys } = buildDeps();
  const result = await runRetentionJob({ name: 'retention', data: { scope: 'attachments', retentionDays: 1 } }, deps);

  assert.equal(result.dryRun, true);
  assert.equal(result.totals.attachments, 1);
  assert.equal(result.totals.attachmentObjectsDeleted, 0);
  assert.deepEqual(result.attachmentStorageKeys, ['attachments/tenant-1/old.txt']);
  assert.deepEqual(deletedKeys, []);
  assert.equal(deps.prisma.attachment.calls.deleteMany, 0);
});

test('retention deletes DB and S3 objects only with explicit flags', async () => {
  const { deps, deletedKeys } = buildDeps();
  const result = await runRetentionJob({
    name: 'retention',
    data: { scope: 'attachments', retentionDays: 1, dryRun: false, deleteAttachmentObjects: true },
  }, deps);

  assert.equal(result.dryRun, false);
  assert.equal(result.deleteAttachmentObjects, true);
  assert.equal(result.totals.attachments, 1);
  assert.equal(result.totals.attachmentObjectsDeleted, 1);
  assert.deepEqual(deletedKeys, ['attachments/tenant-1/old.txt']);
  assert.equal(deps.prisma.attachment.calls.deleteMany, 1);
});

test('retention all scope includes attachments in dry-run summary', async () => {
  const { deps } = buildDeps();
  const result = await runRetentionJob({ name: 'retention', data: { scope: 'all', retentionDays: 1 } }, deps);

  assert.equal(result.dryRun, true);
  assert.equal(result.totals.attachments, 1);
  assert.equal(result.totals.channelEvents, 0);
});

test('retention applies tenant override per scope when no explicit retentionDays', async () => {
  const { deps, tenantCalls } = buildDeps({
    retentionOverrides: { 'attachments': 30, 'audit-logs': 720, 'unknown-scope': 99 },
  });
  const result = await runRetentionJob({
    name: 'retention',
    data: { scope: 'all', tenantId: 'tenant-1' },
  }, deps);

  assert.equal(tenantCalls.findUnique, 1);
  assert.equal(result.effectiveRetentionDays['attachments'], 30);
  assert.equal(result.effectiveRetentionDays['audit-logs'], 720);
  assert.equal(result.effectiveRetentionDays['conversations'], 180);
  assert.equal(result.effectiveRetentionDays['channel-events'], 60);
  assert.equal(result.effectiveRetentionDays['outbound-deliveries'], 90);
  assert.deepEqual(result.appliedOverrides, { 'attachments': 30, 'audit-logs': 720 });
});

test('retention explicit retentionDays overrides tenant settings', async () => {
  const { deps } = buildDeps({ retentionOverrides: { 'attachments': 30 } });
  const result = await runRetentionJob({
    name: 'retention',
    data: { scope: 'attachments', tenantId: 'tenant-1', retentionDays: 7 },
  }, deps);

  assert.equal(result.effectiveRetentionDays['attachments'], 7);
  assert.equal(result.retentionDays, 7);
});

test('retention falls back to defaults when override out of range', async () => {
  const { deps } = buildDeps({ retentionOverrides: { 'attachments': 0, 'audit-logs': 99999 } });
  const result = await runRetentionJob({
    name: 'retention',
    data: { scope: 'all', tenantId: 'tenant-1' },
  }, deps);

  assert.equal(result.effectiveRetentionDays['attachments'], 365);
  assert.equal(result.effectiveRetentionDays['audit-logs'], 365);
  assert.deepEqual(result.appliedOverrides, {});
});

test('normalizeOverrides ignores non-object input and unknown scopes', () => {
  assert.deepEqual(normalizeOverrides(null), {});
  assert.deepEqual(normalizeOverrides('string'), {});
  assert.deepEqual(normalizeOverrides([1, 2]), {});
  assert.deepEqual(
    normalizeOverrides({ 'attachments': 14, 'foo': 7, 'audit-logs': '720' }),
    { 'attachments': 14, 'audit-logs': 720 },
  );
});
