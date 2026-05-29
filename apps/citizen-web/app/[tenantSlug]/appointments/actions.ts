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

  // NOTE: redirect() works by throwing NEXT_REDIRECT, so the success redirect
  // must live OUTSIDE the try/catch — otherwise the catch swallows it and the
  // user sees a failure even though the booking succeeded.
  let appointmentId: string;
  try {
    const appt = await citizenApi.bookAppointment(tenantSlug, { slotId, citizenName, citizenPhone, note });
    appointmentId = appt.id;
  } catch {
    redirect(`/${tenantSlug}/appointments?error=failed`);
  }
  redirect(`/${tenantSlug}/appointments?booked=${appointmentId}`);
}
