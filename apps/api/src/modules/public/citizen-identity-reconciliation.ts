export type ReconciliationIdentifierKind = 'PHONE' | 'EMAIL';

export type ReconciliationCandidate = {
  citizenId: string;
  createdAt: Date;
  identifierCount: number;
  ticketCount: number;
  conversationCount: number;
};

export type ReconciliationScorecardEntry = {
  citizenId: string;
  isPreferred: boolean;
  weight: number;
  ticketCount: number;
  conversationCount: number;
  identifierCount: number;
  createdAt: string;
};

export type ReconciliationReviewReason = 'CONFLICTING_IDENTIFIER_OWNERS' | 'TIED_CANONICAL_SCORE';

export type ReconciliationDecision = {
  action: 'noop' | 'merge' | 'manual_review';
  survivorCitizenId: string;
  duplicateCitizenIds: string[];
  reviewReason: ReconciliationReviewReason | null;
  scorecard: ReconciliationScorecardEntry[];
};

function computeWeight(candidate: ReconciliationCandidate) {
  return candidate.ticketCount * 10 + candidate.conversationCount * 3 + candidate.identifierCount;
}

function hasConflictingIdentifierOwners(input: {
  matchedIdentifierOwnersByKind: Partial<Record<ReconciliationIdentifierKind, string[]>>;
}) {
  const phoneOwners = [...new Set(input.matchedIdentifierOwnersByKind.PHONE ?? [])];
  const emailOwners = [...new Set(input.matchedIdentifierOwnersByKind.EMAIL ?? [])];

  if (phoneOwners.length > 1 || emailOwners.length > 1) return true;
  if (phoneOwners.length === 1 && emailOwners.length === 1 && phoneOwners[0] !== emailOwners[0]) return true;

  return false;
}

export function buildReconciliationDecision(input: {
  candidates: ReconciliationCandidate[];
  preferredCitizenId?: string | null;
  matchedIdentifierOwnersByKind: Partial<Record<ReconciliationIdentifierKind, string[]>>;
}): ReconciliationDecision {
  if (!input.candidates.length) {
    throw new Error('At least one reconciliation candidate is required.');
  }

  const ranked = [...input.candidates]
    .map((candidate) => ({
      citizenId: candidate.citizenId,
      isPreferred: candidate.citizenId === (input.preferredCitizenId ?? null),
      weight: computeWeight(candidate),
      ticketCount: candidate.ticketCount,
      conversationCount: candidate.conversationCount,
      identifierCount: candidate.identifierCount,
      createdAt: candidate.createdAt,
    }))
    .sort((left, right) => {
      const preferredDelta = Number(right.isPreferred) - Number(left.isPreferred);
      if (preferredDelta !== 0) return preferredDelta;
      if (right.weight !== left.weight) return right.weight - left.weight;
      return left.createdAt.getTime() - right.createdAt.getTime();
    });

  const survivor = ranked[0];
  if (!survivor) {
    throw new Error('Canonical citizen could not be selected.');
  }

  const runnerUp = ranked[1];
  const conflictingIdentifierOwners = hasConflictingIdentifierOwners({
    matchedIdentifierOwnersByKind: input.matchedIdentifierOwnersByKind,
  });

  const tiedCanonicalScore = Boolean(
    runnerUp
      && survivor.isPreferred === runnerUp.isPreferred
      && survivor.weight === runnerUp.weight
      && survivor.createdAt.getTime() === runnerUp.createdAt.getTime(),
  );

  const reviewReason: ReconciliationReviewReason | null = conflictingIdentifierOwners
    ? 'CONFLICTING_IDENTIFIER_OWNERS'
    : tiedCanonicalScore
      ? 'TIED_CANONICAL_SCORE'
      : null;

  const duplicateCitizenIds = ranked.slice(1).map((candidate) => candidate.citizenId);

  return {
    action: reviewReason ? 'manual_review' : duplicateCitizenIds.length ? 'merge' : 'noop',
    survivorCitizenId: survivor.citizenId,
    duplicateCitizenIds,
    reviewReason,
    scorecard: ranked.map((candidate) => ({
      citizenId: candidate.citizenId,
      isPreferred: candidate.isPreferred,
      weight: candidate.weight,
      ticketCount: candidate.ticketCount,
      conversationCount: candidate.conversationCount,
      identifierCount: candidate.identifierCount,
      createdAt: candidate.createdAt.toISOString(),
    })),
  };
}
