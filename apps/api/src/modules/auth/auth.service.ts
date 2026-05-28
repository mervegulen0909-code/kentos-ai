import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { JwtBlacklistService } from './jwt-blacklist.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

type TokenType = 'access' | 'refresh';
type AuthTokenPayload = {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
  typ: TokenType;
  jti: string;
  exp?: number;
};

// TTL constants aligned with token expiresIn
const ACCESS_TTL_S = 15 * 60;       // 15 min
const REFRESH_TTL_S = 7 * 24 * 3600; // 7 days
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(JwtBlacklistService) private readonly blacklist: JwtBlacklistService,
    @Inject(MailService) private readonly mail: MailService,
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

    const basePayload = { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...basePayload, typ: 'access' satisfies TokenType, jti: randomUUID() }),
      this.jwt.signAsync(
        { ...basePayload, typ: 'refresh' satisfies TokenType, jti: randomUUID() },
        { expiresIn: '7d', secret: this.refreshSecret() },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
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
    let payload: AuthTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AuthTokenPayload>(dto.refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Gecersiz yenileme anahtari.');
    }

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Gecersiz yenileme anahtari.');
    }

    // Check if the refresh token has been revoked (e.g., from a previous logout)
    if (await this.blacklist.isRevoked(payload.jti)) {
      throw new UnauthorizedException('Oturum sonlandirildi. Lutfen yeniden giris yapin.');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, tenant: { status: 'ACTIVE' } },
    });
    if (!user) throw new UnauthorizedException('Gecersiz yenileme anahtari.');

    // Revoke old refresh token immediately (one-time use rotation)
    const oldExp = payload.exp ?? 0;
    const remainingTtl = Math.max(0, oldExp - Math.floor(Date.now() / 1000));
    await this.blacklist.revoke(payload.jti, remainingTtl);

    // Issue fresh access + refresh token pair
    const basePayload = { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...basePayload, typ: 'access' satisfies TokenType, jti: randomUUID() }),
      this.jwt.signAsync(
        { ...basePayload, typ: 'refresh' satisfies TokenType, jti: randomUUID() },
        { expiresIn: '7d', secret: this.refreshSecret() },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  async logout(accessToken: string | undefined, refreshToken: string | undefined) {
    const revocations: Promise<void>[] = [];

    if (accessToken) {
      try {
        const payload = this.jwt.decode<AuthTokenPayload>(accessToken);
        if (payload?.jti) {
          const ttl = Math.max(0, (payload.exp ?? 0) - Math.floor(Date.now() / 1000));
          revocations.push(this.blacklist.revoke(payload.jti, ttl || ACCESS_TTL_S));
        }
      } catch { /* ignore decode errors */ }
    }

    if (refreshToken) {
      try {
        const payload = this.jwt.decode<AuthTokenPayload>(refreshToken);
        if (payload?.jti) {
          const ttl = Math.max(0, (payload.exp ?? 0) - Math.floor(Date.now() / 1000));
          revocations.push(this.blacklist.revoke(payload.jti, ttl || REFRESH_TTL_S));
        }
      } catch { /* ignore decode errors */ }
    }

    await Promise.allSettled(revocations);
    return { ok: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
    });

    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const hashedToken = await bcrypt.hash(rawToken, 10);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hashedToken,
          passwordResetExpiry: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });

      await this.mail.sendPasswordReset(user.email, rawToken);
    }

    // Always return success to avoid leaking whether the email exists
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    // Find all users with a non-null reset token that hasn't expired
    const candidates = await this.prisma.user.findMany({
      where: {
        passwordResetToken: { not: null },
        passwordResetExpiry: { gte: new Date() },
        isActive: true,
      },
    });

    let matchedUser: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (candidate.passwordResetToken && await bcrypt.compare(token, candidate.passwordResetToken)) {
        matchedUser = candidate;
        break;
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException('Gecersiz veya suresi dolmus sifirlama anahtari.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

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
