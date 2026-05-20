import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WhatsAppProvider } from '@kentos/shared';
import { handleWhatsAppOutbound } from '../outbound-handler.js';

function fakeProvider(): WhatsAppProvider {
  return {
    providerName: 'meta-cloud',
    async sendText(input) {
      return {
        provider: 'meta-cloud',
        externalMessageId: `live-${input.to}`,
        sentAt: new Date().toISOString(),
      };
    },
    async sendMedia() {
      throw new Error('not used');
    },
    async markRead() {},
    async parseWebhook() {
      return [];
    },
  };
}

const baseEnvelope = {
  tenantId: 'tnt_demo',
  tenantSlug: 'demo-belediye',
  channel: 'WHATSAPP' as const,
  conversationId: 'cnv_1',
  externalConversationId: 'wa-90555',
  recipient: { phone: '+905551112233' },
  text: 'Takip kodunuz hazirlandi.',
};

test('handleWhatsAppOutbound rejects without internal key', async () => {
  const result = await handleWhatsAppOutbound(fakeProvider(), baseEnvelope, 'wrong-key', { internalApiKey: 'secret' });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'invalid-internal-key');
});

test('handleWhatsAppOutbound runs dry by default and logs', async () => {
  const result = await handleWhatsAppOutbound(fakeProvider(), baseEnvelope, 'secret', { internalApiKey: 'secret' });
  assert.equal(result.accepted, true);
  assert.equal(result.delivered, false);
  assert.equal(result.reason, 'dry-run');
  assert.ok(result.result?.externalMessageId.startsWith('dry-run-'));
});

test('handleWhatsAppOutbound delivers when live send is enabled', async () => {
  const result = await handleWhatsAppOutbound(fakeProvider(), baseEnvelope, 'secret', {
    internalApiKey: 'secret',
    enableRealSend: true,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.delivered, true);
  assert.equal(result.result?.externalMessageId, 'live-+905551112233');
});

test('handleWhatsAppOutbound rejects missing recipient phone', async () => {
  const result = await handleWhatsAppOutbound(
    fakeProvider(),
    { ...baseEnvelope, recipient: {} },
    'secret',
    { internalApiKey: 'secret' },
  );
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'envelope-validation:recipient');
});
