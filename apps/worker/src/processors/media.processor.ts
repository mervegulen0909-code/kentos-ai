import type { MediaJobData } from '@kentos/shared';
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { getPrismaClient } from '../prisma-client.js';
import { readClamavConfigFromEnv, scanStreamWithClamav, type ClamavScanResult } from '../scan/clamav-client.js';

type ObjectMetadata = {
  contentLength?: number;
  contentType?: string;
};

type ScanOutcome = {
  scanStatus: 'CLEAN' | 'INFECTED' | 'ERROR' | 'SKIPPED' | 'PENDING';
  scanProvider: string;
  threat?: string;
  reason?: string;
  raw?: string;
  scannedAt?: string;
};

type ScanRunner = (input: { storageKey: string }) => Promise<ScanOutcome>;

type AttachmentUpdater = (input: {
  attachmentId: string;
  status: ScanOutcome['scanStatus'];
  provider: string;
  threat?: string;
  scannedAt?: string;
  resultPayload: Record<string, unknown>;
}) => Promise<void>;

type QuarantineHook = (input: {
  attachmentId: string;
  tenantId: string;
  storageKey: string;
  scanProvider: string;
  threat?: string;
  scannedAt?: string;
}) => Promise<void>;

type MediaDependencies = {
  readObjectMetadata?: (storageKey: string) => Promise<ObjectMetadata | null | undefined>;
  scan?: ScanRunner;
  updateAttachment?: AttachmentUpdater;
  onInfected?: QuarantineHook;
};

let s3Client: S3Client | null = null;

export async function processMediaJob(job: { name: string; data: MediaJobData }) {
  return runMediaJob(job, {
    readObjectMetadata,
    scan: defaultScanRunner,
    updateAttachment: defaultAttachmentUpdater,
    onInfected: defaultQuarantineHook,
  });
}

export async function runMediaJob(job: { name: string; data: MediaJobData }, deps: MediaDependencies = {}) {
  const summaryWithoutMetadata = summarizeMediaJob(job.data);
  if (summaryWithoutMetadata.status !== 'accepted') {
    return { processor: 'media', job: job.name, ...summaryWithoutMetadata };
  }

  const metadata = deps.readObjectMetadata ? await deps.readObjectMetadata(job.data.storageKey) : undefined;
  const summary = summarizeMediaJob(job.data, metadata);
  if (summary.status !== 'accepted') {
    return { processor: 'media', job: job.name, ...summary };
  }

  const scanOutcome = deps.scan ? await deps.scan({ storageKey: job.data.storageKey }) : skippedOutcome('no-scanner');

  if (scanOutcome.scanStatus === 'INFECTED' && deps.onInfected) {
    await deps.onInfected({
      attachmentId: job.data.attachmentId,
      tenantId: job.data.tenantId,
      storageKey: job.data.storageKey,
      scanProvider: scanOutcome.scanProvider,
      threat: scanOutcome.threat,
      scannedAt: scanOutcome.scannedAt,
    }).catch((error) => {
      console.error('[media] quarantine hook failed', error instanceof Error ? error.message : error);
    });
  }

  if (deps.updateAttachment) {
    await deps.updateAttachment({
      attachmentId: job.data.attachmentId,
      status: scanOutcome.scanStatus,
      provider: scanOutcome.scanProvider,
      threat: scanOutcome.threat,
      scannedAt: scanOutcome.scannedAt,
      resultPayload: {
        provider: scanOutcome.scanProvider,
        status: scanOutcome.scanStatus,
        threat: scanOutcome.threat ?? null,
        reason: scanOutcome.reason ?? null,
        rawTail: scanOutcome.raw ? scanOutcome.raw.slice(-200) : null,
        scannedAt: scanOutcome.scannedAt ?? null,
      },
    }).catch((error) => {
      console.error('[media] attachment scan persistence failed', error instanceof Error ? error.message : error);
    });
  }

  return {
    processor: 'media',
    job: job.name,
    ...summary,
    scan: {
      provider: scanOutcome.scanProvider,
      status: scanOutcome.scanStatus,
      threat: scanOutcome.threat ?? null,
      reason: scanOutcome.reason ?? null,
      scannedAt: scanOutcome.scannedAt ?? null,
    },
  };
}

