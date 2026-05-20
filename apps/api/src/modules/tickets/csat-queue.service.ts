import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LENIENT_JOB_OPTIONS } from '../../common/queue/queue-job-defaults.js';

type CsatJobData = {
  ticketId: string;
  tenantId: string;
};

@Injectable()
export class CsatQueueService implements OnModuleDestroy {
  private queue?: Queue<CsatJobData>;

  async enqueueCsat(ticketId: string, tenantId: string, delayMs = 3_600_000) {
    // Default: send CSAT 1 hour after ticket resolved
    try {
      await this.getQueue().add('csat:send', { ticketId, tenantId }, {
        ...LENIENT_JOB_OPTIONS,
        jobId: `csat-${ticketId}`,
        delay: delayMs,
      });
      return true;
    } catch (error) {
      console.warn('CSAT enqueue failed', error);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<CsatJobData>('kentos.csat', {
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    });
    return this.queue;
  }
}
