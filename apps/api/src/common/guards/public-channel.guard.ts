import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import { RateLimitService } from '../services/rate-limit.service.js';
type PublicRequest = {
  header(name: string): string | undefined;
  ip?: string;
  socket: { remoteAddress?: string };
  params?: Record<string, string>;
};

@Injectable()
export class PublicChannelGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<PublicRequest>();
    await this.requireAllowedOrigin(request);
    await this.requireRateLimit(request);
    return true;
  }

  private async requireAllowedOrigin(request: PublicRequest) {
    const origin = request.header('origin');
    if (!origin) return;

    const allowlist = await this.resolveAllowedOrigins(String(request.params?.tenantSlug ?? ''));
    if (!allowlist.length) {
      if (this.isProduction()) throw new ForbiddenException('Widget origin izin listesi yapilandirilmadi.');
      return;
    }
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

  private isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private async requireRateLimit(request: PublicRequest) {
    const limit = Number(this.config.get<string>('PUBLIC_RATE_LIMIT_MAX') ?? 120);
    const windowMs = Number(this.config.get<string>('PUBLIC_RATE_LIMIT_WINDOW_MS') ?? 60_000);
    if (!Number.isFinite(limit) || limit <= 0) return;

    const tenantSlug = String(request.params?.tenantSlug ?? 'unknown');
    const forwardedFor = request.header('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = forwardedFor || request.ip || request.socket.remoteAddress || 'unknown';

    const result = await this.rateLimit.hit('public-channel', `${tenantSlug}:${ip}`, limit, windowMs);
    if (!result.allowed) throw new HttpException('Public kanal istek limiti asildi.', 429);
  }
}
