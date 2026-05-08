import { OutboundDeliveryState } from '@kentos/database';
import { getPrismaClient } from '../prisma-client.js';

type RetentionScope = 'channel-events' | 'audit-logs' | 'outbound-deliveries' | 'conversations' | 'all';

type RetentionJobData = {
  tenantId?: string;
  retentionDays?: number;
  scope?: RetentionScope;
};

const DEFAULT_RETENTION_DAYS: Record<RetentionScope, number> = {
  'channel-events': 60,
  'audit-logs': 365,
  'outbound-deliveries': 90,
  'conversations': 180,
  'all': 90,
};

export async function processRetentionJob(job: { name: string; data: RetentionJobData }) {
  const startedAt = new Date().toISOString();
  const { tenantId, scope = 'all' } = job.data ?? {};
  const retentionDays = job.data?.retentionDays ?? DEFAULT_RETENTION_DAYS[scope] ?? 90;
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const prisma = getPrismaClient();

  const tenantFilter = tenantId ? { tenantId } : {};
  const totals: Record<string, number> = {};

  if (scope === 'channel-events' || scope === 'all') {
    const result = await prisma.channelEvent.deleteMany({
      where: { ...tenantFilter, createdAt: { lt: cutoff } },
    });
    totals.channelEvents = result.count;
  }

  if (scope === 'outbound-deliveries' || scope === 'all') {
    const result = await prisma.outboundDelivery.deleteMany({
      where: {
        ...tenantFilter,
        createdAt: { lt: cutoff },
        state: { in: [OutboundDeliveryState.DELIVERED, OutboundDeliveryState.FAILED, OutboundDeliveryState.SKIPPED] },
      },
    });
    totals.outboundDeliveries = result.count;
  }

  if (scope === 'audit-logs' || scope === 'all') {
    const result = await prisma.auditLog.deleteMany({
      where: { ...tenantFilter, createdAt: { lt: cutoff } },
    });
    totals.auditLogs = result.count;
  }

  if (scope === 'conversations' || scope === 'all') {
    const result = await prisma.conversation.deleteMany({
      where: {
        ...tenantFilter,
        updatedAt: { lt: cutoff },
        state: { in: ['TICKET_CREATED', 'CLOSED'] },
      },
    });
    totals.conversations = result.count;
  }

  return {
    processor: 'retention',
    job: job.name,
    tenantId: tenantId ?? null,
    scope,
    retentionDays,
    cutoff: cutoff.toISOString(),
    totals,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
