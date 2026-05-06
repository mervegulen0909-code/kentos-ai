'use server';

import { redirect } from 'next/navigation';
import { ApiError, adminApi } from '../../lib/api';
import { resolveAdminAccessToken } from '../../lib/session';

async function requireToken(handoffId: string) {
  const token = await resolveAdminAccessToken();
  if (!token) redirect(`/handoffs/${handoffId}?error=session`);
  return token;
}

export async function createTicketFromHandoffAction(formData: FormData) {
  const handoffId = String(formData.get('handoffId') ?? '').trim();
  if (!handoffId) redirect('/handoffs?error=general');

  const token = await requireToken(handoffId);

  try {
    const result = await adminApi.createTicketFromHandoff(token, handoffId);
    redirect(`/tickets/${result.ticketId}?success=created-from-handoff`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect(`/handoffs/${handoffId}?error=forbidden`);
    }
    redirect(`/handoffs/${handoffId}?error=create-ticket`);
  }
}
