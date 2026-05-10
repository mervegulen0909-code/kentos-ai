import { randomBytes } from 'node:crypto';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type PresignInput = {
  tenantId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

@Injectable()
export class AttachmentStorageService {
  private client?: S3Client;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async createPresignedUpload(input: PresignInput) {
    const bucket = this.requiredConfig('S3_BUCKET');
    const expiresIn = this.readPositiveInt('S3_PRESIGN_EXPIRES_SECONDS', 900);
    const storageKey = this.buildStorageKey(input.tenantId, input.fileName);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: input.mimeType,
      ContentLength: input.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.getClient(), command, { expiresIn });
    return {
      storageKey,
      uploadUrl,
      headers: {
        'content-type': input.mimeType,
      },
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async createPresignedDownload(storageKey: string, fileName: string) {
    const bucket = this.requiredConfig('S3_BUCKET');
    const expiresIn = this.readPositiveInt('S3_DOWNLOAD_EXPIRES_SECONDS', 300);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ResponseContentDisposition: `attachment; filename="${this.safeFileName(fileName)}"`,
    });

    return {
      downloadUrl: await getSignedUrl(this.getClient(), command, { expiresIn }),
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  private getClient() {
    if (this.client) return this.client;

    const endpoint = this.config.get<string>('S3_ENDPOINT')?.trim();
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION')?.trim() || 'us-east-1',
      endpoint: endpoint || undefined,
      forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE') !== 'false',
      credentials: {
        accessKeyId: this.requiredConfig('S3_ACCESS_KEY'),
        secretAccessKey: this.requiredConfig('S3_SECRET_KEY'),
      },
    });
    return this.client;
  }

  private buildStorageKey(tenantId: string, fileName: string) {
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const safeFileName = this.safeFileName(fileName);
    return [
      'attachments',
      tenantId,
      String(now.getUTCFullYear()),
      month,
      day,
      `${randomBytes(12).toString('hex')}-${safeFileName}`,
    ].join('/');
  }

  private safeFileName(fileName: string) {
    const fallback = 'upload';
    const safe = fileName
      .trim()
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
    return safe || fallback;
  }

  private requiredConfig(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new InternalServerErrorException(`${name} yapilandirilmadi.`);
    return value;
  }

  private readPositiveInt(name: string, fallback: number) {
    const value = Number.parseInt(this.config.get<string>(name) ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
