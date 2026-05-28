import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FaqArticlesService } from '../faq/faq-articles.service.js';
import { AppointmentsService } from '../appointments/appointments.service.js';

@ApiTags('public / faq & appointments')
@Throttle({ default: { ttl: 60_000, limit: 60 } })
@Controller('public/:tenantSlug')
export class PublicFaqAppointmentsController {
  constructor(
    @Inject(FaqArticlesService) private readonly faq: FaqArticlesService,
    @Inject(AppointmentsService) private readonly appointments: AppointmentsService,
  ) {}

  @ApiOperation({ summary: 'Yayınlanmış FAQ makalelerini listele' })
  @Get('faq')
  listFaq(@Param('tenantSlug') tenantSlug: string, @Query('lang') lang?: string) {
    return this.faq.listByTenantSlug(tenantSlug, lang);
  }

  @ApiOperation({ summary: 'Tek FAQ makalesini slug ile getir' })
  @Get('faq/:slug')
  getFaq(
    @Param('tenantSlug') tenantSlug: string,
    @Param('slug') slug: string,
    @Query('lang') lang?: string,
  ) {
    return this.faq.getBySlugForPublic(tenantSlug, slug, lang ?? 'tr');
  }

  @ApiOperation({ summary: 'Müsait randevu slotlarını listele' })
  @Get('appointment-slots')
  availableSlots(
    @Param('tenantSlug') tenantSlug: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.appointments.getAvailableSlotsBySlug(tenantSlug, from, to);
  }

  @ApiOperation({ summary: 'Randevu al' })
  @Post('appointments')
  book(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: { slotId: string; citizenName: string; citizenPhone?: string; note?: string },
  ) {
    return this.appointments.bookByTenantSlug(tenantSlug, undefined, dto);
  }

  @ApiOperation({ summary: 'Randevu iptal et' })
  @Delete('appointments/:id')
  cancel(@Param('tenantSlug') tenantSlug: string, @Param('id') id: string) {
    return this.appointments.cancelByTenantSlug(tenantSlug, id);
  }
}
