'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';

export async function createRuleAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.createSocialMonitorRule(session.accessToken, {
    query: String(formData.get('query') ?? ''),
    platform: String(formData.get('platform') ?? 'TWITTER'),
  });
  revalidatePath('/social-monitor');
}

export async function toggleRuleAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  const id = String(formData.get('id') ?? '');
  const isActive = formData.get('isActive') === 'true';
  await adminApi.updateSocialMonitorRule(session.accessToken, id, { isActive: !isActive });
  revalidatePath('/social-monitor');
}

export async function deleteRuleAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.deleteSocialMonitorRule(session.accessToken, String(formData.get('id') ?? ''));
  revalidatePath('/social-monitor');
}

export async function pollNowAction(_formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.pollSocialMonitor(session.accessToken);
  revalidatePath('/social-monitor');
}
