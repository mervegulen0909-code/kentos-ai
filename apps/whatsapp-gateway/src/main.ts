import type { WhatsAppProvider } from '@kentos/shared';
import { forwardInboundMessages } from './intake-forwarder.js';
import { BaileysProvider } from './providers/baileys.provider.js';
import { MetaCloudProvider } from './providers/meta-cloud.provider.js';

function createProvider(): WhatsAppProvider {
  return process.env.WHATSAPP_PROVIDER === 'meta-cloud' ? new MetaCloudProvider() : new BaileysProvider();
}

const provider: WhatsAppProvider = createProvider();

console.log(`KentOS WhatsApp gateway adapter ready: ${provider.providerName}`);

export async function handleWebhook(raw: unknown) {
  const messages = await provider.parseWebhook(raw);
  return forwardInboundMessages(messages, {
    apiBaseUrl: process.env.KENTOS_API_BASE_URL,
    internalApiKey: process.env.INTERNAL_API_KEY,
  });
}
