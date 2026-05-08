import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, MessageVisibility, TicketStatus } from '@kentos/database';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async overview(user: AuthenticatedUser) {
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

    return {
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

  async channels(user: AuthenticatedUser) {
    const [ticketsByChannel, conversationsByChannel, aiCreatedMessagesByChannel, publicMessagesByChannel] = await Promise.all([
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
    ]);

    const channels = new Set([
      ...ticketsByChannel.map((item) => item.channel),
      ...conversationsByChannel.map((item) => item.channel),
      ...aiCreatedMessagesByChannel.map((item) => item.channel).filter(Boolean),
      ...publicMessagesByChannel.map((item) => item.channel).filter(Boolean),
    ]);

    return [...channels].sort().map((channel) => {
      const tickets = ticketsByChannel.find((item) => item.channel === channel)?._count._all ?? 0;
      const conversations = conversationsByChannel.find((item) => item.channel === channel)?._count._all ?? 0;
      const aiMessages = aiCreatedMessagesByChannel.find((item) => item.channel === channel)?._count._all ?? 0;
      const publicMessages = publicMessagesByChannel.find((item) => item.channel === channel)?._count._all ?? 0;

      return {
        channel,
        tickets,
        conversations,
        publicMessages,
        aiMessages,
        automationRate: publicMessages ? Number((aiMessages / publicMessages).toFixed(3)) : 0,
      };
    });
  }
}
