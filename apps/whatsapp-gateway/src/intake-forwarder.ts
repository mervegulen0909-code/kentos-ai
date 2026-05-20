import { channelIntakeEnvelopeSchema, type ChannelIntakeEnvelope, type NormalizedInboundMessage } from '@kentos/shared';

export function toChannelIntakeEnvelope(message: NormalizedInboundMessage): ChannelIntakeEnvelope | null {
  const text = message.text?.trim();
  if (!text) return null;

  return channelIntakeEnvelopeSchema.parse({
    tenantId: message.tenantId,
    channel: 'WHATSAPP',
    provider: message.provider,
    externalConversationId: message.externalConversationId,
    externalMessageId: message.externalMessageId,
    text,
    media: message.media,
    receivedAt: message.receivedAt,
    citizenContact: {
      phone: message.from,
    },
    raw: message,
  });
}

export type ForwardInboundOptions = {
  apiBaseUrl?: string;
  internalApiKey?: string;
};

export async function forwardInboundMessages(messages: NormalizedInboundMessage[], options: ForwardInboundOptions = {}) {
  const envelopes = messages.map(toChannelIntakeEnvelope).filter((envelope): envelope is ChannelIntakeEnvelope => Boolean(envelope));
  if (!options.apiBaseUrl || !options.internalApiKey) {
    return {
      accepted: envelopes.length,
      skipped: messages.length - envelopes.length,
      delivered: 0,
      envelopes,
    };
  }

  let delivered = 0;
  const errors: Array<{ externalMessageId: string | undefined; error: string }> = [];

  for (const envelope of envelopes) {
    try {
      const response = await fetch(`${options.apiBaseUrl.replace(/\/$/, '')}/internal/channel-ingest`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-kentos-internal-key': options.internalApiKey,
        },
        body: JSON.stringify(envelope),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        errors.push({ externalMessageId: envelope.externalMessageId, error: `HTTP ${response.status}: ${detail.slice(0, 200)}` });
        continue;
      }
      delivered += 1;
    } catch (err) {
      errors.push({ externalMessageId: envelope.externalMessageId, error: err instanceof Error ? err.message : 'unknown-error' });
    }
  }

  return {
    accepted: envelopes.length,
    skipped: messages.length - envelopes.length,
    delivered,
    failed: errors.length,
    errors,
    envelopes,
  };
}
