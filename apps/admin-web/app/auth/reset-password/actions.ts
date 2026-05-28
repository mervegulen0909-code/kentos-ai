'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '../../../lib/api';

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!token) {
    redirect('/auth/reset-password?error=token-missing');
  }

  if (newPassword.length < 8) {
    redirect(`/auth/reset-password?token=${encodeURIComponent(token)}&error=too-short`);
  }

  if (newPassword !== confirmPassword) {
    redirect(`/auth/reset-password?token=${encodeURIComponent(token)}&error=mismatch`);
  }

  try {
    await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
    redirect('/login?reset=success');
  } catch {
    redirect(`/auth/reset-password?token=${encodeURIComponent(token)}&error=failed`);
  }
}
