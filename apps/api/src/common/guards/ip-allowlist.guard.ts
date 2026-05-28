import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';

function normalizeIp(raw: string): string {
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

function clientIp(req: Record<string, unknown>): string {
  const headers = req['headers'] as Record<string, unknown> | undefined;
  const socket = req['socket'] as { remoteAddress?: string } | undefined;
  const forwarded = headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : (typeof forwarded === 'string' ? forwarded.split(',')[0] : '');
  return normalizeIp((first ?? socket?.remoteAddress ?? '').trim());
}

@Injectable()
export class IpAllowlistGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Record<string, unknown> & { user?: AuthenticatedUser }>();
    const tenantId = req.user?.tenantId;

    if (!tenantId) return true; // auth guard runs first, this guard is secondary

    // Use raw query to avoid Prisma client cache issue (schema updated, client not yet regenerated)
    const rows = await this.prisma.$queryRaw<Array<{ ipAllowlist: unknown }>>`
      SELECT "ipAllowlist" FROM "Tenant" WHERE "id" = ${tenantId} LIMIT 1
    `;

    const allowlist = rows[0]?.ipAllowlist;
    if (!Array.isArray(allowlist) || allowlist.length === 0) return true;

    const ip = clientIp(req);
    const allowed = allowlist.some((entry: unknown) => typeof entry === 'string' && entry.trim() === ip);
    if (!allowed) throw new ForbiddenException(`IP ${ip} bu tenant icin izin listesinde degil.`);

    return true;
  }
}
