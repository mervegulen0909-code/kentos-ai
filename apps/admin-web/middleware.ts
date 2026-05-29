import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'kentos_admin_access_token';
const REFRESH_COOKIE = 'kentos_admin_refresh_token';
const SESSION_COOKIE = 'kentos_admin_session';

/**
 * Token refresh middleware for KentOS Admin.
 *
 * Next.js 15 only allows cookies to be modified in Route Handlers, Server
 * Actions, and middleware — NOT in Server Components (pages).  All pages
 * now call `getAdminSession()` (read-only).  This middleware owns the
 * single place where the access token is silently rotated before the page
 * handler runs.
 *
 * Matching: all routes except Next.js internals and static assets.
 */

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const json = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      exp?: number;
    };
    return json.exp ?? null;
  } catch {
    return null;
  }
}

function isTokenFresh(token: string | null, safetyWindowSeconds = 30): boolean {
  if (!token) return false;
  const exp = decodeJwtExp(token);
  if (!exp) return false;
  return exp * 1000 > Date.now() + safetyWindowSeconds * 1000;
}

function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://firebaseapp.com https://*.googleapis.com https://*.firebaseio.com wss: ws:",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Per-request nonce for a strict, hydration-safe Content-Security-Policy.
  // Next.js reads the nonce from the CSP on the request headers and stamps it
  // onto every framework <script>, so 'strict-dynamic' works without
  // 'unsafe-inline'. (CSP is owned here, not in Caddy.)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCspHeader(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  const proceed = (): NextResponse => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('content-security-policy', csp);
    return res;
  };

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value ?? null;

  // Nothing to do: access token is still valid, or there is no refresh token
  if (isTokenFresh(accessToken) || !refreshToken) {
    return proceed();
  }

  // Access token is missing / expired — try silent refresh
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3100/api/v1';

  try {
    const res = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      // Refresh token rejected — clear session cookies and let the page
      // redirect the user to /login as it normally would.
      const response = proceed();
      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }

    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!data.accessToken) throw new Error('missing accessToken in refresh response');

    const cookieBase = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };

    const response = proceed();
    response.cookies.set(ACCESS_COOKIE, data.accessToken, {
      ...cookieBase,
      maxAge: 15 * 60,
    });
    if (data.refreshToken) {
      response.cookies.set(REFRESH_COOKIE, data.refreshToken, {
        ...cookieBase,
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    return response;
  } catch {
    // Network error during refresh — let the request through unchanged;
    // the page will see no valid access token and redirect to /login.
    return proceed();
  }
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     *   - _next/static  (static files)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - login page (avoids redirect loops when session is fully cleared)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|login).*)',
  ],
};
