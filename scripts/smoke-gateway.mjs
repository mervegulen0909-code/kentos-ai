const baseUrl = process.env.KENTOS_GATEWAY_BASE_URL ?? 'http://127.0.0.1:3120';

function section(name) {
  console.log(`\n[${name}]`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseBody(text, path) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${path}, got: ${text.slice(0, 300)}`);
  }
}

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': options.contentType ?? 'application/json' } : {}),
    ...options.headers,
  };
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  return { status: response.status, body: parseBody(text, path), text };
}

async function expectStatus(path, expectedStatus, options = {}) {
  const result = await request(path, options);
  if (result.status !== expectedStatus) {
    throw new Error(`${options.method ?? 'GET'} ${path} expected ${expectedStatus}, got ${result.status}: ${result.text}`);
  }
  return result;
}

const unique = Date.now();
const outboundEnvelope = (channel) => ({
  tenantId: 'smoke-tenant',
  tenantSlug: 'demo-belediye',
  channel,
  conversationId: `smoke-conversation-${unique}`,
  externalConversationId: `smoke-external-${unique}`,
  recipient: { phone: '+905551112233', email: 'citizen@example.test' },
  text: 'Smoke outbound negative check.',
});

section('health');
const health = await expectStatus('/health', 200);
assert(health.body?.ok === true, 'Gateway health response missing ok=true.');
assert(typeof health.body?.ts === 'string', 'Gateway health response missing timestamp.');
console.log('gateway_health', health.status);

section('internal outbound auth');
for (const channel of ['whatsapp', 'instagram', 'facebook', 'sms', 'email']) {
  const apiChannel = channel.toUpperCase();
  const missingKey = await expectStatus(`/internal/${channel}/outbound`, 400, {
    method: 'POST',
    body: JSON.stringify(outboundEnvelope(apiChannel)),
  });
  assert(missingKey.body?.accepted === false, `${channel} missing key was not rejected.`);
  assert(missingKey.body?.reason === 'invalid-internal-key', `${channel} missing key reason mismatch.`);

  const wrongKey = await expectStatus(`/internal/${channel}/outbound`, 400, {
    method: 'POST',
    headers: { 'x-kentos-internal-key': 'wrong-key' },
    body: JSON.stringify(outboundEnvelope(apiChannel)),
  });
  assert(wrongKey.body?.accepted === false, `${channel} wrong key was not rejected.`);
  assert(wrongKey.body?.reason === 'invalid-internal-key', `${channel} wrong key reason mismatch.`);
  console.log('outbound_auth_reject', channel, missingKey.status, wrongKey.status);
}

section('webhook signatures');
for (const channel of ['instagram', 'facebook']) {
  const missingSignature = await expectStatus(`/webhooks/${channel}`, 401, {
    method: 'POST',
    body: JSON.stringify({ object: channel, entry: [] }),
  });
  assert(missingSignature.body?.error === 'meta-signature-invalid', `${channel} missing signature reason mismatch.`);

  const wrongSignature = await expectStatus(`/webhooks/${channel}`, 401, {
    method: 'POST',
    headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
    body: JSON.stringify({ object: channel, entry: [] }),
  });
  assert(wrongSignature.body?.error === 'meta-signature-invalid', `${channel} wrong signature reason mismatch.`);
  console.log('meta_signature_reject', channel, missingSignature.status, wrongSignature.status);
}

const smsBody = 'From=%2B905551112233&Body=Smoke';
const smsMissingSignature = await expectStatus('/webhooks/sms', 401, {
  method: 'POST',
  contentType: 'application/x-www-form-urlencoded',
  body: smsBody,
});
assert(smsMissingSignature.body?.error === 'twilio-signature-invalid', 'SMS missing signature reason mismatch.');

const smsWrongSignature = await expectStatus('/webhooks/sms', 401, {
  method: 'POST',
  contentType: 'application/x-www-form-urlencoded',
  headers: { 'x-twilio-signature': 'wrong-signature' },
  body: smsBody,
});
assert(smsWrongSignature.body?.error === 'twilio-signature-invalid', 'SMS wrong signature reason mismatch.');
console.log('twilio_signature_reject', smsMissingSignature.status, smsWrongSignature.status);

section('email inbound auth');
const emailMissingAuth = await request('/webhooks/email', {
  method: 'POST',
  body: JSON.stringify({ MessageID: 'msg', From: 'citizen@example.test', Subject: 's', TextBody: 't' }),
});
// 401 when basic auth is configured but missing; 503 when env not set. Either is a safe rejection.
assert([401, 503].includes(emailMissingAuth.status), `Email inbound missing auth expected 401/503, got ${emailMissingAuth.status}.`);

const emailWrongAuth = await request('/webhooks/email', {
  method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from('wrong:credentials').toString('base64') },
  body: JSON.stringify({ MessageID: 'msg', From: 'citizen@example.test', Subject: 's', TextBody: 't' }),
});
assert([401, 503].includes(emailWrongAuth.status), `Email inbound wrong auth expected 401/503, got ${emailWrongAuth.status}.`);
console.log('email_inbound_reject', emailMissingAuth.status, emailWrongAuth.status);

console.log('\ngateway smoke passed');
