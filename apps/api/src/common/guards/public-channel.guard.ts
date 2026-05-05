import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
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
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<PublicRequest>();
    await this.requireAllowedOrigin(request);
    this.requireRateLimit(request);
    return true;
  }

  private async requireAllowedOrigin(request: PublicRequest) {
    const origin = request.header('origin');
    if (!origin) return;

    const allowlist = await this.resolveAllowedOrigins(String(request.params?.tenantSlug ?? ''));
    if (!allowlist.length) return;
    if (allowlist.includes(origin)) return;

    throw new ForbiddenException('Widget origin izin listesinde degil.');
  }

  private async resolveAllowedOrigins(tenantSlug: string) {
    const envOrigins = this.config.get<string>('WIDGET_ORIGIN_ALLOWLIST')
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
    const tenant = tenantSlug
      ? await this.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { widgetAllowedOrigins: true } })
      : null;
    const tenantOrigins = Array.isArray(tenant?.widgetAllowedOrigins)
      ? tenant.widgetAllowedOrigins.map((origin) => String(origin)).filter(Boolean)
      : [];

    return [...new Set([...envOrigins, ...tenantOrigins])];
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
