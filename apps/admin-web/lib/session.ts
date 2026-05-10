import { cookies } from 'next/headers';

const sessionCookieName = 'kentos_admin_access_token';
const refreshCookieName = 'kentos_admin_refresh_token';
const sessionStateCookieName = 'kentos_admin_session';

type JwtPayload = {
  exp?: number;
  role?: string;
};

export type AdminSessionUser = {
  fullName: string;
  email: string;
  role: string;
  tenantSlug?: string;
};

export type AdminSession = {
  accessToken: string;
  refreshToken: string;
  user: AdminSessionUser;
};

function decodeJwtPayload(token: string) {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as JwtPayload;
  } catch {
    return null;
  }
}

function normalizeRole(role: string | null | undefined) {
  return String(role ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function encodeSessionState(user: AdminSessionUser) {
  return encodeURIComponent(JSON.stringify(user));
}

function decodeSessionState(value: string | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(decodeURIComponent(value)) as AdminSessionUser;
  } catch {
    return null;
  }
}

function getAccessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 15 * 60,
  } as const;
}

function getLongLivedCookieOptions() {
  return {
    ...getAccessCookieOptions(),
    maxAge: 7 * 24 * 60 * 60,
  } as const;
}

function isTokenFresh(token: string | null, safetyWindowSeconds = 30) {
  if (!token) return false;

  try {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return false;
    return payload.exp * 1000 > Date.now() + safetyWindowSeconds * 1000;
  } catch {
    return false;
  }
}

async function refreshAdminAccessToken(refreshToken: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3100/api/v1'}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Refresh failed with status ${response.status}`);
  }

  const result = await response.json() as { accessToken?: string };
  if (!result.accessToken) {
    throw new Error('Refresh response missing accessToken');
  }

  return result.accessToken;
}

export async function getSessionToken() {
  const store = await cookies();
  return store.get(sessionCookieName)?.value ?? null;
}

export function getRoleFromToken(token: string | null) {
  if (!token) return null;
  return decodeJwtPayload(token)?.role ?? null;
}

export async function setSessionAccessToken(accessToken: string) {
  const store = await cookies();
  store.set(sessionCookieName, accessToken, getAccessCookieOptions());
}

export async function resolveAdminAccessToken() {
  return (await resolveAdminSession())?.accessToken ?? null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const accessToken = store.get(sessionCookieName)?.value ?? null;
  const refreshToken = store.get(refreshCookieName)?.value ?? null;
  const user = decodeSessionState(store.get(sessionStateCookieName)?.value);

  if (!accessToken || !refreshToken || !user) return null;

  return { accessToken, refreshToken, user };
}

export async function resolveAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const accessToken = store.get(sessionCookieName)?.value ?? null;
  const refreshToken = store.get(refreshCookieName)?.value ?? null;
  const user = decodeSessionState(store.get(sessionStateCookieName)?.value);

  if (!refreshToken || !user) return null;
  if (isTokenFresh(accessToken)) return { accessToken: accessToken!, refreshToken, user };

  try {
    const refreshedAccessToken = await refreshAdminAccessToken(refreshToken);
    await setSessionAccessToken(refreshedAccessToken).catch(() => undefined);
    return { accessToken: refreshedAccessToken, refreshToken, user };
  } catch {
    return null;
  }
}

export async function setAdminSession(session: AdminSession) {
  const store = await cookies();
  const cookieOptions = getAccessCookieOptions();

  store.set(sessionCookieName, session.accessToken, cookieOptions);
  store.set(refreshCookieName, session.refreshToken, getLongLivedCookieOptions());
  store.set(sessionStateCookieName, encodeSessionState(session.user), getLongLivedCookieOptions());
}

export async function clearSessionToken() {
  const store = await cookies();
  store.delete(sessionCookieName);
  store.delete(refreshCookieName);
  store.delete(sessionStateCookieName);
}

export async function getRefreshToken() {
  const store = await cookies();
  return store.get(refreshCookieName)?.value ?? null;
}

export function isReadOnlyRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  return ['READ_ONLY', 'VIEWER', 'AUDITOR', 'OBSERVER'].includes(normalizedRole);
}

export function canMutateTickets(role: string | null | undefined) {
  return !isReadOnlyRole(role);
}

export function canAssignTickets(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  return ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'OPERATOR'].includes(normalizedRole);
}

export function canViewAnalytics(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  return ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'].includes(normalizedRole);
}

export function canManageSettings(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  return ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(normalizedRole);
}
