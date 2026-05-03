import { cookies } from 'next/headers';

const sessionCookieName = 'kentos_admin_access_token';
const sessionStateCookieName = 'kentos_admin_session';

export type AdminSessionUser = {
  fullName: string;
  email: string;
  role: string;
};

export type AdminSession = {
  token: string;
  user: AdminSessionUser;
};

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

export async function getSessionToken() {
  const store = await cookies();
  return store.get(sessionCookieName)?.value ?? null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(sessionCookieName)?.value ?? null;
  const user = decodeSessionState(store.get(sessionStateCookieName)?.value);

  if (!token || !user) return null;

  return { token, user };
}

export async function setAdminSession(session: AdminSession) {
  const store = await cookies();
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 15 * 60,
  } as const;

  store.set(sessionCookieName, session.token, cookieOptions);
  store.set(sessionStateCookieName, encodeSessionState(session.user), cookieOptions);
}

export async function clearSessionToken() {
  const store = await cookies();
  store.delete(sessionCookieName);
  store.delete(sessionStateCookieName);
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
