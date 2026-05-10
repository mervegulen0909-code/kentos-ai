import { OutboundDeliveryState } from '@kentos/database';
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { getPrismaClient } from '../prisma-client.js';

type RetentionScope = 'channel-events' | 'audit-logs' | 'outbound-deliveries' | 'conversations' | 'attachments' | 'all';

type RetentionJobData = {
  tenantId?: string;
  retentionDays?: number;
  scope?: RetentionScope;
  dryRun?: boolean;
  deleteAttachmentObjects?: boolean;
};

const DEFAULT_RETENTION_DAYS: Record<RetentionScope, number> = {
  'channel-events': 60,
  'audit-logs': 365,
  'outbound-deliveries': 90,
  'conversations': 180,
  'attachments': 365,
  'all': 90,
};

type RetentionPrisma = {
  channelEvent: { count(input: unknown): Promise<number>; deleteMany(input: unknown): Promise<{ count: number }> };
  outboundDelivery: { count(input: unknown): Promise<number>; deleteMany(input: unknown): Promise<{ count: number }> };
  auditLog: { count(input: unknown): Promise<number>; deleteMany(input: unknown): Promise<{ count: number }> };
  conversation: { count(input: unknown): Promise<number>; deleteMany(input: unknown): Promise<{ count: number }> };
  attachment: {
    count(input: unknown): Promise<number>;
    deleteMany(input: unknown): Promise<{ count: number }>;
    findMany(input: unknown): Promise<Array<{ id: string; storageKey: string }>>;
  };
};

type RetentionDependencies = {
  prisma: RetentionPrisma;
  deleteAttachmentObjects?: (storageKeys: string[]) => Promise<{ deleted: number; errors: string[] }>;
};

let s3Client: S3Client | null = null;

export async function processRetentionJob(job: { name: string; data: RetentionJobData }) {
  return runRetentionJob(job, {
    prisma: getPrismaClient() as unknown as RetentionPrisma,
    deleteAttachmentObjects: deleteS3Objects,
  });
}

export async function runRetentionJob(job: { name: string; data: RetentionJobData }, deps: RetentionDependencies) {
  const startedAt = new Date().toISOString();
  const { tenantId, scope = 'all' } = job.data ?? {};
  const retentionDays = job.data?.retentionDays ?? DEFAULT_RETENTION_DAYS[scope] ?? 90;
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const dryRun = job.data?.dryRun ?? process.env.RETENTION_DRY_RUN !== 'false';
  const deleteAttachmentObjects = job.data?.deleteAttachmentObjects ?? process.env.RETENTION_DELETE_ATTACHMENT_OBJECTS === 'true';
  const prisma = deps.prisma;

  const tenantFilter = tenantId ? { tenantId } : {};
  const totals: Record<string, number> = {};
  const attachmentStorageKeys: string[] = [];
  const objectDeleteErrors: string[] = [];

  if (scope === 'channel-events' || scope === 'all') {
    const where = { ...tenantFilter, createdAt: { lt: cutoff } };
    totals.channelEvents = await countOrDelete(prisma.channelEvent, where, dryRun);
  }

  if (scope === 'outbound-deliveries' || scope === 'all') {
    const where = {
      ...tenantFilter,
      createdAt: { lt: cutoff },
      state: { in: [OutboundDeliveryState.DELIVERED, OutboundDeliveryState.FAILED, OutboundDeliveryState.SKIPPED] },
    };
    totals.outboundDeliveries = await countOrDelete(prisma.outboundDelivery, where, dryRun);
  }

  if (scope === 'audit-logs' || scope === 'all') {
    const where = { ...tenantFilter, createdAt: { lt: cutoff } };
    totals.auditLogs = await countOrDelete(prisma.auditLog, where, dryRun);
  }

  if (scope === 'conversations' || scope === 'all') {
    const where = {
      ...tenantFilter,
      updatedAt: { lt: cutoff },
      state: { in: ['TICKET_CREATED', 'CLOSED'] },
    };
    totals.conversations = await countOrDelete(prisma.conversation, where, dryRun);
  }

  if (scope === 'attachments' || scope === 'all') {
    const where = { ...tenantFilter, createdAt: { lt: cutoff } };
    const attachments = await prisma.attachment.findMany({
      where,
      select: { id: true, storageKey: true },
      orderBy: { createdAt: 'asc' },
    });
    attachmentStorageKeys.push(...attachments.map((attachment) => attachment.storageKey).filter(Boolean));
    totals.attachments = attachments.length;

    if (!dryRun && attachments.length) {
      const result = await prisma.attachment.deleteMany({ where });
      totals.attachments = result.count;
    }

    if (!dryRun && deleteAttachmentObjects && attachmentStorageKeys.length) {
      const objectResult = await deps.deleteAttachmentObjects?.(attachmentStorageKeys);
      totals.attachmentObjectsDeleted = objectResult?.deleted ?? 0;
      objectDeleteErrors.push(...(objectResult?.errors ?? []));
    } else {
      totals.attachmentObjectsDeleted = 0;
    }
  }

  return {
    processor: 'retention',
    job: job.name,
    tenantId: tenantId ?? null,
    scope,
    retentionDays,
    dryRun,
    deleteAttachmentObjects,
    cutoff: cutoff.toISOString(),
    totals,
    attachmentStorageKeys,
    objectDeleteErrors,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

async function countOrDelete(
  model: { count(input: unknown): Promise<number>; deleteMany(input: unknown): Promise<{ count: number }> },
  where: Record<string, unknown>,
  dryRun: boolean,
) {
  if (dryRun) return model.count({ where });
  const result = await model.deleteMany({ where });
  return result.count;
}

async function deleteS3Objects(storageKeys: string[]) {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) return { deleted: 0, errors: ['s3-bucket-not-configured'] };

  const uniqueKeys = [...new Set(storageKeys.filter(Boolean))];
  const errors: string[] = [];
  let deleted = 0;
  for (let index = 0; index < uniqueKeys.length; index += 1000) {
    const chunk = uniqueKeys.slice(index, index + 1000);
    const response = await getS3Client().send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: chunk.map((Key) => ({ Key })),
        Quiet: true,
      },
    }));
    deleted += chunk.length - (response.Errors?.length ?? 0);
    errors.push(...(response.Errors ?? []).map((error) => `${error.Key ?? 'unknown'}:${error.Code ?? 'delete-failed'}`));
  }
  return { deleted, errors };
}

function getS3Client() {
  if (s3Client) return s3Client;
  const endpoint = process.env.S3_ENDPOINT?.trim();
  s3Client = new S3Client({
    region: process.env.S3_REGION?.trim() || 'us-east-1',
    endpoint: endpoint || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY,
        }
      : undefined,
  });
  return s3Client;
}
