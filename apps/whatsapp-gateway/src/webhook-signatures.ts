import crypto from 'node:crypto';

/**
 * Meta (Facebook/Instagram/WhatsApp Cloud) webhook imzasi.
 * Header: `X-Hub-Signature-256: sha256=<hex>`.
 * Body: ham (raw) request gövdesinin string hali — JSON.stringify hash'le farkli olabilir,
 * bu yüzden HTTP server tarafinda raw buffer korunmali.
 */
export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  const [scheme, signature] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !signature) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Postmark inbound webhook Basic Auth dogrulamasi.
 * Postmark inbound webhook bir HTTPS POST + Basic Auth ile gelir.
 * Authorization header: `Basic base64(user:password)`.
 */
export function verifyPostmarkBasicAuth(authorizationHeader: string | undefined, expectedUser: string, expectedPassword: string): boolean {
  if (!authorizationHeader || !expectedUser || !expectedPassword) return false;
  const match = authorizationHeader.match(/^Basic\s+(.+)$/i);
  if (!match) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch {
    return false;
  }
  const sepIndex = decoded.indexOf(':');
  if (sepIndex === -1) return false;
  const user = decoded.slice(0, sepIndex);
  const password = decoded.slice(sepIndex + 1);
  try {
    const userOk = crypto.timingSafeEqual(Buffer.from(user, 'utf8'), Buffer.from(expectedUser, 'utf8'));
    const passwordOk = crypto.timingSafeEqual(Buffer.from(password, 'utf8'), Buffer.from(expectedPassword, 'utf8'));
    return userOk && passwordOk;
  } catch {
    return false;
  }
}

/**
 * Twilio request imzasi.
 * Header: `X-Twilio-Signature` = base64( HMAC-SHA1( authToken, fullUrl + sortedFormPairs ) ).
 */
export function verifyTwilioWebhookSignature(params: {
  fullUrl: string;
  formParams: Record<string, string>;
  signatureHeader: string | undefined;
  authToken: string;
}): boolean {
  if (!params.signatureHeader || !params.authToken) return false;
  const sortedKeys = Object.keys(params.formParams).sort();
  const concatenated = sortedKeys.reduce((acc, key) => acc + key + params.formParams[key], params.fullUrl);
  const expected = crypto.createHmac('sha1', params.authToken).update(concatenated, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(params.signatureHeader, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}
