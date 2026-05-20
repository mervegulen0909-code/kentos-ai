'use server';

import { revalidatePath } from 'next/cache';
import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';

export async function createUserAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session?.accessToken) return { error: 'Oturum bulunamadi.' };
  try {
    await adminApi.createUser(session.accessToken, {
      email: String(formData.get('email') ?? ''),
      fullName: String(formData.get('fullName') ?? ''),
      role: String(formData.get('role') ?? 'OPERATOR'),
      password: String(formData.get('password') ?? ''),
    });
    revalidatePath('/users');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Kullanici olusturulamadi.' };
  }
}

export async function toggleUserActiveAction(id: string, isActive: boolean) {
  const session = await resolveAdminSession();
  if (!session?.accessToken) return { error: 'Oturum bulunamadi.' };
  try {
    await adminApi.updateUser(session.accessToken, id, { isActive });
    revalidatePath('/users');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Guncelleme basarisiz.' };
  }
}
