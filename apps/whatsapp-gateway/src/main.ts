import type { WhatsAppProvider } from '@kentos/shared';
import { forwardGenericInbound, handleGenericOutbound, type GenericChannelKey } from './generic-channel.js';
import { forwardInboundMessages } from './intake-forwarder.js';
import { logger } from './logger.js';
import { handleWhatsAppOutbound } from './outbound-handler.js';
import { BaileysProvider } from './providers/baileys.provider.js';
import { MetaCloudProvider } from './providers/meta-cloud.provider.js';

function createProvider(): WhatsAppProvider {
  return process.env.WHATSAPP_PROVIDER === 'meta-cloud' ? new MetaCloudProvider() : new BaileysProvider();
}

const provider: WhatsAppProvider = createProvider();

// ── Kanal durumu başlangıç logu ───────────────────────────────────────────────
const channelFlags: Record<string, string> = {
  WHATSAPP:  process.env.WHATSAPP_OUTBOUND_LIVE  === 'true' ? 'LIVE 🟢' : 'DRY-RUN 🟡',
  INSTAGRAM: process.env.INSTAGRAM_OUTBOUND_LIVE === 'true' ? 'LIVE 🟢' : 'DRY-RUN 🟡',
  FACEBOOK:  process.env.FACEBOOK_OUTBOUND_LIVE  === 'true' ? 'LIVE 🟢' : 'DRY-RUN 🟡',
  SMS:       process.env.SMS_OUTBOUND_LIVE        === 'true' ? 'LIVE 🟢' : 'DRY-RUN 🟡',
  EMAIL:     process.env.EMAIL_OUTBOUND_LIVE      === 'true' ? 'LIVE 🟢' : 'DRY-RUN 🟡',
};
logger.info(`KentOS WhatsApp gateway adapter ready`, { provider: provider.providerName });
logger.info('Outbound kanal durumları', channelFlags);

export async function handleWebhook(raw: unknown) {
  const messages = await provider.parseWebhook(raw);
  return forwardInboundMessages(messages, {
    apiBaseUrl: process.env.KENTOS_API_BASE_URL,
    internalApiKey: process.env.INTERNAL_API_KEY,
  });
}

export async function handleOutbound(raw: unknown, presentedKey: string | undefined) {
  return handleWhatsAppOutbound(provider, raw, presentedKey, {
    internalApiKey: process.env.INTERNAL_API_KEY,
    enableRealSend: process.env.WHATSAPP_OUTBOUND_LIVE === 'true',
  });
}

export async function handleChannelWebhook(channel: GenericChannelKey, raw: unknown) {
  return forwardGenericInbound(channel, raw);
}

export async function handleChannelOutbound(channel: GenericChannelKey, raw: unknown, presentedKey: string | undefined) {
  return handleGenericOutbound(channel, raw, presentedKey);
}
