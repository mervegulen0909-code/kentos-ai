'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '../../lib/api';
import { getSessionToken } from '../../lib/session';

async function requireToken() {
  const token = await getSessionToken();
  if (!token) throw new Error('Oturum bulunamadı.');
  return token;
}

export async function updateStatusAction(formData: FormData) {
  const token = await requireToken();
  const ticketId = String(formData.get('ticketId') ?? '');
  const status = String(formData.get('status') ?? '');
  const publicMessage = String(formData.get('publicMessage') ?? '').trim();

  await apiFetch(`/tickets/${ticketId}/status`, {
    method: 'POST',
    token,
    body: JSON.stringify({ status, publicMessage: publicMessage || undefined }),
  });

  revalidatePath('/tickets');
  revalidatePath(`/tickets/${ticketId}`);
}

export async function assignTicketAction(formData: FormData) {
  const token = await requireToken();
  const ticketId = String(formData.get('ticketId') ?? '');
  const departmentId = String(formData.get('departmentId') ?? '').trim();

  await apiFetch(`/tickets/${ticketId}/assign`, {
    method: 'POST',
    token,
    body: JSON.stringify({ departmentId }),
  });

  revalidatePath('/tickets');
  revalidatePath(`/tickets/${ticketId}`);
}

export async function addInternalNoteAction(formData: FormData) {
  const token = await requireToken();
  const ticketId = String(formData.get('ticketId') ?? '');
  const body = String(formData.get('body') ?? '').trim();

  await apiFetch(`/tickets/${ticketId}/notes`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function addPublicMessageAction(formData: FormData) {
  const token = await requireToken();
  const ticketId = String(formData.get('ticketId') ?? '');
  const body = String(formData.get('body') ?? '').trim();

  await apiFetch(`/tickets/${ticketId}/public-messages`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  });

  revalidatePath(`/tickets/${ticketId}`);
}
