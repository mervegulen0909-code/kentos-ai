'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminApi, ApiError, apiFetch } from '../../lib/api';
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

function requireNonEmpty(formData: FormData, field: string, fallback: string) {
  const normalized = String(formData.get(field) ?? '').trim();
  const ticketId = String(formData.get('ticketId') ?? '');
  if (!normalized) redirect(`/tickets/${ticketId}?error=${fallback}`);
  return normalized;
}

async function uploadAttachmentIfPresent(token: string, ticketId: string, formData: FormData) {
  const file = formData.get('attachment');
  if (!(file instanceof File) || file.size <= 0) return [];

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
  const initiated = await adminApi.initiateAttachmentUpload(token, {
    ticketId,
    fileName: file.name || 'attachment',
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  });

  const uploadResponse = await fetch(initiated.uploadUrl, {
    method: 'PUT',
    headers: initiated.headers,
    body: bytes,
  });
  if (!uploadResponse.ok) throw new ApiError(uploadResponse.status, 'Attachment upload failed');

  await adminApi.confirmAttachmentUpload(token, initiated.attachmentId, checksumSha256);
  return [initiated.attachmentId];
}

export async function updateStatusAction(formData: FormData) {
  const status = requireNonEmpty(formData, 'status', 'status');
  const publicMessage = String(formData.get('publicMessage') ?? '').trim();

  await runTicketMutation(formData, 'status-updated', (token, ticketId) => apiFetch(`/tickets/${ticketId}/status`, {
    method: 'POST',
    token,
    body: JSON.stringify({ status, publicMessage: publicMessage || undefined }),
  }));
}

export async function assignTicketAction(formData: FormData) {
  const departmentId = requireNonEmpty(formData, 'departmentId', 'assignment');
  const assignedToId = String(formData.get('assignedToId') ?? '').trim() || undefined;

  await runTicketMutation(formData, 'assigned', (token, ticketId) => apiFetch(`/tickets/${ticketId}/assign`, {
    method: 'POST',
    token,
    body: JSON.stringify({ departmentId, assignedToId }),
  }));
}

export async function addInternalNoteAction(formData: FormData) {
  const body = requireNonEmpty(formData, 'body', 'internal-note');

  await runTicketMutation(formData, 'internal-note-added', async (token, ticketId) => {
    const attachmentIds = await uploadAttachmentIfPresent(token, ticketId, formData);
    await apiFetch(`/tickets/${ticketId}/notes`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body, attachmentIds }),
    });
  });
}

export async function addPublicMessageAction(formData: FormData) {
  const body = requireNonEmpty(formData, 'body', 'public-message');

  await runTicketMutation(formData, 'public-message-sent', async (token, ticketId) => {
    const attachmentIds = await uploadAttachmentIfPresent(token, ticketId, formData);
    await apiFetch(`/tickets/${ticketId}/public-messages`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body, attachmentIds }),
    });
  });
}
