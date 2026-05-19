import { AuditActorType, PrismaClient, TicketStatus } from '@kentos/database';

const prisma = new PrismaClient();
const actionableStatuses = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_INFO'] satisfies TicketStatus[];

export async function processSlaJob(job: { name: string; data: unknown }) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Fetch breached tickets that are still actionable
  const breachedTickets = await prisma.ticket.findMany({
    where: {
      status: { in: actionableStatuses },
      resolutionDueAt: { lt: now },
    },
    select: { id: true, tenantId: true, ticketNo: true, resolutionDueAt: true },
  });

  // Find tickets that already have an sla_breached audit log today (avoid duplicate logs)
  const alreadyLoggedIds = breachedTickets.length
    ? await prisma.auditLog.findMany({
        where: {
          ticketId: { in: breachedTickets.map((t) => t.id) },
          action: 'ticket.sla_breached',
          createdAt: { gte: todayStart },
        },
        select: { ticketId: true },
      }).then((rows) => new Set(rows.map((r) => r.ticketId)))
    : new Set<string>();

  const newBreaches = breachedTickets.filter((t) => !alreadyLoggedIds.has(t.id));

  if (newBreaches.length) {
    await prisma.auditLog.createMany({
      data: newBreaches.map((ticket) => ({
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        actorType: AuditActorType.SYSTEM,
        action: 'ticket.sla_breached',
        after: {
          ticketNo: ticket.ticketNo,
          resolutionDueAt: ticket.resolutionDueAt?.toISOString() ?? null,
          detectedAt: now.toISOString(),
        },
      })),
    });
  }

  const dueSoon = await prisma.ticket.count({
    where: {
      status: { in: actionableStatuses },
      resolutionDueAt: {
        gte: now,
        lte: new Date(now.getTime() + 60 * 60_000),
      },
    },
  });

  return {
    processor: 'sla',
    job: job.name,
    checkedAt: now.toISOString(),
    actionableStatuses,
    breached: breachedTickets.length,
    newBreachesLogged: newBreaches.length,
    dueSoon,
    accepted: true,
  };
}
