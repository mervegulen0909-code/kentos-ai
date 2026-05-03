'use server';

import { redirect } from 'next/navigation';

export async function trackTicketAction(tenantSlug: string, formData: FormData) {
  const ticketIdentifier = String(formData.get('ticketNo') ?? '').trim().toUpperCase();
  if (!ticketIdentifier) redirect(`/${tenantSlug}/track?error=missing`);
  if (!/^TK-[A-F0-9]{16}$/.test(ticketIdentifier)) {
    redirect(`/${tenantSlug}/track?error=format`);
  }
  redirect(`/${tenantSlug}/ticket/${encodeURIComponent(ticketIdentifier)}`);
}
