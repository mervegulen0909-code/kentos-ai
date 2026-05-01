import { cookies } from 'next/headers';

const sessionCookieName = 'kentos_admin_access_token';

export async function getSessionToken() {
  const store = await cookies();
  return store.get(sessionCookieName)?.value ?? null;
}

export async function setSessionToken(token: string) {
  const store = await cookies();
  store.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 15 * 60,
  });
}

export async function clearSessionToken() {
  const store = await cookies();
  store.delete(sessionCookieName);
}
