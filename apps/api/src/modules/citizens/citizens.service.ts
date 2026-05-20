import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType } from '@kentos/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

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

  async anonymize(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ anonymized: boolean; citizenId: string }> {
    const existing = await this.prisma.citizen.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Citizen "${id}" not found.`);
    }

    await this.prisma.$transaction([
      this.prisma.citizen.update({
        where: { id },
        data: {
          displayName: null,
          phone: null,
          email: null,
          kvkkConsentAt: null,
        },
      }),
      this.prisma.citizenIdentifier.deleteMany({
        where: { citizenId: id },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorType: AuditActorType.USER,
          actorUserId: user.id,
          action: 'citizen.anonymized',
          after: { citizenId: id },
        },
      }),
    ]);

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
