import { createServer } from 'node:http';
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

// ── Health check HTTP server ──────────────────────────────────────────────────
const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 3130);
const healthServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      workers: workers.map((w) => w.name),
      ts: new Date().toISOString(),
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
healthServer.listen(healthPort, () => {
  logger.info('Worker health endpoint listening', { port: healthPort, path: '/health' });
});

async function shutdown(signal: string) {
  logger.info(`Shutting down worker`, { signal });
  healthServer.close();
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
