'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '../../lib/api';
import { resolveAdminAccessToken } from '../../lib/session';

async function requireToken(ticketId: string) {
  const token = await resolveAdminAccessToken();
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

    const params = new URLSearchParams({
      error: String(formData.get('intent') ?? 'general'),
    });

    if (error instanceof ApiError && error.safeMessage) {
      params.set('errorMessage', error.safeMessage);
    }

    redirect(`/tickets/${ticketId}?${params.toString()}`);
  }

  revalidatePath('/tickets');
  revalidatePath(`/tickets/${ticketId}`);
  redirect(`/tickets/${ticketId}?success=${success}`);
}

function requireNonEmpty(value: FormDataEntryValue | null, fallback: string) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(fallback);
  return normalized;
}

export async function updateStatusAction(formData: FormData) {
  const status = requireNonEmpty(formData.get('status'), 'status');
  const publicMessage = String(formData.get('publicMessage') ?? '').trim();

  await runTicketMutation(formData, 'status-updated', (token, ticketId) => apiFetch(`/tickets/${ticketId}/status`, {
    method: 'POST',
    token,
    body: JSON.stringify({ status, publicMessage: publicMessage || undefined }),
  }));
}

export async function assignTicketAction(formData: FormData) {
  const departmentId = requireNonEmpty(formData.get('departmentId'), 'assignment');

  await runTicketMutation(formData, 'assigned', (token, ticketId) => apiFetch(`/tickets/${ticketId}/assign`, {
    method: 'POST',
    token,
    body: JSON.stringify({ departmentId }),
  }));
}

export async function addInternalNoteAction(formData: FormData) {
  const body = requireNonEmpty(formData.get('body'), 'internal-note');

  await runTicketMutation(formData, 'internal-note-added', (token, ticketId) => apiFetch(`/tickets/${ticketId}/notes`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  }));
}

export async function addPublicMessageAction(formData: FormData) {
  const body = requireNonEmpty(formData.get('body'), 'public-message');

  await runTicketMutation(formData, 'public-message-sent', (token, ticketId) => apiFetch(`/tickets/${ticketId}/public-messages`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  }));
}
