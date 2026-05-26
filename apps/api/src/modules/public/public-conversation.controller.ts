import { Body, Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicChannelGuard } from '../../common/guards/public-channel.guard.js';
import { CreatePublicConversationDto } from './dto/create-public-conversation.dto.js';
import { SendPublicConversationMessageDto } from './dto/send-public-conversation-message.dto.js';
import { PublicConversationService } from './public-conversation.service.js';

// Vatandaş widget — dakikada 60 istek: normal chat trafiği için yeterli
@ApiTags('public-conversations')
@Throttle({ default: { ttl: 60_000, limit: 60 } })
@UseGuards(PublicChannelGuard)
@Controller('public/:tenantSlug/conversations')
export class PublicConversationController {
  constructor(@Inject(PublicConversationService) private readonly conversations: PublicConversationService) {}

  @ApiOperation({ summary: 'Yeni vatandaş konuşması başlat' })
  @ApiParam({ name: 'tenantSlug', description: 'Kiracı slug değeri' })
  @ApiResponse({ status: 201, description: 'Konuşma oluşturuldu' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek gövdesi' })
  @Post()
  start(@Param('tenantSlug') tenantSlug: string, @Body() dto: CreatePublicConversationDto) {
    return this.conversations.start(tenantSlug, dto);
  }

  @ApiOperation({ summary: 'Konuşmaya mesaj gönder' })
  @ApiParam({ name: 'tenantSlug', description: 'Kiracı slug değeri' })
  @ApiParam({ name: 'conversationId', description: 'Konuşma ID' })
  @ApiResponse({ status: 201, description: 'Mesaj gönderildi' })
  @ApiResponse({ status: 404, description: 'Konuşma bulunamadı' })
  @Post(':conversationId/messages')
  sendMessage(
    @Param('tenantSlug') tenantSlug: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendPublicConversationMessageDto,
  ) {
    return this.conversations.sendMessage(tenantSlug, conversationId, dto);
  }
}
