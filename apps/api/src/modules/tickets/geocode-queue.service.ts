import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection } from '../../common/redis.js';
import { DEFAULT_JOB_OPTIONS } from '../../common/queue/queue-job-defaults.js';

@Injectable()
export class GeocodeQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(GeocodeQueueService.name);
  private queue?: Queue;

  async enqueue(ticketId: string, latitude: number, longitude: number) {
    try {
      await this.getQueue().add('reverse-geocode', { ticketId, latitude, longitude }, {
        ...DEFAULT_JOB_OPTIONS,
        jobId: `geocode-${ticketId}`,
        delay: 2_000, // give ticket a moment to settle
      });
    } catch (error) {
      this.logger.warn(`Geocode enqueue failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue('kentos.geocode', { connection: redisConnection() });
    return this.queue;
  }
}
