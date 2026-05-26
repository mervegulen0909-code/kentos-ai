import { Body, Controller, Inject, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service.js';
import { FirebaseAuthDto } from './dto/firebase-auth.dto.js';
import { FirebaseAuthService } from './firebase-auth.service.js';
import { CitizenSessionService } from './citizen-session.service.js';

type CitizenAuthResponse = {
  citizenId: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  sessionToken: string;
};

@ApiTags('public')
@Controller('public/:tenantSlug/auth')
export class PublicFirebaseAuthController {
  constructor(
    @Inject(FirebaseAuthService) private readonly firebaseAuth: FirebaseAuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CitizenSessionService) private readonly sessions: CitizenSessionService,
  ) {}

  /**
   * Firebase ID token'ı doğrular, tenant'a ait vatandaşı bulur veya oluşturur.
   * Dönen citizenId citizen-web'de cookie olarak saklanır.
   */
  @SkipThrottle()
  @Post('firebase')
  async firebaseLogin(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: FirebaseAuthDto,
  ): Promise<CitizenAuthResponse> {
    const decoded = await this.firebaseAuth.verifyIdToken(dto.idToken);

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { slug: tenantSlug },
      select: { id: true },
    });

    // Önce aynı tenant + firebaseUid ile ara
    let citizen = await this.prisma.citizen.findFirst({
      where: { tenantId: tenant.id, firebaseUid: decoded.uid },
      select: { id: true, displayName: true, email: true, phone: true },
    });

    if (!citizen) {
      // Email veya telefon ile eşleşen kayıt var mı?
      const byContact = decoded.email
        ? await this.prisma.citizen.findFirst({
            where: { tenantId: tenant.id, email: decoded.email },
            select: { id: true, displayName: true, email: true, phone: true },
          })
        : decoded.phone
          ? await this.prisma.citizen.findFirst({
              where: { tenantId: tenant.id, phone: decoded.phone },
              select: { id: true, displayName: true, email: true, phone: true },
            })
          : null;

      if (byContact) {
        // Mevcut vatandaşa firebaseUid bağla
        citizen = await this.prisma.citizen.update({
          where: { id: byContact.id },
          data: {
            firebaseUid: decoded.uid,
            displayName: byContact.displayName ?? decoded.name ?? null,
            email: byContact.email ?? decoded.email ?? null,
          },
          select: { id: true, displayName: true, email: true, phone: true },
        });
      } else {
        // Yeni vatandaş oluştur
        citizen = await this.prisma.citizen.create({
          data: {
            tenantId: tenant.id,
            firebaseUid: decoded.uid,
            displayName: decoded.name ?? null,
            email: decoded.email ?? null,
            phone: decoded.phone ?? null,
          },
          select: { id: true, displayName: true, email: true, phone: true },
        });
      }
    }

    return {
      citizenId: citizen.id,
      displayName: citizen.displayName,
      email: citizen.email,
      phone: citizen.phone,
      sessionToken: this.sessions.issue({
        citizenId: citizen.id,
        tenantId: tenant.id,
        tenantSlug,
      }),
    };
  }
}
