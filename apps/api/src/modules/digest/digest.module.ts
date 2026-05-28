import { Module } from '@nestjs/common';
import { DigestController } from './digest.controller.js';
import { DigestQueueService } from './digest-queue.service.js';
import { DigestService } from './digest.service.js';

@Module({
  controllers: [DigestController],
  providers: [DigestService, DigestQueueService],
  exports: [DigestService],
})
export class DigestModule {}
