'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';

export async function createCannedReplyAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.createCannedReply(session.accessToken, {
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    lang: String(formData.get('lang') ?? 'tr'),
    isShared: formData.get('isShared') === 'on',
  });
  revalidatePath('/canned-replies');
}

export async function deleteCannedReplyAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  const id = String(formData.get('id') ?? '');
  await adminApi.deleteCannedReply(session.accessToken, id);
  revalidatePath('/canned-replies');
}

export async function updateCannedReplyAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  const id = String(formData.get('id') ?? '');
  await adminApi.updateCannedReply(session.accessToken, id, {
    title: String(formData.get('title') ?? '') || undefined,
    body: String(formData.get('body') ?? '') || undefined,
    isShared: formData.get('isShared') === 'on',
  });
  revalidatePath('/canned-replies');
}
