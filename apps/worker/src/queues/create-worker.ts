import { Worker } from 'bullmq';
import type { QueueName } from './queue-names.js';

export function createWorker<TData = unknown>(
  name: QueueName,
  processor: (job: { name: string; data: TData }) => Promise<unknown>,
) {
  return new Worker(
    name,
    async (job) => processor({ name: job.name, data: job.data as TData }),
    { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } },
  );
}
