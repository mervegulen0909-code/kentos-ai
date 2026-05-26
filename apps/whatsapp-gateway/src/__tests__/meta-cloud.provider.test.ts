import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { MetaCloudProvider } from '../providers/meta-cloud.provider.js';

// ─── Env helpers ────────────────────────────────────────────────────────────

function setMetaEnv() {
  process.env.META_PHONE_NUMBER_ID = '12345678901234';
  process.env.META_ACCESS_TOKEN = 'EAAtest-token';
  process.env.WHATSAPP_DEFAULT_TENANT_ID = 'tenant-1';
}

function clearMetaEnv() {
  delete process.env.META_PHONE_NUMBER_ID;
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.WHATSAPP_DEFAULT_TENANT_ID;
}

// ─── Fetch mock helpers ──────────────────────────────────────────────────────

type FetchCall = { url: string; init?: RequestInit };

function mockFetch(statusOrCalls: number | { status: number; body: unknown }, body?: unknown) {
  const calls: FetchCall[] = [];
  const status = typeof statusOrCalls === 'number' ? statusOrCalls : statusOrCalls.status;
  const responseBody = typeof statusOrCalls === 'number' ? body : statusOrCalls.body;

  (globalThis as Record<string, unknown>).fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseBody,
      text: async () => JSON.stringify(responseBody),
    };
  };

  return calls;
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  setMetaEnv();
});

afterEach(() => {
  (globalThis as Record<string, unknown>).fetch = originalFetch;
  clearMetaEnv();
});

// ─── Real Meta webhook payloads ──────────────────────────────────────────────

const textMessagePayload = {
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        metadata: { phone_number_id: '12345678901234' },
        contacts: [{ profile: { name: 'Ali Veli' }, wa_id: '905551234567' }],
        messages: [{
          from: '905551234567',
          id: 'wamid.abc123',
          timestamp: '1715299200',
          type: 'text',
          text: { body: 'Merhaba, talebim var.' },
        }],
      },
    }],
  }],
};

const imageMessagePayload = {
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        messages: [{
          from: '905551234567',
          id: 'wamid.img001',
          timestamp: '1715299300',
          type: 'image',
          image: { id: 'media-img-001', mime_type: 'image/jpeg', sha256: 'abc' },
        }],
      },
    }],
  }],
};

const documentMessagePayload = {
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        messages: [{
          from: '905559876543',
          id: 'wamid.doc001',
          timestamp: '1715299400',
          type: 'document',
          document: { id: 'media-doc-001', filename: 'rapor.pdf', mime_type: 'application/pdf' },
        }],
      },
    }],
  }],
};

const statusUpdatePayload = {
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        statuses: [{ id: 'wamid.abc123', status: 'delivered', timestamp: '1715299210' }],
        // No messages array — status updates don't appear in value.messages
      },
    }],
  }],
};

const multipleMessagesPayload = {
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        messages: [
          { from: '905551111111', id: 'wamid.m1', timestamp: '1715299200', type: 'text', text: { body: 'Mesaj 1' } },
          { from: '905552222222', id: 'wamid.m2', timestamp: '1715299250', type: 'text', text: { body: 'Mesaj 2' } },
        ],
      },
    }],
  }],
};

// ─── parseWebhook tests ──────────────────────────────────────────────────────

test('parseWebhook returns empty array for non-whatsapp_business_account object', async () => {
  const provider = new MetaCloudProvider();
  const result = await provider.parseWebhook({ object: 'page', entry: [] });
  assert.deepEqual(result, []);
});

test('parseWebhook returns empty array for null/undefined payload', async () => {
  const provider = new MetaCloudProvider();
  assert.deepEqual(await provider.parseWebhook(null), []);
  assert.deepEqual(await provider.parseWebhook(undefined), []);
  assert.deepEqual(await provider.parseWebhook({}), []);
});

