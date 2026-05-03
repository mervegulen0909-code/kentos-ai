'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '../../lib/api';
import { getSessionToken } from '../../lib/session';

async function requireToken(ticketId: string) {
  const token = await getSessionToken();
  if (!token) redirect(`/tickets/${ticketId}?error=session`);
  return token;
}

async function runTicketMutation(formData: FormData, success: string, mutation: (token: string, ticketId: string) => Promise<void>) {
  const ticketId = String(formData.get('ticketId') ?? '');
  const token = await requireToken(ticketId);

  try {
    await mutation(token, ticketId);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect(`/tickets/${ticketId}?error=forbidden`);
    }
    redirect(`/tickets/${ticketId}?error=${encodeURIComponent(String(formData.get('intent') ?? 'general'))}`);
  }

  revalidatePath('/tickets');
  revalidatePath(`/tickets/${ticketId}`);
  redirect(`/tickets/${ticketId}?success=${success}`);
}

export async function updateStatusAction(formData: FormData) {
  const status = String(formData.get('status') ?? '');
  const publicMessage = String(formData.get('publicMessage') ?? '').trim();

  await runTicketMutation(formData, 'status-updated', (token, ticketId) => apiFetch(`/tickets/${ticketId}/status`, {
    method: 'POST',
    token,
    body: JSON.stringify({ status, publicMessage: publicMessage || undefined }),
  }));
}

export async function assignTicketAction(formData: FormData) {
  const departmentId = String(formData.get('departmentId') ?? '').trim();

  await runTicketMutation(formData, 'assigned', (token, ticketId) => apiFetch(`/tickets/${ticketId}/assign`, {
    method: 'POST',
    token,
    body: JSON.stringify({ departmentId }),
  }));
}

export async function addInternalNoteAction(formData: FormData) {
  const body = String(formData.get('body') ?? '').trim();

  await runTicketMutation(formData, 'internal-note-added', (token, ticketId) => apiFetch(`/tickets/${ticketId}/notes`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  }));
}

export async function addPublicMessageAction(formData: FormData) {
  const body = String(formData.get('body') ?? '').trim();

  await runTicketMutation(formData, 'public-message-sent', (token, ticketId) => apiFetch(`/tickets/${ticketId}/public-messages`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  }));
}
