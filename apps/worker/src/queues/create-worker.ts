import { redisConnection } from './redis-connection.js';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { QueueName } from './queue-names.js';
import { logger } from '../logger.js';

/** TTL for the idempotency lock key (1 hour). */
const JOB_LOCK_TTL_SECONDS = 3600;

let idempotencyRedis: InstanceType<typeof Redis> | null = null;

function getIdempotencyRedis(): InstanceType<typeof Redis> {
  if (!idempotencyRedis) {
    const { url } = redisConnection();
    idempotencyRedis = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true });
    // Prevent unhandled 'error' events from crashing the process
    idempotencyRedis.on('error', (err) => {
      logger.error('[worker] idempotency Redis connection error', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
    // Connect lazily so the process doesn't hang on startup
    idempotencyRedis.connect().catch((err) => {
      logger.error('[worker] idempotency Redis connect failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
  return idempotencyRedis;
}

export function createWorker<TData = unknown>(
  name: QueueName,
  processor: (job: { name: string; data: TData }) => Promise<unknown>,
) {
  return new Worker(
    name,
    async (job) => {
      const lockKey = `job-lock:${name}:${job.id}`;
      const redis = getIdempotencyRedis();
      const acquired = await redis.set(lockKey, '1', 'EX', JOB_LOCK_TTL_SECONDS, 'NX');

      if (!acquired) {
        logger.warn(`[${name}] duplicate job skipped`, { jobId: job.id });
        return { skipped: true, reason: 'duplicate' };
      }

      return processor({ name: job.name, data: job.data as TData });
    },
    { connection: redisConnection() },
  );
}
