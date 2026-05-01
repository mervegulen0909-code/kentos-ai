import type {
  NormalizedInboundMessage,
  SendMediaInput,
  SendMessageResult,
  SendTextInput,
  WhatsAppProvider,
} from '@kentos/shared';

export class MetaCloudProvider implements WhatsAppProvider {
  providerName = 'meta-cloud' as const;

  async sendText(input: SendTextInput): Promise<SendMessageResult> {
    return { provider: this.providerName, externalMessageId: `meta-pending-${input.to}`, sentAt: new Date().toISOString() };
  }

  async sendMedia(input: SendMediaInput): Promise<SendMessageResult> {
    return { provider: this.providerName, externalMessageId: `meta-media-pending-${input.to}`, sentAt: new Date().toISOString() };
  }

  async markRead(): Promise<void> {}

  async parseWebhook(): Promise<NormalizedInboundMessage[]> {
    return [];
  }
}
