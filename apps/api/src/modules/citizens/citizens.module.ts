import { Module } from '@nestjs/common';
import { CitizensController } from './citizens.controller.js';
import { CitizensService } from './citizens.service.js';

@Module({
  controllers: [CitizensController],
  providers: [CitizensService],
})
export class CitizensModule {}
