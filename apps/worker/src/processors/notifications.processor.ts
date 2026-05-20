import { PrismaClient } from '@kentos/database';
import type { NotificationJobData } from '@kentos/shared';
import { logger } from '../logger.js';

const prisma = new PrismaClient();

function providerName() {
  return process.env.WHATSAPP_PROVIDER === 'meta-cloud' ? 'meta-cloud' : 'baileys';
}

function resolveGatewayUrl(): string | null {
  const directOverride = process.env.WHATSAPP_GATEWAY_OUTBOUND_URL;
  if (directOverride) return directOverride;
  const base =
    process.env.WHATSAPP_GATEWAY_BASE_URL ??
    process.env.KENTOS_GATEWAY_BASE_URL ??
    process.env.CHANNEL_GATEWAY_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/internal/whatsapp/outbound`;
}

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
  const message = await prisma.ticketMessage.findFirst({
    where: { id: job.data.messageId },
    include: {
      ticket: {
        include: {
          citizen: true,
          tenant: { select: { slug: true } },
        },
      },
    },
  });

  if (!message) {
    return { processor: 'notifications', job: job.name, skipped: 'message_not_found' };
  }

  const skipReason = getNotificationSkipReason(message as Parameters<typeof getNotificationSkipReason>[0]);
  const to = message.ticket.citizen?.phone?.trim();
  if (skipReason || !to) {
    return { processor: 'notifications', job: job.name, skipped: skipReason ?? 'not_deliverable' };
  }

  const provider = providerName();

  // Check idempotency before sending
  const existingDeliveryEvent = await prisma.channelEvent.findFirst({
    where: {
      tenantId: message.tenantId,
      channel: 'WHATSAPP',
      provider,
      externalEventId: message.externalMessageId ?? undefined,
    },
    select: { id: true },
  });

  if (existingDeliveryEvent && message.externalMessageId) {
    return {
      processor: 'notifications',
      job: job.name,
      delivered: true,
      idempotent: true,
      provider,
      externalMessageId: message.externalMessageId,
    };
  }

  // Call the real WhatsApp gateway
  const gatewayUrl = resolveGatewayUrl();
  const internalKey = process.env.INTERNAL_API_KEY;

  if (!gatewayUrl || !internalKey) {
    logger.error('[notifications] Gateway URL or internal key not configured — cannot deliver WhatsApp notification', {
      messageId: message.id,
      tenantId: message.tenantId,
    });
    throw new Error(`notifications-gateway-config-missing: messageId=${message.id}`);
  }

  const envelope = {
    tenantId: message.tenantId,
    tenantSlug: message.ticket.tenant?.slug ?? '',
    channel: 'WHATSAPP',
    conversationId: message.ticketId ?? message.id,
    recipient: { phone: to },
    text: message.body,
  };

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-kentos-internal-key': internalKey,
    },
    body: JSON.stringify(envelope),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.error('[notifications] Gateway call failed', {
      messageId: message.id,
      status: response.status,
      detail: detail.slice(0, 200),
    });
    throw new Error(`notifications-gateway-error:${response.status} messageId=${message.id}`);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    accepted?: boolean;
    result?: { externalMessageId?: string };
  };

  if (!payload.accepted) {
    logger.warn('[notifications] Gateway rejected delivery', { messageId: message.id, payload });
    throw new Error(`notifications-gateway-rejected: messageId=${message.id}`);
  }

  const sentExternalMessageId = payload.result?.externalMessageId ?? `sent-${Date.now()}-${to}`;

  // Persist the real external message ID
  if (!message.externalMessageId) {
    await prisma.ticketMessage.update({
      where: { id: message.id },
      data: { externalMessageId: sentExternalMessageId },
    });
  }

  // Record the outbound delivery event (with race condition guard)
  try {
    await prisma.channelEvent.create({
      data: {
        tenantId: message.tenantId,
        channel: 'WHATSAPP',
        provider,
        externalEventId: sentExternalMessageId,
        payload: {
          direction: 'OUTBOUND',
          messageId: message.id,
          ticketId: message.ticketId,
          to,
          body: message.body,
        },
        processedAt: new Date(),
      },
    });
  } catch (error) {
    const existing = await prisma.channelEvent.findFirst({
      where: {
        tenantId: message.tenantId,
        channel: 'WHATSAPP',
        provider,
        externalEventId: sentExternalMessageId,
      },
      select: { id: true },
    });
    if (!existing) throw error;
    return {
      processor: 'notifications',
      job: job.name,
      delivered: true,
      idempotent: true,
      provider,
      externalMessageId: sentExternalMessageId,
    };
  }

  return {
    processor: 'notifications',
    job: job.name,
    delivered: true,
    provider,
    externalMessageId: sentExternalMessageId,
  };
}
