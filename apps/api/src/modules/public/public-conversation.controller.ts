import { Body, Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { PublicChannelGuard } from '../../common/guards/public-channel.guard.js';
import { CreatePublicConversationDto } from './dto/create-public-conversation.dto.js';
import { SendPublicConversationMessageDto } from './dto/send-public-conversation-message.dto.js';
import { PublicConversationService } from './public-conversation.service.js';

@UseGuards(PublicChannelGuard)
@Controller('public/:tenantSlug/conversations')
export class PublicConversationController {
  constructor(@Inject(PublicConversationService) private readonly conversations: PublicConversationService) {}

  @Post()
  start(@Param('tenantSlug') tenantSlug: string, @Body() dto: CreatePublicConversationDto) {
    return this.conversations.start(tenantSlug, dto);
  }

  @Post(':conversationId/messages')
  sendMessage(
    @Param('tenantSlug') tenantSlug: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendPublicConversationMessageDto,
  ) {
    return this.conversations.sendMessage(tenantSlug, conversationId, dto);
  }
}
