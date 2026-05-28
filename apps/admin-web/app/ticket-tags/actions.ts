'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';

export async function createTagAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.createTicketTag(session.accessToken, {
    name: String(formData.get('name') ?? ''),
    color: String(formData.get('color') ?? '#6366f1'),
  });
  revalidatePath('/ticket-tags');
}

export async function deleteTagAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.deleteTicketTag(session.accessToken, String(formData.get('id') ?? ''));
  revalidatePath('/ticket-tags');
}
