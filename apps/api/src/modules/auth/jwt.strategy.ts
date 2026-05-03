import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'development-only-secret',
    });
  }

  async validate(payload: { sub: string; typ?: string }) {
    if (payload.typ !== 'access') throw new UnauthorizedException('Oturum gecersiz.');

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, tenant: { status: 'ACTIVE' } },
      include: { tenant: true },
    });

    if (!user) throw new UnauthorizedException('Oturum gecersiz.');
    return { id: user.id, tenantId: user.tenantId, email: user.email, role: user.role };
  }
}
