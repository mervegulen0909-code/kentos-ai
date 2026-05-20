import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, MessageVisibility, OutboundDeliveryState, TicketStatus } from '@kentos/database';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Redis } from 'ioredis';
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
    this._redis ??= new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 1 });
    return this._redis;
  }

  async overview(user: AuthenticatedUser) {
    const cacheKey = `analytics:overview:${user.tenantId}`;
    const cached = await this.redis().get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as unknown;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOpen, openedToday, resolvedToday, byStatus, dueTickets] = await Promise.all([
      this.prisma.ticket.count({
        where: { tenantId: user.tenantId, status: { notIn: [TicketStatus.CLOSED, TicketStatus.REJECTED] } },
      }),
      this.prisma.ticket.count({ where: { tenantId: user.tenantId, createdAt: { gte: today } } }),
      this.prisma.ticket.count({ where: { tenantId: user.tenantId, resolvedAt: { gte: today } } }),
      this.prisma.ticket.groupBy({ by: ['status'], where: { tenantId: user.tenantId }, _count: { _all: true } }),
      this.prisma.ticket.findMany({
        where: {
          tenantId: user.tenantId,
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.REJECTED] },
          resolutionDueAt: { not: null },
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

    await this.redis().setex(cacheKey, 60, JSON.stringify(result)).catch(() => null); // 60s TTL, swallow errors
    return result;
  }

  async departments(user: AuthenticatedUser) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: {
        _count: {
          select: {
            tickets: {
              where: { status: { notIn: [TicketStatus.CLOSED, TicketStatus.REJECTED] } },
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

  async categories(user: AuthenticatedUser) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: { _count: { select: { tickets: true } }, department: true },
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

  async neighborhoods(user: AuthenticatedUser) {
    const neighborhoods = await this.prisma.neighborhood.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: { _count: { select: { tickets: true } } },
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

  async channels(user: AuthenticatedUser) {
    const [ticketsByChannel, conversationsByChannel, aiCreatedMessagesByChannel, publicMessagesByChannel, attachments] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['channel'], where: { tenantId: user.tenantId }, _count: { _all: true } }),
      this.prisma.conversation.groupBy({ by: ['channel'], where: { tenantId: user.tenantId }, _count: { _all: true } }),
      this.prisma.ticketMessage.groupBy({
        by: ['channel'],
        where: { tenantId: user.tenantId, senderType: AuditActorType.AI },
        _count: { _all: true },
      }),
      this.prisma.ticketMessage.groupBy({
        by: ['channel'],
        where: { tenantId: user.tenantId, visibility: MessageVisibility.PUBLIC },
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

  async outboundDeliveries(user: AuthenticatedUser) {
    const [byState, byChannelState, recentFailures] = await Promise.all([
      this.prisma.outboundDelivery.groupBy({
        by: ['state'],
        where: { tenantId: user.tenantId },
        _count: { _all: true },
      }),
      this.prisma.outboundDelivery.groupBy({
        by: ['channel', 'state'],
        where: { tenantId: user.tenantId },
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
}
