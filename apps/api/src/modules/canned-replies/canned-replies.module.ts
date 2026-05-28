import { Module } from '@nestjs/common';
import { CannedRepliesController } from './canned-replies.controller.js';
import { CannedRepliesService } from './canned-replies.service.js';

@Module({
  controllers: [CannedRepliesController],
  providers: [CannedRepliesService],
})
export class CannedRepliesModule {}
