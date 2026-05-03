import { Module } from '@nestjs/common';
import { NotificationQueueService } from '../tickets/notification-queue.service.js';
import { NotificationTemplateService } from '../tickets/notification-template.service.js';
import { SlaService } from '../tickets/sla.service.js';
import { TicketNumberService } from '../tickets/ticket-number.service.js';
import { PublicTicketController } from './public-ticket.controller.js';
import { PublicTicketService } from './public-ticket.service.js';

@Module({
  controllers: [PublicTicketController],
  providers: [PublicTicketService, NotificationQueueService, NotificationTemplateService, SlaService, TicketNumberService],
})
export class PublicTicketModule {}
