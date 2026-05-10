import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { EmailProvider } from '../providers/email.provider.js';
import { handleGenericOutbound } from '../generic-channel.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.EMAIL_OUTBOUND_LIVE;
  delete process.env.EMAIL_PROVIDER;
  delete process.env.EMAIL_FROM_ADDRESS;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.POSTMARK_SERVER_TOKEN;
  delete process.env.INTERNAL_API_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test('EmailProvider returns dry-run envelope when EMAIL_OUTBOUND_LIVE is not "true"', async () => {
  const provider = new EmailProvider();
  const result = await provider.sendText({ tenantId: 't1', to: 'citizen@example.test', text: 'hello' });
  assert.equal(result.provider, 'smtp-email');
  assert.match(result.externalMessageId, /^email-dry-/);
  assert.ok(result.sentAt);
});

test('EmailProvider rejects live send without EMAIL_FROM_ADDRESS', async () => {
  process.env.EMAIL_OUTBOUND_LIVE = 'true';
  const provider = new EmailProvider();
  await assert.rejects(
    () => provider.sendText({ tenantId: 't1', to: 'citizen@example.test', text: 'hello' }),
    /EMAIL_FROM_ADDRESS yapilandirilmadi/,
  );
});

test('EmailProvider postmark transport rejects without POSTMARK_SERVER_TOKEN', async () => {
  process.env.EMAIL_OUTBOUND_LIVE = 'true';
  process.env.EMAIL_PROVIDER = 'postmark';
  process.env.EMAIL_FROM_ADDRESS = 'noreply@example.test';
  const provider = new EmailProvider();
  await assert.rejects(
    () => provider.sendText({ tenantId: 't1', to: 'citizen@example.test', text: 'hello' }),
    /POSTMARK_SERVER_TOKEN yapilandirilmadi/,
  );
});

test('EmailProvider smtp transport rejects without host/port', async () => {
  process.env.EMAIL_OUTBOUND_LIVE = 'true';
  process.env.EMAIL_FROM_ADDRESS = 'noreply@example.test';
  const provider = new EmailProvider();
  await assert.rejects(
    () => provider.sendText({ tenantId: 't1', to: 'citizen@example.test', text: 'hello' }),
    /SMTP_HOST\/SMTP_PORT yapilandirilmadi/,
  );
});

test('handleGenericOutbound EMAIL prefers email recipient and dry-run accepts', async () => {
  process.env.INTERNAL_API_KEY = 'secret';
  const result = await handleGenericOutbound(
    'EMAIL',
    {
      tenantId: 'smoke-tenant',
      tenantSlug: 'demo-belediye',
      channel: 'EMAIL',
      conversationId: 'cnv-1',
      externalConversationId: 'ext-1',
      recipient: { phone: '+905551112233', email: 'citizen@example.test' },
      text: 'Takip kodunuz hazirlandi.',
    },
    'secret',
  );
  assert.equal(result.accepted, true);
  assert.equal(result.delivered, true);
  assert.match(result.result?.externalMessageId ?? '', /^email-dry-/);
});

test('handleGenericOutbound EMAIL rejects missing recipient', async () => {
  process.env.INTERNAL_API_KEY = 'secret';
  const result = await handleGenericOutbound(
    'EMAIL',
    {
      tenantId: 'smoke-tenant',
      tenantSlug: 'demo-belediye',
      channel: 'EMAIL',
      conversationId: 'cnv-1',
      externalConversationId: 'ext-1',
      recipient: {},
      text: 'metin',
    },
    'secret',
  );
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'missing-recipient');
});

test('handleGenericOutbound EMAIL rejects channel mismatch', async () => {
  process.env.INTERNAL_API_KEY = 'secret';
  const result = await handleGenericOutbound(
    'EMAIL',
    {
      tenantId: 'smoke-tenant',
      tenantSlug: 'demo-belediye',
      channel: 'SMS',
      conversationId: 'cnv-1',
      externalConversationId: 'ext-1',
      recipient: { email: 'citizen@example.test' },
      text: 'metin',
    },
    'secret',
  );
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'channel-mismatch');
});

test('handleGenericOutbound EMAIL rejects invalid internal key', async () => {
  process.env.INTERNAL_API_KEY = 'secret';
  const result = await handleGenericOutbound(
    'EMAIL',
    {
      tenantId: 'smoke-tenant',
      tenantSlug: 'demo-belediye',
      channel: 'EMAIL',
      conversationId: 'cnv-1',
      externalConversationId: 'ext-1',
      recipient: { email: 'citizen@example.test' },
      text: 'metin',
    },
    'wrong-key',
  );
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'invalid-internal-key');
});
