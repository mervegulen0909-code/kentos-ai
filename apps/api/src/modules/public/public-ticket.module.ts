import { Module } from '@nestjs/common';
import { PublicChannelGuard } from '../../common/guards/public-channel.guard.js';
import { RateLimitService } from '../../common/services/rate-limit.service.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { NotificationQueueService } from '../tickets/notification-queue.service.js';
import { NotificationTemplateService } from '../tickets/notification-template.service.js';
import { SlaService } from '../tickets/sla.service.js';
import { TicketNumberService } from '../tickets/ticket-number.service.js';
import { CitizenIdentityService } from './citizen-identity.service.js';
import { InternalChannelController } from './internal-channel.controller.js';
import { OutboundDispatchService } from './outbound-dispatch.service.js';
import { PublicConversationController } from './public-conversation.controller.js';
import { PublicConversationService } from './public-conversation.service.js';
import { PublicTicketController } from './public-ticket.controller.js';
import { PublicWidgetController } from './public-widget.controller.js';
import { PublicTicketAiService, PublicTicketService } from './public-ticket.service.js';
import { WidgetEmbedController } from './widget-embed.controller.js';

@Module({
  imports: [AttachmentsModule, AnalyticsModule],
  controllers: [PublicTicketController, PublicConversationController, PublicWidgetController, WidgetEmbedController, InternalChannelController],
  providers: [
    PublicTicketAiService,
    PublicTicketService,
    PublicConversationService,
    CitizenIdentityService,
    OutboundDispatchService,
    PublicChannelGuard,
    RateLimitService,
    NotificationQueueService,
    NotificationTemplateService,
    SlaService,
    TicketNumberService,
  ],
})
export class PublicTicketModule {}
