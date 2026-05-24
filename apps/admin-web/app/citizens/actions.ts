'use server';

import { revalidatePath } from 'next/cache';
import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';

export async function anonymizeCitizenAction(id: string) {
  const session = await resolveAdminSession();
  if (!session?.accessToken) return;
  try {
    await adminApi.anonymizeCitizen(session.accessToken, id);
    revalidatePath('/citizens');
  } catch {}
}

export async function exportCitizenAction(id: string): Promise<{ data?: unknown; error?: string }> {
  const session = await resolveAdminSession();
  if (!session?.accessToken) return { error: 'Oturum bulunamadi.' };
  try {
    const data = await adminApi.exportCitizen(session.accessToken, id);
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Dışa aktarma başarısız.' };
  }
}
