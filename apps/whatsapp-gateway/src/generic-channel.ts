import {
  channelOutboundEnvelopeSchema,
  type ChannelIntakeEnvelope,
  type ChannelOutboundEnvelope,
  type ChannelProvider,
  type GenericInboundMessage,
  type SendMessageResult,
} from '@kentos/shared';
import { EmailProvider } from './providers/email.provider.js';
import { FacebookMessengerProvider } from './providers/facebook.provider.js';
import { InstagramProvider } from './providers/instagram.provider.js';
import { TwilioSmsProvider } from './providers/sms.provider.js';

export type GenericChannelKey = 'INSTAGRAM' | 'FACEBOOK' | 'SMS' | 'EMAIL';

const PROVIDERS: Record<GenericChannelKey, ChannelProvider> = {
  INSTAGRAM: new InstagramProvider(),
  FACEBOOK: new FacebookMessengerProvider(),
  SMS: new TwilioSmsProvider(),
  EMAIL: new EmailProvider(),
};

export function getGenericProvider(channel: GenericChannelKey): ChannelProvider {
  const provider = PROVIDERS[channel];
  if (!provider) throw new Error(`Bilinmeyen kanal saglayicisi: ${channel}`);
  return provider;
}

export function inboundToEnvelope(message: GenericInboundMessage): ChannelIntakeEnvelope | null {
  const text = message.text?.trim();
  if (!text) return null;
  return {
    tenantId: message.tenantId,
    channel: message.channel,
    provider: message.provider,
    externalConversationId: message.externalConversationId,
    externalMessageId: message.externalMessageId,
    text,
    media: message.media,
    receivedAt: message.receivedAt,
    citizenContact: {
      phone: message.channel === 'SMS' ? message.from : undefined,
      email: message.channel === 'EMAIL' ? message.from : undefined,
      displayName: message.from,
    },
    raw: message,
  };
}

export async function forwardGenericInbound(channel: GenericChannelKey, raw: unknown) {
  const provider = getGenericProvider(channel);
  const messages = await provider.parseWebhook(raw);
  const apiBaseUrl = process.env.KENTOS_API_BASE_URL;
  const internalKey = process.env.INTERNAL_API_KEY;
  const envelopes = messages.map(inboundToEnvelope).filter((envelope): envelope is ChannelIntakeEnvelope => Boolean(envelope));

  if (!apiBaseUrl || !internalKey) {
    return { accepted: envelopes.length, delivered: 0, envelopes };
  }

  let delivered = 0;
  for (const envelope of envelopes) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/internal/channel-ingest`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-kentos-internal-key': internalKey,
      },
      body: JSON.stringify(envelope),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[${channel}] inbound forward hata ${response.status}: ${body.slice(0, 200)}`);
      continue;
    }
    delivered += 1;
  }
  return { accepted: envelopes.length, delivered, envelopes };
}

export async function handleGenericOutbound(channel: GenericChannelKey, raw: unknown, presentedKey: string | undefined) {
  const expected = process.env.INTERNAL_API_KEY;
  if (expected && presentedKey !== expected) {
    return { accepted: false, delivered: false, reason: 'invalid-internal-key' };
  }
  const parsed = channelOutboundEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return { accepted: false, delivered: false, reason: 'envelope-validation' };
  }
  const envelope: ChannelOutboundEnvelope = parsed.data;
  if (envelope.channel !== channel) {
    return { accepted: false, delivered: false, reason: 'channel-mismatch' };
  }
  const recipient = channel === 'EMAIL'
    ? envelope.recipient.email ?? envelope.recipient.phone
    : envelope.recipient.phone ?? envelope.recipient.email;
  if (!recipient) return { accepted: false, delivered: false, reason: 'missing-recipient' };

  const provider = getGenericProvider(channel);
  let result: SendMessageResult | undefined;
  try {
    result = await provider.sendText({ tenantId: envelope.tenantId, to: recipient, text: envelope.text });
  } catch (error) {
    return { accepted: true, delivered: false, reason: error instanceof Error ? error.message : 'send-failed' };
  }
  return { accepted: true, delivered: true, result };
}
