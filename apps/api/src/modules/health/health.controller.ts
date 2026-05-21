import { createConnection } from 'node:net';
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service.js';

function checkTcpPort(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeoutMs);
    socket.on('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.on('error', () => { clearTimeout(timer); resolve(false); });
  });
}

@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

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
    const checks: Record<string, 'ok' | 'error'> = {};
    const errors: string[] = [];

    // Database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
      errors.push('database');
    }

    // Redis
    try {
      const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
      const url = new URL(redisUrl);
      const redisOk = await checkTcpPort(url.hostname, Number(url.port) || 6379);
      checks.redis = redisOk ? 'ok' : 'error';
      if (!redisOk) errors.push('redis');
    } catch {
      checks.redis = 'error';
      errors.push('redis');
    }

    // ClamAV
    try {
      const clamHost = this.config.get<string>('CLAMAV_HOST') ?? 'localhost';
      const clamPort = Number(this.config.get<string>('CLAMAV_PORT') ?? 3310);
      const clamOk = await checkTcpPort(clamHost, clamPort);
      checks.clamav = clamOk ? 'ok' : 'error';
      if (!clamOk) errors.push('clamav');
    } catch {
      checks.clamav = 'error';
      errors.push('clamav');
    }

    if (errors.length > 0) {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        dependencies: checks,
        errors,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ready',
      dependencies: checks,
      timestamp: new Date().toISOString(),
    };
  }
}
