import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * F8 — Tenant-Based Rate Limiting
 *
 * Isolates each tenant's request rate so one tenant cannot saturate the
 * shared API and degrade service for others.
 *
 * Defaults: 300 requests / 60 seconds per tenant.
 * Override per-tenant via env: TENANT_RATE_LIMIT (count) and TENANT_RATE_WINDOW_SEC (window).
 *
 * Skipped for: unauthenticated requests (handled by ThrottlerGuard), SUPER_ADMIN.
 */
@Injectable()
export class TenantThrottleGuard implements CanActivate {
  private readonly logger = new Logger(TenantThrottleGuard.name);
  private readonly limit: number;
  private readonly windowSec: number;
  private _redis?: Redis;

  constructor() {
    this.limit = Number(process.env.TENANT_RATE_LIMIT ?? 300);
    this.windowSec = Number(process.env.TENANT_RATE_WINDOW_SEC ?? 60);
  }

  private redis(): Redis {
    this._redis ??= new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    return this._redis;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { tenantId?: string; role?: string } }>();
    const user = request.user;

    // Skip if no tenant context (unauthed routes handled elsewhere)
    if (!user?.tenantId) return true;
    // SUPER_ADMIN is exempt
    if (user.role === 'SUPER_ADMIN') return true;

    const key = `tenant:ratelimit:${user.tenantId}`;
    try {
      const redis = this.redis();
      const [count] = await redis
        .multi()
        .incr(key)
        .expire(key, this.windowSec)
        .exec() as [[null, number], [null, number]];

      const current = count?.[1] ?? 0;
      if (current > this.limit) {
        this.logger.warn(`Tenant rate limit exceeded`, { tenantId: user.tenantId, count: current, limit: this.limit });
        throw new HttpException(
          { statusCode: 429, message: 'Kiracı istek limiti aşıldı. Lütfen kısa bir süre sonra tekrar deneyin.' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // Redis unavailable — fail open (don't block legitimate traffic)
      this.logger.warn('TenantThrottleGuard Redis error — failing open', { error: String(err) });
    }

    return true;
  }
}
