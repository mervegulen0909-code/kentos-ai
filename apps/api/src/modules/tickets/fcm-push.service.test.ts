import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FcmPushService } from './fcm-push.service.js';

function makeSvc() {
  return new FcmPushService();
}

// Track fetch calls
let lastFetchUrl: string | null = null;
let lastFetchOptions: RequestInit | null = null;
let fetchShouldFail = false;
let fetchStatus = 200;

const originalFetch = globalThis.fetch;

function mockFetch(url: string, opts?: RequestInit): Promise<Response> {
  lastFetchUrl = url;
  lastFetchOptions = opts ?? null;
  if (fetchShouldFail) return Promise.reject(new Error('network error'));
  return Promise.resolve({
    ok: fetchStatus >= 200 && fetchStatus < 300,
    status: fetchStatus,
    text: () => Promise.resolve(''),
  } as Response);
}

function setup() {
  lastFetchUrl = null;
  lastFetchOptions = null;
  fetchShouldFail = false;
  fetchStatus = 200;
  (globalThis as Record<string, unknown>).fetch = mockFetch;
}

function teardown() {
  (globalThis as Record<string, unknown>).fetch = originalFetch;
  delete process.env.FCM_SERVER_KEY;
}

// --- send() ---

test('send: no-op when FCM_SERVER_KEY is absent', async () => {
  setup();
  delete process.env.FCM_SERVER_KEY;
  const svc = makeSvc();
  await svc.send({ token: 'tok', title: 'T', body: 'B' });
  assert.equal(lastFetchUrl, null, 'fetch must not be called');
  teardown();
});

test('send: no-op when FCM_SERVER_KEY is empty string', async () => {
  setup();
  process.env.FCM_SERVER_KEY = '   ';
  const svc = makeSvc();
  await svc.send({ token: 'tok', title: 'T', body: 'B' });
  assert.equal(lastFetchUrl, null);
  teardown();
});

test('send: calls FCM endpoint when key is configured', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'test-server-key';
  const svc = makeSvc();
  await svc.send({ token: 'device-token', title: 'Hello', body: 'World' });
  assert.equal(lastFetchUrl, 'https://fcm.googleapis.com/fcm/send');
  teardown();
});

test('send: sets Authorization header', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'mykey123';
  const svc = makeSvc();
  await svc.send({ token: 'tok', title: 'T', body: 'B' });
  const headers = lastFetchOptions?.headers as Record<string, string>;
  assert.equal(headers['Authorization'], 'key=mykey123');
  teardown();
});

test('send: body contains token and notification', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'k';
  const svc = makeSvc();
  await svc.send({ token: 'device-xyz', title: 'Title', body: 'Body text' });
  const parsed = JSON.parse(lastFetchOptions?.body as string);
  assert.equal(parsed.to, 'device-xyz');
  assert.equal(parsed.notification.title, 'Title');
  assert.equal(parsed.notification.body, 'Body text');
  teardown();
});

test('send: includes data payload when provided', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'k';
  const svc = makeSvc();
  await svc.send({ token: 't', title: 'T', body: 'B', data: { ticketId: '123', status: 'RESOLVED' } });
  const parsed = JSON.parse(lastFetchOptions?.body as string);
  assert.equal(parsed.data.ticketId, '123');
  assert.equal(parsed.data.status, 'RESOLVED');
  teardown();
});

test('send: data defaults to empty object when not provided', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'k';
  const svc = makeSvc();
  await svc.send({ token: 't', title: 'T', body: 'B' });
  const parsed = JSON.parse(lastFetchOptions?.body as string);
  assert.deepEqual(parsed.data, {});
  teardown();
});

test('send: does not throw on HTTP error response', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'k';
  fetchStatus = 401;
  const svc = makeSvc();
  await assert.doesNotReject(() => svc.send({ token: 't', title: 'T', body: 'B' }));
  teardown();
});

test('send: does not throw on network error', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'k';
  fetchShouldFail = true;
  const svc = makeSvc();
  await assert.doesNotReject(() => svc.send({ token: 't', title: 'T', body: 'B' }));
  teardown();
});

test('send: uses POST method', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'k';
  const svc = makeSvc();
  await svc.send({ token: 't', title: 'T', body: 'B' });
  assert.equal(lastFetchOptions?.method, 'POST');
  teardown();
});

// --- sendToMany() ---

test('sendToMany: no-op with empty tokens array', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'k';
  const svc = makeSvc();
  await svc.sendToMany([], 'T', 'B');
  assert.equal(lastFetchUrl, null);
  teardown();
});

test('sendToMany: calls send for each token', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'k';
  let callCount = 0;
  const svc = makeSvc();
  const original = svc.send.bind(svc);
  svc.send = async (p) => { callCount++; return original(p); };
  await svc.sendToMany(['tok1', 'tok2', 'tok3'], 'T', 'B');
  assert.equal(callCount, 3);
  teardown();
});

test('sendToMany: resolves even if some sends fail', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'k';
  fetchShouldFail = true;
  const svc = makeSvc();
  await assert.doesNotReject(() => svc.sendToMany(['t1', 't2', 't3'], 'T', 'B'));
  teardown();
});

test('sendToMany: passes data to each send call', async () => {
  setup();
  process.env.FCM_SERVER_KEY = 'k';
  const svc = makeSvc();
  await svc.sendToMany(['tok'], 'Title', 'Body', { key: 'val' });
  const parsed = JSON.parse(lastFetchOptions?.body as string);
  assert.equal(parsed.data.key, 'val');
  teardown();
});
