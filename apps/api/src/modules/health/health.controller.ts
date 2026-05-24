import { createConnection } from 'node:net';
import { Controller, Get, Header, Inject, ServiceUnavailableException } from '@nestjs/common';
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

export function shouldRequireClamavReadiness(provider?: string) {
  return provider?.trim().toLowerCase() === 'clamav';
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

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics() {
    const mem = process.memoryUsage();
    const uptimeS = process.uptime();
    const lines: string[] = [];

    const gauge = (name: string, value: number, labels?: Record<string, string>) => {
      const ls = labels ? Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') : '';
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}${ls ? `{${ls}}` : ''} ${value}`);
    };

    const counter = (name: string, value: number, labels?: Record<string, string>) => {
      const ls = labels ? Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') : '';
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}${ls ? `{${ls}}` : ''} ${value}`);
    };

    // Process metrics
    gauge('process_uptime_seconds', uptimeS);
    gauge('process_memory_heap_used_bytes', mem.heapUsed);
    gauge('process_memory_heap_total_bytes', mem.heapTotal);
    gauge('process_memory_rss_bytes', mem.rss);
    lines.push(`# TYPE nodejs_version_info gauge`);
    lines.push(`nodejs_version_info{version="${process.version}"} 1`);

    // Application metrics from DB (best-effort, skip on error)
    try {
      const [ticketCounts, aiRunCount, conversationCount] = await Promise.all([
        this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
          SELECT status, COUNT(*)::bigint AS count FROM "Ticket" GROUP BY status
        `,
        this.prisma.aiRun.count({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
        this.prisma.conversation.count({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
      ]);

      lines.push(`# TYPE kentos_tickets_total gauge`);
      for (const row of ticketCounts) {
        lines.push(`kentos_tickets_total{status="${row.status}"} ${Number(row.count)}`);
      }
      counter('kentos_ai_runs_24h_total', aiRunCount);
      counter('kentos_conversations_24h_total', conversationCount);
    } catch {
      // DB unavailable — emit only process metrics
      gauge('kentos_db_available', 0);
    }

    return lines.join('\n') + '\n';
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, 'ok' | 'error' | 'skipped'> = {};
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

    // ClamAV is a dependency only when attachment scanning is enabled.
    if (shouldRequireClamavReadiness(this.config.get<string>('ATTACHMENT_SCAN_PROVIDER'))) {
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
    } else {
      checks.clamav = 'skipped';
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
