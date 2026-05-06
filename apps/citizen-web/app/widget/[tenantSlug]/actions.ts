'use server';

import { citizenApi } from '../../../lib/api';

type WidgetSubmitState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  trackingToken: string | null;
  handoffRequested: boolean;
};

export async function submitWidgetMessage(tenantSlug: string, _state: WidgetSubmitState, formData: FormData): Promise<WidgetSubmitState> {
  const description = String(formData.get('draft') ?? '').trim();
  const contact = String(formData.get('contact') ?? '').trim();
  const displayName = String(formData.get('displayName') ?? '').trim();

  if (description.length < 10) {
    return {
      status: 'error',
      message: 'Talebinizi anlayabilmemiz için en az 10 karakterlik kısa bir açıklama yazın.',
      trackingToken: null,
      handoffRequested: false,
    };
  }

  try {
    const conversation = await citizenApi.startConversation(tenantSlug, {
      channel: 'WEB_CHAT',
      displayName: displayName || undefined,
      contact: contact || undefined,
    });
    const result = await citizenApi.sendConversationMessage(tenantSlug, conversation.conversationId, {
      text: description,
      displayName: displayName || undefined,
      phone: contact.startsWith('05') ? contact : undefined,
      email: contact.includes('@') ? contact : undefined,
    });

    return {
      status: result.trackingToken || result.handoffRequested ? 'success' : 'error',
      message:
        result.assistantMessage ??
        result.followUpQuestion ??
        (result.handoffRequested
          ? 'Talebiniz insan desteği isteği olarak belediye ekibine iletildi.'
          : 'Talebiniz için ek bilgi gerekiyor. Lütfen resmi başvuru formundan devam edin.'),
      trackingToken: result.trackingToken,
      handoffRequested: result.handoffRequested,
    };
  } catch {
    return {
      status: 'error',
      message: 'Talep şu anda aktarılamadı. Lütfen biraz sonra tekrar deneyin veya resmi başvuru formuna geçin.',
      trackingToken: null,
      handoffRequested: false,
    };
  }
}
