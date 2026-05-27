import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRedisClient } from '../../common/redis.js';
import type { Redis } from 'ioredis';

const KEY_PREFIX = 'jti:revoked:';
const LOCAL_CACHE_TTL_MS = 30_000;
const LOCAL_CACHE_CLEANUP_INTERVAL_MS = 60_000;

/**
 * Redis-backed JWT token revocation list.
 *
 * Both access and refresh tokens carry a `jti` claim on issuance.
 * On logout, both tokens are added with TTL matching their remaining lifetime.
 * The JwtBlacklistGuard checks this list on every protected request.
 *
 * A 30-second in-memory cache sits in front of Redis to reduce per-request
 * round-trips under high load. Revoked tokens are always written through to Redis.
 */
@Injectable()
export class JwtBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JwtBlacklistService.name);
  private redis!: Redis;
  private readonly localCache = new Map<string, { revoked: boolean; expiresAt: number }>();
  private cleanupTimer!: ReturnType<typeof setInterval>;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.redis = createRedisClient({ lazyConnect: false });
    this.redis.on('error', (err) => this.logger.warn('JWT blacklist Redis error', String(err)));
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.localCache) {
        if (entry.expiresAt <= now) this.localCache.delete(key);
      }
    }, LOCAL_CACHE_CLEANUP_INTERVAL_MS);
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupTimer);
    await this.redis.quit().catch(() => undefined);
  }

  async revoke(jti: string, expiresInSeconds: number): Promise<void> {
    if (expiresInSeconds <= 0) return;
    await this.redis.set(`${KEY_PREFIX}${jti}`, '1', 'EX', expiresInSeconds);
    this.localCache.set(jti, { revoked: true, expiresAt: Date.now() + LOCAL_CACHE_TTL_MS });
  }

  async isRevoked(jti: string): Promise<boolean> {
    const cached = this.localCache.get(jti);
    if (cached && cached.expiresAt > Date.now()) return cached.revoked;

    const result = await this.redis.exists(`${KEY_PREFIX}${jti}`);
    const revoked = result === 1;
    this.localCache.set(jti, { revoked, expiresAt: Date.now() + LOCAL_CACHE_TTL_MS });
    return revoked;
  }
}
