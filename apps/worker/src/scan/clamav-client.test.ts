import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { parseClamavResponse, readClamavConfigFromEnv, scanStreamWithClamav } from './clamav-client.js';

type StubBehavior = 'clean' | 'infected' | 'error' | 'silent';

async function startStub(behavior: StubBehavior) {
  const received: { greeting: string; chunkSizes: number[]; bytes: number } = { greeting: '', chunkSizes: [], bytes: 0 };
  const server = createServer((socket: Socket) => {
    let buffer = Buffer.alloc(0);
    let greetingDone = false;
    socket.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      if (!greetingDone) {
        const nullIndex = buffer.indexOf(0);
        if (nullIndex === -1) return;
        received.greeting = buffer.subarray(0, nullIndex).toString('utf8');
        buffer = buffer.subarray(nullIndex + 1);
        greetingDone = true;
      }

      while (buffer.length >= 4) {
        const length = buffer.readUInt32BE(0);
        if (length === 0) {
          buffer = buffer.subarray(4);
          if (behavior === 'clean') socket.end('stream: OK\0');
          else if (behavior === 'infected') socket.end('stream: Eicar-Test-Signature FOUND\0');
          else if (behavior === 'error') socket.end('INSTREAM size limit exceeded ERROR\0');
          else socket.end();
          return;
        }
        if (buffer.length < 4 + length) return;
        received.chunkSizes.push(length);
        received.bytes += length;
        buffer = buffer.subarray(4 + length);
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return {
    received,
    host: '127.0.0.1',
    port: address.port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function streamFrom(content: string | Buffer) {
  return Readable.from([typeof content === 'string' ? Buffer.from(content) : content]);
}

test('parseClamavResponse classifies clean OK responses', () => {
  assert.deepEqual(parseClamavResponse('stream: OK\0'), { status: 'clean', raw: 'stream: OK' });
});

test('parseClamavResponse extracts FOUND threat name', () => {
  const result = parseClamavResponse('stream: Eicar-Test-Signature FOUND\0');
  assert.equal(result.status, 'infected');
  if (result.status === 'infected') assert.equal(result.threat, 'Eicar-Test-Signature');
});

test('parseClamavResponse maps ERROR to error status', () => {
  const result = parseClamavResponse('INSTREAM size limit exceeded ERROR');
  assert.equal(result.status, 'error');
});

test('parseClamavResponse handles empty input', () => {
  const result = parseClamavResponse('');
  assert.equal(result.status, 'error');
});

test('readClamavConfigFromEnv returns null when host missing', () => {
  const previous = process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_HOST;
  assert.equal(readClamavConfigFromEnv(), null);
  if (previous) process.env.CLAMAV_HOST = previous;
});

test('readClamavConfigFromEnv reads host/port/timeout', () => {
  process.env.CLAMAV_HOST = '127.0.0.1';
  process.env.CLAMAV_PORT = '3310';
  process.env.CLAMAV_TIMEOUT_MS = '5000';
  const config = readClamavConfigFromEnv();
  assert.ok(config);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 3310);
  assert.equal(config.timeoutMs, 5000);
  delete process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_PORT;
  delete process.env.CLAMAV_TIMEOUT_MS;
});

test('scanStreamWithClamav reports clean for OK response', async () => {
  const stub = await startStub('clean');
  try {
    const result = await scanStreamWithClamav(streamFrom('hello world'), { host: stub.host, port: stub.port, timeoutMs: 2000, chunkSize: 8 });
    assert.equal(result.status, 'clean');
    assert.equal(stub.received.greeting, 'zINSTREAM');
    assert.equal(stub.received.bytes, Buffer.from('hello world').length);
  } finally {
    await stub.close();
  }
});

test('scanStreamWithClamav reports infected with threat name', async () => {
  const stub = await startStub('infected');
  try {
    const result = await scanStreamWithClamav(streamFrom('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'), { host: stub.host, port: stub.port, timeoutMs: 2000 });
    assert.equal(result.status, 'infected');
    if (result.status === 'infected') assert.equal(result.threat, 'Eicar-Test-Signature');
  } finally {
    await stub.close();
  }
});

test('scanStreamWithClamav reports error when daemon emits ERROR', async () => {
  const stub = await startStub('error');
  try {
    const result = await scanStreamWithClamav(streamFrom('payload'), { host: stub.host, port: stub.port, timeoutMs: 2000 });
    assert.equal(result.status, 'error');
  } finally {
    await stub.close();
  }
});

test('scanStreamWithClamav times out when daemon goes silent', async () => {
  const stub = await startStub('silent');
  try {
    const result = await scanStreamWithClamav(streamFrom('payload'), { host: stub.host, port: stub.port, timeoutMs: 200 });
    assert.equal(result.status, 'error');
  } finally {
    await stub.close();
  }
});
