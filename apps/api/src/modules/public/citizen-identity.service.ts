import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  buildCitizenIdentifierInputs,
  normalizeCitizenContact,
  type CitizenIdentifierInput,
  type IntakeCitizenContact,
  type NormalizedCitizenContact,
} from '@kentos/shared';
import { buildReconciliationDecision, type ReconciliationReviewReason, type ReconciliationScorecardEntry } from './citizen-identity-reconciliation.js';

type CitizenIdentifierSource =
  | 'PUBLIC_WEB'
  | 'WEB_CHAT'
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'SMS'
  | 'EMAIL'
  | 'STAFF'
  | 'IMPORT'
  | 'MERGE';

type CitizenIdentifierRecord = {
  id: string;
  tenantId: string;
  citizenId: string;
  kind: 'PHONE' | 'EMAIL';
  normalizedValue: string;
  isPrimary: boolean;
  isVerified: boolean;
  source: CitizenIdentifierSource;
  createdAt: Date;
  updatedAt: Date;
};

type CitizenRecord = {
  id: string;
  tenantId: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  mergedIntoCitizenId: string | null;
  mergedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  identifiers: CitizenIdentifierRecord[];
};

type MatchedIdentifierRecord = {
  kind: 'PHONE' | 'EMAIL';
  normalizedValue: string;
  citizen: CitizenRecord;
};

type WeightedCitizen = {
  citizen: CitizenRecord;
  ticketCount: number;
  conversationCount: number;
  weight: number;
};

type IdentifierSyncPlan = {
  desiredIdentifierCount: number;
  missingIdentifierCount: number;
};

export type TenantCitizenBackfillMode = 'dry-run' | 'apply';

export type TenantCitizenBackfillClusterReport = {
  seedCitizenId: string;
  clusterCitizenIds: string[];
  action: 'skipped_no_identifiers' | 'noop' | 'sync_identifiers' | 'merge' | 'manual_review';
  survivorCitizenId: string | null;
  duplicateCitizenIds: string[];
  matchedIdentifierValues: Array<{ kind: 'PHONE' | 'EMAIL'; normalizedValue: string; citizenId: string }>;
  normalizedContact: NormalizedCitizenContact;
  scorecard: ReconciliationScorecardEntry[];
  reviewReason: ReconciliationReviewReason | null;
  ticketRepointCount: number;
  conversationRepointCount: number;
  identifierTransferCount: number;
  identifierSyncPlan: IdentifierSyncPlan;
};

export type TenantCitizenBackfillReport = {
  tenantId: string;
  mode: TenantCitizenBackfillMode;
  startedAt: string;
  completedAt: string;
  totals: {
    scannedCitizenCount: number;
    processedClusterCount: number;
    skippedNoIdentifierCount: number;
    noopCount: number;
    syncIdentifierCount: number;
    mergeCount: number;
    manualReviewCount: number;
    ticketRepointCount: number;
    conversationRepointCount: number;
    identifierTransferCount: number;
  };
  clusters: TenantCitizenBackfillClusterReport[];
  exceptions: TenantCitizenBackfillClusterReport[];
  readiness: {
    readyForPhase3: boolean;
    unresolvedExceptionCount: number;
    note: string;
  };
};

type DbClient = any;

