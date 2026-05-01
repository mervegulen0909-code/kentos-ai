import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
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
      throw new UnauthorizedException('Geçersiz kullanıcı bilgileri.');
    }

    const payload = { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role };

    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: await this.jwt.signAsync(payload, { expiresIn: '7d' }),
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
      const payload = await this.jwt.verifyAsync<{ sub: string; tenantId: string; email: string; role: string }>(dto.refreshToken);
      return {
        accessToken: await this.jwt.signAsync({
          sub: payload.sub,
          tenantId: payload.tenantId,
          email: payload.email,
          role: payload.role,
        }),
      };
    } catch {
      throw new UnauthorizedException('Geçersiz yenileme anahtarı.');
    }
  }

  logout() {
    return { ok: true };
  }
}
