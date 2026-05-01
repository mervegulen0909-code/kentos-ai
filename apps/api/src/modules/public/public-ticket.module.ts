import { Module } from '@nestjs/common';
import { SlaService } from '../tickets/sla.service.js';
import { TicketNumberService } from '../tickets/ticket-number.service.js';
import { PublicTicketController } from './public-ticket.controller.js';
import { PublicTicketService } from './public-ticket.service.js';

@Module({
  controllers: [PublicTicketController],
  providers: [PublicTicketService, SlaService, TicketNumberService],
})
export class PublicTicketModule {}
