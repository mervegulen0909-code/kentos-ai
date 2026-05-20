import { logger } from './logger.js';
import { processMediaJob } from './processors/media.processor.js';
import { processNotificationJob } from './processors/notifications.processor.js';
import { processOutboundJob } from './processors/outbound.processor.js';
import { processReportJob } from './processors/reports.processor.js';
import { processRetentionJob } from './processors/retention.processor.js';
import { processSlaJob } from './processors/sla.processor.js';
import { createWorker } from './queues/create-worker.js';
import { queueNames } from './queues/queue-names.js';

const workers = [
  createWorker(queueNames.sla, processSlaJob),
  createWorker(queueNames.notifications, processNotificationJob),
  createWorker(queueNames.reports, processReportJob),
  createWorker(queueNames.media, processMediaJob),
  createWorker(queueNames.retention, processRetentionJob),
  createWorker(queueNames.outbound, processOutboundJob),
];

logger.info('KentOS worker ready', { queues: workers.map((w) => w.name) });

for (const worker of workers) {
  worker.on('completed', (job, result) => {
    logger.info(`[${worker.name}] job completed`, { jobId: job.id, result });
  });
  worker.on('failed', (job, error) => {
    logger.error(`[${worker.name}] job failed`, {
      jobId: job?.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

async function shutdown(signal: string) {
  logger.info(`Shutting down worker`, { signal });
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
