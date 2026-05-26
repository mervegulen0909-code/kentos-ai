import { redisConnection } from './redis-connection.js';
import { Queue } from 'bullmq';
import type { QueueName } from './queue-names.js';

export function createQueue(name: QueueName) {
  return new Queue(name, { connection: redisConnection() });
}
