import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runRetentionJob } from './retention.processor.js';

function buildModel(rows: Array<{ id?: string; storageKey?: string }> = []) {
  const calls = { count: 0, deleteMany: 0, findMany: 0 };
  return {
    calls,
    count: async () => {
      calls.count += 1;
      return rows.length;
    },
    deleteMany: async () => {
      calls.deleteMany += 1;
      return { count: rows.length };
    },
    findMany: async () => {
      calls.findMany += 1;
      return rows.map((row, index) => ({
        id: row.id ?? `row-${index}`,
        storageKey: row.storageKey ?? `attachments/tenant-1/file-${index}.txt`,
      }));
    },
  };
}

function buildDeps(attachments = [{ storageKey: 'attachments/tenant-1/old.txt' }]) {
  const base = buildModel();
  const attachment = buildModel(attachments);
  const deletedKeys: string[] = [];
  return {
    deletedKeys,
    deps: {
      prisma: {
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
