import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

/**
 * ThrottlerGuard extended to inject X-RateLimit-* response headers on every request.
 *
 * Headers added:
 *   X-RateLimit-Limit     — max requests allowed in the window
 *   X-RateLimit-Remaining — remaining requests in current window
 *   X-RateLimit-Reset     — Unix timestamp (seconds) when the window resets
 *   Retry-After           — seconds until reset, only on 429 responses (added by throwThrottlingException)
 */
@Injectable()
export class ThrottlerWithHeadersGuard extends ThrottlerGuard {
  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, getTracker, generateKey } = requestProps;

    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    const res = context.switchToHttp().getResponse<{ setHeader?: (name: string, value: string) => void }>();

    const tracker = await getTracker(req, context);
    const key = generateKey(context, tracker, throttler.name ?? 'default');

    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(key, ttl, limit, blockDuration ?? 0, throttler.name ?? 'default');

    const remaining = Math.max(0, limit - totalHits);
    const resetInSec = Math.ceil(timeToExpire / 1000);
    const resetAt = Math.floor(Date.now() / 1000) + resetInSec;

    res.setHeader?.('X-RateLimit-Limit', String(limit));
    res.setHeader?.('X-RateLimit-Remaining', String(remaining));
    res.setHeader?.('X-RateLimit-Reset', String(resetAt));

    if (isBlocked) {
      res.setHeader?.('Retry-After', String(Math.ceil(timeToBlockExpire / 1000)));
      await this.throwThrottlingException(context, {
        ttl,
        limit,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    return true;
  }
}
