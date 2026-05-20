import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { NotificationJobData } from '@kentos/shared';
import { DEFAULT_JOB_OPTIONS } from '../../common/queue/queue-job-defaults.js';

@Injectable()
export class NotificationQueueService implements OnModuleDestroy {
  private queue?: Queue<NotificationJobData | { deliveryId: string }>;

  async enqueueMessage(messageId: string) {
    try {
      await this.getQueue().add('send-public-message', { messageId }, {
        ...DEFAULT_JOB_OPTIONS,
        jobId: `message-${messageId}`,
      });
      return true;
    } catch (error) {
      console.warn('Notification queue enqueue failed', error);
      return false;
    }
  }

  async enqueueScheduledDelivery(deliveryId: string, delayMs: number) {
    try {
      await this.getQueue().add('send-scheduled-delivery', { deliveryId }, {
        ...DEFAULT_JOB_OPTIONS,
        jobId: `delivery-${deliveryId}`,
        delay: delayMs > 0 ? delayMs : undefined,
      });
      return true;
    } catch (error) {
      console.warn('Scheduled delivery enqueue failed', error);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<NotificationJobData | { deliveryId: string }>('kentos.notifications', {
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    });
    return this.queue;
  }
}
