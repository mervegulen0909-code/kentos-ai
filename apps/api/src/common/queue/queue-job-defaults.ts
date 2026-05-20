import type { JobsOptions } from 'bullmq';

/**
 * Default job options for all BullMQ queues.
 * 5 attempts with exponential backoff: 2s → 4s → 8s → 16s → 32s
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2_000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

/**
 * Lenient options for fire-and-forget jobs (reports, media, retention).
 * Fewer retries — failures are non-critical.
 */
export const LENIENT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: 50,
  removeOnFail: 200,
};
