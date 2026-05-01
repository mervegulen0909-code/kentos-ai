import { Module } from '@nestjs/common';
import { SlaService } from './sla.service.js';
import { TicketNumberService } from './ticket-number.service.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, SlaService, TicketNumberService],
})
export class TicketsModule {}
