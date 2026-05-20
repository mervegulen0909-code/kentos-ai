'use server';

import { revalidatePath } from 'next/cache';
import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';

export async function anonymizeCitizenAction(id: string) {
  const session = await resolveAdminSession();
  if (!session?.accessToken) return { error: 'Oturum bulunamadi.' };
  try {
    await adminApi.anonymizeCitizen(session.accessToken, id);
    revalidatePath('/citizens');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Anonimleştirme başarısız.' };
  }
}
