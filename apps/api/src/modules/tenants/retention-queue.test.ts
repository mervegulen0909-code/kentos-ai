import assert from 'node:assert/strict';
import { buildRetentionScheduleOptions } from './retention-queue.service.js';

function run(name: string, fn: () => void) {
  fn();
  console.log(`retention-queue ${name} passed`);
}

run('buildRetentionScheduleOptions defaults to 03:00 daily', () => {
  const out = buildRetentionScheduleOptions({});
  assert.equal(out.cronPattern, '0 3 * * *');
  assert.equal(out.jobName, 'retention:daily');
  assert.equal(out.repeatKey, 'retention:daily:all-tenants');
});

run('buildRetentionScheduleOptions accepts safe cron override', () => {
  const out = buildRetentionScheduleOptions({ RETENTION_CRON_PATTERN: '15 4 * * 1' });
  assert.equal(out.cronPattern, '15 4 * * 1');
});

run('buildRetentionScheduleOptions rejects unsafe characters', () => {
  const out = buildRetentionScheduleOptions({ RETENTION_CRON_PATTERN: 'rm -rf /' });
  assert.equal(out.cronPattern, '0 3 * * *');
});

console.log('all retention-queue tests passed');
