import { z } from 'zod';

export const normalizedMediaSchema = z.object({
  providerMediaId: z.string().optional(),
  mimeType: z.string(),
  fileName: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
  url: z.string().url().optional(),
});

export const normalizedInboundMessageSchema = z.object({
  tenantId: z.string().min(1),
  provider: z.enum(['baileys', 'meta-cloud']),
  channel: z.literal('WHATSAPP'),
  externalConversationId: z.string().min(1),
  externalMessageId: z.string().min(1),
  from: z.string().min(1),
  text: z.string().optional(),
  media: z.array(normalizedMediaSchema).optional(),
  receivedAt: z.string().datetime(),
});

export type NormalizedMedia = z.infer<typeof normalizedMediaSchema>;
export type NormalizedInboundMessage = z.infer<typeof normalizedInboundMessageSchema>;

export type SendTextInput = {
  tenantId: string;
  to: string;
  text: string;
};

export type SendMediaInput = SendTextInput & {
  media: NormalizedMedia;
};

export type SendMessageResult = {
  provider: string;
  externalMessageId: string;
  sentAt: string;
};

export interface WhatsAppProvider {
  providerName: 'baileys' | 'meta-cloud';
  sendText(input: SendTextInput): Promise<SendMessageResult>;
  sendMedia(input: SendMediaInput): Promise<SendMessageResult>;
  markRead(input: { tenantId: string; externalMessageId: string }): Promise<void>;
  parseWebhook(raw: unknown): Promise<NormalizedInboundMessage[]>;
}

export type GenericChannelKind = 'INSTAGRAM' | 'FACEBOOK' | 'SMS';

export type GenericInboundMessage = {
  tenantId: string;
  channel: GenericChannelKind;
  provider: string;
  externalConversationId: string;
  externalMessageId: string;
  from: string;
  text?: string;
  media?: NormalizedMedia[];
  receivedAt: string;
};

export type GenericSendInput = {
  tenantId: string;
  to: string;
  text: string;
};

export interface ChannelProvider {
  channel: GenericChannelKind;
  providerName: string;
  parseWebhook(raw: unknown): Promise<GenericInboundMessage[]>;
  sendText(input: GenericSendInput): Promise<SendMessageResult>;
}
