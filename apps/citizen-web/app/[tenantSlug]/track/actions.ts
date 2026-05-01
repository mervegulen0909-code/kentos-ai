'use server';

import { redirect } from 'next/navigation';

export async function trackTicketAction(tenantSlug: string, formData: FormData) {
  const ticketNo = String(formData.get('ticketNo') ?? '').trim().toUpperCase();
  if (!ticketNo) redirect(`/${tenantSlug}/track?error=missing`);
  redirect(`/${tenantSlug}/ticket/${encodeURIComponent(ticketNo)}`);
}
