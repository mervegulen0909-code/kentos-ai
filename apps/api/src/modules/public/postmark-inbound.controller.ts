import { Body, Controller, Logger, Param, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicConversationService } from './public-conversation.service.js';

type PostmarkInboundPayload = {
  FromName?: string;
  From?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID?: string;
  Date?: string;
};

@SkipThrottle()
@ApiTags('webhooks')
@Controller(':tenantSlug/webhooks/postmark')
export class PostmarkInboundController {
  private readonly logger = new Logger(PostmarkInboundController.name);

  constructor(private readonly conversations: PublicConversationService) {}

  @ApiOperation({ summary: 'Postmark inbound email webhook → ticket/conversation' })
  @Post()
  async inbound(
    @Param('tenantSlug') tenantSlug: string,
    @Body() payload: PostmarkInboundPayload,
  ) {
    const from = payload.From ?? '';
    const text = (payload.TextBody ?? payload.HtmlBody ?? '').trim();

    if (!from || !text) {
      this.logger.warn(`PostmarkInbound: empty from or text (tenantSlug=${tenantSlug})`);
      return { ok: false, reason: 'missing_from_or_text' };
    }

    try {
      await this.conversations.ingestEnvelope({
        tenantSlug,
        channel: 'EMAIL',
        provider: 'postmark',
        externalConversationId: payload.MessageID ?? from,
        externalMessageId: payload.MessageID,
        text: payload.Subject ? `${payload.Subject}\n\n${text}` : text,
        receivedAt: payload.Date ?? new Date().toISOString(),
        citizenContact: {
          email: from,
          displayName: payload.FromName ?? null,
        },
      });
      return { ok: true };
    } catch (err) {
      this.logger.error(`PostmarkInbound: ingestEnvelope failed: ${String(err)}`);
      return { ok: false, reason: 'ingest_failed' };
    }
  }
}
