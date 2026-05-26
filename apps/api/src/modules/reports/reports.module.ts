import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsQueueService } from './reports-queue.service.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsQueueService],
})
export class ReportsModule {}
