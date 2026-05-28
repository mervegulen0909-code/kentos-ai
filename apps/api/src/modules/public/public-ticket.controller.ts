import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicChannelGuard } from '../../common/guards/public-channel.guard.js';
import { CreatePublicMessageDto } from './dto/create-public-message.dto.js';
import { CreatePublicTicketDto } from './dto/create-public-ticket.dto.js';
import { PublicTicketService } from './public-ticket.service.js';

@ApiTags('public / tickets')
// Vatandaş başvurusu — dakikada 30: tekil başvuru formu için yeterli
@Throttle({ default: { ttl: 60_000, limit: 30 } })
@UseGuards(PublicChannelGuard)
@Controller('public/:tenantSlug/tickets')
export class PublicTicketController {
  constructor(@Inject(PublicTicketService) private readonly tickets: PublicTicketService) {}

  @ApiOperation({ summary: 'Vatandaş başvurusu oluştur (AI sınıflandırma ile)' })
  @ApiResponse({ status: 201, description: 'Başvuru alındı — trackingToken dönülür' })
  @ApiResponse({ status: 429, description: 'Rate limit aşıldı' })
  @Post()
  create(@Param('tenantSlug') tenantSlug: string, @Body() dto: CreatePublicTicketDto) {
    return this.tickets.create(tenantSlug, dto);
  }

  @ApiOperation({ summary: 'Takip tokenı ile başvuru sorgula' })
  @ApiResponse({ status: 200, description: 'Başvuru durumu ve mesajları' })
  @ApiResponse({ status: 404, description: 'Başvuru bulunamadı' })
  @Get(':trackingToken')
  get(@Param('tenantSlug') tenantSlug: string, @Param('trackingToken') trackingToken: string) {
    return this.tickets.get(tenantSlug, trackingToken);
  }

  @Post(':trackingToken/messages')
  addMessage(
    @Param('tenantSlug') tenantSlug: string,
    @Param('trackingToken') trackingToken: string,
    @Body() dto: CreatePublicMessageDto,
  ) {
    return this.tickets.addMessage(tenantSlug, trackingToken, dto);
  }

  @ApiOperation({ summary: 'Vatandaş şikayet yükseltme — önceliği artırır' })
  @ApiResponse({ status: 200, description: 'Yükseltme sonucu' })
  @Post(':trackingToken/escalate')
  escalate(
    @Param('tenantSlug') tenantSlug: string,
    @Param('trackingToken') trackingToken: string,
  ) {
    return this.tickets.escalate(tenantSlug, trackingToken);
  }

  @ApiOperation({ summary: 'Ticket zaman çizelgesi — herkese açık durum ve mesaj geçmişi' })
  @ApiResponse({ status: 200, description: 'Kronolojik olaylar listesi' })
  @Get(':trackingToken/timeline')
  timeline(
    @Param('tenantSlug') tenantSlug: string,
    @Param('trackingToken') trackingToken: string,
  ) {
    return this.tickets.timeline(tenantSlug, trackingToken);
  }
}