test('parseWebhook parses a text message correctly', async () => {
  const provider = new MetaCloudProvider();
  const result = await provider.parseWebhook(textMessagePayload);

  assert.equal(result.length, 1);
  const msg = result[0];
  assert.equal(msg.tenantId, 'tenant-1');
  assert.equal(msg.provider, 'meta-cloud');
  assert.equal(msg.channel, 'WHATSAPP');
  assert.equal(msg.externalConversationId, '905551234567');
  assert.equal(msg.externalMessageId, 'wamid.abc123');
  assert.equal(msg.from, '905551234567');
  assert.equal(msg.text, 'Merhaba, talebim var.');
  assert.equal(msg.media, undefined);
  assert.equal(msg.receivedAt, new Date(1715299200 * 1000).toISOString());
});

test('parseWebhook parses an image message with media array', async () => {
  const provider = new MetaCloudProvider();
  const result = await provider.parseWebhook(imageMessagePayload);

  assert.equal(result.length, 1);
  assert.equal(result[0].externalMessageId, 'wamid.img001');
  assert.equal(result[0].text, undefined);
  assert.ok(Array.isArray(result[0].media));
  assert.equal(result[0].media!.length, 1);
  assert.equal(result[0].media![0].providerMediaId, 'media-img-001');
  assert.equal(result[0].media![0].mimeType, 'image/jpeg');
});

test('parseWebhook parses a document message with filename', async () => {
  const provider = new MetaCloudProvider();
  const result = await provider.parseWebhook(documentMessagePayload);

  assert.equal(result.length, 1);
  assert.equal(result[0].externalMessageId, 'wamid.doc001');
  assert.ok(Array.isArray(result[0].media));
  assert.equal(result[0].media![0].mimeType, 'application/pdf');
  assert.equal(result[0].media![0].fileName, 'rapor.pdf');
});

test('parseWebhook silently ignores status update entries (no messages array)', async () => {
  const provider = new MetaCloudProvider();
  const result = await provider.parseWebhook(statusUpdatePayload);
  assert.deepEqual(result, []);
});

test('parseWebhook returns multiple messages from one payload', async () => {
  const provider = new MetaCloudProvider();
  const result = await provider.parseWebhook(multipleMessagesPayload);
  assert.equal(result.length, 2);
  assert.equal(result[0].externalMessageId, 'wamid.m1');
  assert.equal(result[1].externalMessageId, 'wamid.m2');
  assert.equal(result[0].text, 'Mesaj 1');
  assert.equal(result[1].text, 'Mesaj 2');
});

test('parseWebhook skips non-messages change fields', async () => {
  const provider = new MetaCloudProvider();
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [
        { field: 'account_alerts', value: { alerts: ['something'] } },
        { field: 'messages', value: { messages: [{ from: '90555', id: 'mid1', timestamp: '1715299200', type: 'text', text: { body: 'Hi' } }] } },
      ],
    }],
  };
  const result = await provider.parseWebhook(payload);
  assert.equal(result.length, 1);
  assert.equal(result[0].externalMessageId, 'mid1');
});

// ─── sendText tests ──────────────────────────────────────────────────────────

test('sendText calls Meta Graph API and returns externalMessageId', async () => {
  const calls = mockFetch(200, { messages: [{ id: 'wamid.sent001' }] });
  const provider = new MetaCloudProvider();
  const result = await provider.sendText({ tenantId: 'tenant-1', to: '+905551234567', text: 'Mesajınız alındı.' });

  assert.equal(result.provider, 'meta-cloud');
  assert.equal(result.externalMessageId, 'wamid.sent001');
  assert.ok(result.sentAt);

  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/12345678901234/messages'));
  const body = JSON.parse(calls[0].init!.body as string);
  assert.equal(body.messaging_product, 'whatsapp');
  assert.equal(body.to, '+905551234567');
  assert.equal(body.type, 'text');
  assert.equal(body.text.body, 'Mesajınız alındı.');

  const headers = calls[0].init!.headers as Record<string, string>;
  assert.ok(headers['Authorization']?.includes('EAAtest-token'));
});

