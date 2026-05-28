import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection } from '../../common/redis.js';
import { LENIENT_JOB_OPTIONS } from '../../common/queue/queue-job-defaults.js';

export type DigestJobData = { tenantId: string; managerEmail: string };

const QUEUE_NAME = 'kentos.digest';
const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class DigestQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(DigestQueueService.name);
  private queue?: Queue<DigestJobData>;

  async enqueueOnce(tenantId: string, managerEmail: string) {
    try {
      await this.getQueue().add('digest:weekly', { tenantId, managerEmail }, {
        ...LENIENT_JOB_OPTIONS,
        jobId: `digest-manual-${tenantId}-${Date.now()}`,
      });
      return true;
    } catch (err) {
      this.logger.warn(`Digest enqueue failed: ${String(err)}`);
      return false;
    }
  }

  async scheduleWeekly(tenantId: string, managerEmail: string) {
    try {
      await this.getQueue().add('digest:weekly', { tenantId, managerEmail }, {
        ...LENIENT_JOB_OPTIONS,
        jobId: `digest-weekly-${tenantId}`,
        repeat: { every: WEEKLY_MS },
        removeOnComplete: 50,
      });
      return true;
    } catch (err) {
      this.logger.warn(`Digest weekly schedule failed: ${String(err)}`);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<DigestJobData>(QUEUE_NAME, { connection: redisConnection() });
    return this.queue;
  }
}
