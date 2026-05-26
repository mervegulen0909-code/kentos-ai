import { Body, Controller, Get, Headers, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicConversationService } from './public-conversation.service.js';
import { PublicTicketService } from './public-ticket.service.js';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto.js';

@SkipThrottle()
@Controller('public/:tenantSlug')
export class PublicWidgetController {
  constructor(
    @Inject(PublicConversationService) private readonly conversations: PublicConversationService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PublicTicketService) private readonly tickets: PublicTicketService,
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}

  @Get('widget-settings')
  getSettings(@Param('tenantSlug') tenantSlug: string) {
    return this.conversations.widgetSettings(tenantSlug);
  }

  @Get('widget-status')
  async getStatus(
    @Param('tenantSlug') tenantSlug: string,
    @Headers('origin') origin?: string,
    @Headers('x-probe-origin') probeOrigin?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, status: true, widgetEnabled: true, widgetAllowedOrigins: true },
    });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Belediye bulunamadi.');

    const allowed = Array.isArray(tenant.widgetAllowedOrigins)
      ? tenant.widgetAllowedOrigins.map((value) => String(value)).filter(Boolean)
      : [];
    // Diagnostik: x-probe-origin operator panelinden gelen test origin'i; gercek browser
    // origin'i header'i sabit kalir, probe header gondericiye gore allowlist sonucu
    // doner.
    const effectiveOrigin = probeOrigin?.trim() || origin || null;
    const originAllowed = effectiveOrigin ? allowed.includes(effectiveOrigin) : null;

    return {
      tenantSlug,
      widgetEnabled: tenant.widgetEnabled,
      widgetReady: tenant.widgetEnabled && tenant.status === 'ACTIVE',
      origin: effectiveOrigin,
      originAllowed,
      allowedOriginCount: allowed.length,
      checkedAt: new Date().toISOString(),
    };
  }

  @ApiTags('public / device-tokens')
  @ApiOperation({ summary: 'Mobil push bildirimi için cihaz token kaydı' })
  @Post('device-tokens')
  registerDeviceToken(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.tickets.registerDeviceToken(tenantSlug, dto);
  }

  /**
   * F5 — Şeffaflık Portalı: Kamuya açık, anonim istatistikler.
   * Kişisel veri içermez — sadece aggregate veriler.
   * Cache TTL: 5 dakika.
   */
  @ApiTags('public / transparency')
  @ApiOperation({ summary: 'Belediye şeffaflık istatistikleri (kamuya açık, anonim)' })
  @Get('stats')
  async publicStats(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, status: true },
    });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Belediye bulunamadi.');
    return this.analytics.publicStats(tenant.id);
  }
}
