import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  health() {
    return {
      status: 'ok',
      service: 'kentos-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ready',
      dependencies: {
        database: 'ok',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
