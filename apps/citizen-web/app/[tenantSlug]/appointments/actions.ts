'use server';

import { redirect } from 'next/navigation';
import { citizenApi } from '../../../lib/api';

export async function bookAppointmentAction(tenantSlug: string, formData: FormData) {
  const slotId = String(formData.get('slotId') ?? '');
  const citizenName = String(formData.get('citizenName') ?? '').trim();
  const citizenPhone = String(formData.get('citizenPhone') ?? '').trim() || undefined;
  const note = String(formData.get('note') ?? '').trim() || undefined;

  if (!slotId || !citizenName) {
    redirect(`/${tenantSlug}/appointments?error=missing`);
  }

  try {
    const appt = await citizenApi.bookAppointment(tenantSlug, { slotId, citizenName, citizenPhone, note });
    redirect(`/${tenantSlug}/appointments?booked=${appt.id}`);
  } catch {
    redirect(`/${tenantSlug}/appointments?error=failed`);
  }
}
