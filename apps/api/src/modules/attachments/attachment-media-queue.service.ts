import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { MediaJobData } from '@kentos/shared';

@Injectable()
export class AttachmentMediaQueueService implements OnModuleDestroy {
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
      console.warn('Media queue enqueue failed', error);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<MediaJobData>('kentos.media', {
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    });
    return this.queue;
  }
}
