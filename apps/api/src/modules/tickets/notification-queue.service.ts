import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { NotificationJobData } from '@kentos/shared';

@Injectable()
export class NotificationQueueService implements OnModuleDestroy {
  private queue?: Queue<NotificationJobData>;

  async enqueueMessage(messageId: string) {
    try {
      await this.getQueue().add('send-public-message', { messageId }, {
        jobId: `message-${messageId}`,
        removeOnComplete: 100,
        removeOnFail: 500,
      });
      return true;
    } catch (error) {
      console.warn('Notification queue enqueue failed', error);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<NotificationJobData>('kentos.notifications', {
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    });
    return this.queue;
  }
}
