import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CitizensService } from './citizens.service.js';
import { CitizensController } from './citizens.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [CitizensController],
  providers: [CitizensService],
  exports: [CitizensService],
})
export class CitizensModule {}
