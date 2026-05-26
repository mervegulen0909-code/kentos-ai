'use server';

import { revalidatePath } from 'next/cache';
import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';

export async function generateReportAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session?.accessToken) return;
  const type = String(formData.get('type') ?? 'weekly_summary');
  try {
    await adminApi.generateReport(session.accessToken, type);
    revalidatePath('/reports');
  } catch {}
}
