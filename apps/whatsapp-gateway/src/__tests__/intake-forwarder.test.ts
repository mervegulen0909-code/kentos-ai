import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toChannelIntakeEnvelope } from '../intake-forwarder.js';

test('toChannelIntakeEnvelope normalizes WhatsApp payload', () => {
  const envelope = toChannelIntakeEnvelope({
    tenantId: 'tnt_demo',
    provider: 'meta-cloud',
    channel: 'WHATSAPP',
    externalConversationId: 'wa-90555',
    externalMessageId: 'msg-1',
    from: '+905551112233',
    text: 'Sokak lambasi calismiyor',
    receivedAt: new Date().toISOString(),
  });

  assert.ok(envelope, 'envelope should be produced');
  assert.equal(envelope?.channel, 'WHATSAPP');
  assert.equal(envelope?.provider, 'meta-cloud');
  assert.equal(envelope?.text, 'Sokak lambasi calismiyor');
  assert.equal(envelope?.citizenContact?.phone, '+905551112233');
});

test('toChannelIntakeEnvelope skips empty text', () => {
  const envelope = toChannelIntakeEnvelope({
    tenantId: 'tnt_demo',
    provider: 'meta-cloud',
    channel: 'WHATSAPP',
    externalConversationId: 'wa-90555',
    externalMessageId: 'msg-2',
    from: '+905551112233',
    text: '   ',
    receivedAt: new Date().toISOString(),
  });

  assert.equal(envelope, null);
});
