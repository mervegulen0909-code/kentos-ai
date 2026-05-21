import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection } from '../../common/redis.js';
import { LENIENT_JOB_OPTIONS } from '../../common/queue/queue-job-defaults.js';

type CsatJobData = {
  ticketId: string;
  tenantId: string;
};

@Injectable()
export class CsatQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(CsatQueueService.name);
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
      this.logger.warn(`CSAT enqueue failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<CsatJobData>('kentos.csat', {
      connection: redisConnection(),
    });
    return this.queue;
  }
}
