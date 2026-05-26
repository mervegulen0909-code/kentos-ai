import { AuditActorType, PrismaClient, TicketStatus } from '@kentos/database';
import { logger } from '../logger.js';

const prisma = new PrismaClient();
const actionableStatuses = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_INFO'] satisfies TicketStatus[];

export async function processSlaJob(job: { name: string; data: unknown }) {
  const now = new Date();

  const toEscalate = await prisma.ticket.findMany({
    where: {
      status: { in: actionableStatuses },
      resolutionDueAt: { lt: now },
      slaBreachedAt: null,
    },
    select: { id: true, tenantId: true, departmentId: true, assignedToId: true, ticketNo: true },
  });

  const { count: newlyBreached } = await prisma.ticket.updateMany({
    where: {
      status: { in: actionableStatuses },
      resolutionDueAt: { lt: now },
      slaBreachedAt: null,
    },
    data: { slaBreachedAt: now },
  });

  if (newlyBreached > 0) {
    logger.warn('[sla] SLA breach persisted', { newlyBreached, checkedAt: now.toISOString() });
  }

  let escalated = 0;
  for (const ticket of toEscalate) {
    if (ticket.assignedToId) continue;
    try {
      const manager = await prisma.user.findFirst({
        where: {
          tenantId: ticket.tenantId,
          role: 'MANAGER',
          isActive: true,
          ...(ticket.departmentId
            ? { departments: { some: { departmentId: ticket.departmentId } } }
            : {}),
        },
        select: { id: true, fullName: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!manager) continue;

      await prisma.$transaction([
        prisma.ticket.update({
          where: { id: ticket.id },
          data: { assignedToId: manager.id, status: TicketStatus.ASSIGNED },
        }),
        prisma.auditLog.create({
          data: {
            tenantId: ticket.tenantId,
            ticketId: ticket.id,
            actorType: AuditActorType.SYSTEM,
            action: 'ticket.sla_escalated',
            before: { assignedToId: null },
            after: { assignedToId: manager.id, reason: 'sla_breach_auto_escalation' },
          },
        }),
      ]);

      escalated++;
      logger.warn('[sla] Auto-escalated ticket to manager', {
        ticketId: ticket.id,
        ticketNo: ticket.ticketNo,
        managerId: manager.id,
        managerName: manager.fullName,
      });
    } catch (err) {
      logger.error('[sla] Failed to escalate ticket', { ticketId: ticket.id, error: String(err) });
    }
  }

  const [breached, dueSoon] = await Promise.all([
    prisma.ticket.count({
      where: {
        status: { in: actionableStatuses },
        resolutionDueAt: { lt: now },
      },
    }),
    prisma.ticket.count({
      where: {
        status: { in: actionableStatuses },
        resolutionDueAt: {
          gte: now,
          lte: new Date(now.getTime() + 60 * 60_000),
        },
      },
    }),
  ]);

  // Metric-friendly structured log for Prometheus/log-scraping pipelines
  logger.info('sla_breach_metric', {
    metric: 'sla_breaches_total',
    newlyBreached,
    breached,
    escalated,
    dueSoon,
    checkedAt: now.toISOString(),
  });

  // Per-tenant breakdown for multi-tenant metric granularity
  const tenantBreachCounts = new Map<string, number>();
  for (const ticket of toEscalate) {
    tenantBreachCounts.set(ticket.tenantId, (tenantBreachCounts.get(ticket.tenantId) ?? 0) + 1);
  }
  for (const [tenantId, count] of tenantBreachCounts) {
    logger.info('sla_breach_metric', {
      metric: 'sla_breaches_total',
      breached: count,
      tenantId,
      checkedAt: now.toISOString(),
    });
  }

  return {
    processor: 'sla',
    job: job.name,
    checkedAt: now.toISOString(),
    actionableStatuses,
    newlyBreached,
    escalated,
    breached,
    dueSoon,
    accepted: true,
  };
}
