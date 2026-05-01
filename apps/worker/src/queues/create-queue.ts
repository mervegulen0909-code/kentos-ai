import { Queue } from 'bullmq';
import type { QueueName } from './queue-names.js';

export function createQueue(name: QueueName) {
  return new Queue(name, { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } });
}
