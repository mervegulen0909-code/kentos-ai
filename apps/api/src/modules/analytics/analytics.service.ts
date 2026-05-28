import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, MessageVisibility, OutboundDeliveryState, TicketStatus } from '@kentos/database';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createRedisClient } from '../../common/redis.js';
import type { Redis } from 'ioredis';
import {
  summarizeAiUsageByProvider,
  summarizeAiUsageWindow,
  type AiRunGroupRow,
  type AiUsageReport,
  type AiUsageWindow,
} from './ai-usage.js';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private _redis?: Redis;
  private redis() {
    this._redis ??= createRedisClient();
    return this._redis;
  }

  private dateRange(from?: Date, to?: Date) {
    if (!from && !to) return undefined;
    return {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  async overview(user: AuthenticatedUser, from?: Date, to?: Date) {
    const hasRange = from || to;
    const cacheKey = hasRange ? null : `analytics:overview:${user.tenantId}`;
    if (cacheKey) {
      const cached = await this.redis().get(cacheKey).catch(() => null);
      if (cached) return JSON.parse(cached) as unknown;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const createdFilter = this.dateRange(from, to) ?? { gte: new Date(0) };

    const [totalOpen, openedToday, resolvedToday, byStatus, dueTickets] = await Promise.all([
      this.prisma.ticket.count({
        where: { tenantId: user.tenantId, status: { notIn: [TicketStatus.CLOSED, TicketStatus.REJECTED] }, createdAt: hasRange ? createdFilter : undefined },
      }),
      this.prisma.ticket.count({ where: { tenantId: user.tenantId, createdAt: hasRange ? createdFilter : { gte: today } } }),
      this.prisma.ticket.count({ where: { tenantId: user.tenantId, resolvedAt: hasRange ? createdFilter : { gte: today } } }),
      this.prisma.ticket.groupBy({ by: ['status'], where: { tenantId: user.tenantId, ...(hasRange ? { createdAt: createdFilter } : {}) }, _count: { _all: true } }),
      this.prisma.ticket.findMany({
        where: {
          tenantId: user.tenantId,
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.REJECTED] },
          resolutionDueAt: { not: null },
          ...(hasRange ? { createdAt: createdFilter } : {}),
        },
        select: { resolutionDueAt: true },
      }),
    ]);

    const now = Date.now();

    const result = {
      totalOpen,
      openedToday,
      resolvedToday,
      slaBreached: dueTickets.filter((ticket) => ticket.resolutionDueAt && ticket.resolutionDueAt.getTime() < now).length,
      slaDueSoon: dueTickets.filter((ticket) => {
        if (!ticket.resolutionDueAt) return false;
        const diff = ticket.resolutionDueAt.getTime() - now;
        return diff >= 0 && diff <= 4 * 60 * 60 * 1000;
      }).length,
      byStatus: byStatus.map((item) => ({ status: item.status, count: item._count._all })),
    };

    if (cacheKey) await this.redis().setex(cacheKey, 60, JSON.stringify(result)).catch(() => null);
    return result;
  }

  async departments(user: AuthenticatedUser, from?: Date, to?: Date) {
    const createdAt = this.dateRange(from, to);
    const departments = await this.prisma.department.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: {
        _count: {
          select: {
            tickets: {
              where: { status: { notIn: [TicketStatus.CLOSED, TicketStatus.REJECTED] }, ...(createdAt ? { createdAt } : {}) },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return departments.map((department) => ({
      id: department.id,
      name: department.name,
      code: department.code,
      openTickets: department._count.tickets,
    }));
  }

  async categories(user: AuthenticatedUser, from?: Date, to?: Date) {
    const createdAt = this.dateRange(from, to);
    const categories = await this.prisma.category.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: { _count: { select: { tickets: { where: createdAt ? { createdAt } : {} } } }, department: true },
      orderBy: { name: 'asc' },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      code: category.code,
      departmentName: category.department?.name ?? null,
      tickets: category._count.tickets,
    }));
  }

  async neighborhoods(user: AuthenticatedUser, from?: Date, to?: Date) {
    const createdAt = this.dateRange(from, to);
    const neighborhoods = await this.prisma.neighborhood.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: { _count: { select: { tickets: { where: createdAt ? { createdAt } : {} } } } },
      orderBy: { name: 'asc' },
    });

    return neighborhoods.map((neighborhood) => ({
      id: neighborhood.id,
      name: neighborhood.name,
      tickets: neighborhood._count.tickets,
    }));
  }

  async conversationSegments(user: AuthenticatedUser) {
    const [byState, handoffOpen, totalConversations, ticketsFromConversations] = await Promise.all([
      this.prisma.conversation.groupBy({
        by: ['state'],
        where: { tenantId: user.tenantId },
        _count: { _all: true },
      }),
      this.prisma.conversation.count({
        where: { tenantId: user.tenantId, handoffRequested: true, state: { not: 'TICKET_CREATED' } },
      }),
      this.prisma.conversation.count({ where: { tenantId: user.tenantId } }),
      this.prisma.conversation.count({
        where: { tenantId: user.tenantId, state: 'TICKET_CREATED', handoffRequested: false },
      }),
    ]);

    const stateMap = new Map(byState.map((row) => [row.state, row._count._all]));
    const aiCompleted = ticketsFromConversations;
    const operatorHandoff = handoffOpen;
    const awaitingInfo = (stateMap.get('OPEN') ?? 0) - operatorHandoff;
    const automationRate = totalConversations
      ? Number((aiCompleted / totalConversations).toFixed(3))
      : 0;

    return {
      totalConversations,
      aiCompleted,
      operatorHandoff,
      awaitingInfo: awaitingInfo < 0 ? 0 : awaitingInfo,
      automationRate,
    };
  }

  async aiUsage(user: AuthenticatedUser): Promise<AiUsageReport> {
    const now = new Date();
    const windows: Array<{ key: 'last24h' | 'last7d' | 'last30d'; days: number }> = [
      { key: 'last24h', days: 1 },
      { key: 'last7d', days: 7 },
      { key: 'last30d', days: 30 },
    ];
    const fetched = await Promise.all(
      windows.map(async ({ key, days }) => ({
        key,
        rows: await this.aiUsageRowsForWindow(user.tenantId, new Date(now.getTime() - days * 86_400_000)),
      })),
    );
    const summarized: Record<'last24h' | 'last7d' | 'last30d', AiUsageWindow> = {
      last24h: summarizeAiUsageWindow(fetched.find((entry) => entry.key === 'last24h')?.rows ?? []),
      last7d: summarizeAiUsageWindow(fetched.find((entry) => entry.key === 'last7d')?.rows ?? []),
      last30d: summarizeAiUsageWindow(fetched.find((entry) => entry.key === 'last30d')?.rows ?? []),
    };
    const byProvider = summarizeAiUsageByProvider(
      fetched.find((entry) => entry.key === 'last30d')?.rows ?? [],
    );
    return {
      generatedAt: now.toISOString(),
      windows: summarized,
      byProvider,
    };
  }

  private async aiUsageRowsForWindow(tenantId: string, since: Date): Promise<AiRunGroupRow[]> {
    const grouped = await this.prisma.aiRun.groupBy({
      by: ['provider'],
      where: { tenantId, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { tokensTotal: true, costMicros: true, latencyMs: true },
    });
    const successGrouped = await this.prisma.aiRun.groupBy({
      by: ['provider'],
      where: { tenantId, createdAt: { gte: since }, success: true },
      _count: { _all: true },
    });
    const successByProvider = new Map(successGrouped.map((row) => [row.provider, row._count._all]));
    return grouped.map((row) => ({
      provider: row.provider,
      runs: row._count._all,
      successCount: successByProvider.get(row.provider) ?? 0,
      tokensTotal: row._sum.tokensTotal ?? 0,
      costMicros: row._sum.costMicros ?? 0,
      totalLatencyMs: row._sum.latencyMs ?? 0,
    }));
  }

  async channels(user: AuthenticatedUser, from?: Date, to?: Date) {
    const createdAt = this.dateRange(from, to);
    const baseWhere = { tenantId: user.tenantId, ...(createdAt ? { createdAt } : {}) };
    const [ticketsByChannel, conversationsByChannel, aiCreatedMessagesByChannel, publicMessagesByChannel, attachments] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['channel'], where: baseWhere, _count: { _all: true } }),
      this.prisma.conversation.groupBy({ by: ['channel'], where: { tenantId: user.tenantId, ...(createdAt ? { createdAt } : {}) }, _count: { _all: true } }),
      this.prisma.ticketMessage.groupBy({
        by: ['channel'],
        where: { tenantId: user.tenantId, senderType: AuditActorType.AI, ...(createdAt ? { createdAt } : {}) },
        _count: { _all: true },
      }),
      this.prisma.ticketMessage.groupBy({
        by: ['channel'],
        where: { tenantId: user.tenantId, visibility: MessageVisibility.PUBLIC, ...(createdAt ? { createdAt } : {}) },
        _count: { _all: true },
      }),
      this.prisma.attachment.findMany({
        where: { tenantId: user.tenantId, checksumSha256: { not: null } },
        select: {
          ticket: { select: { channel: true } },
          message: { select: { channel: true, ticket: { select: { channel: true } } } },
        },
      }),
    ]);
    const attachmentsByChannel = new Map<string, number>();
    for (const attachment of attachments) {
      const channel = attachment.message?.channel ?? attachment.message?.ticket.channel ?? attachment.ticket?.channel;
      if (!channel) continue;
      attachmentsByChannel.set(channel, (attachmentsByChannel.get(channel) ?? 0) + 1);
    }

    const channels = new Set<string>([
      ...ticketsByChannel.map((item) => item.channel),
      ...conversationsByChannel.map((item) => item.channel),
      ...aiCreatedMessagesByChannel.flatMap((item) => item.channel ? [item.channel] : []),
      ...publicMessagesByChannel.flatMap((item) => item.channel ? [item.channel] : []),
      ...attachmentsByChannel.keys(),
    ]);

    return [...channels].sort().map((channel) => {
      const tickets = ticketsByChannel.find((item) => item.channel === channel)?._count._all ?? 0;
      const conversations = conversationsByChannel.find((item) => item.channel === channel)?._count._all ?? 0;
      const aiMessages = aiCreatedMessagesByChannel.find((item) => item.channel === channel)?._count._all ?? 0;
      const publicMessages = publicMessagesByChannel.find((item) => item.channel === channel)?._count._all ?? 0;
      const attachmentCount = attachmentsByChannel.get(channel) ?? 0;

      return {
        channel,
        tickets,
        conversations,
        publicMessages,
        aiMessages,
        attachments: attachmentCount,
        automationRate: publicMessages ? Number((aiMessages / publicMessages).toFixed(3)) : 0,
      };
    });
  }

  async outboundDeliveries(user: AuthenticatedUser, from?: Date, to?: Date) {
    const createdAt = this.dateRange(from, to);
    const baseWhere = { tenantId: user.tenantId, ...(createdAt ? { createdAt } : {}) };
    const [byState, byChannelState, recentFailures] = await Promise.all([
      this.prisma.outboundDelivery.groupBy({
        by: ['state'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.outboundDelivery.groupBy({
        by: ['channel', 'state'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.outboundDelivery.findMany({
        where: { tenantId: user.tenantId, state: OutboundDeliveryState.FAILED },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          channel: true,
          attempts: true,
          lastError: true,
          updatedAt: true,
        },
      }),
    ]);

    const stateCount = (state: OutboundDeliveryState) =>
      byState.find((row) => row.state === state)?._count._all ?? 0;
    const channels = new Set(byChannelState.map((row) => row.channel));
    const byChannel = [...channels].sort().map((channel) => {
      const count = (state: OutboundDeliveryState) =>
        byChannelState.find((row) => row.channel === channel && row.state === state)?._count._all ?? 0;
      const pending = count(OutboundDeliveryState.PENDING);
      const dispatched = count(OutboundDeliveryState.DISPATCHED);
      const delivered = count(OutboundDeliveryState.DELIVERED);
      const failed = count(OutboundDeliveryState.FAILED);
      const skipped = count(OutboundDeliveryState.SKIPPED);
      return {
        channel,
        total: pending + dispatched + delivered + failed + skipped,
        pending,
        dispatched,
        delivered,
        failed,
        skipped,
      };
    });

    return {
      total: byState.reduce((sum, row) => sum + row._count._all, 0),
      pending: stateCount(OutboundDeliveryState.PENDING),
      dispatched: stateCount(OutboundDeliveryState.DISPATCHED),
      delivered: stateCount(OutboundDeliveryState.DELIVERED),
      failed: stateCount(OutboundDeliveryState.FAILED),
      skipped: stateCount(OutboundDeliveryState.SKIPPED),
      byChannel,
      recentFailures: recentFailures.map((failure) => ({
        id: failure.id,
        channel: failure.channel,
        attempts: failure.attempts,
        lastError: failure.lastError,
        updatedAt: failure.updatedAt,
      })),
    };
  }

  // 1.4: SLA trend — daily breach / open / resolved counts
  async slaTrend(user: AuthenticatedUser, from?: Date, to?: Date) {
    const start = from ?? new Date(Date.now() - 30 * 86_400_000);
    const end = to ?? new Date();

    const rows = await this.prisma.$queryRaw<Array<{
      day: Date;
      opened: number;
      resolved: number;
      breached: number;
    }>>`
      SELECT
        DATE_TRUNC('day', "createdAt" AT TIME ZONE 'Europe/Istanbul') AS day,
        COUNT(*) FILTER (WHERE TRUE)::int AS opened,
        COUNT(*) FILTER (WHERE "resolvedAt" IS NOT NULL)::int AS resolved,
        COUNT(*) FILTER (WHERE "slaBreachedAt" IS NOT NULL)::int AS breached
      FROM "Ticket"
      WHERE "tenantId" = ${user.tenantId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
      GROUP BY DATE_TRUNC('day', "createdAt" AT TIME ZONE 'Europe/Istanbul')
      ORDER BY day ASC
    `;

    return rows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      opened: Number(row.opened),
      resolved: Number(row.resolved),
      breached: Number(row.breached),
    }));
  }

  // F7: Operator Performance Dashboard
  async operatorPerformance(user: AuthenticatedUser, from?: Date, to?: Date) {
    const since30d = from ?? new Date(Date.now() - 30 * 86_400_000);
    const until = to ?? new Date();

    const [assignedCounts, resolvedCounts, avgResolution, csatByOp] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['assignedToId'],
        where: { tenantId: user.tenantId, assignedToId: { not: null }, createdAt: { gte: since30d, lte: until } },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['assignedToId'],
        where: {
          tenantId: user.tenantId,
          assignedToId: { not: null },
          resolvedAt: { gte: since30d, lte: until, not: null },
        },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ assigned_to_id: string; avg_resolution_hours: number }>>`
        SELECT "assignedToId" AS assigned_to_id,
               ROUND(AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600.0)::numeric, 1)::float AS avg_resolution_hours
        FROM "Ticket"
        WHERE "tenantId" = ${user.tenantId}
          AND "assignedToId" IS NOT NULL
          AND "resolvedAt" IS NOT NULL
          AND "createdAt" >= ${since30d}
          AND "createdAt" <= ${until}
        GROUP BY "assignedToId"
      `,
      this.prisma.ticket.groupBy({
        by: ['assignedToId'],
        where: { tenantId: user.tenantId, assignedToId: { not: null }, csatScore: { not: null }, createdAt: { gte: since30d, lte: until } },
        _avg: { csatScore: true },
        _count: { csatScore: true },
      }),
    ]);

    // Collect all operator IDs
    const opIds = [
      ...new Set([
        ...assignedCounts.map((r) => r.assignedToId),
        ...resolvedCounts.map((r) => r.assignedToId),
      ].filter(Boolean) as string[]),
    ];

    const users = opIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: opIds } }, select: { id: true, fullName: true, email: true, role: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const resolvedMap = new Map(resolvedCounts.map((r) => [r.assignedToId, r._count._all]));
    const resolutionHoursMap = new Map(avgResolution.map((r) => [r.assigned_to_id, r.avg_resolution_hours]));
    const csatMap = new Map(csatByOp.map((r) => [r.assignedToId, { avg: r._avg.csatScore, count: r._count.csatScore }]));

    return opIds.map((id) => {
      const u = userMap.get(id);
      const assigned = assignedCounts.find((r) => r.assignedToId === id)?._count._all ?? 0;
      const resolved = resolvedMap.get(id) ?? 0;
      const csat = csatMap.get(id);
      return {
        userId: id,
        fullName: u?.fullName ?? 'Bilinmiyor',
        email: u?.email ?? '',
        role: u?.role ?? '',
        assigned,
        resolved,
        resolutionRate: assigned > 0 ? Number((resolved / assigned).toFixed(3)) : 0,
        avgResolutionHours: resolutionHoursMap.get(id) ?? null,
        csatAvg: csat?.avg ? Number(csat.avg.toFixed(2)) : null,
        csatResponses: csat?.count ?? 0,
      };
    }).sort((a, b) => b.resolved - a.resolved);
  }

  // F3: CSAT Dashboard
  async csat(user: AuthenticatedUser, from?: Date, to?: Date) {
    const createdAt = this.dateRange(from, to);
    const baseWhere = { tenantId: user.tenantId, csatScore: { not: null } as object, ...(createdAt ? { createdAt } : {}) };
    const trendSince = from ?? new Date(Date.now() - 30 * 86_400_000);
    const [overall, byDepartment, trend] = await Promise.all([
      this.prisma.ticket.aggregate({
        _avg: { csatScore: true },
        _count: { csatScore: true },
        where: baseWhere,
      }),
      this.prisma.ticket.groupBy({
        by: ['departmentId'],
        _avg: { csatScore: true },
        _count: { csatScore: true },
        where: baseWhere,
        orderBy: { _avg: { csatScore: 'desc' } },
      }),
      this.prisma.ticket.findMany({
        where: {
          tenantId: user.tenantId,
          csatScore: { not: null },
          csatRespondedAt: { gte: trendSince, ...(to ? { lte: to } : {}) },
        },
        select: { csatScore: true, csatRespondedAt: true },
        orderBy: { csatRespondedAt: 'asc' },
      }),
    ]);

    // Enrich department names
    const deptIds = byDepartment.map((d) => d.departmentId).filter(Boolean) as string[];
    const departments =
      deptIds.length > 0
        ? await this.prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
        : [];
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    // Low-scored tickets for attention
    const lowScoreTickets = await this.prisma.ticket.findMany({
      where: { tenantId: user.tenantId, csatScore: { lte: 2, not: null } },
      orderBy: { csatRespondedAt: 'desc' },
      take: 10,
      select: { id: true, ticketNo: true, csatScore: true, csatRespondedAt: true, departmentId: true },
    });

    return {
      overall: {
        avg: overall._avg.csatScore ? Number(overall._avg.csatScore.toFixed(2)) : null,
        responseCount: overall._count.csatScore,
      },
      byDepartment: byDepartment.map((row) => ({
        departmentId: row.departmentId,
        departmentName: row.departmentId ? (deptMap.get(row.departmentId) ?? null) : null,
        avg: row._avg.csatScore ? Number(row._avg.csatScore.toFixed(2)) : null,
        responseCount: row._count.csatScore,
      })),
      trend: trend.map((t) => ({ score: t.csatScore, respondedAt: t.csatRespondedAt })),
      lowScoreTickets,
    };
  }

  // F5: Transparency Portal — public aggregate stats (no PII)
  async publicStats(tenantId: string) {
    const cacheKey = `public:stats:${tenantId}`;
    const cached = await this.redis().get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as unknown;

    const [byStatus, topCategories, topDepartments, avgResolutionDays, totalTickets] =
      await Promise.all([
        this.prisma.ticket.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.ticket.groupBy({
          by: ['categoryId'],
          where: { tenantId, categoryId: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
        this.prisma.ticket.groupBy({
          by: ['departmentId'],
          where: { tenantId, departmentId: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
        this.prisma.$queryRaw<Array<{ avg_days: number }>>`
          SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 86400.0)::numeric, 1)::float AS avg_days
          FROM "Ticket"
          WHERE "tenantId" = ${tenantId} AND "resolvedAt" IS NOT NULL
        `,
        this.prisma.ticket.count({ where: { tenantId } }),
      ]);

    // Enrich category and department names
    const categoryIds = topCategories.map((c) => c.categoryId).filter(Boolean) as string[];
    const departmentIds = topDepartments.map((d) => d.departmentId).filter(Boolean) as string[];

    const [categories, departments] = await Promise.all([
      categoryIds.length
        ? this.prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
        : [],
      departmentIds.length
        ? this.prisma.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    const result = {
      generatedAt: new Date().toISOString(),
      totalTickets,
      byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
      topCategories: topCategories.map((row) => ({
        name: row.categoryId ? (catMap.get(row.categoryId) ?? 'Diğer') : 'Diğer',
        count: row._count._all,
      })),
      topDepartments: topDepartments.map((row) => ({
        name: row.departmentId ? (deptMap.get(row.departmentId) ?? 'Diğer') : 'Diğer',
        count: row._count._all,
      })),
      avgResolutionDays: avgResolutionDays[0]?.avg_days ?? null,
    };

    await this.redis().setex(cacheKey, 300, JSON.stringify(result)).catch(() => null); // 5 min TTL
    return result;
  }

  // 6.3 — Coğrafi ısı haritası
  async heatmap(user: AuthenticatedUser, from?: Date, to?: Date) {
    const now = new Date();
    const start = from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = to ?? now;

    const rows = await this.prisma.$queryRaw<Array<{ lat: number; lon: number; count: bigint }>>`
      SELECT
        ROUND("latitude"::numeric, 4) AS lat,
        ROUND("longitude"::numeric, 4) AS lon,
        COUNT(*) AS count
      FROM "Ticket"
      WHERE "tenantId" = ${user.tenantId}
        AND "latitude" IS NOT NULL
        AND "longitude" IS NOT NULL
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
      GROUP BY ROUND("latitude"::numeric, 4), ROUND("longitude"::numeric, 4)
      ORDER BY count DESC
      LIMIT 2000
    `;

    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
        properties: { count: Number(r.count) },
      })),
    };
  }
}
