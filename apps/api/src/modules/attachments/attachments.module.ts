import { Module } from '@nestjs/common';
import { PublicChannelGuard } from '../../common/guards/public-channel.guard.js';
import { RateLimitService } from '../../common/services/rate-limit.service.js';
import { AttachmentMediaQueueService } from './attachment-media-queue.service.js';
import { AttachmentStorageService } from './attachment-storage.service.js';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { PublicAttachmentsController } from './public-attachments.controller.js';

@Module({
  controllers: [AttachmentsController, PublicAttachmentsController],
  providers: [AttachmentsService, AttachmentStorageService, AttachmentMediaQueueService, PublicChannelGuard, RateLimitService],
})
export class AttachmentsModule {}
