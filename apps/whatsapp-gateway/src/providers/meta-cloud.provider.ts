import type {
  NormalizedInboundMessage,
  NormalizedMedia,
  SendMediaInput,
  SendMessageResult,
  SendTextInput,
  WhatsAppProvider,
} from '@kentos/shared';

const META_GRAPH_BASE = 'https://graph.facebook.com/v18.0';

function readMetaConfig() {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  if (!phoneNumberId || !accessToken) {
    throw new Error('META_PHONE_NUMBER_ID and META_ACCESS_TOKEN required');
  }
  const tenantId = process.env.WHATSAPP_DEFAULT_TENANT_ID?.trim() ?? '';
  return { phoneNumberId, accessToken, tenantId };
}

async function callMetaApi(
  phoneNumberId: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(`${META_GRAPH_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Meta API error ${response.status}: ${text}`);
  }

  return response.json();
}

export class MetaCloudProvider implements WhatsAppProvider {
  providerName = 'meta-cloud' as const;

  async sendText(input: SendTextInput): Promise<SendMessageResult> {
    const { phoneNumberId, accessToken } = readMetaConfig();
    const data = (await callMetaApi(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: 'text',
      text: { preview_url: false, body: input.text },
    })) as { messages: Array<{ id: string }> };

    return {
      provider: this.providerName,
      externalMessageId: data.messages[0].id,
      sentAt: new Date().toISOString(),
    };
  }

  async sendMedia(input: SendMediaInput): Promise<SendMessageResult> {
    const { phoneNumberId, accessToken } = readMetaConfig();

    const mimeType = input.media.mimeType ?? 'application/octet-stream';
    let mediaType: 'image' | 'document' | 'video' | 'audio';
    if (mimeType.startsWith('image/')) {
      mediaType = 'image';
    } else if (mimeType.startsWith('video/')) {
      mediaType = 'video';
    } else if (mimeType.startsWith('audio/')) {
      mediaType = 'audio';
    } else {
      mediaType = 'document';
    }

    const mediaPayload: Record<string, unknown> = { link: input.media.url };
    if (input.text) mediaPayload.caption = input.text;
    if (mediaType === 'document' && input.media.fileName) {
      mediaPayload.filename = input.media.fileName;
    }

    const data = (await callMetaApi(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: mediaType,
      [mediaType]: mediaPayload,
    })) as { messages: Array<{ id: string }> };

    return {
      provider: this.providerName,
      externalMessageId: data.messages[0].id,
      sentAt: new Date().toISOString(),
    };
  }

  async markRead(input: { tenantId: string; externalMessageId: string }): Promise<void> {
    const { phoneNumberId, accessToken } = readMetaConfig();
    await callMetaApi(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: input.externalMessageId,
    });
  }

  async parseWebhook(raw: unknown): Promise<NormalizedInboundMessage[]> {
    const { tenantId } = readMetaConfig();

    const payload = raw as {
      object?: string;
      entry?: Array<{
        changes?: Array<{
          field?: string;
          value?: {
            metadata?: { phone_number_id?: string };
            contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
            messages?: Array<{
              from: string;
              id: string;
              timestamp: string;
              type: string;
              text?: { body: string };
              image?: { id: string; mime_type: string; sha256?: string };
              document?: { id: string; filename?: string; mime_type: string };
              video?: { id: string; mime_type: string };
              audio?: { id: string; mime_type: string };
              sticker?: { id: string; mime_type: string };
            }>;
          };
        }>;
      }>;
    };

    if (payload?.object !== 'whatsapp_business_account') {
      return [];
    }

    const results: NormalizedInboundMessage[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value?.messages) continue;

        for (const msg of value.messages) {
          // Skip status updates (delivered/read) — they have no 'from' in the messages array
          // and appear under value.statuses, not value.messages. But guard anyway.
          if (!msg.from || !msg.id) continue;

          const receivedAt = new Date(Number(msg.timestamp) * 1000).toISOString();
          const media: NormalizedMedia[] = [];
          let text: string | undefined;

          if (msg.type === 'text' && msg.text?.body) {
            text = msg.text.body;
          } else if (msg.type === 'image' && msg.image) {
            media.push({
              providerMediaId: msg.image.id,
              mimeType: msg.image.mime_type,
            });
          } else if (msg.type === 'document' && msg.document) {
            media.push({
              providerMediaId: msg.document.id,
              mimeType: msg.document.mime_type,
              fileName: msg.document.filename,
            });
          } else if (msg.type === 'video' && msg.video) {
            media.push({
              providerMediaId: msg.video.id,
              mimeType: msg.video.mime_type,
            });
          } else if (msg.type === 'audio' && msg.audio) {
            media.push({
              providerMediaId: msg.audio.id,
              mimeType: msg.audio.mime_type,
            });
          } else if (msg.type === 'sticker' && msg.sticker) {
            media.push({
              providerMediaId: msg.sticker.id,
              mimeType: msg.sticker.mime_type,
            });
          }
          // Unsupported message types (location, reaction, etc.) → skip
          else if (msg.type !== 'text') {
            continue;
          }

          results.push({
            tenantId,
            provider: 'meta-cloud',
            channel: 'WHATSAPP',
            externalConversationId: msg.from,
            externalMessageId: msg.id,
            from: msg.from,
            text,
            media: media.length > 0 ? media : undefined,
            receivedAt,
          });
        }
      }
    }

    return results;
  }
}
