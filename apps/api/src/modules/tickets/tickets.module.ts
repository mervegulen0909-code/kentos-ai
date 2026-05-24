import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { EventsModule } from '../events/events.module.js';
import { CsatQueueService } from './csat-queue.service.js';
import { SlaQueueService } from './sla-queue.service.js';
import { NeighborhoodRoutingService } from './neighborhood-routing.service.js';
import { NotificationQueueService } from './notification-queue.service.js';
import { NotificationTemplateService } from './notification-template.service.js';
import { SlaService } from './sla.service.js';
import { FcmPushService } from './fcm-push.service.js';
import { TicketAiService } from './ticket-ai.service.js';
import { TicketNumberService } from './ticket-number.service.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  imports: [AttachmentsModule, EventsModule],
  controllers: [TicketsController],
  providers: [TicketsService, TicketAiService, FcmPushService, NotificationQueueService, NotificationTemplateService, SlaService, TicketNumberService, CsatQueueService, NeighborhoodRoutingService, SlaQueueService],
})
export class TicketsModule {}
