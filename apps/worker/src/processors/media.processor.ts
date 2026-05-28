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

  let scanOutcome = deps.scan ? await deps.scan({ storageKey: job.data.storageKey }) : skippedOutcome('no-scanner');

  if (scanOutcome.scanStatus === 'INFECTED') {
    // VirusTotal secondary scan — fire-and-forget escalation for confirmation
    const vtResult = await virusTotalEscalate(job.data.storageKey, job.data.attachmentId);
    if (vtResult) {
      scanOutcome = { ...scanOutcome, scanProvider: `clamav+virustotal`, reason: vtResult };
    }

    if (deps.onInfected) {
      // Karantina hook başarısız olursa job yeniden denenebilmesi için hata fırlatılır
      await deps.onInfected({
        attachmentId: job.data.attachmentId,
        tenantId: job.data.tenantId,
        storageKey: job.data.storageKey,
        scanProvider: scanOutcome.scanProvider,
        threat: scanOutcome.threat,
        scannedAt: scanOutcome.scannedAt,
      }).catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        // İnfected attachment karantinaya alınamazsa kritik hata — job retry edilmeli
        throw new Error(`[media] quarantine hook failed for ${job.data.attachmentId}: ${msg}`);
      });
    }
  }

  if (deps.updateAttachment) {
    // DB güncelleme başarısız olursa job retry edilebilir; scan sonucu kaybedilmemeli
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
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`[media] attachment scan persistence failed for ${job.data.attachmentId}: ${msg}`);
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

async function virusTotalEscalate(storageKey: string, attachmentId: string): Promise<string | null> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const bucket = process.env.S3_BUCKET?.trim();
    if (!bucket) return null;

    const s3 = getS3Client();
    const { Body, ContentLength } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
    if (!Body || !ContentLength) return null;
    if (ContentLength > 32 * 1024 * 1024) return 'file-too-large-for-virustotal'; // 32 MB limit

    const chunks: Uint8Array[] = [];
    for await (const chunk of Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer]), storageKey.split('/').pop() ?? 'attachment');

    const uploadRes = await fetch('https://www.virustotal.com/api/v3/files', {
      method: 'POST',
      headers: { 'x-apikey': apiKey },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (!uploadRes.ok) return `virustotal-upload-failed-${uploadRes.status}`;
    const uploadData = await uploadRes.json() as { data?: { id?: string } };
    const analysisId = uploadData.data?.id;
    if (!analysisId) return 'virustotal-no-analysis-id';

    // Poll for result (max 3 attempts with 5s delay)
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((r) => setTimeout(r, 5_000));
      const pollRes = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: { 'x-apikey': apiKey },
        signal: AbortSignal.timeout(10_000),
      });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json() as { data?: { attributes?: { status?: string; stats?: { malicious?: number; suspicious?: number } } } };
      const attrs = pollData.data?.attributes;
      if (attrs?.status !== 'completed') continue;
      const malicious = attrs.stats?.malicious ?? 0;
      const suspicious = attrs.stats?.suspicious ?? 0;
      return `vt:malicious=${malicious},suspicious=${suspicious},attachment=${attachmentId}`;
    }

    return `vt:analysis=${analysisId},pending`;
  } catch (error) {
    return `virustotal-error:${error instanceof Error ? error.message.slice(0, 100) : 'unknown'}`;
  }
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
