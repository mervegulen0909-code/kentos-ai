import { Module } from '@nestjs/common';
import { NotificationQueueService } from './notification-queue.service.js';
import { NotificationTemplateService } from './notification-template.service.js';
import { SlaService } from './sla.service.js';
import { TicketNumberService } from './ticket-number.service.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, NotificationQueueService, NotificationTemplateService, SlaService, TicketNumberService],
})
export class TicketsModule {}
