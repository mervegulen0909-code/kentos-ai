import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { EmailProvider } from '../providers/email.provider.js';
import { handleGenericOutbound } from '../generic-channel.js';
import { verifyPostmarkBasicAuth } from '../webhook-signatures.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.EMAIL_OUTBOUND_LIVE;
  delete process.env.EMAIL_PROVIDER;
  delete process.env.EMAIL_FROM_ADDRESS;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.POSTMARK_SERVER_TOKEN;
  delete process.env.INTERNAL_API_KEY;
  delete process.env.EMAIL_DEFAULT_TENANT_ID;
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

test('EmailProvider parseWebhook returns empty when EMAIL_DEFAULT_TENANT_ID not set', async () => {
  const provider = new EmailProvider();
  const out = await provider.parseWebhook({
    MessageID: 'msg-1',
    From: 'citizen@example.test',
    Subject: 'Hello',
    TextBody: 'Yardim lazim',
    Date: '2026-05-10T12:00:00Z',
  });
  assert.deepEqual(out, []);
});

test('EmailProvider parseWebhook builds inbound message with subject + body', async () => {
  process.env.EMAIL_DEFAULT_TENANT_ID = 'tenant-1';
  const provider = new EmailProvider();
  const out = await provider.parseWebhook({
    MessageID: 'msg-2',
    From: 'citizen@example.test',
    FromFull: { Email: 'citizen@example.test', Name: 'Test' },
    Subject: 'Yol cukuru',
    TextBody: 'Sokakta cukur var.',
    Date: '2026-05-10T12:00:00Z',
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].tenantId, 'tenant-1');
  assert.equal(out[0].channel, 'EMAIL');
  assert.equal(out[0].from, 'citizen@example.test');
  assert.equal(out[0].externalMessageId, 'msg-2');
  assert.ok(out[0].text);
  assert.match(out[0].text!, /Yol cukuru/);
  assert.match(out[0].text!, /Sokakta cukur/);
});

test('EmailProvider parseWebhook prefers StrippedTextReply when present', async () => {
  process.env.EMAIL_DEFAULT_TENANT_ID = 'tenant-1';
  const provider = new EmailProvider();
  const out = await provider.parseWebhook({
    MessageID: 'msg-3',
    From: 'citizen@example.test',
    Subject: 'Re: Soru',
    TextBody: '... full quoted thread with previous email body ...',
    StrippedTextReply: 'Sadece yeni cevap.',
  });
  assert.equal(out.length, 1);
  assert.ok(out[0].text);
  assert.match(out[0].text!, /Sadece yeni cevap/);
});

test('verifyPostmarkBasicAuth accepts correct user/password', () => {
  const header = 'Basic ' + Buffer.from('u:p').toString('base64');
  assert.equal(verifyPostmarkBasicAuth(header, 'u', 'p'), true);
});

test('verifyPostmarkBasicAuth rejects missing or wrong header', () => {
  assert.equal(verifyPostmarkBasicAuth(undefined, 'u', 'p'), false);
  assert.equal(verifyPostmarkBasicAuth('Bearer xxx', 'u', 'p'), false);
  const bad = 'Basic ' + Buffer.from('u:wrong').toString('base64');
  assert.equal(verifyPostmarkBasicAuth(bad, 'u', 'p'), false);
});

test('verifyPostmarkBasicAuth tolerates colons in password', () => {
  const password = 'p:assw:ord';
  const header = 'Basic ' + Buffer.from(`u:${password}`).toString('base64');
  assert.equal(verifyPostmarkBasicAuth(header, 'u', password), true);
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
