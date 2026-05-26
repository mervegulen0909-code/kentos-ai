import { OutboundDeliveryState, PrismaClient } from '@kentos/database';
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { logger } from '../logger.js';
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  RETENTION_SCOPES,
  type RetentionScope,
  type TenantRetentionOverrides,
} from '@kentos/shared';
import { getPrismaClient } from '../prisma-client.js';

type RetentionJobScope = RetentionScope | 'all';

type RetentionJobData = {
  tenantId?: string;
  retentionDays?: number;
  scope?: RetentionJobScope;
  dryRun?: boolean;
  deleteAttachmentObjects?: boolean;
};

type RetentionDependencies = {
  prisma: PrismaClient;
  deleteAttachmentObjects?: (storageKeys: string[]) => Promise<{ deleted: number; errors: string[] }>;
};

let s3Client: S3Client | null = null;

export async function processRetentionJob(job: { name: string; data: RetentionJobData }) {
  return runRetentionJob(job, {
    prisma: getPrismaClient(),
    deleteAttachmentObjects: deleteS3Objects,
  });
}

export async function runRetentionJob(job: { name: string; data: RetentionJobData }, deps: RetentionDependencies) {
  const startedAt = new Date().toISOString();
  const { tenantId, scope = 'all' } = job.data ?? {};
  const explicitDays = job.data?.retentionDays;
  const dryRun = job.data?.dryRun ?? process.env.RETENTION_DRY_RUN !== 'false';
  const deleteAttachmentObjectsFlag = job.data?.deleteAttachmentObjects ?? process.env.RETENTION_DELETE_ATTACHMENT_OBJECTS === 'true';

  // Üretimde dry-run açıksa uyar — veri GERÇEKTEN silinmiyor, KVKK yükümlülüğü yerine getirilmiyor
  if (dryRun && process.env.NODE_ENV === 'production') {
    console.warn('[retention] ⚠️  RETENTION_DRY_RUN=true — hiçbir veri silinmeyecek. KVKK/saklama penceresi yükümlülükleri yerine getirilmiyor. Canlıda silme için RETENTION_DRY_RUN=false ayarlayın.');
  }
  const prisma = deps.prisma;

  const overrides = tenantId ? await loadTenantOverrides(prisma, tenantId) : {};

  const scopesToRun: RetentionScope[] = scope === 'all' ? [...RETENTION_SCOPES] : [scope];
  const tenantFilter = tenantId ? { tenantId } : {};
  const totals: Record<string, number> = {};
  const effectiveRetentionDays: Partial<Record<RetentionScope, number>> = {};
  const attachmentStorageKeys: string[] = [];
  const objectDeleteErrors: string[] = [];

  for (const target of scopesToRun) {
    const days = resolveScopeDays(target, explicitDays, overrides);
    effectiveRetentionDays[target] = days;
    const cutoff = new Date(Date.now() - days * 86_400_000);

    if (target === 'channel-events') {
      const where = { ...tenantFilter, createdAt: { lt: cutoff } };
      totals.channelEvents = await countOrDelete(prisma.channelEvent, where, dryRun);
    }

    if (target === 'outbound-deliveries') {
      const where = {
        ...tenantFilter,
        createdAt: { lt: cutoff },
        state: { in: [OutboundDeliveryState.DELIVERED, OutboundDeliveryState.FAILED, OutboundDeliveryState.SKIPPED] },
      };
      totals.outboundDeliveries = await countOrDelete(prisma.outboundDelivery, where, dryRun);
    }

    if (target === 'audit-logs') {
      const where = { ...tenantFilter, createdAt: { lt: cutoff } };
      totals.auditLogs = await countOrDelete(prisma.auditLog, where, dryRun);
    }

    if (target === 'conversations') {
      const where = {
        ...tenantFilter,
        updatedAt: { lt: cutoff },
        state: { in: ['TICKET_CREATED', 'CLOSED'] },
      };
      totals.conversations = await countOrDelete(prisma.conversation, where, dryRun);
    }

    if (target === 'attachments') {
      const where = { ...tenantFilter, createdAt: { lt: cutoff } };
      const attachments = await prisma.attachment.findMany({
        where,
        select: { id: true, storageKey: true },
        orderBy: { createdAt: 'asc' },
      });
      const keys = attachments.map((attachment) => attachment.storageKey).filter(Boolean);
      attachmentStorageKeys.push(...keys);
      totals.attachments = attachments.length;
      totals.attachmentObjectsDeleted = totals.attachmentObjectsDeleted ?? 0;

      if (!dryRun && attachments.length) {
        // S3 deletion FIRST — prevents orphaned blobs if DB deletion succeeds but S3 fails.
        if (deleteAttachmentObjectsFlag && keys.length) {
          try {
            const objectResult = await deps.deleteAttachmentObjects?.(keys);
            totals.attachmentObjectsDeleted = objectResult?.deleted ?? 0;
            const s3Errors = objectResult?.errors ?? [];
            if (s3Errors.length) {
              logger.error('[retention] S3 deletion errors — skipping DB attachment deletion to avoid orphaned blobs', {
                count: keys.length,
                errorCount: s3Errors.length,
                errors: s3Errors.slice(0, 10),
              });
              objectDeleteErrors.push(...s3Errors);
              totals.attachments = 0; // nothing deleted from DB this run
              continue;
            }
          } catch (err) {
            logger.error('[retention] S3 deletion threw — skipping DB attachment deletion', {
              count: keys.length,
              error: String(err),
            });
            objectDeleteErrors.push(String(err));
            totals.attachments = 0;
            continue;
          }
        }

        const result = await prisma.attachment.deleteMany({ where });
        totals.attachments = result.count;
      }
    }
  }

  const reportedRetentionDays =
    scope === 'all'
      ? null
      : explicitDays ?? overrides[scope] ?? DEFAULT_RETENTION_DAYS[scope];

  return {
    processor: 'retention',
    job: job.name,
    tenantId: tenantId ?? null,
    scope,
    retentionDays: reportedRetentionDays,
    effectiveRetentionDays,
    appliedOverrides: overrides,
    dryRun,
    deleteAttachmentObjects: deleteAttachmentObjectsFlag,
    totals,
    attachmentStorageKeys,
    objectDeleteErrors,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

async function loadTenantOverrides(prisma: PrismaClient, tenantId: string): Promise<TenantRetentionOverrides> {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { retentionOverrides: true } });
    return normalizeOverrides(tenant?.retentionOverrides);
  } catch {
    return {};
  }
}

export function normalizeOverrides(value: unknown): TenantRetentionOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: TenantRetentionOverrides = {};
  for (const scope of RETENTION_SCOPES) {
    const raw = (value as Record<string, unknown>)[scope];
    if (raw === undefined || raw === null) continue;
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(numeric)) continue;
    if (numeric < MIN_RETENTION_DAYS || numeric > MAX_RETENTION_DAYS) continue;
    result[scope] = numeric;
  }
  return result;
}

function resolveScopeDays(
  scope: RetentionScope,
  explicitDays: number | undefined,
  overrides: TenantRetentionOverrides,
): number {
  if (typeof explicitDays === 'number' && Number.isFinite(explicitDays) && explicitDays >= MIN_RETENTION_DAYS) {
    return explicitDays;
  }
  const override = overrides[scope];
  if (typeof override === 'number') return override;
  return DEFAULT_RETENTION_DAYS[scope];
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
