import type {
  NormalizedInboundMessage,
  SendMediaInput,
  SendMessageResult,
  SendTextInput,
  WhatsAppProvider,
} from '@kentos/shared';

export class BaileysProvider implements WhatsAppProvider {
  providerName = 'baileys' as const;

  async sendText(input: SendTextInput): Promise<SendMessageResult> {
    return { provider: this.providerName, externalMessageId: `demo-${Date.now()}-${input.to}`, sentAt: new Date().toISOString() };
  }

  async sendMedia(input: SendMediaInput): Promise<SendMessageResult> {
    return { provider: this.providerName, externalMessageId: `demo-media-${Date.now()}-${input.to}`, sentAt: new Date().toISOString() };
  }

  async markRead(): Promise<void> {}

  async parseWebhook(raw: unknown): Promise<NormalizedInboundMessage[]> {
    if (!Array.isArray(raw)) return [];
    return raw as NormalizedInboundMessage[];
  }
}
