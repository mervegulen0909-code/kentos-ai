import { buildReconciliationDecision } from './citizen-identity-reconciliation.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function testDetectsConflictingIdentifierOwners() {
  const decision = buildReconciliationDecision({
    preferredCitizenId: 'citizen-a',
    matchedIdentifierOwnersByKind: {
      PHONE: ['citizen-a'],
      EMAIL: ['citizen-b'],
    },
    candidates: [
      {
        citizenId: 'citizen-a',
        createdAt: new Date('2026-05-01T09:00:00.000Z'),
        identifierCount: 1,
        ticketCount: 2,
        conversationCount: 0,
      },
      {
        citizenId: 'citizen-b',
        createdAt: new Date('2026-05-01T10:00:00.000Z'),
        identifierCount: 1,
        ticketCount: 1,
        conversationCount: 1,
      },
    ],
  });

  assert(decision.action === 'manual_review', 'conflicting owners should require manual review');
  assert(decision.reviewReason === 'CONFLICTING_IDENTIFIER_OWNERS', 'reason should explain the identifier conflict');
}

function testSelectsHighestOperationalWeight() {
  const decision = buildReconciliationDecision({
    preferredCitizenId: null,
    matchedIdentifierOwnersByKind: {
      PHONE: ['citizen-a'],
    },
    candidates: [
      {
        citizenId: 'citizen-a',
        createdAt: new Date('2026-05-01T09:00:00.000Z'),
        identifierCount: 1,
        ticketCount: 1,
        conversationCount: 0,
      },
      {
        citizenId: 'citizen-b',
        createdAt: new Date('2026-05-01T08:00:00.000Z'),
        identifierCount: 0,
        ticketCount: 3,
        conversationCount: 0,
      },
    ],
  });

  assert(decision.action === 'merge', 'non-conflicting duplicates should auto-merge');
  assert(decision.survivorCitizenId === 'citizen-b', 'highest relationship weight should win');
  assert(decision.duplicateCitizenIds.length === 1, 'one duplicate should be reported');
}

function testFallsBackToEarliestCreationTime() {
  const decision = buildReconciliationDecision({
    preferredCitizenId: null,
    matchedIdentifierOwnersByKind: {
      EMAIL: ['citizen-a'],
    },
    candidates: [
      {
        citizenId: 'citizen-a',
        createdAt: new Date('2026-05-01T09:00:00.000Z'),
        identifierCount: 1,
        ticketCount: 0,
        conversationCount: 0,
      },
      {
        citizenId: 'citizen-b',
        createdAt: new Date('2026-05-01T11:00:00.000Z'),
        identifierCount: 1,
        ticketCount: 0,
        conversationCount: 0,
      },
    ],
  });

  assert(decision.survivorCitizenId === 'citizen-a', 'earliest created citizen should win exact weight ties');
}

testDetectsConflictingIdentifierOwners();
testSelectsHighestOperationalWeight();
testFallsBackToEarliestCreationTime();

console.log('citizen identity reconciliation tests passed');
