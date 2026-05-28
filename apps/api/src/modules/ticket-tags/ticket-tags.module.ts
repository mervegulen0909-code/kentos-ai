import { Module } from '@nestjs/common';
import { TicketTagsController } from './ticket-tags.controller.js';
import { TicketTagsService } from './ticket-tags.service.js';

@Module({
  controllers: [TicketTagsController],
  providers: [TicketTagsService],
})
export class TicketTagsModule {}
