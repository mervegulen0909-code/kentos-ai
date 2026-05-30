import { NextResponse, type NextRequest } from 'next/server';

/**
 * Per-request nonce-based Content-Security-Policy for KentOS citizen web.
 *
 * Next.js reads the nonce from the CSP set on the request headers and stamps it
 * onto every framework <script>, so `'strict-dynamic'` stays strict while
 * hydration still works (no `'unsafe-inline'` for scripts). CSP is owned here,
 * not in Caddy, so the nonce can change every request.
 *
 * `/widget/*` is embeddable on municipality sites, so it uses
 * `frame-ancestors *`; every other page denies framing.
 */
function buildCspHeader(nonce: string, frameAncestors: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://firebaseapp.com https://*.googleapis.com https://*.firebaseio.com wss: ws:",
    "font-src 'self' data:",
    `frame-ancestors ${frameAncestors}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function middleware(request: NextRequest): NextResponse {
  if (request.method === 'POST' && request.nextUrl.pathname.startsWith('/widget')) {
    console.warn(`[TS-MW] widget POST enter @${Date.now()}`);
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isWidget = request.nextUrl.pathname.startsWith('/widget');
  const csp = buildCspHeader(nonce, isWidget ? '*' : "'none'");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Match everything except Next.js internals and static assets.
    '/((?!_next/static|_next/image|favicon\\.ico|icon|manifest\\.webmanifest|widget\\.js).*)',
  ],
};
