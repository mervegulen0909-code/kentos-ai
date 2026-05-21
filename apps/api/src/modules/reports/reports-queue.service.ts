import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection } from '../../common/redis.js';
import { LENIENT_JOB_OPTIONS } from '../../common/queue/queue-job-defaults.js';

export type ReportJobData = {
  tenantId: string;
  type: string;
  requestedBy: string;
};

@Injectable()
export class ReportsQueueService implements OnModuleDestroy {
  private queue?: Queue<ReportJobData>;

  async enqueue(payload: ReportJobData): Promise<{ jobId: string | undefined }> {
    const job = await this.getQueue().add('reports:generate', payload, LENIENT_JOB_OPTIONS);
    return { jobId: job.id };
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<ReportJobData>('kentos.reports', {
      connection: redisConnection(),
    });
    return this.queue;
  }
}
