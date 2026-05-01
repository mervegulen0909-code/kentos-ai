'use server';

import { redirect } from 'next/navigation';
import { citizenApi } from '../../../lib/api';

export async function createReportAction(tenantSlug: string, formData: FormData) {
  const description = String(formData.get('description') ?? '').trim();
  const addressText = String(formData.get('addressText') ?? '').trim();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();

  if (description.length < 10) redirect(`/${tenantSlug}/report?error=description&field=description`);

  let ticketNo: string;

  try {
    const ticket = await citizenApi.createTicket(tenantSlug, {
      description,
      addressText: addressText || undefined,
      displayName: displayName || undefined,
      phone: phone || undefined,
      email: email || undefined,
    });
    ticketNo = ticket.ticketNo;
  } catch {
    redirect(`/${tenantSlug}/report?error=api`);
  }

  redirect(`/${tenantSlug}/ticket/${ticketNo}`);
}
