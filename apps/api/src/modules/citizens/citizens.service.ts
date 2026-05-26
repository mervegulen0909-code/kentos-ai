import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, Prisma } from '@kentos/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { MergeCitizenDto } from './dto/merge-citizen.dto.js';

const ERASED_TEXT = '[KVKK gereği silindi]';

interface ListFilters {
  q?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class CitizensService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    user: AuthenticatedUser,
    filters: ListFilters,
  ): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      mergedIntoCitizenId: null,
      ...(filters.q
        ? {
            OR: [
              {
                displayName: {
                  contains: filters.q,
                  mode: 'insensitive' as const,
                },
              },
              {
                phone: { contains: filters.q, mode: 'insensitive' as const },
              },
              {
                email: { contains: filters.q, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.citizen.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { tickets: true },
          },
        },
      }),
      this.prisma.citizen.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async get(user: AuthenticatedUser, id: string): Promise<unknown> {
    const citizen = await this.prisma.citizen.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        tickets: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            ticketNo: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
        identifiers: true,
      },
    });

    if (!citizen) {
      throw new NotFoundException(`Citizen "${id}" not found.`);
    }

    return citizen;
  }

  async merge(user: AuthenticatedUser, sourceId: string, dto: MergeCitizenDto) {
    const { mergeIntoId } = dto;

    if (sourceId === mergeIntoId) {
      throw new BadRequestException('Source and target citizen must be different');
    }

    const [source, target] = await Promise.all([
      this.prisma.citizen.findUnique({ where: { id: sourceId } }),
      this.prisma.citizen.findUnique({ where: { id: mergeIntoId } }),
    ]);

    if (!source || source.tenantId !== user.tenantId) {
      throw new NotFoundException('Citizen not found');
    }
    if (!target || target.tenantId !== user.tenantId) {
      throw new NotFoundException('Target citizen not found');
    }
    if (source.mergedIntoCitizenId) {
      throw new BadRequestException('Source citizen is already merged into another citizen');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.updateMany({
        where: { tenantId: user.tenantId, citizenId: sourceId },
        data: { citizenId: mergeIntoId },
      });
      await tx.conversation.updateMany({
        where: { tenantId: user.tenantId, citizenId: sourceId },
        data: { citizenId: mergeIntoId },
      });

      const sourceIdentifiers = await tx.citizenIdentifier.findMany({ where: { citizenId: sourceId } });
      const targetIdentifiers = await tx.citizenIdentifier.findMany({ where: { citizenId: mergeIntoId } });
      const targetKeys = new Set(targetIdentifiers.map((i) => `${i.kind}:${i.normalizedValue}`));

      for (const identifier of sourceIdentifiers) {
        const key = `${identifier.kind}:${identifier.normalizedValue}`;
        if (targetKeys.has(key)) {
          await tx.citizenIdentifier.delete({ where: { id: identifier.id } });
        } else {
          await tx.citizenIdentifier.update({ where: { id: identifier.id }, data: { citizenId: mergeIntoId } });
        }
      }

      await tx.citizen.update({
        where: { id: sourceId },
        data: { mergedIntoCitizenId: mergeIntoId, mergedAt: now },
      });

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorType: AuditActorType.USER,
          actorUserId: user.id,
          action: 'citizen.merged',
          after: { sourceId, mergeIntoId },
        },
      });
    });

    return { merged: true, sourceId, mergeIntoId, mergedAt: now.toISOString() };
  }

  async anonymize(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ anonymized: boolean; citizenId: string }> {
    return this.eraseByIdForTenant(user.tenantId, id, {
      actorType: AuditActorType.USER,
      actorUserId: user.id,
    });
  }

  async selfErase(
    tenantId: string,
    citizenId: string,
  ): Promise<{ anonymized: boolean; citizenId: string }> {
    return this.eraseByIdForTenant(tenantId, citizenId, {
      actorType: AuditActorType.CITIZEN,
    });
  }

  private async eraseByIdForTenant(
    tenantId: string,
    id: string,
    actor: { actorType: AuditActorType; actorUserId?: string },
  ): Promise<{ anonymized: boolean; citizenId: string }> {
    const existing = await this.prisma.citizen.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Citizen "${id}" not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      const ticketIds = (
        await tx.ticket.findMany({ where: { citizenId: id }, select: { id: true } })
      ).map((t) => t.id);

      const conversationIds = (
        await tx.conversation.findMany({ where: { citizenId: id }, select: { id: true } })
      ).map((c) => c.id);

      await tx.citizen.update({
        where: { id },
        data: { displayName: null, phone: null, email: null, firebaseUid: null, kvkkConsentAt: null },
      });

      await tx.citizenIdentifier.deleteMany({ where: { citizenId: id } });
      await tx.citizenDeviceToken.deleteMany({ where: { citizenId: id } });

      if (ticketIds.length > 0) {
        await tx.ticket.updateMany({
          where: { id: { in: ticketIds } },
          data: { title: ERASED_TEXT, description: ERASED_TEXT, addressText: null },
        });
        await tx.ticketMessage.updateMany({
          where: { ticketId: { in: ticketIds }, senderType: AuditActorType.CITIZEN },
          data: { body: ERASED_TEXT },
        });
      }

      if (conversationIds.length > 0) {
        await tx.conversation.updateMany({
          where: { id: { in: conversationIds } },
          data: { context: Prisma.DbNull },
        });
        await tx.outboundDelivery.updateMany({
          where: { conversationId: { in: conversationIds } },
          data: { recipientPhone: null, recipientEmail: null, body: ERASED_TEXT },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorType: actor.actorType,
          actorUserId: actor.actorUserId,
          action: 'citizen.anonymized',
          after: {
            citizenId: id,
            cascadeTickets: ticketIds.length,
            cascadeConversations: conversationIds.length,
          },
        },
      });
    });

    return { anonymized: true, citizenId: id };
  }

  async export(user: AuthenticatedUser, id: string): Promise<unknown> {
    const citizen = await this.prisma.citizen.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        tickets: true,
        identifiers: true,
      },
    });

    if (!citizen) {
      throw new NotFoundException(`Citizen "${id}" not found.`);
    }

    return {
      exportedAt: new Date().toISOString(),
      citizen: {
        id: citizen.id,
        tenantId: citizen.tenantId,
        displayName: citizen.displayName,
        phone: citizen.phone,
        email: citizen.email,
        kvkkConsentAt: citizen.kvkkConsentAt,
        createdAt: citizen.createdAt,
        updatedAt: citizen.updatedAt,
      },
      identifiers: citizen.identifiers,
      tickets: citizen.tickets.map((t) => ({
        id: t.id,
        ticketNo: t.ticketNo,
        title: t.title,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        resolvedAt: t.resolvedAt,
      })),
    };
  }
}
