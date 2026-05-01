'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { clearSessionToken, setSessionToken } from '../../lib/session';

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
    await setSessionToken(result.accessToken);
  } catch {
    redirect('/login?error=invalid');
  }

  redirect('/');
}

export async function logoutAction() {
  await clearSessionToken();
  redirect('/login');
}
