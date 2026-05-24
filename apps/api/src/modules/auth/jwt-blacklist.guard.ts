import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtBlacklistService } from './jwt-blacklist.service.js';

type JwtPayload = { jti?: string };

@Injectable()
export class JwtBlacklistGuard implements CanActivate {
  private readonly logger = new Logger(JwtBlacklistGuard.name);

  constructor(private readonly blacklist: JwtBlacklistService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const jti = request.user?.jti;

    if (!jti) return true; // No jti claim → cannot revoke, pass through

    try {
      if (await this.blacklist.isRevoked(jti)) {
        throw new UnauthorizedException('Oturum sonlandirildi. Lutfen yeniden giris yapin.');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      // Redis unavailable — fail open (log warning, allow request)
      this.logger.warn('JWT blacklist check failed (Redis unavailable); allowing request', String(err));
    }

    return true;
  }
}
