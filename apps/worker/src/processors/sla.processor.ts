import { PrismaClient, TicketStatus } from '@kentos/database';
import { logger } from '../logger.js';

const prisma = new PrismaClient();
const actionableStatuses = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_INFO'] satisfies TicketStatus[];

export async function processSlaJob(job: { name: string; data: unknown }) {
  const now = new Date();

  // Persist slaBreachedAt for tickets that have crossed their resolution deadline for the first time.
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

  return {
    processor: 'sla',
    job: job.name,
    checkedAt: now.toISOString(),
    actionableStatuses,
    newlyBreached,
    breached,
    dueSoon,
    accepted: true,
  };
}
