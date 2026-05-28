import { Module } from '@nestjs/common';
import { SocialMonitorController } from './social-monitor.controller.js';
import { SocialMonitorService } from './social-monitor.service.js';

@Module({
  controllers: [SocialMonitorController],
  providers: [SocialMonitorService],
})
export class SocialMonitorModule {}
