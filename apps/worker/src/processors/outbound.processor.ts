import { OutboundDeliveryState } from '@kentos/database';
import type { ChannelOutboundEnvelope, IntakeChannel } from '@kentos/shared';
import { getPrismaClient } from '../prisma-client.js';

type OutboundJobData = {
  deliveryId: string;
};

const OUTBOUND_GATEWAY_PATHS: Partial<Record<IntakeChannel, string>> = {
  WHATSAPP: '/internal/whatsapp/outbound',
  INSTAGRAM: '/internal/instagram/outbound',
  FACEBOOK: '/internal/facebook/outbound',
  SMS: '/internal/sms/outbound',
};

function resolveGatewayUrl(channel: IntakeChannel): string | null {
  const path = OUTBOUND_GATEWAY_PATHS[channel];
  if (!path) return null;
  const channelKey = channel.toUpperCase();
  const directOverride = process.env[`${channelKey}_GATEWAY_OUTBOUND_URL`];
  if (directOverride) return directOverride;
  const baseUrl = process.env[`${channelKey}_GATEWAY_BASE_URL`] ?? process.env.CHANNEL_GATEWAY_BASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export async function processOutboundJob(job: { name: string; data: OutboundJobData }) {
  const prisma = getPrismaClient();
  const delivery = await prisma.outboundDelivery.findUnique({
    where: { id: job.data.deliveryId },
    include: { tenant: { select: { slug: true } } },
  });
  if (!delivery) return { skipped: true, reason: 'delivery-not-found' };
  if (delivery.state === OutboundDeliveryState.DELIVERED || delivery.state === OutboundDeliveryState.SKIPPED) {
    return { skipped: true, reason: `state-${delivery.state}` };
  }

  const channel = delivery.channel as IntakeChannel;
  const gatewayUrl = resolveGatewayUrl(channel);
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!gatewayUrl || !internalKey) {
    await prisma.outboundDelivery.update({
      where: { id: delivery.id },
      data: {
        state: OutboundDeliveryState.PENDING,
        lastError: 'gateway-or-key-missing',
      },
    });
    return { skipped: true, reason: 'gateway-config-missing' };
  }

  const envelope: ChannelOutboundEnvelope = {
    tenantId: delivery.tenantId,
    tenantSlug: delivery.tenant?.slug ?? '',
    channel,
    conversationId: delivery.conversationId ?? '',
    externalConversationId: delivery.externalConversationId ?? undefined,
    recipient: {
      phone: delivery.recipientPhone ?? undefined,
      email: delivery.recipientEmail ?? undefined,
    },
    text: delivery.body,
    templateKey: delivery.templateKey ?? undefined,
  };

  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-kentos-internal-key': internalKey,
      },
      body: JSON.stringify(envelope),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      await prisma.outboundDelivery.update({
        where: { id: delivery.id },
        data: {
          state: OutboundDeliveryState.FAILED,
          attempts: { increment: 1 },
          lastError: `gateway-${response.status}:${detail.slice(0, 160)}`,
        },
      });
      throw new Error(`gateway-${response.status}`);
    }
    const payload = (await response.json().catch(() => ({}))) as { result?: { externalMessageId?: string } };
    await prisma.outboundDelivery.update({
      where: { id: delivery.id },
      data: {
        state: OutboundDeliveryState.DISPATCHED,
        attempts: { increment: 1 },
        dispatchedAt: new Date(),
        externalMessageId: payload.result?.externalMessageId ?? null,
        lastError: null,
      },
    });
    return { processor: 'outbound', deliveryId: delivery.id, channel, status: 'DISPATCHED' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-outbound-error';
    await prisma.outboundDelivery.update({
      where: { id: delivery.id },
      data: {
        state: OutboundDeliveryState.FAILED,
        attempts: { increment: 1 },
        lastError: message.slice(0, 200),
      },
    });
    throw error;
  }
}
