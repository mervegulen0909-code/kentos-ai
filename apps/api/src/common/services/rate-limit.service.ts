import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

type RedisLike = {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  pttl(key: string): Promise<number>;
  quit(): Promise<'OK'>;
  on(event: 'error', listener: () => void): void;
};

type RedisConstructor = new (
  url: string,
  options: {
    maxRetriesPerRequest: number;
    enableOfflineQueue: boolean;
    lazyConnect: boolean;
  },
) => RedisLike;

type Bucket = { count: number; resetAt: number };

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  resetAtMs: number;
  source: 'redis' | 'memory';
};

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly memoryBuckets = new Map<string, Bucket>();
  private redis: RedisLike | null = null;
  private redisDisabledUntil = 0;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async hit(scope: string, key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const compositeKey = `kentos:rl:${scope}:${key}`;
    const redis = this.tryGetRedis();
    if (redis) {
      try {
        const count = await redis.incr(compositeKey);
        if (count === 1) await redis.pexpire(compositeKey, windowMs);
        const ttl = await redis.pttl(compositeKey);
        const resetAtMs = now + (ttl > 0 ? ttl : windowMs);
        return {
          allowed: count <= limit,
          count,
          limit,
          resetAtMs,
          source: 'redis',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'redis-error';
        this.logger.warn(`Redis rate-limit hatasi, memory fallback. detay=${message}`);
        this.disableRedisTemporarily();
      }
    }

    const bucket = this.memoryBuckets.get(compositeKey);
    if (!bucket || bucket.resetAt <= now) {
      this.memoryBuckets.set(compositeKey, { count: 1, resetAt: now + windowMs });
      return { allowed: true, count: 1, limit, resetAtMs: now + windowMs, source: 'memory' };
    }
    bucket.count += 1;
    return { allowed: bucket.count <= limit, count: bucket.count, limit, resetAtMs: bucket.resetAt, source: 'memory' };
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit().catch(() => {});
  }

  private tryGetRedis(): RedisLike | null {
    if (Date.now() < this.redisDisabledUntil) return null;
    const url = this.config.get<string>('REDIS_URL');
    if (!url) return null;
    if (!this.redis) {
      try {
        const Redis = require('ioredis') as RedisConstructor;
        this.redis = new Redis(url, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          lazyConnect: false,
        });
        this.redis.on('error', () => this.disableRedisTemporarily());
      } catch (error) {
        this.logger.warn(`Redis baglantisi acilamadi, memory fallback aktif. ${error instanceof Error ? error.message : ''}`);
        this.disableRedisTemporarily();
        return null;
      }
    }
    return this.redis;
  }

  private disableRedisTemporarily() {
    this.redisDisabledUntil = Date.now() + 30_000;
  }
}
