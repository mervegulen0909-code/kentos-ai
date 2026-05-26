import { OutboundDeliveryState } from '@kentos/database';
import type { ChannelOutboundEnvelope, IntakeChannel } from '@kentos/shared';
import { getPrismaClient } from '../prisma-client.js';

const WA_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in ms
const WA_DEFAULT_TEMPLATE = process.env.WA_DEFAULT_NOTIFICATION_TEMPLATE ?? 'kentos_notification';

/**
 * F2 — WA HSM: Check whether the last inbound message from a phone number
 * was within the Meta 24-hour conversation window.
 * Returns null if within window (use free-form text), or a template name if outside.
 */
async function resolveWaTemplateKey(
  tenantId: string,
  recipientPhone: string,
): Promise<string | null> {
  const prismaRaw = getPrismaClient() as unknown as {
    channelEvent: {
      findFirst(input: unknown): Promise<{ createdAt: Date } | null>;
    };
  };

  const lastInbound = await prismaRaw.channelEvent.findFirst({
    where: {
      tenantId,
      channel: 'WHATSAPP',
      externalConversationId: recipientPhone,
    },
    orderBy: { createdAt: 'desc' },
  } as unknown);

  if (!lastInbound) return WA_DEFAULT_TEMPLATE; // no prior contact — must use template
  const age = Date.now() - lastInbound.createdAt.getTime();
  return age > WA_WINDOW_MS ? WA_DEFAULT_TEMPLATE : null; // null = within window, use text
}

type OutboundJobData = {
  deliveryId: string;
};

type OutboundDeliveryRecord = {
  id: string;
  tenantId: string;
  conversationId: string | null;
  channel: string;
  state: OutboundDeliveryState;
  recipientPhone: string | null;
  recipientEmail: string | null;
  externalConversationId: string | null;
  templateKey: string | null;
  body: string;
  tenant: { slug: string } | null;
};

type OutboundPrisma = {
  outboundDelivery: {
    findUnique(input: unknown): Promise<OutboundDeliveryRecord | null>;
    update(input: unknown): Promise<unknown>;
  };
};

type OutboundDependencies = {
  prisma: OutboundPrisma;
  fetch: typeof fetch;
  resolveGatewayUrl?: (channel: IntakeChannel) => string | null;
  internalApiKey?: string;
};

const OUTBOUND_GATEWAY_PATHS: Partial<Record<IntakeChannel, string>> = {
  WHATSAPP: '/internal/whatsapp/outbound',
  INSTAGRAM: '/internal/instagram/outbound',
  FACEBOOK: '/internal/facebook/outbound',
  SMS: '/internal/sms/outbound',
  EMAIL: '/internal/email/outbound',
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
  return runOutboundJob(job, {
    prisma: getPrismaClient() as unknown as OutboundPrisma,
    fetch,
    resolveGatewayUrl,
    internalApiKey: process.env.INTERNAL_API_KEY,
  });
}

export async function runOutboundJob(job: { name: string; data: OutboundJobData }, deps: OutboundDependencies) {
  const prisma = deps.prisma;
  const delivery = await prisma.outboundDelivery.findUnique({
    where: { id: job.data.deliveryId },
    include: { tenant: { select: { slug: true } } },
  });
  if (!delivery) return { skipped: true, reason: 'delivery-not-found' };
  if (
    delivery.state === OutboundDeliveryState.DISPATCHED ||
    delivery.state === OutboundDeliveryState.DELIVERED ||
    delivery.state === OutboundDeliveryState.SKIPPED
  ) {
    return { skipped: true, reason: `state-${delivery.state}` };
  }

  const channel = delivery.channel as IntakeChannel;
  const gatewayUrl = (deps.resolveGatewayUrl ?? resolveGatewayUrl)(channel);
  const internalKey = deps.internalApiKey;
  if (!gatewayUrl || !internalKey) {
    await prisma.outboundDelivery.update({
      where: { id: delivery.id },
      data: {
        state: OutboundDeliveryState.FAILED,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        lastError: 'gateway-or-key-missing',
      },
    });
    throw new Error('gateway-config-missing');
  }

  // F2 — WA HSM: Resolve template key for WhatsApp messages
  let resolvedTemplateKey = delivery.templateKey ?? undefined;
  if (channel === 'WHATSAPP' && !resolvedTemplateKey && delivery.recipientPhone) {
    try {
      const templateKey = await resolveWaTemplateKey(delivery.tenantId, delivery.recipientPhone);
      if (templateKey) resolvedTemplateKey = templateKey;
    } catch {
      // Non-fatal — fall back to text send (may fail at Meta if outside window)
    }
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
    templateKey: resolvedTemplateKey,
  };

  try {
    const response = await deps.fetch(gatewayUrl, {
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
      throw new Error(`gateway-${response.status}:${detail.slice(0, 160)}`);
    }
    const payload = (await response.json().catch(() => ({}))) as { result?: { externalMessageId?: string } };
    await prisma.outboundDelivery.update({
      where: { id: delivery.id },
      data: {
        state: OutboundDeliveryState.DISPATCHED,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
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
        lastAttemptAt: new Date(),
        lastError: message.slice(0, 200),
      },
    });
    throw error;
  }
}
