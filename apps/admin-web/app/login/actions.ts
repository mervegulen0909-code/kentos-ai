'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { clearSessionToken, getAdminSession, setAdminSession } from '../../lib/session';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    fullName: string;
    email: string;
    role: string;
  };
};

export async function loginAction(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!tenantSlug || !email || !password) redirect('/login?error=missing');

  try {
    const result = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ tenantSlug, email, password }),
    });

    await setAdminSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        fullName: result.user.fullName,
        email: result.user.email,
        role: result.user.role,
        tenantSlug,
      },
    });
  } catch {
    redirect('/login?error=invalid');
  }

  redirect('/');
}

export async function logoutAction() {
  // Revoke both tokens on the API before clearing cookies
  const session = await getAdminSession();
  if (session) {
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      }),
    }).catch(() => undefined); // Non-fatal: still clear cookies even if API unreachable
  }
  await clearSessionToken();
  redirect('/login');
}
