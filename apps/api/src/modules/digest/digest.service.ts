import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { DigestQueueService } from './digest-queue.service.js';

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DigestQueueService) private readonly queue: DigestQueueService,
  ) {}

  async triggerDigest(user: AuthenticatedUser, targetEmail?: string) {
    const email = targetEmail ?? user.email;
    await this.queue.enqueueOnce(user.tenantId, email);
    return { ok: true, scheduledFor: email };
  }

  async scheduleWeeklyDigest(user: AuthenticatedUser, targetEmail?: string) {
    const email = targetEmail ?? user.email;
    await this.queue.scheduleWeekly(user.tenantId, email);
    return { ok: true, scheduledFor: email, frequency: 'weekly' };
  }

  async buildDigestPayload(tenantId: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [opened, resolved, breached, byCategory, bySentiment, avgResolutionHours] = await Promise.all([
      this.prisma.ticket.count({ where: { tenantId, createdAt: { gte: weekAgo } } }),
      this.prisma.ticket.count({ where: { tenantId, resolvedAt: { gte: weekAgo } } }),
      this.prisma.ticket.count({ where: { tenantId, slaBreachedAt: { gte: weekAgo, not: null } } }),
      this.prisma.ticket.groupBy({
        by: ['categoryId'],
        where: { tenantId, createdAt: { gte: weekAgo } },
        _count: { _all: true },
        orderBy: { _count: { categoryId: 'desc' } },
        take: 5,
      }),
      this.prisma.$queryRaw<Array<{ priority: string; count: bigint }>>`
        SELECT "priority", COUNT(*)::int as count
        FROM "Ticket"
        WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${weekAgo}
        GROUP BY "priority"
        ORDER BY count DESC
      `,
      this.prisma.$queryRaw<Array<{ avg_hours: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600) as avg_hours
        FROM "Ticket"
        WHERE "tenantId" = ${tenantId} AND "resolvedAt" >= ${weekAgo}
      `,
    ]);

    const categoryDetails = await Promise.all(
      byCategory.map(async (row) => {
        if (!row.categoryId) return { name: 'Kategorisiz', count: row._count._all };
        const cat = await this.prisma.category.findUnique({ where: { id: row.categoryId }, select: { name: true } });
        return { name: cat?.name ?? row.categoryId, count: row._count._all };
      }),
    );

    return {
      period: { from: weekAgo.toISOString(), to: now.toISOString() },
      summary: { opened, resolved, breached, avgResolutionHours: avgResolutionHours[0]?.avg_hours ?? null },
      topCategories: categoryDetails,
      priorityBreakdown: bySentiment.map((r) => ({ priority: r.priority, count: Number(r.count) })),
    };
  }
}
