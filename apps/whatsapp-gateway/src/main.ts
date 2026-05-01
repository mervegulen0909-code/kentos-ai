import type { WhatsAppProvider } from '@kentos/shared';
import { BaileysProvider } from './providers/baileys.provider.js';

const provider: WhatsAppProvider = new BaileysProvider();

console.log(`KentOS WhatsApp gateway adapter ready: ${provider.providerName}`);
