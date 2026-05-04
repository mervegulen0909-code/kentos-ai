import { PrismaClient, TicketStatus } from '@kentos/database';

const prisma = new PrismaClient();
const actionableStatuses = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_INFO'] satisfies TicketStatus[];

export async function processSlaJob(job: { name: string; data: unknown }) {
  const now = new Date();
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
    breached,
    dueSoon,
    accepted: true,
  };
}
