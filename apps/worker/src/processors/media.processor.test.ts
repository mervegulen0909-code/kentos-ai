import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeMediaJob } from './media.processor.js';

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
