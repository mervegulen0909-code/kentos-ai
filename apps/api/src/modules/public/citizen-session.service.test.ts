import assert from 'node:assert/strict';
import { CitizenSessionService } from './citizen-session.service.js';

const service = new CitizenSessionService({
  get: (key: string) => key === 'CITIZEN_SESSION_SECRET' ? 'citizen-test-secret' : undefined,
  getOrThrow: () => {
    throw new Error('Unexpected fallback secret read.');
  },
} as never);

const token = service.issue({
  citizenId: 'citizen-1',
  tenantId: 'tenant-1',
  tenantSlug: 'demo-belediye',
});

const verified = service.verify(token, 'demo-belediye');
assert.equal(verified.citizenId, 'citizen-1');
assert.equal(verified.tenantId, 'tenant-1');

assert.throws(() => service.verify(`${token}tampered`, 'demo-belediye'));
assert.throws(() => service.verify(token, 'baska-belediye'));

console.log('citizen session tests passed');
