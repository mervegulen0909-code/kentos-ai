import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection } from '../../common/redis.js';

const DEFAULT_CRON = '*/5 * * * *'; // Her 5 dakikada bir SLA kontrolü

@Injectable()
export class SlaQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaQueueService.name);
  private queue?: Queue;

  async onModuleInit() {
    if (process.env.SLA_SCHEDULE_DISABLED === 'true') {
      this.logger.log('SLA scheduler disabled via SLA_SCHEDULE_DISABLED=true');
      return;
    }

    const pattern = this.resolvePattern();
    try {
      const q = this.getQueue();
      await q.add(
        'sla:check',
        {},
        {
          repeat: { pattern },
          jobId: 'sla:scheduled:cron',
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 100 },
        },
      );
      this.logger.log(`SLA cron registered: ${pattern}`);
    } catch (err) {
      this.logger.warn(`SLA cron bootstrap failed: ${String(err)}`);
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  async enqueueNow() {
    await this.getQueue().add('sla:run-now', {}, { removeOnComplete: 20, removeOnFail: 50 });
  }

  private resolvePattern(): string {
    const env = process.env.SLA_CRON_PATTERN?.trim();
    return env && /^[*0-9\/, -]+$/.test(env) ? env : DEFAULT_CRON;
  }

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue('kentos.sla', { connection: redisConnection() });
    }
    return this.queue;
  }
}
