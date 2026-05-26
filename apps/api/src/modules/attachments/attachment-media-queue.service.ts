import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection } from '../../common/redis.js';
import type { MediaJobData } from '@kentos/shared';

@Injectable()
export class AttachmentMediaQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(AttachmentMediaQueueService.name);
  private queue?: Queue<MediaJobData>;

  async enqueueAttachment(data: MediaJobData) {
    try {
      await this.getQueue().add('process-attachment', data, {
        jobId: `attachment-${data.attachmentId}`,
        removeOnComplete: 100,
        removeOnFail: 500,
      });
      return true;
    } catch (error) {
      this.logger.warn(`Media queue enqueue failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<MediaJobData>('kentos.media', {
      connection: redisConnection(),
    });
    return this.queue;
  }
}
