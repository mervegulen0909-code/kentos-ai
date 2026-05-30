'use server';

import { createHash } from 'node:crypto';
import { citizenApi } from '../../../lib/api';

type WidgetSubmitState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  conversationId: string | null;
  trackingToken: string | null;
  handoffRequested: boolean;
  missingFields: string[];
};

export async function submitWidgetMessage(tenantSlug: string, _state: WidgetSubmitState, formData: FormData): Promise<WidgetSubmitState> {
  const description = String(formData.get('draft') ?? '').trim();
  const contact = String(formData.get('contact') ?? '').trim();
  const displayName = String(formData.get('displayName') ?? '').trim();

  if (description.length < 10) {
    return {
      status: 'error',
      message: 'Talebinizi anlayabilmemiz icin en az 10 karakterlik kisa bir aciklama yazin.',
      conversationId: null,
      trackingToken: null,
      handoffRequested: false,
      missingFields: [],
    };
  }

  try {
    const attachmentIds = await uploadAttachmentIfPresent(tenantSlug, formData);
    const conversationId = _state.conversationId && !_state.trackingToken
      ? _state.conversationId
      : (await citizenApi.startConversation(tenantSlug, {
          channel: 'WEB_CHAT',
          displayName: displayName || undefined,
          contact: contact || undefined,
        })).conversationId;
    const result = await citizenApi.sendConversationMessage(tenantSlug, conversationId, {
      text: description,
      displayName: displayName || undefined,
      phone: contact.startsWith('05') ? contact : undefined,
      email: contact.includes('@') ? contact : undefined,
      attachmentIds,
    });

    return {
      status: 'success',
      message:
        result.assistantMessage ??
        result.followUpQuestion ??
        (result.handoffRequested
          ? 'Talebiniz insan destegi istegi olarak belediye ekibine iletildi.'
          : 'Talebiniz icin ek bilgi gerekiyor. Lutfen resmi basvuru formundan devam edin.'),
      conversationId: result.conversationId,
      trackingToken: result.trackingToken,
      handoffRequested: result.handoffRequested,
      missingFields: result.missingFields,
    };
  } catch {
    return {
      status: 'error',
      message: 'Talep su anda aktarilamadi. Lutfen biraz sonra tekrar deneyin veya resmi basvuru formuna gecin.',
      conversationId: null,
      trackingToken: null,
      handoffRequested: false,
      missingFields: [],
    };
  }
}

async function uploadAttachmentIfPresent(tenantSlug: string, formData: FormData) {
  const file = formData.get('attachment');
  if (!(file instanceof File) || file.size <= 0) return [];

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
  const initiated = await citizenApi.initiateAttachmentUpload(tenantSlug, {
    fileName: file.name || 'attachment',
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  });
  const uploadResponse = await fetch(initiated.uploadUrl, {
    method: 'PUT',
    headers: initiated.headers,
    body: bytes,
  });
  if (!uploadResponse.ok) throw new Error('Attachment upload failed');

  await citizenApi.confirmAttachmentUpload(tenantSlug, initiated.attachmentId, checksumSha256);
  return [initiated.attachmentId];
}
