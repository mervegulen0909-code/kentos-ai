'use server';

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
