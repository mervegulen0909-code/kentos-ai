import http from 'node:http';
import { URL } from 'node:url';
import { handleChannelOutbound, handleChannelWebhook, handleOutbound, handleWebhook } from './main.js';
import { verifyMetaWebhookSignature, verifyPostmarkBasicAuth, verifyTwilioWebhookSignature } from './webhook-signatures.js';

const PORT = Number(process.env.PORT ?? 3120);
const META_APP_SECRET = process.env.META_APP_SECRET ?? '';
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';

type RouteResult = { status: number; body: unknown; contentType?: string };
type RouteHandler = (req: http.IncomingMessage, body: string, url: URL) => Promise<RouteResult>;

function readHeader(req: http.IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

const routes: Record<string, RouteHandler> = {
  'GET /webhooks/whatsapp': async (_req, _body, url) => verifyMetaWebhookChallenge(url),
  'GET /webhooks/instagram': async (_req, _body, url) => verifyMetaWebhookChallenge(url),
  'GET /webhooks/facebook': async (_req, _body, url) => verifyMetaWebhookChallenge(url),
  'POST /webhooks/whatsapp': async (req, body) => {
    if (META_APP_SECRET && !verifyMetaWebhookSignature(body, readHeader(req, 'x-hub-signature-256'), META_APP_SECRET)) {
      return { status: 401, body: { error: 'meta-signature-invalid' } };
    }
    const payload = body ? JSON.parse(body) : {};
    const result = await handleWebhook(payload);
    return { status: 200, body: result };
  },
  'POST /webhooks/instagram': async (req, body) => {
    if (META_APP_SECRET && !verifyMetaWebhookSignature(body, readHeader(req, 'x-hub-signature-256'), META_APP_SECRET)) {
      return { status: 401, body: { error: 'meta-signature-invalid' } };
    }
    const payload = body ? JSON.parse(body) : {};
    const result = await handleChannelWebhook('INSTAGRAM', payload);
    return { status: 200, body: result };
  },
  'POST /webhooks/facebook': async (req, body) => {
    if (META_APP_SECRET && !verifyMetaWebhookSignature(body, readHeader(req, 'x-hub-signature-256'), META_APP_SECRET)) {
      return { status: 401, body: { error: 'meta-signature-invalid' } };
    }
    const payload = body ? JSON.parse(body) : {};
    const result = await handleChannelWebhook('FACEBOOK', payload);
    return { status: 200, body: result };
  },
  'POST /webhooks/email': async (req, body) => {
    const expectedUser = process.env.POSTMARK_INBOUND_BASIC_USER ?? '';
    const expectedPassword = process.env.POSTMARK_INBOUND_BASIC_PASS ?? '';
    if (!expectedUser || !expectedPassword) {
      return { status: 503, body: { error: 'postmark-inbound-not-configured' } };
    }
    if (!verifyPostmarkBasicAuth(readHeader(req, 'authorization'), expectedUser, expectedPassword)) {
      return { status: 401, body: { error: 'postmark-basic-auth-invalid' } };
    }
    let payload: unknown = {};
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      return { status: 400, body: { error: 'invalid-json' } };
    }
    const result = await handleChannelWebhook('EMAIL', payload);
    return { status: 200, body: result };
  },
  'POST /webhooks/sms': async (req, body, url) => {
    const params = parseFormBody(body);
    const fullUrl = `${process.env.PUBLIC_GATEWAY_BASE_URL?.replace(/\/$/, '') ?? `http://localhost:${PORT}`}${url.pathname}`;
    if (TWILIO_AUTH_TOKEN && !verifyTwilioWebhookSignature({
      fullUrl,
      formParams: params,
      signatureHeader: readHeader(req, 'x-twilio-signature'),
      authToken: TWILIO_AUTH_TOKEN,
    })) {
      return { status: 401, body: { error: 'twilio-signature-invalid' } };
    }
    const result = await handleChannelWebhook('SMS', params);
    return { status: 200, body: result };
  },
  'POST /internal/whatsapp/outbound': async (req, body) => {
    const internalKey = readHeader(req, 'x-kentos-internal-key');
    const payload = body ? JSON.parse(body) : {};
    const result = await handleOutbound(payload, internalKey);
    return { status: result.accepted ? 200 : 400, body: result };
  },
  'POST /internal/instagram/outbound': async (req, body) => {
    const internalKey = readHeader(req, 'x-kentos-internal-key');
    const payload = body ? JSON.parse(body) : {};
    const result = await handleChannelOutbound('INSTAGRAM', payload, internalKey);
    return { status: result.accepted ? 200 : 400, body: result };
  },
  'POST /internal/facebook/outbound': async (req, body) => {
    const internalKey = readHeader(req, 'x-kentos-internal-key');
    const payload = body ? JSON.parse(body) : {};
    const result = await handleChannelOutbound('FACEBOOK', payload, internalKey);
    return { status: result.accepted ? 200 : 400, body: result };
  },
  'POST /internal/sms/outbound': async (req, body) => {
    const internalKey = readHeader(req, 'x-kentos-internal-key');
    const payload = body ? JSON.parse(body) : {};
    const result = await handleChannelOutbound('SMS', payload, internalKey);
    return { status: result.accepted ? 200 : 400, body: result };
  },
  'POST /internal/email/outbound': async (req, body) => {
    const internalKey = readHeader(req, 'x-kentos-internal-key');
    const payload = body ? JSON.parse(body) : {};
    const result = await handleChannelOutbound('EMAIL', payload, internalKey);
    return { status: result.accepted ? 200 : 400, body: result };
  },
  'GET /health': async () => ({ status: 200, body: { ok: true, ts: new Date().toISOString() } }),
};

function verifyMetaWebhookChallenge(url: URL): RouteResult {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (!META_WEBHOOK_VERIFY_TOKEN) {
    return { status: 503, body: { error: 'meta-webhook-verify-token-not-configured' } };
  }
  if (mode === 'subscribe' && token === META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return { status: 200, body: challenge, contentType: 'text/plain' };
  }
  return { status: 403, body: { error: 'meta-webhook-verification-failed' } };
}

function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of body.split('&')) {
    if (!part) continue;
    const [key, value = ''] = part.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
  }
  return params;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const key = `${req.method ?? 'GET'} ${url.pathname}`;
    const handler = routes[key];
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not-found', route: key }));
      return;
    }
    const body = await readBody(req);
    const result = await handler(req, body, url);
    const contentType = result.contentType ?? 'application/json';
    res.writeHead(result.status, { 'Content-Type': contentType });
    res.end(contentType === 'application/json' ? JSON.stringify(result.body) : String(result.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error';
    console.error(`[Gateway] istek hatasi: ${message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal', detail: message.slice(0, 200) }));
  }
});

if (process.env.GATEWAY_HTTP_AUTOSTART !== 'false') {
  server.listen(PORT, () => {
    console.log(`KentOS channel gateway listening on http://0.0.0.0:${PORT}`);
  });
}

export { server };
