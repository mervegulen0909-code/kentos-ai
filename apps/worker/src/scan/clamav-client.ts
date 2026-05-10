import { Socket } from 'node:net';
import type { Readable } from 'node:stream';

export type ClamavConfig = {
  host: string;
  port: number;
  timeoutMs?: number;
  chunkSize?: number;
};

export type ClamavScanResult =
  | { status: 'clean'; raw: string }
  | { status: 'infected'; threat: string; raw: string }
  | { status: 'error'; reason: string; raw?: string };

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CHUNK_SIZE = 64 * 1024;
const MAX_CHUNK_SIZE = 1024 * 1024;

export function readClamavConfigFromEnv(): ClamavConfig | null {
  const host = process.env.CLAMAV_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.CLAMAV_PORT ?? 3310);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const chunkSize = Number(process.env.CLAMAV_CHUNK_SIZE ?? DEFAULT_CHUNK_SIZE);
  return {
    host,
    port,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    chunkSize: Number.isFinite(chunkSize) && chunkSize > 0 && chunkSize <= MAX_CHUNK_SIZE ? chunkSize : DEFAULT_CHUNK_SIZE,
  };
}

export function parseClamavResponse(raw: string): ClamavScanResult {
  const text = raw.replace(/\0+$/g, '').trim();
  if (!text) return { status: 'error', reason: 'empty-response', raw };
  const foundMatch = text.match(/:\s*(.+?)\s+FOUND\b/);
  if (foundMatch) {
    return { status: 'infected', threat: foundMatch[1].trim(), raw: text };
  }
  if (/:\s*OK\b/.test(text)) {
    return { status: 'clean', raw: text };
  }
  if (/ERROR/i.test(text)) {
    return { status: 'error', reason: text.slice(-200), raw: text };
  }
  return { status: 'error', reason: 'unparsed-response', raw: text };
}

export async function scanStreamWithClamav(stream: Readable, config: ClamavConfig): Promise<ClamavScanResult> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const chunkSize = config.chunkSize ?? DEFAULT_CHUNK_SIZE;

  return new Promise<ClamavScanResult>((resolve) => {
    const socket = new Socket();
    let resolved = false;
    let raw = '';

    const timer = setTimeout(() => finalize({ status: 'error', reason: 'clamav-timeout' }), timeoutMs);

    function finalize(result: ClamavScanResult) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      socket.removeAllListeners();
      stream.removeAllListeners();
      try { socket.destroy(); } catch { /* ignore */ }
      try { (stream as { destroy?: () => void }).destroy?.(); } catch { /* ignore */ }
      resolve(result);
    }

    socket.on('error', (error) => finalize({ status: 'error', reason: error.message }));
    socket.on('data', (data: Buffer) => {
      raw += data.toString('utf8');
      if (raw.includes('\0') || /\b(FOUND|ERROR)\b/.test(raw) || /:\s*OK\b/.test(raw)) {
        finalize(parseClamavResponse(raw));
      }
    });
    socket.on('close', () => {
      if (resolved) return;
      finalize(parseClamavResponse(raw));
    });

    socket.connect({ host: config.host, port: config.port }, () => {
      socket.write('zINSTREAM\0');
      pumpStream(socket, stream, chunkSize, (error) => {
        if (error) {
          finalize({ status: 'error', reason: error.message });
          return;
        }
        const trailer = Buffer.alloc(4);
        trailer.writeUInt32BE(0, 0);
        socket.write(trailer);
      });
    });
  });
}

function pumpStream(
  socket: Socket,
  stream: Readable,
  chunkSize: number,
  done: (error: Error | null) => void,
) {
  let pending: Buffer[] = [];
  let pendingBytes = 0;
  let finished = false;

  function flush() {
    while (pendingBytes >= chunkSize) {
      const buffer = Buffer.concat(pending);
      const slice = buffer.subarray(0, chunkSize);
      const remainder = buffer.subarray(chunkSize);
      writeChunk(socket, slice);
      pending = remainder.length ? [remainder] : [];
      pendingBytes = remainder.length;
    }
  }

  stream.on('data', (chunk: Buffer | string) => {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    pending.push(buffer);
    pendingBytes += buffer.length;
    flush();
  });

  stream.on('end', () => {
    if (finished) return;
    finished = true;
    if (pendingBytes > 0) {
      const buffer = Buffer.concat(pending);
      writeChunk(socket, buffer);
    }
    done(null);
  });

  stream.on('error', (error) => {
    if (finished) return;
    finished = true;
    done(error instanceof Error ? error : new Error('stream-error'));
  });
}

function writeChunk(socket: Socket, chunk: Buffer) {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(chunk.length, 0);
  socket.write(header);
  socket.write(chunk);
}
