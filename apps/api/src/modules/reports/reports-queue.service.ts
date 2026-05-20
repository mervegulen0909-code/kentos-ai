import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

export type ReportJobData = {
  tenantId: string;
  type: string;
  requestedBy: string;
};

@Injectable()
export class ReportsQueueService implements OnModuleDestroy {
  private queue?: Queue<ReportJobData>;

  async enqueue(payload: ReportJobData): Promise<{ jobId: string | undefined }> {
    const job = await this.getQueue().add('reports:generate', payload, {
      removeOnComplete: 100,
      removeOnFail: 500,
    });
    return { jobId: job.id };
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<ReportJobData>('kentos.reports', {
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    });
    return this.queue;
  }
}
