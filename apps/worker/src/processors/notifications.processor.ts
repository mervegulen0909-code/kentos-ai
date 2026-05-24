import { OutboundDeliveryState } from '@kentos/database';
import type { NotificationJobData } from '@kentos/shared';
import { Queue } from 'bullmq';
import { getPrismaClient } from '../prisma-client.js';

const OUTBOUND_QUEUE = 'kentos.outbound';
const TICKET_MSG_IDEMPOTENCY_PREFIX = 'ticket-msg:';

export function getNotificationSkipReason(message: {
  senderType: string;
  visibility: string;
  ticket: { citizen: { phone: string | null } | null };
}) {
  const to = message.ticket.citizen?.phone?.trim();
  if (!to) return 'missing_phone';
  if (message.senderType === 'CITIZEN') return 'citizen_originated';
  if (message.visibility !== 'PUBLIC') return 'non_public';
  return null;
}

export async function processNotificationJob(job: { name: string; data: NotificationJobData }) {
  const prisma = getPrismaClient();

  const message = await prisma.ticketMessage.findFirst({
    where: { id: job.data.messageId },
    include: {
      ticket: {
        include: { citizen: true },
      },
    },
  });

  if (!message) {
    return { processor: 'notifications', job: job.name, skipped: 'message_not_found' };
  }

  const skipReason = getNotificationSkipReason(message);
  const to = message.ticket.citizen?.phone?.trim();
  if (skipReason || !to) {
    return { processor: 'notifications', job: job.name, skipped: skipReason ?? 'not_deliverable' };
  }

  const idempotencyKey = `${TICKET_MSG_IDEMPOTENCY_PREFIX}${message.id}`;
  const existing = await prisma.outboundDelivery.findFirst({
    where: { tenantId: message.tenantId, externalConversationId: idempotencyKey },
    select: { id: true, state: true },
  });
  if (existing) {
    return { processor: 'notifications', job: job.name, skipped: 'already_dispatched', deliveryId: existing.id };
  }

  const delivery = await prisma.outboundDelivery.create({
    data: {
      tenantId: message.tenantId,
      channel: 'WHATSAPP',
      state: OutboundDeliveryState.PENDING,
      recipientPhone: to,
      externalConversationId: idempotencyKey,
      body: message.body,
    },
  });

  const queue = new Queue(OUTBOUND_QUEUE, {
    connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
  });
  try {
    await queue.add(
      'channel-outbound',
      { deliveryId: delivery.id },
      {
        jobId: `outbound-${delivery.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  } finally {
    await queue.close();
  }

  return {
    processor: 'notifications',
    job: job.name,
    dispatched: true,
    deliveryId: delivery.id,
    channel: 'WHATSAPP',
    recipientPhone: to,
  };
}
