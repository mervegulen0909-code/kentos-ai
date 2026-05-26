import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OutboundDeliveryState } from '@kentos/database';
import { runOutboundJob } from './outbound.processor.js';

function buildPrisma(delivery?: Partial<{ id: string; state: OutboundDeliveryState; channel: string }>) {
  const updates: unknown[] = [];
  return {
    updates,
    prisma: {
      outboundDelivery: {
        findUnique: async () => delivery === undefined ? null : {
          id: delivery.id ?? 'delivery-1',
          tenantId: 'tenant-1',
          conversationId: 'conversation-1',
          channel: delivery.channel ?? 'WHATSAPP',
          state: delivery.state ?? OutboundDeliveryState.PENDING,
          recipientPhone: '+905551112233',
          recipientEmail: null,
          externalConversationId: 'external-1',
          templateKey: null,
          body: 'Takip kodunuz hazirlandi.',
          tenant: { slug: 'demo-belediye' },
        },
        update: async (input: unknown) => {
          updates.push(input);
          return {};
        },
      },
    },
  };
}

test('runOutboundJob dispatches through gateway and marks delivery dispatched', async () => {
  const { prisma, updates } = buildPrisma({});
  const result = await runOutboundJob({ name: 'channel-outbound', data: { deliveryId: 'delivery-1' } }, {
    prisma,
    internalApiKey: 'internal-key',
    resolveGatewayUrl: () => 'http://gateway/internal/whatsapp/outbound',
    fetch: async (_url, init) => {
      assert.equal((init?.headers as Record<string, string>)['x-kentos-internal-key'], 'internal-key');
      return new Response(JSON.stringify({ result: { externalMessageId: 'provider-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.deepEqual(result, { processor: 'outbound', deliveryId: 'delivery-1', channel: 'WHATSAPP', status: 'DISPATCHED' });
  assert.equal(updates.length, 1);
  const update = updates[0] as { data: { state: OutboundDeliveryState; externalMessageId: string } };
  assert.equal(update.data.state, OutboundDeliveryState.DISPATCHED);
  assert.equal(update.data.externalMessageId, 'provider-1');
});

test('runOutboundJob leaves one failed attempt and bounded retry signal on gateway failure', async () => {
  const { prisma, updates } = buildPrisma({});
  await assert.rejects(
    runOutboundJob({ name: 'channel-outbound', data: { deliveryId: 'delivery-1' } }, {
      prisma,
      internalApiKey: 'internal-key',
      resolveGatewayUrl: () => 'http://gateway/internal/whatsapp/outbound',
      fetch: async () => new Response('provider down', { status: 503 }),
    }),
    /gateway-503/,
  );

  assert.equal(updates.length, 1);
  const update = updates[0] as { data: { state: OutboundDeliveryState; attempts: { increment: number }; lastError: string } };
  assert.equal(update.data.state, OutboundDeliveryState.FAILED);
  assert.deepEqual(update.data.attempts, { increment: 1 });
  assert.match(update.data.lastError, /gateway-503:provider down/);
});

test('runOutboundJob fails fast when gateway configuration is missing', async () => {
  const { prisma, updates } = buildPrisma({});
  await assert.rejects(
    runOutboundJob({ name: 'channel-outbound', data: { deliveryId: 'delivery-1' } }, {
      prisma,
      internalApiKey: '',
      resolveGatewayUrl: () => null,
      fetch: async () => new Response('{}'),
    }),
    /gateway-config-missing/,
  );

  const update = updates[0] as { data: { state: OutboundDeliveryState; attempts: { increment: number }; lastError: string } };
  assert.equal(update.data.state, OutboundDeliveryState.FAILED);
  assert.deepEqual(update.data.attempts, { increment: 1 });
  assert.equal(update.data.lastError, 'gateway-or-key-missing');
});

test('runOutboundJob skips already dispatched terminal deliveries', async () => {
  const { prisma, updates } = buildPrisma({ state: OutboundDeliveryState.DISPATCHED });
  const result = await runOutboundJob({ name: 'channel-outbound', data: { deliveryId: 'delivery-1' } }, {
    prisma,
    internalApiKey: 'internal-key',
    resolveGatewayUrl: () => 'http://gateway/internal/whatsapp/outbound',
    fetch: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.deepEqual(result, { skipped: true, reason: 'state-DISPATCHED' });
  assert.equal(updates.length, 0);
});