export function summarizeMediaJob(data: MediaJobData, metadata?: ObjectMetadata | null) {
  if (!data.attachmentId || !data.tenantId || !data.storageKey) {
    return { status: 'failed' as const, reason: 'invalid-payload' };
  }
  if (!/^[a-f0-9]{64}$/i.test(data.checksumSha256)) {
    return { status: 'failed' as const, reason: 'invalid-checksum', attachmentId: data.attachmentId };
  }
  if (data.sizeBytes <= 0 || !Number.isFinite(data.sizeBytes)) {
    return { status: 'failed' as const, reason: 'invalid-size', attachmentId: data.attachmentId };
  }
  if (metadata === null) {
    return { status: 'skipped' as const, reason: 'object-missing', attachmentId: data.attachmentId };
  }
  if (metadata?.contentLength != null && metadata.contentLength !== data.sizeBytes) {
    return { status: 'failed' as const, reason: 'size-mismatch', attachmentId: data.attachmentId };
  }
  if (metadata?.contentType && metadata.contentType !== data.mimeType) {
    return { status: 'failed' as const, reason: 'mime-mismatch', attachmentId: data.attachmentId };
  }

  return {
    status: 'accepted' as const,
    attachmentId: data.attachmentId,
    reason: metadata ? 'object-metadata-verified' : 'payload-validated',
    object: metadata ?? null,
  };
}

function skippedOutcome(reason: string): ScanOutcome {
  return {
    scanStatus: 'SKIPPED',
    scanProvider: 'placeholder',
    reason,
    scannedAt: new Date().toISOString(),
  };
}

async function defaultScanRunner({ storageKey }: { storageKey: string }): Promise<ScanOutcome> {
  const provider = process.env.ATTACHMENT_SCAN_PROVIDER?.trim().toLowerCase();
  if (!provider || provider === 'placeholder' || provider === 'none' || provider === 'disabled') {
    return skippedOutcome('scan-provider-placeholder');
  }
  if (provider === 'clamav') {
    const config = readClamavConfigFromEnv();
    if (!config) return skippedOutcome('clamav-config-missing');
    const stream = await openObjectStream(storageKey);
    if (!stream) {
      return skippedOutcome('object-stream-unavailable');
    }
    try {
      const result: ClamavScanResult = await scanStreamWithClamav(stream, config);
      return mapClamavResult(result);
    } catch (error) {
      return {
        scanStatus: 'ERROR',
        scanProvider: 'clamav',
        reason: error instanceof Error ? error.message : 'clamav-error',
        scannedAt: new Date().toISOString(),
      };
    }
  }
  return skippedOutcome(`unknown-provider:${provider}`);
}

function mapClamavResult(result: ClamavScanResult): ScanOutcome {
  if (result.status === 'clean') {
    return { scanStatus: 'CLEAN', scanProvider: 'clamav', raw: result.raw, scannedAt: new Date().toISOString() };
  }
  if (result.status === 'infected') {
    return { scanStatus: 'INFECTED', scanProvider: 'clamav', threat: result.threat, raw: result.raw, scannedAt: new Date().toISOString() };
  }
  return { scanStatus: 'ERROR', scanProvider: 'clamav', reason: result.reason, raw: result.raw, scannedAt: new Date().toISOString() };
}

async function defaultQuarantineHook(input: Parameters<QuarantineHook>[0]) {
  const prisma = getPrismaClient();
  const attachment = await prisma.attachment.findUnique({
    where: { id: input.attachmentId },
    select: { ticketId: true, fileName: true, mimeType: true, sizeBytes: true, messageId: true },
  });
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      ticketId: attachment?.ticketId ?? null,
      actorType: 'SYSTEM',
      action: 'attachment.scan_quarantined',
      after: {
        attachmentId: input.attachmentId,
        scanProvider: input.scanProvider,
        threat: input.threat ?? null,
        scannedAt: input.scannedAt ?? null,
        fileName: attachment?.fileName ?? null,
        mimeType: attachment?.mimeType ?? null,
        sizeBytes: attachment?.sizeBytes ?? null,
        messageId: attachment?.messageId ?? null,
        storageKey: input.storageKey,
      },
    },
  });
}

async function defaultAttachmentUpdater(input: Parameters<AttachmentUpdater>[0]) {
  try {
    const prisma = getPrismaClient();
    await prisma.attachment.update({
      where: { id: input.attachmentId },
      data: {
        scanStatus: input.status,
        scanProvider: input.provider,
        scanThreat: input.threat ?? null,
        scannedAt: input.scannedAt ? new Date(input.scannedAt) : new Date(),
        scanResult: input.resultPayload as never,
      },
    });
  } catch (error) {
    throw error instanceof Error ? error : new Error('attachment-update-failed');
  }
}

async function readObjectMetadata(storageKey: string): Promise<ObjectMetadata | null | undefined> {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) return undefined;

  try {
    const response = await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
    return {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  } catch (error) {
    const name = error && typeof error === 'object' ? (error as { name?: string }).name : null;
    if (name === 'NotFound' || name === 'NoSuchKey' || name === 'NotFoundError') return null;
    throw error;
  }
}

async function openObjectStream(storageKey: string): Promise<Readable | null> {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) return null;
  const response = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
  const body = response.Body as Readable | undefined;
  return body ?? null;
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
