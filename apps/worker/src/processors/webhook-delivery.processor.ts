import { PrismaClient } from '@kentos/database';
import { createHmac } from 'node:crypto';

// Block SSRF: private/loopback IPs and internal service hostnames
const PRIVATE_URL_RE =
  /^https?:\/\/(localhost|127\.|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|\[::1\]|redis|postgres|minio|clamav|caddy|api|worker|admin-web|citizen-web)/i;

function assertPublicUrl(url: string) {
  if (PRIVATE_URL_RE.test(url)) {
    throw new Error(`webhook-blocked-private-url: ${url}`);
  }
}

const prisma = new PrismaClient();

type WebhookJobData = {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  tenantId: string;
};

export async function processWebhookJob(job: { name: string; data: WebhookJobData }) {
  const { webhookId, event, payload, tenantId } = job.data;

  const webhook = await prisma.tenantWebhook.findFirst({
    where: { id: webhookId, tenantId, isActive: true },
  });

  if (!webhook) {
    return { processor: 'webhook-delivery', skipped: 'webhook-not-found-or-inactive' };
  }

  assertPublicUrl(webhook.url);

  const events = Array.isArray(webhook.events) ? webhook.events as string[] : [];
  if (!events.includes(event)) {
    return { processor: 'webhook-delivery', skipped: 'event-not-subscribed' };
  }

  const body = JSON.stringify({ event, tenantId, payload, deliveredAt: new Date().toISOString() });
  const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kentos-signature': `sha256=${signature}`,
        'x-kentos-event': event,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`webhook-http-${response.status}`);
    }

    return { processor: 'webhook-delivery', webhookId, event, delivered: true };
  } finally {
    clearTimeout(timeout);
  }
}
