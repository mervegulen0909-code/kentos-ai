import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  buildCitizenIdentifierInputs,
  normalizeCitizenContact,
  type CitizenIdentifierInput,
  type IntakeCitizenContact,
  type NormalizedCitizenContact,
} from '@kentos/shared';

type CitizenIdentifierSource = 'PUBLIC_WEB' | 'WEB_CHAT' | 'WHATSAPP' | 'STAFF' | 'IMPORT' | 'MERGE';

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
      const matchedIdentifiers = (await db.citizenIdentifier.findMany({
        where: {
          tenantId: input.tenantId,
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
      })) as Array<{ citizen: CitizenRecord }>;

      const rawCitizenMatches = (await db.citizen.findMany({
        where: {
          tenantId: input.tenantId,
          mergedIntoCitizenId: null,
          OR: [
            ...(normalizedContact.phone ? [{ phone: { in: this.phoneLookupVariants(normalizedContact.phone) } }] : []),
            ...(normalizedContact.email ? [{ email: normalizedContact.email }] : []),
          ],
        },
        include: { identifiers: true },
      })) as CitizenRecord[];

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

  async backfillTenantCitizens(tenantId: string) {
    const citizens = (await (this.prisma as DbClient).citizen.findMany({
      where: { tenantId },
      include: { identifiers: true },
      orderBy: { createdAt: 'asc' },
    })) as CitizenRecord[];

    for (const citizen of citizens) {
      const normalizedContact = normalizeCitizenContact({
        displayName: citizen.displayName,
        phone: citizen.phone,
        email: citizen.email,
      });
      const identifiers = buildCitizenIdentifierInputs(normalizedContact);
      if (!identifiers.length) continue;

      await this.prisma.$transaction(async (tx) => {
        const db = tx as DbClient;
        const matchedIdentifiers = (await db.citizenIdentifier.findMany({
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
        })) as Array<{ citizen: CitizenRecord }>;

        const survivor = await this.reconcileCitizenCluster(db, {
          tenantId,
          matchedIdentifiers,
          normalizedContact,
          preferredCitizenId: citizen.id,
          seedCitizenId: citizen.id,
        });

        await this.syncCitizenIdentifiers(db, {
          tenantId,
          citizen: survivor,
          identifiers,
          displayName: normalizedContact.displayName,
          source: 'IMPORT',
        });
      });
    }
  }

  private async reconcileCitizenCluster(
    db: DbClient,
    input: {
      tenantId: string;
      matchedIdentifiers: Array<{ citizen: CitizenRecord }>;
      rawCitizens?: CitizenRecord[];
      normalizedContact: NormalizedCitizenContact;
      preferredCitizenId: string | null;
      seedCitizenId?: string;
    },
  ): Promise<CitizenRecord> {
    const byId = new Map<string, CitizenRecord>();

    for (const match of input.matchedIdentifiers) {
      const citizen = match.citizen;
      if (!citizen || citizen.mergedIntoCitizenId) continue;
      byId.set(citizen.id, citizen);
    }

    for (const citizen of input.rawCitizens ?? []) {
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

    const citizens = [...byId.values()];
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

    const weightedCitizens = await Promise.all(
      citizens.map(async (citizen) => {
        const [ticketCount, conversationCount] = await Promise.all([
          db.ticket.count({ where: { tenantId: input.tenantId, citizenId: citizen.id } }),
          db.conversation.count({ where: { tenantId: input.tenantId, citizenId: citizen.id } }),
        ]);

        return {
          citizen,
          weight: ticketCount * 10 + conversationCount * 3 + citizen.identifiers.length,
        };
      }),
    );

    weightedCitizens.sort((left, right) => {
      const preferredDelta = Number(right.citizen.id === input.preferredCitizenId) - Number(left.citizen.id === input.preferredCitizenId);
      if (preferredDelta !== 0) return preferredDelta;
      if (right.weight !== left.weight) return right.weight - left.weight;
      return left.citizen.createdAt.getTime() - right.citizen.createdAt.getTime();
    });

    const survivor = weightedCitizens[0]?.citizen;
    if (!survivor) throw new Error('Canonical citizen could not be selected.');

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
