'use server';

import { redirect } from 'next/navigation';

export async function trackTicketAction(tenantSlug: string, formData: FormData) {
  const ticketNo = String(formData.get('ticketNo') ?? '').trim().toUpperCase();
  if (!ticketNo) redirect(`/${tenantSlug}/track?error=missing`);
  if (!/^KNT-\d{4}-\d{6}$/.test(ticketNo)) redirect(`/${tenantSlug}/track?error=format`);
  redirect(`/${tenantSlug}/ticket/${encodeURIComponent(ticketNo)}`);
}
