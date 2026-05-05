import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type PublicRequest = {
  header(name: string): string | undefined;
  ip?: string;
  socket: { remoteAddress?: string };
  params?: Record<string, string>;
};

type RateLimitBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateLimitBucket>();

@Injectable()
export class PublicChannelGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<PublicRequest>();
    this.requireAllowedOrigin(request);
    this.requireRateLimit(request);
    return true;
  }

  private requireAllowedOrigin(request: PublicRequest) {
    const allowlist = this.config.get<string>('WIDGET_ORIGIN_ALLOWLIST')
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
    if (!allowlist.length) return;

    const origin = request.header('origin');
    if (!origin) return;
    if (allowlist.includes(origin)) return;

    throw new ForbiddenException('Widget origin izin listesinde degil.');
  }

  private requireRateLimit(request: PublicRequest) {
    const limit = Number(this.config.get<string>('PUBLIC_RATE_LIMIT_MAX') ?? 120);
    const windowMs = Number(this.config.get<string>('PUBLIC_RATE_LIMIT_WINDOW_MS') ?? 60_000);
    if (!Number.isFinite(limit) || limit <= 0) return;

    const now = Date.now();
    const tenantSlug = String(request.params?.tenantSlug ?? 'unknown');
    const forwardedFor = request.header('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = forwardedFor || request.ip || request.socket.remoteAddress || 'unknown';
    const key = `${tenantSlug}:${ip}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    bucket.count += 1;
    if (bucket.count > limit) throw new HttpException('Public kanal istek limiti asildi.', 429);
  }
}
