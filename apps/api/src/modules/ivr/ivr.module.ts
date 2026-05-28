import { Module } from '@nestjs/common';
import { IvrController } from './ivr.controller.js';
import { IvrService } from './ivr.service.js';

@Module({
  controllers: [IvrController],
  providers: [IvrService],
})
export class IvrModule {}
