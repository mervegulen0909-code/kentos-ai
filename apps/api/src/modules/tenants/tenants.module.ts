import { Module } from '@nestjs/common';
import { RetentionQueueService } from './retention-queue.service.js';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, RetentionQueueService],
  exports: [RetentionQueueService],
})
export class TenantsModule {}
