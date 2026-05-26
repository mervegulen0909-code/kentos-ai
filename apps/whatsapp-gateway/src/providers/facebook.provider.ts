import type { ChannelProvider, GenericInboundMessage, GenericSendInput, SendMessageResult } from '@kentos/shared';
import { logger } from '../logger.js';

type FacebookWebhookEntry = {
  id?: string;
  messaging?: Array<{
    sender?: { id?: string };
    recipient?: { id?: string };
    timestamp?: number;
    message?: { mid?: string; text?: string };
  }>;
};

type FacebookWebhookPayload = {
  object?: string;
  entry?: FacebookWebhookEntry[];
};

const TENANT_ENV_FALLBACK = 'FACEBOOK_DEFAULT_TENANT_ID';

export class FacebookMessengerProvider implements ChannelProvider {
  channel = 'FACEBOOK' as const;
  providerName = 'meta-graph-messenger';

  async parseWebhook(raw: unknown): Promise<GenericInboundMessage[]> {
    const payload = raw as FacebookWebhookPayload | undefined;
    if (!payload || payload.object !== 'page') return [];
    const tenantId = process.env[TENANT_ENV_FALLBACK];
    if (!tenantId) return [];

    const messages: GenericInboundMessage[] = [];
    for (const entry of payload.entry ?? []) {
      for (const message of entry.messaging ?? []) {
        const text = message.message?.text?.trim();
        const senderId = message.sender?.id;
        if (!text || !senderId || !message.message?.mid) continue;
        messages.push({
          tenantId,
          channel: 'FACEBOOK',
          provider: this.providerName,
          externalConversationId: `fb:${senderId}`,
          externalMessageId: message.message.mid,
          from: senderId,
          text,
          receivedAt: new Date((message.timestamp ?? Date.now()) * 1).toISOString(),
        });
      }
    }
    return messages;
  }

  async sendText(input: GenericSendInput): Promise<SendMessageResult> {
    if (process.env.FACEBOOK_OUTBOUND_LIVE !== 'true') {
      logger.info('[FACEBOOK] dry-run', { to: input.to, textPreview: input.text.slice(0, 60) });
      return {
        provider: this.providerName,
        externalMessageId: `fb-dry-${Date.now()}`,
        sentAt: new Date().toISOString(),
      };
    }

    const accessToken = process.env.FACEBOOK_PAGE_TOKEN;
    if (!accessToken) throw new Error('FACEBOOK_PAGE_TOKEN yapilandirilmadi.');

    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: input.to },
        message: { text: input.text },
        messaging_type: 'RESPONSE',
      }),
    });
    if (!response.ok) throw new Error(`Facebook send failed: ${response.status}`);
    const payload = (await response.json().catch(() => ({}))) as { message_id?: string };
    return {
      provider: this.providerName,
      externalMessageId: payload.message_id ?? `fb-${Date.now()}`,
      sentAt: new Date().toISOString(),
    };
  }
}
