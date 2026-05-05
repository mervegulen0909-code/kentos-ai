import { Module } from '@nestjs/common';
import { PublicChannelGuard } from '../../common/guards/public-channel.guard.js';
import { NotificationQueueService } from '../tickets/notification-queue.service.js';
import { NotificationTemplateService } from '../tickets/notification-template.service.js';
import { SlaService } from '../tickets/sla.service.js';
import { TicketNumberService } from '../tickets/ticket-number.service.js';
import { InternalChannelController } from './internal-channel.controller.js';
import { PublicConversationController } from './public-conversation.controller.js';
import { PublicConversationService } from './public-conversation.service.js';
import { PublicTicketController } from './public-ticket.controller.js';
import { PublicTicketAiService, PublicTicketService } from './public-ticket.service.js';

@Module({
  controllers: [PublicTicketController, PublicConversationController, InternalChannelController],
  providers: [PublicTicketAiService, PublicTicketService, PublicConversationService, PublicChannelGuard, NotificationQueueService, NotificationTemplateService, SlaService, TicketNumberService],
})
export class PublicTicketModule {}
