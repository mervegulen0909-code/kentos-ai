'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';

export async function createSlotAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.createAppointmentSlot(session.accessToken, {
    startsAt: String(formData.get('startsAt') ?? ''),
    endsAt: String(formData.get('endsAt') ?? ''),
    capacity: Number(formData.get('capacity') ?? 1),
    departmentId: String(formData.get('departmentId') ?? '') || undefined,
  });
  revalidatePath('/appointments');
}

export async function deleteSlotAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.deleteAppointmentSlot(session.accessToken, String(formData.get('id') ?? ''));
  revalidatePath('/appointments');
}

export async function updateAppointmentStatusAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.updateAppointmentStatus(
    session.accessToken,
    String(formData.get('id') ?? ''),
    String(formData.get('status') ?? ''),
  );
  revalidatePath('/appointments');
}
