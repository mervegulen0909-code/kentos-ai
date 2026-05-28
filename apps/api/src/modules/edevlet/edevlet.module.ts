import { Module } from '@nestjs/common';
import { EdevletController } from './edevlet.controller.js';
import { EdevletService } from './edevlet.service.js';

@Module({
  controllers: [EdevletController],
  providers: [EdevletService],
})
export class EdevletModule {}
