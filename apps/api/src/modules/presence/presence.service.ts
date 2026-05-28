import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { createRedisClient } from '../../common/redis.js';
import type { Redis } from 'ioredis';

const PRESENCE_TTL_SECONDS = 60;

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = createRedisClient();
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  async heartbeat(user: AuthenticatedUser): Promise<{ ok: true; expiresIn: number }> {
    const key = `presence:${user.tenantId}:${user.id}`;
    const payload = JSON.stringify({ userId: user.id, fullName: (user as { fullName?: string }).fullName ?? null });
    await this.redis.setex(key, PRESENCE_TTL_SECONDS, payload).catch((err: unknown) => {
      this.logger.warn(`Presence heartbeat failed: ${String(err)}`);
    });
    return { ok: true, expiresIn: PRESENCE_TTL_SECONDS };
  }

  async listOnline(user: AuthenticatedUser): Promise<Array<{ userId: string; fullName: string | null }>> {
    const pattern = `presence:${user.tenantId}:*`;
    try {
      const keys = await this.redis.keys(pattern);
      if (!keys.length) return [];
      const values = await this.redis.mget(...keys);
      return values.flatMap((v) => {
        if (!v) return [];
        try {
          return [JSON.parse(v) as { userId: string; fullName: string | null }];
        } catch {
          return [];
        }
      });
    } catch (err) {
      this.logger.warn(`Presence list failed: ${String(err)}`);
      return [];
    }
  }
}
