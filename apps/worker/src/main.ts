import { createServer } from 'node:http';
import { Queue } from 'bullmq';
import { logger } from './logger.js';
import { initSentry } from './sentry.js';
import { processCsatJob } from './processors/csat.processor.js';
import { processMediaJob } from './processors/media.processor.js';
import { processNotificationJob } from './processors/notifications.processor.js';
import { processOutboundJob } from './processors/outbound.processor.js';
import { processRetentionJob } from './processors/retention.processor.js';
import { processSlaJob } from './processors/sla.processor.js';
import { processWebhookJob } from './processors/webhook-delivery.processor.js';
import { createQueue } from './queues/create-queue.js';
import { createWorker } from './queues/create-worker.js';
import { queueNames } from './queues/queue-names.js';
import { redisConnection } from './queues/redis-connection.js';

await initSentry(process.env.SENTRY_DSN, process.env.NODE_ENV ?? 'development');

const workers = [
  createWorker(queueNames.sla, processSlaJob),
  createWorker(queueNames.notifications, processNotificationJob),
  createWorker(queueNames.media, processMediaJob),
  createWorker(queueNames.retention, processRetentionJob),
  createWorker(queueNames.outbound, processOutboundJob),
  createWorker(queueNames.webhooks, processWebhookJob),
  createWorker(queueNames.csat, processCsatJob),
];

logger.info('KentOS worker ready', { queues: workers.map((w) => w.name) });

// ── Dead-Letter Queue for exhausted jobs ────────────────────────────────────
const dlqQueue = new Queue(queueNames.dlq, { connection: redisConnection() });

for (const worker of workers) {
  worker.on('completed', (job, result) => {
    logger.info(`[${worker.name}] job completed`, { jobId: job.id, result });
  });
  worker.on('failed', (job, error) => {
    logger.error(`[${worker.name}] job failed`, {
      jobId: job?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    // Move exhausted jobs to the DLQ
    if (job && job.attemptsMade >= (job.opts?.attempts ?? 5)) {
      dlqQueue.add('dead-letter', {
        originalQueue: worker.name,
        originalJobName: job.name,
        originalData: job.data,
        error: error instanceof Error ? error.message : String(error),
        failedAt: new Date().toISOString(),
      }, { removeOnComplete: 1_000, removeOnFail: 1_000 }).catch((dlqErr) => {
        logger.error(`[${worker.name}] failed to enqueue DLQ entry`, {
          jobId: job.id,
          dlqError: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
        });
      });
    }
  });
}

// ── Queue instances for health introspection ─────────────────────────────────
const queues = Object.values(queueNames).map((name) => createQueue(name));

// ── Health check HTTP server ──────────────────────────────────────────────────
const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 3130);
const healthServer = createServer(async (req, res) => {
  if (req.url === '/health') {
    try {
      const queueStats = await Promise.all(
        queues.map(async (q) => {
          const counts = await q.getJobCounts('active', 'completed', 'failed', 'waiting', 'delayed');
          return { name: q.name, ...counts } as { name: string; failed?: number } & Record<string, number | string | undefined>;
        }),
      );
      const totalFailed = queueStats.reduce((sum, q) => sum + Number(q.failed ?? 0), 0);
      res.writeHead(totalFailed > 100 ? 503 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: totalFailed <= 100,
        workers: workers.map((w) => w.name),
        queues: queueStats,
        ts: new Date().toISOString(),
      }));
    } catch (err) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'queue introspection failed', ts: new Date().toISOString() }));
    }
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
  await dlqQueue.close().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
