import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection } from '../../common/redis.js';

export type RetentionJobPayload = {
  tenantId?: string;
  scope?: 'channel-events' | 'audit-logs' | 'outbound-deliveries' | 'conversations' | 'attachments' | 'all';
  retentionDays?: number;
  dryRun?: boolean;
  deleteAttachmentObjects?: boolean;
};

export type RetentionScheduleOptions = {
  cronPattern: string;
  jobName: string;
  repeatKey: string;
};

export function buildRetentionScheduleOptions(env: NodeJS.ProcessEnv = process.env): RetentionScheduleOptions {
  const pattern = env.RETENTION_CRON_PATTERN?.trim();
  return {
    cronPattern: pattern && /^[*0-9\/, -]+$/.test(pattern) ? pattern : '0 3 * * *',
    jobName: 'retention:daily',
    repeatKey: 'retention:daily:all-tenants',
  };
}

@Injectable()
export class RetentionQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionQueueService.name);
  private queue?: Queue<RetentionJobPayload>;
  private registered = false;

  async onModuleInit() {
    if (process.env.RETENTION_SCHEDULE_DISABLED === 'true') {
      return;
    }
    try {
      const options = buildRetentionScheduleOptions();
      const queue = this.getQueue();
      await queue.add(options.jobName, {}, {
        repeat: { pattern: options.cronPattern },
        jobId: options.repeatKey,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      });
      this.registered = true;
    } catch (error) {
      this.logger.warn(`Retention scheduler bootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async enqueueNow(payload: RetentionJobPayload) {
    try {
      await this.getQueue().add('retention:run-now', payload, {
        removeOnComplete: 100,
        removeOnFail: 500,
      });
      return true;
    } catch (error) {
      this.logger.warn(`Retention run-now enqueue failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  isRegistered() {
    return this.registered;
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<RetentionJobPayload>('kentos.retention', {
      connection: redisConnection(),
    });
    return this.queue;
  }
}