@Injectable()
export class CitizenIdentityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  normalizeContact(input?: IntakeCitizenContact | null): NormalizedCitizenContact {
    return normalizeCitizenContact(input);
  }

  async resolveCitizen(input: {
    tenantId: string;
    contact?: IntakeCitizenContact | null;
    source: CitizenIdentifierSource;
    preferredCitizenId?: string | null;
  }): Promise<CitizenRecord | null> {
    const normalizedContact = normalizeCitizenContact(input.contact);
    const identifiers = buildCitizenIdentifierInputs(normalizedContact);

    if (!identifiers.length) return null;

    return this.prisma.$transaction(async (tx) => {
      const db = tx as DbClient;
      const matchedIdentifiers = await this.findMatchedIdentifiers(db, input.tenantId, identifiers);
      const rawCitizenMatches = await this.findRawCitizenMatches(db, input.tenantId, normalizedContact);

      const canonicalCitizen = matchedIdentifiers.length || rawCitizenMatches.length
        ? await this.reconcileCitizenCluster(db, {
            tenantId: input.tenantId,
            matchedIdentifiers,
            rawCitizens: rawCitizenMatches,
            normalizedContact,
            preferredCitizenId: input.preferredCitizenId ?? null,
          })
        : ((await db.citizen.create({
            data: {
              tenantId: input.tenantId,
              displayName: normalizedContact.displayName,
              phone: normalizedContact.phone,
              email: normalizedContact.email,
            },
            include: { identifiers: true },
          })) as CitizenRecord);

      return this.syncCitizenIdentifiers(db, {
        tenantId: input.tenantId,
        citizen: canonicalCitizen,
        identifiers,
        displayName: normalizedContact.displayName,
        source: input.source,
      });
    });
  }

  async backfillTenantCitizens(input: string | { tenantId: string; mode?: TenantCitizenBackfillMode }): Promise<TenantCitizenBackfillReport> {
    const tenantId = typeof input === 'string' ? input : input.tenantId;
    const mode = typeof input === 'string' ? 'dry-run' : input.mode ?? 'dry-run';
    const startedAt = new Date().toISOString();

    const citizens = (await (this.prisma as DbClient).citizen.findMany({
      where: { tenantId, mergedIntoCitizenId: null },
      include: { identifiers: true },
      orderBy: { createdAt: 'asc' },
    })) as CitizenRecord[];

    const processedClusterKeys = new Set<string>();
    const clusters: TenantCitizenBackfillClusterReport[] = [];

    for (const citizen of citizens) {
      const normalizedContact = normalizeCitizenContact({
        displayName: citizen.displayName,
        phone: citizen.phone,
        email: citizen.email,
      });
      const identifiers = buildCitizenIdentifierInputs(normalizedContact);

      if (!identifiers.length) {
        clusters.push({
          seedCitizenId: citizen.id,
          clusterCitizenIds: [citizen.id],
          action: 'skipped_no_identifiers',
          survivorCitizenId: citizen.id,
          duplicateCitizenIds: [],
          matchedIdentifierValues: [],
          normalizedContact,
          scorecard: [],
          reviewReason: null,
          ticketRepointCount: 0,
          conversationRepointCount: 0,
          identifierTransferCount: 0,
          identifierSyncPlan: { desiredIdentifierCount: 0, missingIdentifierCount: 0 },
        });
        continue;
      }

      const clusterReport = await this.prisma.$transaction(async (tx) => {
        const db = tx as DbClient;
        const matchedIdentifiers = await this.findMatchedIdentifiers(db, tenantId, identifiers);
        const rawCitizenMatches = await this.findRawCitizenMatches(db, tenantId, normalizedContact);
        const clusterCitizens = await this.collectClusterCitizens(db, {
          tenantId,
          matchedIdentifiers,
          rawCitizens: rawCitizenMatches,
          seedCitizenId: citizen.id,
        });

        const clusterKey = this.buildClusterKey(clusterCitizens);
        if (processedClusterKeys.has(clusterKey)) {
          return null;
        }
        processedClusterKeys.add(clusterKey);

        const weightedCitizens = await this.loadWeightedCitizens(db, tenantId, clusterCitizens);
        const aggregatedIdentifiers = this.collectClusterIdentifiers(clusterCitizens);
        const decision = buildReconciliationDecision({
          candidates: weightedCitizens.map((entry) => ({
            citizenId: entry.citizen.id,
            createdAt: entry.citizen.createdAt,
            identifierCount: entry.citizen.identifiers.length,
            ticketCount: entry.ticketCount,
            conversationCount: entry.conversationCount,
          })),
          preferredCitizenId: citizen.id,
          matchedIdentifierOwnersByKind: this.buildMatchedIdentifierOwnersByKind(matchedIdentifiers),
        });

        const survivor = clusterCitizens.find((entry) => entry.id === decision.survivorCitizenId) ?? clusterCitizens[0];
        if (!survivor) {
          throw new InternalServerErrorException('Backfill survivor could not be resolved.');
        }

        const duplicateCitizens = clusterCitizens.filter((entry) => decision.duplicateCitizenIds.includes(entry.id));
        const identifierSyncPlan = this.planIdentifierSync(survivor, aggregatedIdentifiers);
        const report: TenantCitizenBackfillClusterReport = {
          seedCitizenId: citizen.id,
          clusterCitizenIds: clusterCitizens.map((entry) => entry.id),
          action: decision.action === 'manual_review'
            ? 'manual_review'
            : decision.duplicateCitizenIds.length
              ? 'merge'
              : identifierSyncPlan.missingIdentifierCount > 0
                ? 'sync_identifiers'
                : 'noop',
          survivorCitizenId: survivor.id,
          duplicateCitizenIds: decision.duplicateCitizenIds,
          matchedIdentifierValues: matchedIdentifiers.map((entry) => ({
            kind: entry.kind,
            normalizedValue: entry.normalizedValue,
            citizenId: entry.citizen.id,
          })),
          normalizedContact,
          scorecard: decision.scorecard,
          reviewReason: decision.reviewReason,
          ticketRepointCount: duplicateCitizens.reduce((sum, entry) => sum + (weightedCitizens.find((weighted) => weighted.citizen.id === entry.id)?.ticketCount ?? 0), 0),
          conversationRepointCount: duplicateCitizens.reduce((sum, entry) => sum + (weightedCitizens.find((weighted) => weighted.citizen.id === entry.id)?.conversationCount ?? 0), 0),
          identifierTransferCount: duplicateCitizens.reduce((sum, entry) => sum + entry.identifiers.length, 0),
          identifierSyncPlan,
        };

        if (decision.action === 'manual_review' || mode === 'dry-run') {
          return report;
        }

        const reconciledCitizen = await this.reconcileCitizenCluster(db, {
          tenantId,
          matchedIdentifiers,
          rawCitizens: rawCitizenMatches,
          normalizedContact,
          preferredCitizenId: citizen.id,
          seedCitizenId: citizen.id,
        });

        await this.syncCitizenIdentifiers(db, {
          tenantId,
          citizen: reconciledCitizen,
          identifiers: aggregatedIdentifiers,
          displayName: this.pickDisplayName(clusterCitizens),
          source: 'IMPORT',
        });

        return report;
      });

      if (clusterReport) {
        clusters.push(clusterReport);
      }
    }

    const totals = {
      scannedCitizenCount: citizens.length,
      processedClusterCount: clusters.length,
      skippedNoIdentifierCount: clusters.filter((cluster) => cluster.action === 'skipped_no_identifiers').length,
      noopCount: clusters.filter((cluster) => cluster.action === 'noop').length,
      syncIdentifierCount: clusters.filter((cluster) => cluster.action === 'sync_identifiers').length,
      mergeCount: clusters.filter((cluster) => cluster.action === 'merge').length,
      manualReviewCount: clusters.filter((cluster) => cluster.action === 'manual_review').length,
      ticketRepointCount: clusters.reduce((sum, cluster) => sum + cluster.ticketRepointCount, 0),
      conversationRepointCount: clusters.reduce((sum, cluster) => sum + cluster.conversationRepointCount, 0),
      identifierTransferCount: clusters.reduce((sum, cluster) => sum + cluster.identifierTransferCount, 0),
    };

    const exceptions = clusters.filter((cluster) => cluster.action === 'manual_review');

    return {
      tenantId,
      mode,
      startedAt,
      completedAt: new Date().toISOString(),
      totals,
      clusters,
      exceptions,
      readiness: {
        readyForPhase3: exceptions.length === 0,
        unresolvedExceptionCount: exceptions.length,
        note: exceptions.length === 0
          ? 'Phase 3 unique enforcement can proceed after final verification.'
          : 'Manual review clusters remain open; do not add Phase 3 unique enforcement yet.',
      },
    };
  }

  private async reconcileCitizenCluster(
    db: DbClient,
    input: {
      tenantId: string;
      matchedIdentifiers: MatchedIdentifierRecord[];
      rawCitizens?: CitizenRecord[];
      normalizedContact: NormalizedCitizenContact;
      preferredCitizenId: string | null;
      seedCitizenId?: string;
    },
  ): Promise<CitizenRecord> {
    const citizens = await this.collectClusterCitizens(db, {
      tenantId: input.tenantId,
      matchedIdentifiers: input.matchedIdentifiers,
      rawCitizens: input.rawCitizens ?? [],
      seedCitizenId: input.seedCitizenId,
    });

    if (!citizens.length) {
      return (await db.citizen.create({
        data: {
          tenantId: input.tenantId,
          displayName: input.normalizedContact.displayName,
          phone: input.normalizedContact.phone,
          email: input.normalizedContact.email,
        },
        include: { identifiers: true },
      })) as CitizenRecord;
    }

    const weightedCitizens = await this.loadWeightedCitizens(db, input.tenantId, citizens);
    const weightedMap = new Map(weightedCitizens.map((entry) => [entry.citizen.id, entry]));

    weightedCitizens.sort((left, right) => {
      const preferredDelta = Number(right.citizen.id === input.preferredCitizenId) - Number(left.citizen.id === input.preferredCitizenId);
      if (preferredDelta !== 0) return preferredDelta;
      if (right.weight !== left.weight) return right.weight - left.weight;
      return left.citizen.createdAt.getTime() - right.citizen.createdAt.getTime();
    });

    const survivor = weightedCitizens[0]?.citizen;
    if (!survivor) throw new InternalServerErrorException('Canonical citizen could not be selected.');

    const duplicates = weightedCitizens.slice(1).map((entry) => entry.citizen);
    if (!duplicates.length) {
      return (await db.citizen.update({
        where: { id: survivor.id },
        data: {
          displayName: survivor.displayName ?? input.normalizedContact.displayName,
          phone: survivor.phone ?? input.normalizedContact.phone,
          email: survivor.email ?? input.normalizedContact.email,
        },
        include: { identifiers: true },
      })) as CitizenRecord;
    }

    const duplicateIds = duplicates.map((duplicate) => duplicate.id);
    const mergedAt = new Date();

    await db.ticket.updateMany({
      where: { tenantId: input.tenantId, citizenId: { in: duplicateIds } },
      data: { citizenId: survivor.id },
    });

    await db.conversation.updateMany({
      where: { tenantId: input.tenantId, citizenId: { in: duplicateIds } },
      data: { citizenId: survivor.id },
    });

    await db.citizenIdentifier.updateMany({
      where: { tenantId: input.tenantId, citizenId: { in: duplicateIds } },
      data: { citizenId: survivor.id, source: 'MERGE' },
    });

    await db.citizen.updateMany({
      where: { tenantId: input.tenantId, id: { in: duplicateIds } },
      data: { mergedIntoCitizenId: survivor.id, mergedAt },
    });

    return (await db.citizen.update({
      where: { id: survivor.id },
      data: {
        displayName: survivor.displayName ?? input.normalizedContact.displayName,
        phone: survivor.phone ?? input.normalizedContact.phone,
        email: survivor.email ?? input.normalizedContact.email,
      },
      include: { identifiers: true },
    })) as CitizenRecord;
  }

  private async syncCitizenIdentifiers(
    db: DbClient,
    input: {
      tenantId: string;
      citizen: CitizenRecord;
      identifiers: CitizenIdentifierInput[];
      displayName: string | null;
      source: CitizenIdentifierSource;
    },
  ): Promise<CitizenRecord> {
    const seen = new Set<string>();

    for (const identifier of input.identifiers) {
      const key = `${identifier.kind}:${identifier.normalizedValue}`;
      if (seen.has(key)) continue;
      seen.add(key);

      await db.citizenIdentifier.upsert({
        where: {
          tenantId_kind_normalizedValue: {
            tenantId: input.tenantId,
            kind: identifier.kind,
            normalizedValue: identifier.normalizedValue,
          },
        },
        update: {
          citizenId: input.citizen.id,
          source: input.source,
        },
        create: {
          tenantId: input.tenantId,
          citizenId: input.citizen.id,
          kind: identifier.kind,
          normalizedValue: identifier.normalizedValue,
          isPrimary:
            identifier.kind === 'PHONE'
              ? input.citizen.phone === identifier.normalizedValue || !input.citizen.phone
              : input.citizen.email === identifier.normalizedValue || !input.citizen.email,
          isVerified: false,
          source: input.source,
        },
      });
    }

    return (await db.citizen.update({
      where: { id: input.citizen.id },
      data: {
        displayName: input.citizen.displayName ?? input.displayName,
        phone: input.citizen.phone ?? input.identifiers.find((identifier) => identifier.kind === 'PHONE')?.normalizedValue ?? null,
        email: input.citizen.email ?? input.identifiers.find((identifier) => identifier.kind === 'EMAIL')?.normalizedValue ?? null,
      },
      include: { identifiers: true },
    })) as CitizenRecord;
  }

  private async findMatchedIdentifiers(db: DbClient, tenantId: string, identifiers: CitizenIdentifierInput[]): Promise<MatchedIdentifierRecord[]> {
    if (!identifiers.length) return [];

    return (await db.citizenIdentifier.findMany({
      where: {
        tenantId,
        OR: identifiers.map((identifier) => ({
          kind: identifier.kind,
          normalizedValue: identifier.normalizedValue,
        })),
      },
      include: {
        citizen: {
          include: {
            identifiers: true,
          },
        },
      },
    })) as MatchedIdentifierRecord[];
  }

  private async findRawCitizenMatches(db: DbClient, tenantId: string, normalizedContact: NormalizedCitizenContact): Promise<CitizenRecord[]> {
    const orClauses = [
      ...(normalizedContact.phone ? [{ phone: { in: this.phoneLookupVariants(normalizedContact.phone) } }] : []),
      ...(normalizedContact.email ? [{ email: normalizedContact.email }] : []),
    ];

    if (!orClauses.length) return [];

    return (await db.citizen.findMany({
      where: {
        tenantId,
        mergedIntoCitizenId: null,
        OR: orClauses,
      },
      include: { identifiers: true },
    })) as CitizenRecord[];
  }

  private async collectClusterCitizens(
    db: DbClient,
    input: {
      tenantId: string;
      matchedIdentifiers: MatchedIdentifierRecord[];
      rawCitizens: CitizenRecord[];
      seedCitizenId?: string;
    },
  ): Promise<CitizenRecord[]> {
    const byId = new Map<string, CitizenRecord>();

    for (const match of input.matchedIdentifiers) {
      const citizen = match.citizen;
      if (!citizen || citizen.mergedIntoCitizenId) continue;
      byId.set(citizen.id, citizen);
    }

    for (const citizen of input.rawCitizens) {
      if (!citizen || citizen.mergedIntoCitizenId) continue;
      byId.set(citizen.id, citizen);
    }

    if (input.seedCitizenId) {
      const existing = (await db.citizen.findUnique({
        where: { id: input.seedCitizenId },
        include: { identifiers: true },
      })) as CitizenRecord | null;

      if (existing?.tenantId === input.tenantId && !existing.mergedIntoCitizenId) {
        byId.set(existing.id, existing);
      }
    }

    return [...byId.values()];
  }

  private async loadWeightedCitizens(db: DbClient, tenantId: string, citizens: CitizenRecord[]): Promise<WeightedCitizen[]> {
    return Promise.all(
      citizens.map(async (citizen) => {
        const [ticketCount, conversationCount] = await Promise.all([
          db.ticket.count({ where: { tenantId, citizenId: citizen.id } }),
          db.conversation.count({ where: { tenantId, citizenId: citizen.id } }),
        ]);

        return {
          citizen,
          ticketCount,
          conversationCount,
          weight: ticketCount * 10 + conversationCount * 3 + citizen.identifiers.length,
        } satisfies WeightedCitizen;
      }),
    );
  }

  private buildMatchedIdentifierOwnersByKind(matchedIdentifiers: MatchedIdentifierRecord[]) {
    return matchedIdentifiers.reduce<Partial<Record<'PHONE' | 'EMAIL', string[]>>>((acc, match) => {
      const existing = acc[match.kind] ?? [];
      acc[match.kind] = [...existing, match.citizen.id];
      return acc;
    }, {});
  }

  private collectClusterIdentifiers(citizens: CitizenRecord[]): CitizenIdentifierInput[] {
    const byKey = new Map<string, CitizenIdentifierInput>();

    for (const citizen of citizens) {
      const normalizedContact = normalizeCitizenContact({
        displayName: citizen.displayName,
        phone: citizen.phone,
        email: citizen.email,
      });

      for (const identifier of buildCitizenIdentifierInputs(normalizedContact)) {
        byKey.set(`${identifier.kind}:${identifier.normalizedValue}`, identifier);
      }

      for (const identifier of citizen.identifiers) {
        byKey.set(`${identifier.kind}:${identifier.normalizedValue}`, {
          kind: identifier.kind,
          normalizedValue: identifier.normalizedValue,
        });
      }
    }

    return [...byKey.values()];
  }

  private planIdentifierSync(citizen: CitizenRecord, identifiers: CitizenIdentifierInput[]): IdentifierSyncPlan {
    const existingKeys = new Set(citizen.identifiers.map((identifier) => `${identifier.kind}:${identifier.normalizedValue}`));
    const desiredKeys = new Set(identifiers.map((identifier) => `${identifier.kind}:${identifier.normalizedValue}`));

    let missingIdentifierCount = 0;
    for (const key of desiredKeys) {
      if (!existingKeys.has(key)) {
        missingIdentifierCount += 1;
      }
    }

    return {
      desiredIdentifierCount: desiredKeys.size,
      missingIdentifierCount,
    };
  }

  private pickDisplayName(citizens: CitizenRecord[]) {
    return citizens.find((citizen) => citizen.displayName)?.displayName ?? null;
  }

  private buildClusterKey(citizens: CitizenRecord[]) {
    return citizens.map((citizen) => citizen.id).sort().join(':');
  }

  private phoneLookupVariants(normalizedPhone: string) {
    const variants = new Set([normalizedPhone]);

    if (normalizedPhone.startsWith('90') && normalizedPhone.length === 12) {
      const local = normalizedPhone.slice(2);
      variants.add(`+${normalizedPhone}`);
      variants.add(`0${local}`);
      variants.add(local);
    }

    return [...variants];
  }
}
