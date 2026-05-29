'use server';

import { citizenApi } from '../../lib/api';

export type MascotReply = {
  ok: boolean;
  conversationId: string | null;
  reply: string;
  trackingToken: string | null;
  handoffRequested: boolean;
};

/**
 * Maskot sohbeti için sunucu eylemi: ilk mesajda konuşmayı başlatır, sonra
 * mesajı gönderir ve üretken (AI) yanıtı döndürür. Server-side çalışır → CORS yok.
 */
export async function sendMascotMessage(
  tenantSlug: string,
  conversationId: string | null,
  text: string,
): Promise<MascotReply> {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    return { ok: false, conversationId, reply: 'Lütfen birkaç kelimelik bir mesaj yazın.', trackingToken: null, handoffRequested: false };
  }

  try {
    const id = conversationId ?? (await citizenApi.startConversation(tenantSlug, { channel: 'WEB_CHAT' })).conversationId;
    const result = await citizenApi.sendConversationMessage(tenantSlug, id, { text: trimmed });
    const reply =
      result.assistantMessage ??
      result.followUpQuestion ??
      (result.handoffRequested
        ? 'Talebinizi belediye ekibine ilettim, en kısa sürede dönüş yapılacaktır.'
        : 'Talebinizi aldım, teşekkürler.');
    return {
      ok: true,
      conversationId: result.conversationId,
      reply,
      trackingToken: result.trackingToken,
      handoffRequested: result.handoffRequested,
    };
  } catch {
    return {
      ok: false,
      conversationId,
      reply: 'Şu an yanıt veremiyorum. Lütfen biraz sonra tekrar deneyin ya da başvuru formunu kullanın.',
      trackingToken: null,
      handoffRequested: false,
    };
  }
}
