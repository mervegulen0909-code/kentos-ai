import type { ChannelProvider, GenericInboundMessage, GenericSendInput, SendMessageResult } from '@kentos/shared';

type InstagramWebhookEntry = {
  id?: string;
  messaging?: Array<{
    sender?: { id?: string };
    recipient?: { id?: string };
    timestamp?: number;
    message?: { mid?: string; text?: string };
  }>;
};

type InstagramWebhookPayload = {
  object?: string;
  entry?: InstagramWebhookEntry[];
};

const TENANT_ENV_FALLBACK = 'INSTAGRAM_DEFAULT_TENANT_ID';

export class InstagramProvider implements ChannelProvider {
  channel = 'INSTAGRAM' as const;
  providerName = 'meta-graph-instagram';

  async parseWebhook(raw: unknown): Promise<GenericInboundMessage[]> {
    const payload = raw as InstagramWebhookPayload | undefined;
    if (!payload || payload.object !== 'instagram') return [];
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
          channel: 'INSTAGRAM',
          provider: this.providerName,
          externalConversationId: `ig:${senderId}`,
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
    if (process.env.INSTAGRAM_OUTBOUND_LIVE !== 'true') {
      console.log(`[Instagram DM] dry-run → ${input.to}: "${input.text.slice(0, 60)}"`);
      return {
        provider: this.providerName,
        externalMessageId: `ig-dry-${Date.now()}`,
        sentAt: new Date().toISOString(),
      };
    }

    const accessToken = process.env.INSTAGRAM_GRAPH_TOKEN;
    if (!accessToken) throw new Error('INSTAGRAM_GRAPH_TOKEN yapilandirilmadi.');

    const response = await fetch('https://graph.facebook.com/v18.0/me/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: input.to },
        message: { text: input.text },
        messaging_type: 'RESPONSE',
      }),
    });
    if (!response.ok) throw new Error(`Instagram send failed: ${response.status}`);
    const payload = (await response.json().catch(() => ({}))) as { message_id?: string };
    return {
      provider: this.providerName,
      externalMessageId: payload.message_id ?? `ig-${Date.now()}`,
      sentAt: new Date().toISOString(),
    };
  }
}
