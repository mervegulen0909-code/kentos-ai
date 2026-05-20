import { channelOutboundEnvelopeSchema, type ChannelOutboundEnvelope, type SendMessageResult, type WhatsAppProvider } from '@kentos/shared';
import { logger } from './logger.js';

export type OutboundHandlerOptions = {
  internalApiKey?: string;
  enableRealSend?: boolean;
};

export type OutboundHandlerResult = {
  accepted: boolean;
  delivered: boolean;
  reason?: string;
  result?: SendMessageResult;
  envelope: ChannelOutboundEnvelope;
};

const SAFE_LOG_PREFIX = '[KentOS Gateway Outbound]';

export async function handleWhatsAppOutbound(
  provider: WhatsAppProvider,
  raw: unknown,
  presentedKey: string | undefined,
  options: OutboundHandlerOptions = {},
): Promise<OutboundHandlerResult> {
  const expected = options.internalApiKey;
  if (expected && presentedKey !== expected) {
    return {
      accepted: false,
      delivered: false,
      reason: 'invalid-internal-key',
      envelope: raw as ChannelOutboundEnvelope,
    };
  }

  const parsed = channelOutboundEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      accepted: false,
      delivered: false,
      reason: `envelope-validation:${parsed.error.issues.map((issue) => issue.path.join('.')).join(',')}`,
      envelope: raw as ChannelOutboundEnvelope,
    };
  }

  const envelope = parsed.data;
  if (envelope.channel !== 'WHATSAPP') {
    return { accepted: false, delivered: false, reason: 'channel-mismatch', envelope };
  }

  const phone = envelope.recipient.phone;
  if (!phone) {
    return { accepted: false, delivered: false, reason: 'missing-recipient-phone', envelope };
  }

  if (!options.enableRealSend) {
    logger.info(`${SAFE_LOG_PREFIX} DRY_RUN`, { channel: envelope.channel, phone, conversationId: envelope.conversationId, textPreview: envelope.text.slice(0, 80) });
    return {
      accepted: true,
      delivered: false,
      reason: 'dry-run',
      result: {
        provider: provider.providerName,
        externalMessageId: `dry-run-${Date.now()}`,
        sentAt: new Date().toISOString(),
      },
      envelope,
    };
  }

  try {
    const result = await provider.sendText({ tenantId: envelope.tenantId, to: phone, text: envelope.text });
    logger.info(`${SAFE_LOG_PREFIX} LIVE send ok`, { channel: envelope.channel, phone, externalMessageId: result.externalMessageId });
    return { accepted: true, delivered: true, result, envelope };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'send-failed';
    logger.error(`${SAFE_LOG_PREFIX} send failed`, { channel: envelope.channel, phone, error: message });
    return { accepted: true, delivered: false, reason: message, envelope };
  }
}
