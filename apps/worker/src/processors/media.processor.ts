import type { MediaJobData } from '@kentos/shared';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

type ObjectMetadata = {
  contentLength?: number;
  contentType?: string;
};

let s3Client: S3Client | null = null;

export async function processMediaJob(job: { name: string; data: MediaJobData }) {
  const payloadSummary = summarizeMediaJob(job.data);
  if (payloadSummary.status !== 'accepted') return { processor: 'media', job: job.name, ...payloadSummary };

  const metadata = await readObjectMetadata(job.data.storageKey);
  return {
    processor: 'media',
    job: job.name,
    ...summarizeMediaJob(job.data, metadata),
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
    scan: 'not-configured',
  };
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
