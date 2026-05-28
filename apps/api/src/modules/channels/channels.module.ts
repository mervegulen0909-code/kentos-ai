import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller.js';
import { NotificationSinksService } from './notification-sinks.service.js';
import { WhatsappTemplatesService } from './whatsapp-templates.service.js';

@Module({
  controllers: [ChannelsController],
  providers: [WhatsappTemplatesService, NotificationSinksService],
  exports: [NotificationSinksService],
})
export class ChannelsModule {}
