import { Controller, Get, Inject, Param } from '@nestjs/common';
import { PublicConversationService } from './public-conversation.service.js';

@Controller('public/:tenantSlug/widget-settings')
export class PublicWidgetController {
  constructor(@Inject(PublicConversationService) private readonly conversations: PublicConversationService) {}

  @Get()
  get(@Param('tenantSlug') tenantSlug: string) {
    return this.conversations.widgetSettings(tenantSlug);
  }
}
