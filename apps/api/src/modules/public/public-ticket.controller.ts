import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { CreatePublicMessageDto } from './dto/create-public-message.dto.js';
import { CreatePublicTicketDto } from './dto/create-public-ticket.dto.js';
import { PublicTicketService } from './public-ticket.service.js';

@Controller('public/:tenantSlug/tickets')
export class PublicTicketController {
  constructor(@Inject(PublicTicketService) private readonly tickets: PublicTicketService) {}

  @Post()
  create(@Param('tenantSlug') tenantSlug: string, @Body() dto: CreatePublicTicketDto) {
    return this.tickets.create(tenantSlug, dto);
  }

  @Get(':ticketNo')
  get(@Param('tenantSlug') tenantSlug: string, @Param('ticketNo') ticketNo: string) {
    return this.tickets.get(tenantSlug, ticketNo);
  }

  @Post(':ticketNo/messages')
  addMessage(
    @Param('tenantSlug') tenantSlug: string,
    @Param('ticketNo') ticketNo: string,
    @Body() dto: CreatePublicMessageDto,
  ) {
    return this.tickets.addMessage(tenantSlug, ticketNo, dto);
  }
}
