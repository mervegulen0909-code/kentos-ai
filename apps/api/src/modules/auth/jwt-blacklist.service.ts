import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRedisClient } from '../../common/redis.js';
import type { Redis } from 'ioredis';

const KEY_PREFIX = 'jti:revoked:';

/**
 * Redis-backed JWT token revocation list.
 *
 * Both access and refresh tokens carry a `jti` claim on issuance.
 * On logout, both tokens are added with TTL matching their remaining lifetime.
 * The JwtBlacklistGuard checks this list on every protected request.
 */
@Injectable()
export class JwtBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JwtBlacklistService.name);
  private redis!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.redis = createRedisClient({ lazyConnect: false });
    this.redis.on('error', (err) => this.logger.warn('JWT blacklist Redis error', String(err)));
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  async revoke(jti: string, expiresInSeconds: number): Promise<void> {
    if (expiresInSeconds <= 0) return;
    await this.redis.set(`${KEY_PREFIX}${jti}`, '1', 'EX', expiresInSeconds);
  }

  async isRevoked(jti: string): Promise<boolean> {
    const result = await this.redis.exists(`${KEY_PREFIX}${jti}`);
    return result === 1;
  }
}
