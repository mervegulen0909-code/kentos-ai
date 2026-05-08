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

console.log('KentOS worker ready for SLA, notification, reporting and media queues.');
console.log(`Registered queues: ${workers.map((worker) => worker.name).join(', ')}`);

for (const worker of workers) {
  worker.on('completed', (job, result) => {
    console.log(`[${worker.name}] completed`, job.id, result);
  });
  worker.on('failed', (job, error) => {
    console.error(`[${worker.name}] failed`, job?.id, error);
  });
}

async function shutdown(signal: string) {
  console.log(`Shutting down worker on ${signal}...`);
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
