'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';

export async function createSinkAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  const eventsRaw = formData.get('events') as string ?? '';
  const events = eventsRaw.split(',').map((e) => e.trim()).filter(Boolean);
  await adminApi.createNotificationSink(session.accessToken, {
    name: String(formData.get('name') ?? ''),
    type: String(formData.get('type') ?? 'SLACK'),
    webhookUrl: String(formData.get('webhookUrl') ?? ''),
    events: events.length ? events : ['ticket.created', 'ticket.resolved'],
  });
  revalidatePath('/channels');
}

export async function toggleSinkAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  const id = String(formData.get('id') ?? '');
  const isActive = formData.get('isActive') === 'true';
  await adminApi.updateNotificationSink(session.accessToken, id, { isActive: !isActive });
  revalidatePath('/channels');
}

export async function deleteSinkAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.deleteNotificationSink(session.accessToken, String(formData.get('id') ?? ''));
  revalidatePath('/channels');
}
