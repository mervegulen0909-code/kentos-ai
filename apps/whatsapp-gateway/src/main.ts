import type { WhatsAppProvider } from '@kentos/shared';
import { BaileysProvider } from './providers/baileys.provider.js';
import { MetaCloudProvider } from './providers/meta-cloud.provider.js';

function createProvider(): WhatsAppProvider {
  return process.env.WHATSAPP_PROVIDER === 'meta-cloud' ? new MetaCloudProvider() : new BaileysProvider();
}

const provider: WhatsAppProvider = createProvider();

console.log(`KentOS WhatsApp gateway adapter ready: ${provider.providerName}`);
