import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

type TokenType = 'access' | 'refresh';
type AuthTokenPayload = { sub: string; tenantId: string; email: string; role: string; typ: TokenType };

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        isActive: true,
        tenant: { slug: dto.tenantSlug, status: 'ACTIVE' },
      },
      include: { tenant: true },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Gecersiz kullanici bilgileri.');
    }

    const payload = { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role };

    return {
      accessToken: await this.jwt.signAsync({ ...payload, typ: 'access' satisfies TokenType }),
      refreshToken: await this.jwt.signAsync(
        { ...payload, typ: 'refresh' satisfies TokenType },
        { expiresIn: '7d', secret: this.refreshSecret() },
      ),
      user: {
        id: user.id,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async refresh(dto: RefreshDto) {
    try {
      const payload = await this.jwt.verifyAsync<AuthTokenPayload>(dto.refreshToken, { secret: this.refreshSecret() });
      if (payload.typ !== 'refresh') throw new UnauthorizedException('Gecersiz yenileme anahtari.');

      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, isActive: true, tenant: { status: 'ACTIVE' } },
      });
      if (!user) throw new UnauthorizedException('Gecersiz yenileme anahtari.');

      return {
        accessToken: await this.jwt.signAsync({
          sub: user.id,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role,
          typ: 'access' satisfies TokenType,
        }),
      };
    } catch {
      throw new UnauthorizedException('Gecersiz yenileme anahtari.');
    }
  }

  logout() {
    return { ok: true };
  }

  private refreshSecret(): string {
    const refresh = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!refresh) {
      throw new Error('JWT_REFRESH_SECRET must be set in environment variables');
    }
    const access = this.config.get<string>('JWT_ACCESS_SECRET');
    if (refresh === access) {
      throw new Error('JWT_REFRESH_SECRET must be different from JWT_ACCESS_SECRET');
    }
    return refresh;
  }
}
