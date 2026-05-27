import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RetentionQueueService } from './retention-queue.service.js';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';
import { WebhookQueueService } from './webhook-queue.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TenantsController],
  providers: [TenantsService, RetentionQueueService, WebhookQueueService],
  exports: [RetentionQueueService, WebhookQueueService],
})
export class TenantsModule {}
