import { Prisma, PrismaClient, TicketStatus } from '@kentos/database';
import { logger } from '../logger.js';

const prisma = new PrismaClient();

const openStatuses = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_INFO'] satisfies TicketStatus[];
const closedStatuses = ['RESOLVED', 'CLOSED'] satisfies TicketStatus[];

type ReportJobData = {
  tenantId?: string;
  type?: string;
};

export async function processReportJob(job: { name: string; data: ReportJobData | unknown }) {
  const generatedAt = new Date().toISOString();
  const data = job.data as ReportJobData | null | undefined;
  const tenantId = data?.tenantId;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const tenantFilter = tenantId ? { tenantId } : {};

  // ── Ticket volume over the past 7 days ───────────────────────────────────
  const [openedCount, closedCount] = await Promise.all([
    prisma.ticket.count({
      where: {
        ...tenantFilter,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.ticket.count({
      where: {
        ...tenantFilter,
        status: { in: closedStatuses },
        closedAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  // ── Currently open tickets ───────────────────────────────────────────────
  const currentlyOpenCount = await prisma.ticket.count({
    where: {
      ...tenantFilter,
      status: { in: openStatuses },
    },
  });

  // ── High-priority open tickets ───────────────────────────────────────────
  const highPriorityOpen = await prisma.ticket.findMany({
    where: {
      ...tenantFilter,
      status: { in: openStatuses },
      priority: { in: ['HIGH', 'URGENT'] },
    },
    select: {
      id: true,
      ticketNo: true,
      title: true,
      priority: true,
      status: true,
      resolutionDueAt: true,
      createdAt: true,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: 20,
  });

  // ── Department breakdown (open tickets) ─────────────────────────────────
  const departmentBreakdownRaw = await prisma.ticket.groupBy({
    by: ['departmentId'],
    where: {
      ...tenantFilter,
      status: { in: openStatuses },
    },
    _count: { _all: true },
    orderBy: { _count: { departmentId: 'desc' } },
  });

  // Resolve department names
  const departmentIds = departmentBreakdownRaw
    .map((row) => row.departmentId)
    .filter((id): id is string => Boolean(id));

  const departments = departmentIds.length
    ? await prisma.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, name: true, code: true },
      })
    : [];

  const departmentMap = new Map(departments.map((d) => [d.id, d]));

  const departmentBreakdown = departmentBreakdownRaw.map((row) => ({
    departmentId: row.departmentId,
    departmentName: row.departmentId ? (departmentMap.get(row.departmentId)?.name ?? 'Unknown') : 'Unassigned',
    departmentCode: row.departmentId ? (departmentMap.get(row.departmentId)?.code ?? null) : null,
    openTickets: row._count._all,
  }));

  // ── SLA breach count ─────────────────────────────────────────────────────
  const slaBreachedCount = await prisma.ticket.count({
    where: {
      ...tenantFilter,
      status: { in: openStatuses },
      resolutionDueAt: { lt: now },
    },
  });

  const generatedReport = {
    period: {
      from: sevenDaysAgo.toISOString(),
      to: now.toISOString(),
      days: 7,
    },
    volume: {
      opened: openedCount,
      closed: closedCount,
      currentlyOpen: currentlyOpenCount,
      slaBreached: slaBreachedCount,
    },
    departmentBreakdown,
    highPriorityOpen: highPriorityOpen.map((ticket) => ({
      ticketNo: ticket.ticketNo,
      title: ticket.title,
      priority: ticket.priority,
      status: ticket.status,
      resolutionDueAt: ticket.resolutionDueAt?.toISOString() ?? null,
      createdAt: ticket.createdAt.toISOString(),
    })),
  };

  // Persist the report to the database
  const reportType = data?.type ?? 'weekly_summary';
  try {
    const report = await prisma.managerReport.create({
      data: {
        tenantId: tenantId ?? 'system',
        type: reportType,
        periodStart: sevenDaysAgo,
        periodEnd: now,
        summary: `${reportType} — ${openedCount} açılan, ${closedCount} kapanan, ${currentlyOpenCount} bekleyen ticket`,
        metrics: generatedReport as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      processor: 'reports',
      job: job.name,
      tenantId: tenantId ?? null,
      reportId: report.id,
      generatedAt,
      generatedReport,
      accepted: true,
    };
  } catch (err) {
    // Non-fatal: log the error but still return success
    logger.error('Failed to persist report to DB', { error: err instanceof Error ? err.message : String(err) });
    return {
      processor: 'reports',
      job: job.name,
      tenantId: tenantId ?? null,
      generatedAt,
      generatedReport,
      accepted: true,
      persisted: false,
    };
  }
}
