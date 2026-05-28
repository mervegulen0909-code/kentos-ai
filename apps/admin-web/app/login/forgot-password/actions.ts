'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '../../../lib/api';

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');

  if (!email || !email.includes('@')) {
    redirect('/login/forgot-password?error=invalid-email');
  }

  try {
    await apiFetch('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  } catch {
    // Always show success to avoid email enumeration
  }

  redirect('/login/forgot-password?sent=1');
}
