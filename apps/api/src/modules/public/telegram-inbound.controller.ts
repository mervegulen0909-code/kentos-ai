import { Body, Controller, Logger, Param, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicConversationService } from './public-conversation.service.js';

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    from?: { id?: number; username?: string; first_name?: string; last_name?: string };
    chat?: { id?: number };
    date?: number;
    text?: string;
    caption?: string;
  };
};

@SkipThrottle()
@ApiTags('webhooks')
@Controller(':tenantSlug/webhooks/telegram')
export class TelegramInboundController {
  private readonly logger = new Logger(TelegramInboundController.name);

  constructor(private readonly conversations: PublicConversationService) {}

  @ApiOperation({ summary: 'Telegram webhook → conversation' })
  @Post()
  async update(
    @Param('tenantSlug') tenantSlug: string,
    @Body() update: TelegramUpdate,
  ) {
    const msg = update.message;
    if (!msg) return { ok: true }; // ignore non-message updates (callback_query etc.)

    const chatId = msg.chat?.id?.toString() ?? msg.from?.id?.toString();
    const text = (msg.text ?? msg.caption ?? '').trim();

    if (!chatId || !text) {
      return { ok: true };
    }

    const displayName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || null;

    try {
      await this.conversations.ingestEnvelope({
        tenantSlug,
        // 'TELEGRAM' is in ChannelType DB enum (migration) but not yet in Prisma generated client
        channel: 'TELEGRAM' as unknown as 'EMAIL',
        provider: 'telegram',
        externalConversationId: chatId,
        externalMessageId: msg.message_id?.toString(),
        text,
        receivedAt: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
        citizenContact: { displayName },
      });
      return { ok: true };
    } catch (err) {
      this.logger.error(`TelegramInbound: ingestEnvelope failed: ${String(err)}`);
      return { ok: true }; // always return 200 to Telegram or it will retry
    }
  }
}