test('sendText throws on 4xx Meta API error', async () => {
  mockFetch(400, { error: { message: 'Invalid phone number' } });
  const provider = new MetaCloudProvider();
  await assert.rejects(
    () => provider.sendText({ tenantId: 'tenant-1', to: 'bad-phone', text: 'Test' }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Meta API error 400/);
      return true;
    },
  );
});

test('sendText throws on 5xx Meta API error', async () => {
  mockFetch(500, { error: { message: 'Internal Server Error' } });
  const provider = new MetaCloudProvider();
  await assert.rejects(
    () => provider.sendText({ tenantId: 'tenant-1', to: '+905551234567', text: 'Test' }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Meta API error 500/);
      return true;
    },
  );
});

// ─── sendMedia tests ─────────────────────────────────────────────────────────

test('sendMedia sends image type with link and caption', async () => {
  const calls = mockFetch(200, { messages: [{ id: 'wamid.media001' }] });
  const provider = new MetaCloudProvider();
  const result = await provider.sendMedia({
    tenantId: 'tenant-1',
    to: '+905551234567',
    text: 'Dosyanız eklendi.',
    media: { mimeType: 'image/jpeg', url: 'https://cdn.example.com/image.jpg' },
  });

  assert.equal(result.externalMessageId, 'wamid.media001');
  const body = JSON.parse(calls[0].init!.body as string);
  assert.equal(body.type, 'image');
  assert.equal(body.image.link, 'https://cdn.example.com/image.jpg');
  assert.equal(body.image.caption, 'Dosyanız eklendi.');
});

test('sendMedia sends document type with filename', async () => {
  const calls = mockFetch(200, { messages: [{ id: 'wamid.doc002' }] });
  const provider = new MetaCloudProvider();
  await provider.sendMedia({
    tenantId: 'tenant-1',
    to: '+905551234567',
    text: '',
    media: { mimeType: 'application/pdf', url: 'https://cdn.example.com/doc.pdf', fileName: 'rapor.pdf' },
  });

  const body = JSON.parse(calls[0].init!.body as string);
  assert.equal(body.type, 'document');
  assert.equal(body.document.filename, 'rapor.pdf');
});

// ─── markRead tests ──────────────────────────────────────────────────────────

test('markRead calls Meta API with correct status:read payload', async () => {
  const calls = mockFetch(200, {});
  const provider = new MetaCloudProvider();
  await provider.markRead({ tenantId: 'tenant-1', externalMessageId: 'wamid.abc123' });

  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].init!.body as string);
  assert.equal(body.messaging_product, 'whatsapp');
  assert.equal(body.status, 'read');
  assert.equal(body.message_id, 'wamid.abc123');
});

// ─── Missing env var tests ───────────────────────────────────────────────────

test('sendText throws meaningful error when META_PHONE_NUMBER_ID is missing', async () => {
  delete process.env.META_PHONE_NUMBER_ID;
  const provider = new MetaCloudProvider();
  await assert.rejects(
    () => provider.sendText({ tenantId: 'tenant-1', to: '+90555', text: 'test' }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /META_PHONE_NUMBER_ID/);
      return true;
    },
  );
});

test('sendText throws meaningful error when META_ACCESS_TOKEN is missing', async () => {
  delete process.env.META_ACCESS_TOKEN;
  const provider = new MetaCloudProvider();
  await assert.rejects(
    () => provider.sendText({ tenantId: 'tenant-1', to: '+90555', text: 'test' }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /META_ACCESS_TOKEN/);
      return true;
    },
  );
});

test('parseWebhook uses WHATSAPP_DEFAULT_TENANT_ID for tenantId in messages', async () => {
  process.env.WHATSAPP_DEFAULT_TENANT_ID = 'custom-tenant-42';
  const provider = new MetaCloudProvider();
  const result = await provider.parseWebhook(textMessagePayload);
  assert.equal(result[0].tenantId, 'custom-tenant-42');
});
