import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runMediaJob, summarizeMediaJob } from './media.processor.js';

const baseJob = {
  attachmentId: 'att-1',
  tenantId: 'tenant-1',
  storageKey: 'attachments/tenant-1/test/file.txt',
  mimeType: 'text/plain',
  sizeBytes: 12,
  checksumSha256: 'a'.repeat(64),
};

test('summarizeMediaJob accepts matching object metadata', () => {
  const result = summarizeMediaJob(baseJob, { contentLength: 12, contentType: 'text/plain' });
  assert.equal(result.status, 'accepted');
  assert.equal(result.reason, 'object-metadata-verified');
});

test('summarizeMediaJob skips missing objects without throwing', () => {
  const result = summarizeMediaJob(baseJob, null);
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'object-missing');
});

test('summarizeMediaJob rejects invalid checksums', () => {
  const result = summarizeMediaJob({ ...baseJob, checksumSha256: 'bad' });
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'invalid-checksum');
});

test('summarizeMediaJob rejects metadata mismatches', () => {
  const result = summarizeMediaJob(baseJob, { contentLength: 13, contentType: 'text/plain' });
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'size-mismatch');
});

test('runMediaJob persists CLEAN scan when injected scanner returns clean', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const result = await runMediaJob({ name: 'process-attachment', data: baseJob }, {
    readObjectMetadata: async () => ({ contentLength: 12, contentType: 'text/plain' }),
    scan: async () => ({ scanStatus: 'CLEAN', scanProvider: 'clamav', raw: 'stream: OK', scannedAt: '2026-05-10T00:00:00.000Z' }),
    updateAttachment: async (input) => { updates.push(input); },
  });

  assert.equal(result.status, 'accepted');
  if (result.status !== 'accepted') return;
  assert.equal(result.scan.status, 'CLEAN');
  assert.equal(result.scan.provider, 'clamav');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, 'CLEAN');
  assert.equal(updates[0].provider, 'clamav');
  assert.equal(updates[0].attachmentId, 'att-1');
});

test('runMediaJob persists INFECTED scan with threat name', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const result = await runMediaJob({ name: 'process-attachment', data: baseJob }, {
    readObjectMetadata: async () => ({ contentLength: 12, contentType: 'text/plain' }),
    scan: async () => ({ scanStatus: 'INFECTED', scanProvider: 'clamav', threat: 'Eicar-Test-Signature', raw: 'stream: ... FOUND', scannedAt: '2026-05-10T00:00:00.000Z' }),
    updateAttachment: async (input) => { updates.push(input); },
  });

  assert.equal(result.status, 'accepted');
  if (result.status !== 'accepted') return;
  assert.equal(result.scan.status, 'INFECTED');
  assert.equal(result.scan.threat, 'Eicar-Test-Signature');
  assert.equal(updates[0].threat, 'Eicar-Test-Signature');
  assert.equal(updates[0].status, 'INFECTED');
});

test('runMediaJob calls onInfected quarantine hook only on INFECTED scans', async () => {
  const quarantineCalls: Array<Record<string, unknown>> = [];
  await runMediaJob({ name: 'process-attachment', data: baseJob }, {
    readObjectMetadata: async () => ({ contentLength: 12, contentType: 'text/plain' }),
    scan: async () => ({ scanStatus: 'CLEAN', scanProvider: 'clamav', scannedAt: '2026-05-10T00:00:00.000Z' }),
    updateAttachment: async () => {},
    onInfected: async (input) => { quarantineCalls.push(input); },
  });
  assert.equal(quarantineCalls.length, 0);

  await runMediaJob({ name: 'process-attachment', data: baseJob }, {
    readObjectMetadata: async () => ({ contentLength: 12, contentType: 'text/plain' }),
    scan: async () => ({ scanStatus: 'INFECTED', scanProvider: 'clamav', threat: 'Eicar', scannedAt: '2026-05-10T00:00:00.000Z' }),
    updateAttachment: async () => {},
    onInfected: async (input) => { quarantineCalls.push(input); },
  });
  assert.equal(quarantineCalls.length, 1);
  assert.equal(quarantineCalls[0].attachmentId, 'att-1');
  assert.equal(quarantineCalls[0].tenantId, 'tenant-1');
  assert.equal(quarantineCalls[0].threat, 'Eicar');
  assert.equal(quarantineCalls[0].scanProvider, 'clamav');
});

test('runMediaJob throws (BullMQ retry) when quarantine hook fails', async () => {
  // If an INFECTED file cannot be quarantined the job must fail so BullMQ retries it.
  await assert.rejects(
    () => runMediaJob({ name: 'process-attachment', data: baseJob }, {
      readObjectMetadata: async () => ({ contentLength: 12, contentType: 'text/plain' }),
      scan: async () => ({ scanStatus: 'INFECTED', scanProvider: 'clamav', threat: 'Eicar', scannedAt: '2026-05-10T00:00:00.000Z' }),
      updateAttachment: async () => {},
      onInfected: async () => { throw new Error('audit-log-down'); },
    }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /quarantine hook failed.*att-1.*audit-log-down/);
      return true;
    },
  );
});

test('runMediaJob skips scanner when payload validation fails (does not call updateAttachment)', async () => {
  const updates: Array<Record<string, unknown>> = [];
  let scanCalls = 0;
  const result = await runMediaJob({ name: 'process-attachment', data: { ...baseJob, checksumSha256: 'bad' } }, {
    readObjectMetadata: async () => ({ contentLength: 12, contentType: 'text/plain' }),
    scan: async () => { scanCalls += 1; return { scanStatus: 'CLEAN', scanProvider: 'clamav' }; },
    updateAttachment: async (input) => { updates.push(input); },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'invalid-checksum');
  assert.equal(scanCalls, 0);
  assert.equal(updates.length, 0);
});

test('runMediaJob marks scan as ERROR when scanner throws', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const result = await runMediaJob({ name: 'process-attachment', data: baseJob }, {
    readObjectMetadata: async () => ({ contentLength: 12, contentType: 'text/plain' }),
    scan: async () => ({ scanStatus: 'ERROR', scanProvider: 'clamav', reason: 'clamav-timeout', scannedAt: '2026-05-10T00:00:00.000Z' }),
    updateAttachment: async (input) => { updates.push(input); },
  });

  assert.equal(result.status, 'accepted');
  if (result.status !== 'accepted') return;
  assert.equal(result.scan.status, 'ERROR');
  assert.equal(updates[0].status, 'ERROR');
});

test('runMediaJob throws (BullMQ retry) when updateAttachment fails', async () => {
  // If scan result cannot be persisted to DB the job must fail so BullMQ retries it.
  await assert.rejects(
    () => runMediaJob({ name: 'process-attachment', data: baseJob }, {
      readObjectMetadata: async () => ({ contentLength: 12, contentType: 'text/plain' }),
      scan: async () => ({ scanStatus: 'CLEAN', scanProvider: 'clamav', scannedAt: '2026-05-10T00:00:00.000Z' }),
      updateAttachment: async () => { throw new Error('db-down'); },
    }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /scan persistence failed.*att-1.*db-down/);
      return true;
    },
  );
});
