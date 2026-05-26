import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { Queue } from 'bullmq';
import { redisConnection } from './redis.js';

const QUEUE_NAMES = [
  'kentos.sla',
  'kentos.notifications',
  'kentos.reports',
  'kentos.media',
  'kentos.retention',
  'kentos.outbound',
  'kentos.webhooks',
  'kentos.csat',
] as const;

/**
 * Mounts Bull Board at /admin/queues protected by HTTP Basic Auth.
 *
 * Set BULL_BOARD_USER and BULL_BOARD_PASS env vars to enable.
 * If either is missing, the endpoint returns 503 so it can be safely
 * left unconfigured until credentials are provisioned.
 */
export function mountBullBoard(app: { use: (...args: unknown[]) => void }): void {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const boardUser = process.env.BULL_BOARD_USER;
  const boardPass = process.env.BULL_BOARD_PASS;

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queues = QUEUE_NAMES.map(
    (name) => new BullMQAdapter(new Queue(name, { connection: redisConnection() })),
  );

  createBullBoard({ queues, serverAdapter });

  // Basic Auth guard — reject immediately if credentials not configured
  app.use('/admin/queues', (req: { headers: Record<string, string | undefined> }, res: { status: (c: number) => { json: (b: unknown) => void }; setHeader: (k: string, v: string) => void }, next: () => void) => {
    if (!boardUser || !boardPass) {
      res.status(503).json({ message: 'Bull Board not configured (set BULL_BOARD_USER and BULL_BOARD_PASS)' });
      return;
    }

    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="KentOS Queue Monitor"');
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const [user, pass] = Buffer.from(authHeader.slice(6), 'base64').toString().split(':');
    if (user !== boardUser || pass !== boardPass) {
      res.setHeader('WWW-Authenticate', 'Basic realm="KentOS Queue Monitor"');
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    next();
  });

  app.use('/admin/queues', serverAdapter.getRouter());
}
